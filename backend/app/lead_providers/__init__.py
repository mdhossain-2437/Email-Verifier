"""Lead-finding provider abstraction.

Each provider implements the same ``find_leads`` interface so the
``/api/lead-finder`` endpoint can merge results from multiple sources
transparently. Providers are registered at import time and enabled only
when their required configuration (API key, etc.) is present.
"""

from __future__ import annotations

from .base import LeadProvider, LeadProviderResult, registry, find_leads_multi

# Import providers so they self-register.
from . import pattern as _pattern_mod  # noqa: F401
from . import website_crawl as _website_crawl_mod  # noqa: F401
from . import hunter as _hunter_mod  # noqa: F401
from . import brave_search as _brave_mod  # noqa: F401

__all__ = [
    "LeadProvider",
    "LeadProviderResult",
    "registry",
    "find_leads_multi",
]
