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
import smtplib
import socket
from dataclasses import dataclass, asdict, field
from email.utils import parseaddr
from typing import Optional

import dns.asyncresolver
import dns.exception
import dns.rdatatype
import dns.resolver
from email_validator import EmailNotValidError, validate_email

from .disposable import is_disposable, is_role


_RESOLVER = dns.asyncresolver.Resolver()
_RESOLVER.lifetime = 5.0
_RESOLVER.timeout = 3.0

# Per-process caches. These keep bulk verification fast — we only resolve MX
# records once per domain even if 50,000 addresses share a domain.
_MX_CACHE: dict[str, list[tuple[int, str]]] = {}
_DOMAIN_OK_CACHE: dict[str, bool] = {}
_SMTP_PROBE_CACHE: dict[tuple[str, str], "SmtpProbeResult"] = {}


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
    if domain in _MX_CACHE:
        return _MX_CACHE[domain]

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
    _MX_CACHE[domain] = records
    return records


async def _domain_resolves(domain: str) -> bool:
    if domain in _DOMAIN_OK_CACHE:
        return _DOMAIN_OK_CACHE[domain]
    records = await _resolve_mx(domain)
    ok = bool(records)
    _DOMAIN_OK_CACHE[domain] = ok
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
    if cache_key in _SMTP_PROBE_CACHE:
        return _SMTP_PROBE_CACHE[cache_key]

    mx_records = await _resolve_mx(domain)
    if not mx_records:
        result = SmtpProbeResult(
            deliverable=False, code=None, message="no MX records"
        )
        _SMTP_PROBE_CACHE[cache_key] = result
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
    _SMTP_PROBE_CACHE[cache_key] = last_result
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
    result = VerificationResult(
        email=email,
        valid_syntax=True,
        normalized=normalized,
        local_part=local,
        domain=domain,
        is_disposable=is_disposable(domain),
        is_role=is_role(local),
    )

    if result.is_disposable:
        result.status = "risky"
        result.reason = "disposable domain"

    if check_mx:
        mx_records = await _resolve_mx(domain)
        result.has_mx = bool(mx_records)
        result.mx_records = [host for _, host in mx_records]
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
