"""Abstract provider interface + global registry."""

from __future__ import annotations

import asyncio
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass
class LeadProviderResult:
    """One email discovered by a provider."""

    email: str
    confidence: float
    source: str  # e.g. "pattern:first.last", "hunter", "website:/contact"
    name: Optional[str] = None
    title: Optional[str] = None


class LeadProvider(ABC):
    """Base class every lead-finding provider inherits from."""

    name: str = ""
    requires_api_key: bool = False

    @abstractmethod
    def enabled(self) -> bool:
        """Return True if this provider has everything it needs to run."""

    @abstractmethod
    async def find(
        self,
        *,
        domain: str,
        person_name: Optional[str] = None,
        company: Optional[str] = None,
    ) -> list[LeadProviderResult]:
        """Return discovered emails for the given domain/person."""


# ---------------------------------------------------------------------------
# Global registry
# ---------------------------------------------------------------------------

_providers: list[LeadProvider] = []


def register(provider: LeadProvider) -> None:
    _providers.append(provider)
    logger.info("Registered lead provider: %s (enabled=%s)", provider.name, provider.enabled())


def registry() -> list[dict]:
    """Return a serialisable list of registered providers + their status."""
    return [
        {
            "name": p.name,
            "enabled": p.enabled(),
            "requires_api_key": p.requires_api_key,
        }
        for p in _providers
    ]


async def find_leads_multi(
    *,
    domain: str,
    person_name: Optional[str] = None,
    company: Optional[str] = None,
    providers: Optional[list[str]] = None,
) -> dict[str, list[LeadProviderResult]]:
    """Run all enabled providers (or a subset) and merge results.

    Returns ``{provider_name: [results]}``."""
    active = [p for p in _providers if p.enabled()]
    if providers:
        wanted = set(providers)
        active = [p for p in active if p.name in wanted]

    async def _run(p: LeadProvider) -> tuple[str, list[LeadProviderResult]]:
        try:
            results = await p.find(domain=domain, person_name=person_name, company=company)
            return p.name, results
        except Exception:  # noqa: BLE001
            logger.exception("Provider %s failed for domain=%s", p.name, domain)
            return p.name, []

    pairs = await asyncio.gather(*(_run(p) for p in active))
    return dict(pairs)
