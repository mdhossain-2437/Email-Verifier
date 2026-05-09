"""Email verification.

Performs four levels of verification, each progressively stricter and slower:

1. **Syntax** — RFC 5322-style validation via :mod:`email_validator`.
2. **Domain** — checks that the domain has DNS records and resolves.
3. **MX** — fetches MX records (or falls back to A/AAAA per RFC 5321 §5).
4. **SMTP** — opens an SMTP connection to the highest-priority MX and issues
   ``MAIL FROM`` / ``RCPT TO`` commands without sending data. Many providers
   (Gmail, Yahoo) implement greylisting and refuse to confirm individual
   addresses, so we treat ambiguous responses as "unknown" rather than
   "invalid". Extensive caching is applied at the domain level to keep
   bulk-verification fast.
"""

from __future__ import annotations

import asyncio
import hashlib
import os
import smtplib
import socket
import time
from collections import OrderedDict
from dataclasses import dataclass, asdict, field
from email.utils import parseaddr
from typing import Generic, Hashable, Optional, TypeVar

import dns.asyncresolver
import dns.exception
import dns.rdatatype
import dns.resolver
from email_validator import EmailNotValidError, validate_email

from .disposable import is_disposable, is_role
from .locale import country_for_domain, country_for_host
from .providers import provider_for_domain


_RESOLVER = dns.asyncresolver.Resolver()
_RESOLVER.lifetime = 5.0
_RESOLVER.timeout = 3.0


# ---------------------------------------------------------------------------
# Bounded TTL cache
# ---------------------------------------------------------------------------
#
# A long-running verifier sees thousands of unique domains over time. The
# original implementation used unbounded ``dict``s which (a) leaked memory
# slowly and (b) never refreshed stale DNS / SMTP results. This tiny
# in-process cache caps both axes: a max-size LRU plus a per-entry TTL,
# good enough that we don't need to pull cachetools in for one use.

_K = TypeVar("_K", bound=Hashable)
_V = TypeVar("_V")


class _TTLCache(Generic[_K, _V]):
    def __init__(self, *, maxsize: int, ttl: float) -> None:
        self._maxsize = max(1, int(maxsize))
        self._ttl = max(0.0, float(ttl))
        # Single-threaded access via the asyncio event loop — no explicit
        # lock needed. The OrderedDict gives us O(1) LRU touches on read.
        self._data: "OrderedDict[_K, tuple[float, _V]]" = OrderedDict()

    def get(self, key: _K) -> Optional[_V]:
        entry = self._data.get(key)
        if entry is None:
            return None
        expires_at, value = entry
        if self._ttl and expires_at < time.monotonic():
            # Expired — drop and miss.
            self._data.pop(key, None)
            return None
        # LRU touch.
        self._data.move_to_end(key)
        return value

    def set(self, key: _K, value: _V) -> None:
        expires_at = time.monotonic() + self._ttl if self._ttl else float("inf")
        if key in self._data:
            self._data.move_to_end(key)
        self._data[key] = (expires_at, value)
        while len(self._data) > self._maxsize:
            self._data.popitem(last=False)

    def clear(self) -> None:
        self._data.clear()

    def __len__(self) -> int:  # pragma: no cover - trivial
        return len(self._data)


def _env_int(name: str, default: int) -> int:
    raw = os.environ.get(name, "").strip()
    if not raw:
        return default
    try:
        value = int(raw)
    except ValueError:
        return default
    return value if value > 0 else default


# Tunables. Defaults sized for a single-VPS install resolving up to a few
# thousand unique domains per session. Operators can override via env.
_MX_CACHE_TTL = _env_int("EMAIL_VERIFIER_MX_CACHE_TTL", 600)        # 10 min
_DOMAIN_CACHE_TTL = _env_int("EMAIL_VERIFIER_DOMAIN_CACHE_TTL", 600)
_SMTP_CACHE_TTL = _env_int("EMAIL_VERIFIER_SMTP_CACHE_TTL", 300)    # 5 min
_CACHE_MAXSIZE = _env_int("EMAIL_VERIFIER_CACHE_MAXSIZE", 10_000)

