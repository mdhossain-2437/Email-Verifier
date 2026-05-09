"""Tests for the email extractor."""

from app.extractor import extract_emails, extract_unique


def test_extracts_plain_addresses():
    text = "Contact alice@example.com or bob@example.org for help."
    assert extract_emails(text) == ["alice@example.com", "bob@example.org"]


def test_deduplicates_case_insensitive():
    text = "ada@Example.com ADA@example.com ada@example.com"
    assert extract_emails(text) == ["ada@example.com"]


def test_handles_at_dot_obfuscation():
    text = "ada [at] example [dot] com  and bob (at) example.com  and carol AT example DOT com"
    assert "ada@example.com" in extract_emails(text)
    assert "bob@example.com" in extract_emails(text)
    assert "carol@example.com" in extract_emails(text)


def test_strips_punctuation_and_mailto():
    text = "Visit (mailto:dave@example.io)! Or, eve@example.io. The end."
    extracted = extract_emails(text)
    assert "dave@example.io" in extracted
    assert "eve@example.io" in extracted


def test_ignores_obvious_non_emails():
    text = "not an email: foo@bar @example.com baz@"
    assert extract_emails(text) == []


def test_extract_unique_across_blobs():
    a = "alice@example.com bob@example.com"
    b = "bob@example.com carol@example.com"
    assert extract_unique(a, b) == [
        "alice@example.com",
        "bob@example.com",
        "carol@example.com",
    ]


def test_disable_deobfuscation():
    text = "ada [at] example [dot] com"
    assert extract_emails(text, deobfuscate=False) == []
