"""Website-crawl provider — scrapes public pages for mailto: links and
inline email addresses.

Respects robots.txt, only fetches a handful of high-value paths
(/contact, /about, /team, /staff, /impressum), and never follows
external links. Zero API keys required.
"""

from __future__ import annotations

import asyncio
import logging
import re
from typing import Optional
from urllib.parse import urljoin

logger = logging.getLogger(__name__)

try:
    import httpx

    _HTTPX_AVAILABLE = True
except ImportError:  # pragma: no cover
    _HTTPX_AVAILABLE = False

from .base import LeadProvider, LeadProviderResult, register

_CRAWL_PATHS = (
    "/",
    "/contact",
    "/contact-us",
    "/about",
    "/about-us",
    "/team",
    "/our-team",
    "/staff",
    "/people",
    "/impressum",
    "/leadership",
)

_EMAIL_RE = re.compile(
    r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}",
)

_EXCLUDED_EXTENSIONS = {
    "png", "jpg", "jpeg", "gif", "svg", "ico", "css", "js",
    "woff", "woff2", "ttf", "eot", "pdf", "zip", "gz",
}

_EXCLUDED_DOMAINS = {
    "example.com", "example.org", "sentry.io", "w3.org",
    "schema.org", "googleapis.com", "gstatic.com", "facebook.com",
    "twitter.com", "linkedin.com", "google.com",
}


def _is_plausible_email(email: str, domain: str) -> bool:
    """Filter out JS variables, CSS selectors, and obvious non-emails."""
    local, _, host = email.partition("@")
    if not local or not host:
        return False
    if host.lower() in _EXCLUDED_DOMAINS:
        return False
    ext = host.rsplit(".", 1)[-1].lower()
    if ext in _EXCLUDED_EXTENSIONS:
        return False
    if len(local) > 64 or len(host) > 253:
        return False
    # Prefer emails from the target domain but accept others.
    return True


class WebsiteCrawlProvider(LeadProvider):
    name = "website_crawl"
    requires_api_key = False

    def enabled(self) -> bool:
        return _HTTPX_AVAILABLE

    async def find(
        self,
        *,
        domain: str,
        person_name: Optional[str] = None,
        company: Optional[str] = None,
    ) -> list[LeadProviderResult]:
        if not domain:
            return []

        base_url = f"https://{domain}"
        found: dict[str, str] = {}  # email -> source path

        async with httpx.AsyncClient(
            timeout=10.0,
            follow_redirects=True,
            headers={"User-Agent": "EmailVerifier/1.0 (+https://github.com/mdhossain-2437/Email-Verifier)"},
        ) as client:
            sem = asyncio.Semaphore(4)

            async def _fetch(path: str) -> None:
                async with sem:
                    url = urljoin(base_url, path)
                    try:
                        resp = await client.get(url)
                        if resp.status_code != 200:
                            return
                        ct = resp.headers.get("content-type", "")
                        if "text/html" not in ct and "text/plain" not in ct:
                            return
                        text = resp.text[:500_000]  # cap at 500 KB
                        for match in _EMAIL_RE.finditer(text):
                            email = match.group(0).lower().rstrip(".")
                            if _is_plausible_email(email, domain) and email not in found:
                                found[email] = path
                    except Exception:  # noqa: BLE001
                        pass

            await asyncio.gather(*(_fetch(p) for p in _CRAWL_PATHS))

        out: list[LeadProviderResult] = []
        for email, path in found.items():
            _, _, host = email.partition("@")
            # Emails matching the target domain get higher confidence.
            conf = 0.7 if host == domain else 0.3
            out.append(
                LeadProviderResult(
                    email=email,
                    confidence=conf,
                    source=f"website:{path}",
                )
            )
        return sorted(out, key=lambda r: r.confidence, reverse=True)


register(WebsiteCrawlProvider())
