"""Lead Finder — pattern-based work-email discovery.

This module exists explicitly *instead of* a Google-dork / LinkedIn-scrape
scraper. We will not build that. Instead, the user supplies the targets they
want to reach (``name`` + ``company`` + ``domain``) and we generate the ~15
most common corporate email patterns and verify them with the same MX / SMTP
pipeline as the rest of the app. This is the legal, auditable equivalent of
what Hunter.io / Apollo / RocketReach do — the user supplies the targets,
we just enumerate plausible local-parts and validate them.

Why ~15 patterns? Anything more is mostly long-tail noise; we rank-order so
that the highest-likelihood pattern (firstname.lastname@) probes first and we
short-circuit as soon as SMTP confirms a deliverable address.
"""

from __future__ import annotations

import asyncio
import re
import unicodedata
from dataclasses import dataclass, field
from typing import Optional

from .verifier import verify_email, VerificationResult

# Ordered by industry-observed prevalence (highest hit-rate first). Each
# pattern is a callable so we can compose mixed-case / single-letter / dotted
# variants without a giant string-format soup.
_PATTERN_BUILDERS: tuple[tuple[str, str], ...] = (
    ("first.last", "{first}.{last}"),
    ("flast", "{f}{last}"),
    ("first", "{first}"),
    ("firstlast", "{first}{last}"),
    ("first_last", "{first}_{last}"),
    ("first-last", "{first}-{last}"),
    ("last.first", "{last}.{first}"),
    ("lastf", "{last}{f}"),
    ("last", "{last}"),
    ("firstl", "{first}{l}"),
    ("f.last", "{f}.{last}"),
    ("first.l", "{first}.{l}"),
    ("fl", "{f}{l}"),
    ("first1", "{first}1"),
    ("firstlast2", "{first}{last}2"),
)

# Confidence weight per pattern (rough industry priors — sum doesn't matter,
# we only use these to rank).
_PATTERN_WEIGHTS: dict[str, float] = {
    "first.last": 0.34,
    "flast": 0.18,
    "first": 0.10,
    "firstlast": 0.07,
    "first_last": 0.05,
    "first-last": 0.04,
    "last.first": 0.04,
    "lastf": 0.03,
    "last": 0.03,
    "firstl": 0.02,
    "f.last": 0.03,
    "first.l": 0.02,
    "fl": 0.02,
    "first1": 0.015,
    "firstlast2": 0.015,
}


@dataclass
class LeadInput:
    """A single target the operator wants to find a work email for."""

    name: str
    company: Optional[str] = None
    domain: str = ""


@dataclass
class CandidateResult:
    pattern: str
    email: str
    confidence: float
    verification: Optional[VerificationResult] = None


@dataclass
class LeadResult:
    """Result for a single ``LeadInput``."""

    input: LeadInput
    candidates: list[CandidateResult] = field(default_factory=list)
    best: Optional[CandidateResult] = None
    notes: list[str] = field(default_factory=list)


def _strip_accents(s: str) -> str:
    """Fold accented characters down to ASCII so 'José' → 'jose'."""
    nfkd = unicodedata.normalize("NFKD", s)
    return "".join(c for c in nfkd if not unicodedata.combining(c))


def _split_name(full_name: str) -> tuple[str, str]:
    """Split 'First Middle Last' into ('first', 'last')."""
    cleaned = _strip_accents((full_name or "").strip()).lower()
    cleaned = re.sub(r"[^\w\s\-']", "", cleaned)
    parts = [p for p in re.split(r"\s+", cleaned) if p]
    if not parts:
        return "", ""
    if len(parts) == 1:
        return parts[0], ""
    return parts[0], parts[-1]


def _normalize_domain(domain: str) -> str:
    d = (domain or "").strip().lower()
    # Strip protocol / path if a URL was pasted.
    d = re.sub(r"^https?://", "", d)
    d = d.split("/", 1)[0]
    d = d.split("@", 1)[-1]  # 'name@example.com' → 'example.com'
    if d.startswith("www."):
        d = d[4:]
    return d


def generate_candidates(lead: LeadInput) -> list[CandidateResult]:
    """Build the ranked list of pattern → email candidates for one lead.

    Returns at most one candidate per *unique* email — patterns that collapse
    to the same string (e.g. single-name targets) are deduplicated.
    """
    first, last = _split_name(lead.name)
    domain = _normalize_domain(lead.domain)
    if not first or not domain:
        return []

    f = first[:1]
    l = last[:1] if last else ""

    seen: set[str] = set()
    out: list[CandidateResult] = []
    for pattern_name, template in _PATTERN_BUILDERS:
        # Skip patterns that depend on a missing last name.
        if not last and ("{last}" in template or "{l}" in template):
            continue
        try:
            local = template.format(first=first, last=last, f=f, l=l)
        except KeyError:
            continue
        local = re.sub(r"[^a-z0-9._\-]", "", local)
        local = local.strip("._-")
        if not local or local in seen:
            continue
        seen.add(local)
        weight = _PATTERN_WEIGHTS.get(pattern_name, 0.01)
        out.append(
            CandidateResult(
                pattern=pattern_name,
                email=f"{local}@{domain}",
                confidence=weight,
            )
        )
    return out


async def verify_lead(
    lead: LeadInput,
    *,
    check_mx: bool = True,
    check_smtp: bool = False,
    concurrency: int = 8,
    max_candidates: int = 8,
) -> LeadResult:
    """Generate candidates for one lead and verify the top ``max_candidates``.

    The candidates are returned in ranked order. ``best`` is the highest-
    confidence candidate that passed verification (status == 'valid'), or the
    top candidate if none verified cleanly.
    """
    candidates = generate_candidates(lead)
    notes: list[str] = []
    if not candidates:
        first, last = _split_name(lead.name)
        domain = _normalize_domain(lead.domain)
        if not first:
            notes.append("name is empty or unparseable")
        if not domain:
            notes.append("domain is empty or unparseable")
        return LeadResult(input=lead, candidates=[], best=None, notes=notes)

    head = candidates[:max_candidates]
    sem = asyncio.Semaphore(concurrency)

    async def _verify(c: CandidateResult) -> CandidateResult:
        async with sem:
            c.verification = await verify_email(
                c.email, check_mx=check_mx, check_smtp=check_smtp
            )
            return c

    head = await asyncio.gather(*(_verify(c) for c in head))

    # Re-rank: domain-confirmed valid > risky > unknown > invalid; ties
    # broken by the original confidence prior. Patterns whose verification
    # failed for "no MX" should drag the whole bucket — if the first
    # candidate has no MX, none of the others will either.
    status_rank = {"valid": 3, "risky": 2, "unknown": 1, "invalid": 0}

    def _score(c: CandidateResult) -> tuple[int, float]:
        s = (c.verification.status if c.verification else "unknown")
        return (status_rank.get(s, 0), c.confidence)

    head.sort(key=_score, reverse=True)
    best = head[0] if head else None

    # Surface a useful note when the whole domain has no MX — it's the
    # difference between "no email exists" and "you typed the domain wrong".
    if (
        head
        and head[0].verification
        and head[0].verification.has_mx is False
    ):
        notes.append(
            f"domain '{_normalize_domain(lead.domain)}' has no MX record — "
            "lead is unreachable via email regardless of pattern"
        )

    return LeadResult(input=lead, candidates=head, best=best, notes=notes)
