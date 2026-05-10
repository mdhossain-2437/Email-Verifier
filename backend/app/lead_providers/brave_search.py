"""Brave Search API provider.

Free tier: 2 000 queries / month (no credit card).
Sign up at https://brave.com/search/api/ and paste your API key as the
``BRAVE_SEARCH_API_KEY`` env var.

This provider searches Brave for ``"@domain.com" email`` and extracts
email addresses from the result snippets. It's the legal replacement
for "Google-dork for emails" — Brave explicitly allows API access
and the snippets are fair-use text.
"""

from __future__ import annotations

import logging
import os
import re
from typing import Optional

logger = logging.getLogger(__name__)

try:
    import httpx

    _HTTPX_AVAILABLE = True
except ImportError:  # pragma: no cover
    _HTTPX_AVAILABLE = False

from .base import LeadProvider, LeadProviderResult, register

_BRAVE_SEARCH_URL = "https://api.search.brave.com/res/v1/web/search"

_EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")


def _api_key() -> str:
    return os.environ.get("BRAVE_SEARCH_API_KEY", "").strip()


class BraveSearchProvider(LeadProvider):
    name = "brave_search"
    requires_api_key = True

    def enabled(self) -> bool:
        return _HTTPX_AVAILABLE and bool(_api_key())

    async def find(
        self,
        *,
        domain: str,
        person_name: Optional[str] = None,
        company: Optional[str] = None,
    ) -> list[LeadProviderResult]:
        key = _api_key()
        if not key or not domain:
            return []

        query = f'"@{domain}" email'
        if person_name:
            query = f'"{person_name}" "@{domain}" email'

        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                _BRAVE_SEARCH_URL,
                params={"q": query, "count": "20"},
                headers={
                    "Accept": "application/json",
                    "Accept-Encoding": "gzip",
                    "X-Subscription-Token": key,
                },
            )
            if resp.status_code != 200:
                logger.warning("Brave Search API %s: %s", resp.status_code, resp.text[:200])
                return []

            data = resp.json()

        found: dict[str, str] = {}  # email -> source url
        for result in data.get("web", {}).get("results", []):
            text = " ".join(
                filter(None, [result.get("title", ""), result.get("description", "")])
            )
            url = result.get("url", "")
            for match in _EMAIL_RE.finditer(text):
                email = match.group(0).lower().rstrip(".")
                _, _, host = email.partition("@")
                if host == domain and email not in found:
                    found[email] = url

        out: list[LeadProviderResult] = []
        for email, url in found.items():
            out.append(
                LeadProviderResult(
                    email=email,
                    confidence=0.6,
                    source=f"brave_search:{url[:120]}",
                )
            )
        return sorted(out, key=lambda r: r.confidence, reverse=True)


register(BraveSearchProvider())
