"""Country / TLD lookup for email domains.

Looks at the public-suffix portion of a domain to infer a likely country.
This is a heuristic — a ``.com`` domain hosted in Sweden will still be
reported as "international" and a ``.co.uk`` domain registered in
California will be reported as "United Kingdom" — but it's a useful free
signal for segmenting bulk-extracted lists by region.

The list is intentionally curated to common ccTLDs only. Generic TLDs
(``.com``, ``.org``, ``.io``, ``.dev``, ``.app``, ...) are reported as
``None`` so callers can clearly distinguish "no country signal" from a
real geographic match.
"""

from __future__ import annotations

# Two-letter ccTLD -> (ISO country code, display name).
# Includes a few historical / common multi-label suffixes (``.co.uk``,
# ``.com.br``, ...) that callers expect to resolve cleanly.
_CCTLDS: dict[str, tuple[str, str]] = {
    # Asia / Pacific
    "bd": ("BD", "Bangladesh"),
    "in": ("IN", "India"),
    "pk": ("PK", "Pakistan"),
    "lk": ("LK", "Sri Lanka"),
    "np": ("NP", "Nepal"),
    "bt": ("BT", "Bhutan"),
    "mv": ("MV", "Maldives"),
    "af": ("AF", "Afghanistan"),
    "cn": ("CN", "China"),
    "hk": ("HK", "Hong Kong"),
    "tw": ("TW", "Taiwan"),
    "jp": ("JP", "Japan"),
    "kr": ("KR", "South Korea"),
    "kp": ("KP", "North Korea"),
    "mn": ("MN", "Mongolia"),
    "id": ("ID", "Indonesia"),
    "my": ("MY", "Malaysia"),
    "sg": ("SG", "Singapore"),
    "th": ("TH", "Thailand"),
    "vn": ("VN", "Vietnam"),
    "ph": ("PH", "Philippines"),
    "kh": ("KH", "Cambodia"),
    "la": ("LA", "Laos"),
    "mm": ("MM", "Myanmar"),
    "au": ("AU", "Australia"),
    "nz": ("NZ", "New Zealand"),
    "fj": ("FJ", "Fiji"),
    # Middle East
    "ae": ("AE", "United Arab Emirates"),
    "sa": ("SA", "Saudi Arabia"),
    "qa": ("QA", "Qatar"),
    "kw": ("KW", "Kuwait"),
    "bh": ("BH", "Bahrain"),
    "om": ("OM", "Oman"),
    "ye": ("YE", "Yemen"),
    "il": ("IL", "Israel"),
    "ps": ("PS", "Palestine"),
    "jo": ("JO", "Jordan"),
    "lb": ("LB", "Lebanon"),
    "sy": ("SY", "Syria"),
    "iq": ("IQ", "Iraq"),
    "ir": ("IR", "Iran"),
    "tr": ("TR", "Turkey"),
    # Europe
    "uk": ("GB", "United Kingdom"),
    "gb": ("GB", "United Kingdom"),
    "ie": ("IE", "Ireland"),
    "fr": ("FR", "France"),
    "de": ("DE", "Germany"),
    "at": ("AT", "Austria"),
    "ch": ("CH", "Switzerland"),
    "li": ("LI", "Liechtenstein"),
    "lu": ("LU", "Luxembourg"),
    "be": ("BE", "Belgium"),
    "nl": ("NL", "Netherlands"),
    "es": ("ES", "Spain"),
    "pt": ("PT", "Portugal"),
    "it": ("IT", "Italy"),
    "sm": ("SM", "San Marino"),
    "va": ("VA", "Vatican City"),
    "mt": ("MT", "Malta"),
    "gr": ("GR", "Greece"),
    "cy": ("CY", "Cyprus"),
    "se": ("SE", "Sweden"),
    "no": ("NO", "Norway"),
    "dk": ("DK", "Denmark"),
    "fi": ("FI", "Finland"),
    "is": ("IS", "Iceland"),
    "ee": ("EE", "Estonia"),
    "lv": ("LV", "Latvia"),
    "lt": ("LT", "Lithuania"),
    "pl": ("PL", "Poland"),
    "cz": ("CZ", "Czechia"),
    "sk": ("SK", "Slovakia"),
    "hu": ("HU", "Hungary"),
    "ro": ("RO", "Romania"),
    "bg": ("BG", "Bulgaria"),
    "si": ("SI", "Slovenia"),
    "hr": ("HR", "Croatia"),
    "rs": ("RS", "Serbia"),
    "ba": ("BA", "Bosnia and Herzegovina"),
    "me": ("ME", "Montenegro"),
    "mk": ("MK", "North Macedonia"),
    "al": ("AL", "Albania"),
    "ua": ("UA", "Ukraine"),
    "by": ("BY", "Belarus"),
    "md": ("MD", "Moldova"),
    "ru": ("RU", "Russia"),
    "ge": ("GE", "Georgia"),
    "am": ("AM", "Armenia"),
    "az": ("AZ", "Azerbaijan"),
    # Americas
    "us": ("US", "United States"),
    "ca": ("CA", "Canada"),
    "mx": ("MX", "Mexico"),
    "br": ("BR", "Brazil"),
    "ar": ("AR", "Argentina"),
    "cl": ("CL", "Chile"),
    "co": ("CO", "Colombia"),
    "pe": ("PE", "Peru"),
    "ve": ("VE", "Venezuela"),
    "uy": ("UY", "Uruguay"),
    "py": ("PY", "Paraguay"),
    "bo": ("BO", "Bolivia"),
    "ec": ("EC", "Ecuador"),
    "cr": ("CR", "Costa Rica"),
    "pa": ("PA", "Panama"),
    "do": ("DO", "Dominican Republic"),
    "gt": ("GT", "Guatemala"),
    "hn": ("HN", "Honduras"),
    "sv": ("SV", "El Salvador"),
    "ni": ("NI", "Nicaragua"),
    "cu": ("CU", "Cuba"),
    "ht": ("HT", "Haiti"),
    "jm": ("JM", "Jamaica"),
    "tt": ("TT", "Trinidad and Tobago"),
    "bs": ("BS", "Bahamas"),
    "bb": ("BB", "Barbados"),
    # Africa
    "eg": ("EG", "Egypt"),
    "ma": ("MA", "Morocco"),
    "dz": ("DZ", "Algeria"),
    "tn": ("TN", "Tunisia"),
    "ly": ("LY", "Libya"),
    "sd": ("SD", "Sudan"),
    "ng": ("NG", "Nigeria"),
    "gh": ("GH", "Ghana"),
    "ke": ("KE", "Kenya"),
    "ug": ("UG", "Uganda"),
    "tz": ("TZ", "Tanzania"),
    "et": ("ET", "Ethiopia"),
    "rw": ("RW", "Rwanda"),
    "za": ("ZA", "South Africa"),
    "zw": ("ZW", "Zimbabwe"),
    "zm": ("ZM", "Zambia"),
    "mz": ("MZ", "Mozambique"),
    "ao": ("AO", "Angola"),
    "ci": ("CI", "Côte d'Ivoire"),
    "sn": ("SN", "Senegal"),
    "cm": ("CM", "Cameroon"),
    "mg": ("MG", "Madagascar"),
    "mu": ("MU", "Mauritius"),
}


def country_for_domain(domain: str) -> tuple[str | None, str | None]:
    """Return ``(iso2, country_name)`` or ``(None, None)`` for a domain.

    Handles common multi-label suffixes (``.co.uk``, ``.com.au``, ...).
    Generic TLDs (``.com``, ``.org``, ``.io``, ``.dev``, ...) return
    ``(None, None)`` so callers can present them as "international".
    """
    if not domain:
        return None, None
    parts = [p for p in domain.lower().split(".") if p]
    if len(parts) < 2:
        return None, None
    last = parts[-1]
    second_last = parts[-2] if len(parts) >= 2 else ""

    # Common patterns: example.co.uk, example.com.br, example.gov.uk
    if second_last in {"co", "com", "net", "org", "gov", "edu", "ac", "or", "ne", "go"}:
        if last in _CCTLDS:
            return _CCTLDS[last]

    if last in _CCTLDS:
        return _CCTLDS[last]
    return None, None


def country_for_host(host: str) -> tuple[str | None, str | None]:
    """Same as :func:`country_for_domain` but applied to MX/A hostnames.

    Useful as a secondary signal — e.g. an ``example.com`` domain whose
    primary MX is ``mail.example.de`` is plausibly German-operated.
    """
    return country_for_domain(host)
