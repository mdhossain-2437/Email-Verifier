"""Tests for the country/TLD and provider classifiers."""

from app.locale import country_for_domain, country_for_host
from app.providers import is_free_provider, provider_for_domain


def test_country_for_simple_cctld():
    assert country_for_domain("acme.de") == ("DE", "Germany")
    assert country_for_domain("acme.fr") == ("FR", "France")
    assert country_for_domain("acme.bd") == ("BD", "Bangladesh")


def test_country_for_multilabel_cctld():
    assert country_for_domain("acme.co.uk") == ("GB", "United Kingdom")
    assert country_for_domain("acme.com.br") == ("BR", "Brazil")
    assert country_for_domain("acme.gov.in") == ("IN", "India")


def test_country_returns_none_for_generic_tlds():
    assert country_for_domain("acme.com") == (None, None)
    assert country_for_domain("acme.io") == (None, None)
    assert country_for_domain("acme.dev") == (None, None)


def test_country_handles_garbage():
    assert country_for_domain("") == (None, None)
    assert country_for_domain("nodot") == (None, None)
    assert country_for_domain(".") == (None, None)


def test_country_for_host_alias_works():
    assert country_for_host("mail.acme.de") == ("DE", "Germany")


def test_provider_for_well_known_free_domains():
    assert provider_for_domain("gmail.com") == "Gmail"
    assert provider_for_domain("outlook.com") == "Outlook"
    assert provider_for_domain("yahoo.co.uk") == "Yahoo"
    assert provider_for_domain("proton.me") == "Proton"


def test_provider_returns_none_for_corporate_domain():
    assert provider_for_domain("acme.com") is None
    assert is_free_provider("acme.com") is False


def test_provider_lookup_is_case_insensitive():
    assert provider_for_domain("Gmail.COM") == "Gmail"
    assert is_free_provider("YAHOO.com") is True
