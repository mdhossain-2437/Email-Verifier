"""Hunter.io API provider.

Free tier: 25 domain searches / month, 50 email verifications / month.
Sign up at https://hunter.io/ and paste your API key as the
``HUNTER_API_KEY`` env var.

API docs: https://hunter.io/api-documentation/v2
"""

from __future__ import annotations

import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)

try:
    import httpx

    _HTTPX_AVAILABLE = True
except ImportError:  # pragma: no cover
    _HTTPX_AVAILABLE = False

from .base import LeadProvider, LeadProviderResult, register

_HUNTER_BASE = "https://api.hunter.io/v2"


def _api_key() -> str:
    return os.environ.get("HUNTER_API_KEY", "").strip()


class HunterProvider(LeadProvider):
    name = "hunter"
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

        params: dict[str, str] = {
            "domain": domain,
            "api_key": key,
            "limit": "20",
        }

        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(f"{_HUNTER_BASE}/domain-search", params=params)
            if resp.status_code != 200:
                logger.warning("Hunter API %s: %s", resp.status_code, resp.text[:200])
                return []

            data = resp.json().get("data", {})
            emails = data.get("emails", [])

        out: list[LeadProviderResult] = []
        for entry in emails:
            email = (entry.get("value") or "").lower().strip()
            if not email:
                continue
            conf_raw = entry.get("confidence") or 0
            conf = min(float(conf_raw) / 100.0, 1.0)
            name_parts = []
            if entry.get("first_name"):
                name_parts.append(entry["first_name"])
            if entry.get("last_name"):
                name_parts.append(entry["last_name"])

            out.append(
                LeadProviderResult(
                    email=email,
                    confidence=conf,
                    source="hunter",
                    name=" ".join(name_parts) if name_parts else None,
                    title=entry.get("position") or None,
                )
            )
        return sorted(out, key=lambda r: r.confidence, reverse=True)


register(HunterProvider())
