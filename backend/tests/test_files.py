"""Tests for multi-format file ingestion."""

from __future__ import annotations

import io
import json

import pytest

from app.files import emails_from_iterable, extract_from_file, file_to_text


def test_txt_extracts_addresses():
    data = b"Hello alice@example.com and bob@example.org!"
    assert extract_from_file("dump.txt", data) == ["alice@example.com", "bob@example.org"]


def test_csv_pulls_from_any_column():
    data = b"name,role,email\nAlice,Admin,alice@example.com\nBob,Eng,bob@example.org\n"
    out = extract_from_file("contacts.csv", data)
    assert out == ["alice@example.com", "bob@example.org"]


def test_csv_handles_semicolon_dialect():
    data = b"id;email;notes\n1;carol@example.com;ok\n2;dave@example.io;n/a\n"
    out = extract_from_file("euro.csv", data)
    assert "carol@example.com" in out
    assert "dave@example.io" in out


def test_json_extracts_from_nested_structure():
    payload = {
        "users": [
            {"name": "Alice", "email": "alice@example.com"},
            {"name": "Bob", "contact": {"primary": "bob@example.org"}},
        ]
    }
    data = json.dumps(payload).encode("utf-8")
    out = extract_from_file("users.json", data)
    assert out == ["alice@example.com", "bob@example.org"]


def test_jsonl_falls_back_when_top_level_invalid():
    data = b'{"email":"a@example.com"}\n{"email":"b@example.com"}\n'
    out = extract_from_file("dump.jsonl", data)
    assert out == ["a@example.com", "b@example.com"]


def test_html_strips_tags_and_finds_addresses():
    data = b'<html><body>Email <a href="mailto:eve@example.com">us</a></body></html>'
    out = extract_from_file("page.html", data)
    assert out == ["eve@example.com"]


def test_eml_treats_headers_as_text():
    data = b"From: alice@example.com\r\nTo: bob@example.org\r\n\r\nbody\r\n"
    out = extract_from_file("note.eml", data)
    assert out == ["alice@example.com", "bob@example.org"]


def test_xlsx_round_trip():
    openpyxl = pytest.importorskip("openpyxl")
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(["Name", "Email", "Note"])
    ws.append(["Alice", "alice@example.com", "VIP"])
    ws.append(["Bob", "bob@example.org", "n/a"])
    buf = io.BytesIO()
    wb.save(buf)
    out = extract_from_file("contacts.xlsx", buf.getvalue())
    assert out == ["alice@example.com", "bob@example.org"]


def test_unknown_extension_falls_back_to_text():
    data = b"contact: anon@example.com"
    out = extract_from_file("mystery.bin", data)
    assert out == ["anon@example.com"]


def test_empty_payload_returns_empty():
    assert extract_from_file("empty.txt", b"") == []


def test_emails_from_iterable_dedupes_and_lowercases():
    out = emails_from_iterable(["Alice@Example.com", "alice@example.com", " ", "BOB@example.com"])
    assert out == ["alice@example.com", "bob@example.com"]


def test_file_to_text_does_not_decode_xlsx_as_text():
    """Sanity check: an xlsx is binary; file_to_text must not return raw bytes."""
    openpyxl = pytest.importorskip("openpyxl")
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(["only-cell@example.com"])
    buf = io.BytesIO()
    wb.save(buf)
    text = file_to_text("x.xlsx", buf.getvalue())
    assert "only-cell@example.com" in text