# Per-process caches. These keep bulk verification fast — we only resolve MX
# records once per domain even if 50,000 addresses share a domain.
_MX_CACHE: _TTLCache[str, list[tuple[int, str]]] = _TTLCache(
    maxsize=_CACHE_MAXSIZE, ttl=float(_MX_CACHE_TTL)
)
_DOMAIN_OK_CACHE: _TTLCache[str, bool] = _TTLCache(
    maxsize=_CACHE_MAXSIZE, ttl=float(_DOMAIN_CACHE_TTL)
)
_SMTP_PROBE_CACHE: _TTLCache[tuple[str, str], "SmtpProbeResult"] = _TTLCache(
    maxsize=_CACHE_MAXSIZE, ttl=float(_SMTP_CACHE_TTL)
)


def _reset_caches_for_tests() -> None:
    """Test-only helper. Wipes all verifier caches so test ordering can't
    leak DNS results from a prior test into a later one."""
    _MX_CACHE.clear()
    _DOMAIN_OK_CACHE.clear()
    _SMTP_PROBE_CACHE.clear()


@dataclass
class SmtpProbeResult:
    deliverable: Optional[bool]
    code: Optional[int]
    message: Optional[str]
    catch_all: Optional[bool] = None


@dataclass
class VerificationResult:
    email: str
    valid_syntax: bool
    normalized: Optional[str] = None
    local_part: Optional[str] = None
    domain: Optional[str] = None
    is_disposable: bool = False
    is_role: bool = False
    is_free_provider: bool = False
    provider: Optional[str] = None
    country_code: Optional[str] = None
    country_name: Optional[str] = None
    mx_country_code: Optional[str] = None
    mx_country_name: Optional[str] = None
    gravatar_url: Optional[str] = None
    has_mx: Optional[bool] = None
    mx_records: list[str] = field(default_factory=list)
    smtp_deliverable: Optional[bool] = None
    smtp_catch_all: Optional[bool] = None
    smtp_code: Optional[int] = None
    smtp_message: Optional[str] = None
    status: str = "unknown"  # one of: valid, invalid, risky, unknown
    reason: Optional[str] = None
    duration_ms: float = 0.0

    def to_dict(self) -> dict:
        return asdict(self)


def _gravatar_url(email: str) -> str:
    """Construct the public Gravatar URL for an address.

    No network call is made — Gravatar's URL scheme (md5 of the lowercase
    address) is deterministic, so callers can pre-compute the URL and let
    the browser fall back to the default avatar if no profile exists. This
    makes the bulk-verifier dramatically faster than tools that probe
    Gravatar's servers per-row.
    """
    digest = hashlib.md5(email.strip().lower().encode("utf-8")).hexdigest()
    return f"https://www.gravatar.com/avatar/{digest}?d=404"


# ---------------------------------------------------------------------------
# Syntax & normalization
# ---------------------------------------------------------------------------


def _split_address(email: str) -> tuple[str, str]:
    """Best-effort split into (local_part, domain). Falls back to empty
    strings if the address is malformed."""
    _, addr = parseaddr(email)
    if "@" not in addr:
        return "", ""
    local, _, domain = addr.rpartition("@")
    return local, domain.lower()


def _check_syntax(email: str) -> tuple[bool, Optional[str], Optional[str]]:
    """Return ``(is_valid, normalized_email, error_message)``."""
    try:
        info = validate_email(
            email,
            check_deliverability=False,
            allow_smtputf8=True,
            allow_quoted_local=True,
        )
        return True, info.normalized, None
    except EmailNotValidError as exc:
        return False, None, str(exc)


# ---------------------------------------------------------------------------
# DNS / MX
# ---------------------------------------------------------------------------


