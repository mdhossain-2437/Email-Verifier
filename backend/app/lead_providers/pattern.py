"""Pattern-based email guessing provider.

Wraps the existing ``app.lead_finder`` module as a provider so it
participates in the multi-provider merge. This is the free, zero-config
baseline that always runs.
"""

from __future__ import annotations

from typing import Optional

from ..lead_finder import LeadInput, generate_candidates, verify_lead
from .base import LeadProvider, LeadProviderResult, register


class PatternProvider(LeadProvider):
    name = "pattern"
    requires_api_key = False

    def enabled(self) -> bool:
        return True

    async def find(
        self,
        *,
        domain: str,
        person_name: Optional[str] = None,
        company: Optional[str] = None,
    ) -> list[LeadProviderResult]:
        if not person_name or not domain:
            return []

        lead = LeadInput(name=person_name, company=company, domain=domain)
        result = await verify_lead(lead, check_mx=True, check_smtp=False, max_candidates=8)

        out: list[LeadProviderResult] = []
        for c in result.candidates:
            status = c.verification.status if c.verification else "unknown"
            out.append(
                LeadProviderResult(
                    email=c.email,
                    confidence=c.confidence * (1.5 if status == "valid" else 1.0),
                    source=f"pattern:{c.pattern}",
                )
            )
        return out


register(PatternProvider())
