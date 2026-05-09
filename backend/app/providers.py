"""Free / consumer mailbox provider classification.

Distinguishes free webmail addresses (``gmail.com``, ``yahoo.com``,
``outlook.com``, ...) from "work" / corporate domains. Useful for B2B
filtering: most outbound campaigns want to skip personal mailboxes and
focus on company addresses.

This list intentionally only covers the highest-volume providers
worldwide. Anything not on this list is reported as a "work" mailbox,
which is the safe default for B2B segmentation.
"""

from __future__ import annotations

FREE_PROVIDERS: dict[str, str] = {
    # Google
    "gmail.com": "Gmail",
    "googlemail.com": "Gmail",
    # Microsoft
    "outlook.com": "Outlook",
    "outlook.co.uk": "Outlook",
    "outlook.in": "Outlook",
    "outlook.de": "Outlook",
    "outlook.fr": "Outlook",
    "outlook.es": "Outlook",
    "outlook.it": "Outlook",
    "outlook.com.br": "Outlook",
    "hotmail.com": "Hotmail",
    "hotmail.co.uk": "Hotmail",
    "hotmail.fr": "Hotmail",
    "hotmail.de": "Hotmail",
    "hotmail.it": "Hotmail",
    "hotmail.es": "Hotmail",
    "live.com": "Live",
    "live.co.uk": "Live",
    "live.fr": "Live",
    "live.de": "Live",
    "msn.com": "MSN",
    # Yahoo
    "yahoo.com": "Yahoo",
    "yahoo.co.uk": "Yahoo",
    "yahoo.co.in": "Yahoo",
    "yahoo.in": "Yahoo",
    "yahoo.fr": "Yahoo",
    "yahoo.de": "Yahoo",
    "yahoo.es": "Yahoo",
    "yahoo.it": "Yahoo",
    "yahoo.com.br": "Yahoo",
    "yahoo.com.mx": "Yahoo",
    "yahoo.ca": "Yahoo",
    "yahoo.com.au": "Yahoo",
    "yahoo.com.sg": "Yahoo",
    "yahoo.com.ph": "Yahoo",
    "yahoo.com.hk": "Yahoo",
    "yahoo.com.tw": "Yahoo",
    "yahoo.co.jp": "Yahoo",
    "ymail.com": "Yahoo",
    "rocketmail.com": "Yahoo",
    # Apple
    "icloud.com": "iCloud",
    "me.com": "iCloud",
    "mac.com": "iCloud",
    # AOL
    "aol.com": "AOL",
    "aol.co.uk": "AOL",
    "aol.de": "AOL",
    "aol.fr": "AOL",
    # Proton
    "proton.me": "Proton",
    "protonmail.com": "Proton",
    "protonmail.ch": "Proton",
    "pm.me": "Proton",
    # Privacy / forwarding
    "tutanota.com": "Tutanota",
    "tutanota.de": "Tutanota",
    "tuta.io": "Tutanota",
    "fastmail.com": "Fastmail",
    "fastmail.fm": "Fastmail",
    "hey.com": "Hey",
    "duck.com": "DuckDuckGo",
    # Russia / CIS
    "yandex.ru": "Yandex",
    "yandex.com": "Yandex",
    "yandex.kz": "Yandex",
    "yandex.by": "Yandex",
    "yandex.ua": "Yandex",
    "ya.ru": "Yandex",
    "mail.ru": "Mail.ru",
    "list.ru": "Mail.ru",
    "bk.ru": "Mail.ru",
    "inbox.ru": "Mail.ru",
    "rambler.ru": "Rambler",
    # China
    "qq.com": "Tencent QQ",
    "163.com": "NetEase 163",
    "126.com": "NetEase 126",
    "sina.com": "Sina",
    "sina.cn": "Sina",
    "sohu.com": "Sohu",
    # India / SE Asia
    "rediffmail.com": "Rediffmail",
    "rediff.com": "Rediffmail",
    # Germany
    "gmx.de": "GMX",
    "gmx.com": "GMX",
    "gmx.net": "GMX",
    "web.de": "WEB.DE",
    "t-online.de": "T-Online",
    "freenet.de": "Freenet",
    # France
    "orange.fr": "Orange",
    "wanadoo.fr": "Orange",
    "laposte.net": "La Poste",
    "free.fr": "Free",
    "sfr.fr": "SFR",
    # UK
    "btinternet.com": "BT",
    "sky.com": "Sky",
    "virginmedia.com": "Virgin",
    "ntlworld.com": "Virgin",
    # Brazil / LatAm
    "uol.com.br": "UOL",
    "bol.com.br": "UOL",
    "terra.com.br": "Terra",
    "ig.com.br": "iG",
    "globo.com": "Globo",
    "globomail.com": "Globo",
    # Japan
    "nifty.com": "Nifty",
    "ezweb.ne.jp": "au",
    "docomo.ne.jp": "DOCOMO",
    "softbank.ne.jp": "SoftBank",
    # Misc / global
    "zoho.com": "Zoho",
    "zohomail.com": "Zoho",
    "mailbox.org": "Mailbox.org",
    "posteo.de": "Posteo",
    "posteo.net": "Posteo",
    "runbox.com": "Runbox",
}


def provider_for_domain(domain: str) -> str | None:
    """Return the friendly provider name for a free webmail domain, else
    ``None`` (which callers should treat as a "work" / corporate mailbox)."""
    return FREE_PROVIDERS.get((domain or "").lower())


def is_free_provider(domain: str) -> bool:
    return provider_for_domain(domain) is not None