async def _resolve_mx(domain: str) -> list[tuple[int, str]]:
    """Resolve MX records for ``domain``. Falls back to A/AAAA per RFC 5321
    when no MX records are published. Result is cached per domain."""
    cached = _MX_CACHE.get(domain)
    if cached is not None:
        return cached

    records: list[tuple[int, str]] = []
    try:
        answer = await _RESOLVER.resolve(domain, dns.rdatatype.MX)
        for rdata in answer:
            host = str(rdata.exchange).rstrip(".").lower()
            records.append((int(rdata.preference), host))
    except (dns.resolver.NoAnswer, dns.resolver.NXDOMAIN):
        pass
    except (dns.exception.DNSException, OSError):
        pass

    if not records:
        # RFC 5321 §5.1 — fall back to implicit MX (A / AAAA) if no MX exists.
        for rdtype in (dns.rdatatype.A, dns.rdatatype.AAAA):
            try:
                answer = await _RESOLVER.resolve(domain, rdtype)
                if answer:
                    records.append((0, domain))
                    break
            except (dns.exception.DNSException, OSError):
                continue

    records.sort(key=lambda r: r[0])
    _MX_CACHE.set(domain, records)
    return records


async def _domain_resolves(domain: str) -> bool:
    cached = _DOMAIN_OK_CACHE.get(domain)
    if cached is not None:
        return cached
    records = await _resolve_mx(domain)
    ok = bool(records)
    _DOMAIN_OK_CACHE.set(domain, ok)
    return ok


# ---------------------------------------------------------------------------
# SMTP probe
# ---------------------------------------------------------------------------


def _smtp_probe_sync(
    host: str,
    email: str,
    helo_domain: str,
    sender: str,
    timeout: float,
) -> SmtpProbeResult:
    """Synchronous SMTP probe. Run via ``run_in_executor`` so the asyncio
    loop is not blocked by socket I/O."""
    try:
        with smtplib.SMTP(timeout=timeout) as smtp:
            smtp.connect(host, 25)
            smtp.ehlo_or_helo_if_needed()
            try:
                smtp.ehlo(helo_domain)
            except smtplib.SMTPException:
                smtp.helo(helo_domain)
            code, msg_bytes = smtp.mail(sender)
            if code >= 400:
                return SmtpProbeResult(
                    deliverable=None,
                    code=code,
                    message=msg_bytes.decode(errors="replace"),
                )
            code, msg_bytes = smtp.rcpt(email)
            text = msg_bytes.decode(errors="replace")
            try:
                smtp.quit()
            except smtplib.SMTPException:
                pass
            if 200 <= code < 300:
                return SmtpProbeResult(deliverable=True, code=code, message=text)
            if 500 <= code < 600:
                return SmtpProbeResult(deliverable=False, code=code, message=text)
            # 4xx — temporary failure / greylisting
            return SmtpProbeResult(deliverable=None, code=code, message=text)
    except (socket.timeout, smtplib.SMTPServerDisconnected, smtplib.SMTPConnectError):
        return SmtpProbeResult(deliverable=None, code=None, message="smtp timeout")
    except (smtplib.SMTPException, OSError) as exc:
        return SmtpProbeResult(deliverable=None, code=None, message=str(exc))


async def _smtp_probe(
    domain: str,
    email: str,
    *,
    helo_domain: str,
    sender: str,
    timeout: float,
) -> SmtpProbeResult:
    cache_key = (domain, email)
    cached = _SMTP_PROBE_CACHE.get(cache_key)
    if cached is not None:
        return cached

    mx_records = await _resolve_mx(domain)
    if not mx_records:
        result = SmtpProbeResult(
            deliverable=False, code=None, message="no MX records"
        )
        _SMTP_PROBE_CACHE.set(cache_key, result)
        return result

    loop = asyncio.get_running_loop()
    last_result = SmtpProbeResult(deliverable=None, code=None, message="no MX reachable")
    for _, host in mx_records[:3]:
        last_result = await loop.run_in_executor(
            None,
            _smtp_probe_sync,
            host,
            email,
            helo_domain,
            sender,
            timeout,
        )
        if last_result.deliverable is not None:
            break
    _SMTP_PROBE_CACHE.set(cache_key, last_result)
    return last_result


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------


