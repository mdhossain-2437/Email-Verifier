"""Email extraction utilities.

Extracts email addresses from arbitrary unstructured text. Handles common
obfuscation patterns ("name [at] example [dot] com", "name (at) example.com")
and de-duplicates results while preserving first-seen order.
"""

from __future__ import annotations

import re
from typing import Iterable

# RFC 5322 inspired but pragmatic. We intentionally accept the broad set of
# characters typically allowed in real-world addresses and rely on the verifier
# downstream to reject anything that does not pass strict validation.
_EMAIL_RE = re.compile(
    r"(?<![A-Za-z0-9._%+\-])"
    r"([A-Za-z0-9._%+\-]+)"
    r"@"
    r"([A-Za-z0-9](?:[A-Za-z0-9\-]{0,61}[A-Za-z0-9])?"
    r"(?:\.[A-Za-z0-9](?:[A-Za-z0-9\-]{0,61}[A-Za-z0-9])?)+)"
)

# Common obfuscation patterns. We normalize text *before* running the main
# regex so that "alice [at] example [dot] com" becomes "alice@example.com".
_AT_PATTERNS = [
    re.compile(r"\s*[\[\(\{<]\s*(?:at|AT|At)\s*[\]\)\}>]\s*"),
    re.compile(r"\s+(?:at|AT|At)\s+"),
]
_DOT_PATTERNS = [
    re.compile(r"\s*[\[\(\{<]\s*(?:dot|DOT|Dot)\s*[\]\)\}>]\s*"),
    re.compile(r"\s+(?:dot|DOT|Dot)\s+"),
]


def _deobfuscate(text: str) -> str:
    """Replace common obfuscation patterns with literal '@' and '.'."""
    for pat in _AT_PATTERNS:
        text = pat.sub("@", text)
    for pat in _DOT_PATTERNS:
        text = pat.sub(".", text)
    return text


def extract_emails(text: str, deobfuscate: bool = True) -> list[str]:
    """Extract a de-duplicated list of email addresses from raw text.

    The function is intentionally tolerant: it only ensures the address has
    the structural shape of an email. Use :func:`verify_email` from
    :mod:`app.verifier` for strict validation.
    """
    if not text:
        return []
    if deobfuscate:
        text = _deobfuscate(text)

    seen: set[str] = set()
    results: list[str] = []
    for match in _EMAIL_RE.finditer(text):
        local, domain = match.group(1), match.group(2)
        email = f"{local}@{domain}".rstrip(".").lower()
        if email in seen:
            continue
        seen.add(email)
        results.append(email)
    return results


def extract_unique(*texts: str) -> list[str]:
    """Extract emails from multiple text blobs while preserving order."""
    seen: set[str] = set()
    out: list[str] = []
    for blob in texts:
        for email in extract_emails(blob):
            if email not in seen:
                seen.add(email)
                out.append(email)
    return out


def chunk(items: Iterable[str], size: int) -> Iterable[list[str]]:
    """Yield successive chunks of ``size`` from ``items``."""
    batch: list[str] = []
    for item in items:
        batch.append(item)
        if len(batch) >= size:
            yield batch
            batch = []
    if batch:
        yield batch