async def verify_email(
    email: str,
    *,
    check_mx: bool = True,
    check_smtp: bool = False,
    helo_domain: str = "verifier.local",
    sender: str = "verify@verifier.local",
    smtp_timeout: float = 8.0,
) -> VerificationResult:
    """Run the full verification pipeline against ``email``."""
    loop = asyncio.get_running_loop()
    started = loop.time()
    email = (email or "").strip()

    syntax_ok, normalized, err = _check_syntax(email)
    if not syntax_ok or not normalized:
        local, domain = _split_address(email)
        return VerificationResult(
            email=email,
            valid_syntax=False,
            local_part=local or None,
            domain=domain or None,
            status="invalid",
            reason=err or "invalid syntax",
            duration_ms=(loop.time() - started) * 1000,
        )

    local, domain = _split_address(normalized)
    provider = provider_for_domain(domain)
    cc, cn = country_for_domain(domain)
    result = VerificationResult(
        email=email,
        valid_syntax=True,
        normalized=normalized,
        local_part=local,
        domain=domain,
        is_disposable=is_disposable(domain),
        is_role=is_role(local),
        is_free_provider=provider is not None,
        provider=provider,
        country_code=cc,
        country_name=cn,
        gravatar_url=_gravatar_url(normalized),
    )

    if result.is_disposable:
        result.status = "risky"
        result.reason = "disposable domain"

    if check_mx:
        mx_records = await _resolve_mx(domain)
        result.has_mx = bool(mx_records)
        result.mx_records = [host for _, host in mx_records]
        if mx_records:
            primary = mx_records[0][1]
            mx_cc, mx_cn = country_for_host(primary)
            if mx_cc:
                result.mx_country_code = mx_cc
                result.mx_country_name = mx_cn
                # Promote MX-based country signal when the domain itself
                # is on a generic TLD (.com / .io / etc.) that gave us no
                # geographic clue.
                if not result.country_code:
                    result.country_code = mx_cc
                    result.country_name = mx_cn
        if not mx_records:
            result.status = "invalid"
            result.reason = "no MX or A record for domain"
            result.duration_ms = (loop.time() - started) * 1000
            return result

    if check_smtp and result.has_mx is not False:
        probe = await _smtp_probe(
            domain,
            normalized,
            helo_domain=helo_domain,
            sender=sender,
            timeout=smtp_timeout,
        )
        result.smtp_deliverable = probe.deliverable
        result.smtp_code = probe.code
        result.smtp_message = probe.message
        if probe.deliverable is True:
            if result.status != "risky":
                result.status = "valid"
                result.reason = "SMTP accepted RCPT TO"
        elif probe.deliverable is False:
            result.status = "invalid"
            result.reason = probe.message or "SMTP rejected RCPT TO"
        else:
            if result.status not in {"risky", "invalid"}:
                result.status = "unknown"
                result.reason = probe.message or "SMTP probe inconclusive"

    if result.status == "unknown" and result.has_mx and not check_smtp:
        # If the caller did not request an SMTP probe, the best we can say is
        # that the address is structurally valid and the domain accepts mail.
        result.status = "valid"
        if result.is_role:
            result.status = "risky"
            result.reason = "role account"
        else:
            result.reason = "syntax + MX ok"
    elif result.status == "unknown" and not check_mx:
        result.status = "valid"
        result.reason = "syntax ok (MX/SMTP not checked)"

    if result.is_role and result.status == "valid":
        result.status = "risky"
        result.reason = "role account"

    result.duration_ms = (loop.time() - started) * 1000
    return result


async def verify_many(
    emails: list[str],
    *,
    check_mx: bool = True,
    check_smtp: bool = False,
    concurrency: int = 16,
    helo_domain: str = "verifier.local",
    sender: str = "verify@verifier.local",
    smtp_timeout: float = 8.0,
) -> list[VerificationResult]:
    """Verify many emails concurrently with a bounded semaphore."""
    sem = asyncio.Semaphore(concurrency)

    async def _one(addr: str) -> VerificationResult:
        async with sem:
            return await verify_email(
                addr,
                check_mx=check_mx,
                check_smtp=check_smtp,
                helo_domain=helo_domain,
                sender=sender,
                smtp_timeout=smtp_timeout,
            )

    return await asyncio.gather(*(_one(e) for e in emails))


def reset_caches() -> None:
    """Clear all caches. Mostly useful for tests."""
    _MX_CACHE.clear()
    _DOMAIN_OK_CACHE.clear()
    _SMTP_PROBE_CACHE.clear()
