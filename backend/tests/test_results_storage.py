"""Unit tests for results_storage module.

These tests mock firebase_admin.storage so they run without real
credentials / a real bucket. The integration test in
``test_results_storage_multi_machine.py`` covers the end-to-end flow
through main.py.
"""

from __future__ import annotations

import gzip
import json
from typing import Any
from unittest.mock import MagicMock, patch

import pytest


@pytest.fixture
def fake_bucket():
    """Return a (bucket, blob) pair that records all upload/download calls."""
    bucket = MagicMock(name="bucket")
    blob = MagicMock(name="blob")
    bucket.blob.return_value = blob
    blob.exists.return_value = False
    return bucket, blob


def test_upload_results_returns_false_without_uid(fake_bucket):
    from app import results_storage

    bucket, _ = fake_bucket
    with patch.object(results_storage, "_bucket", return_value=bucket):
        ok = results_storage.upload_results("job-1", uid=None, results=[{"a": 1}])
    assert ok is False
    bucket.blob.assert_not_called()


def test_upload_results_returns_false_with_empty_results(fake_bucket):
    from app import results_storage

    bucket, _ = fake_bucket
    with patch.object(results_storage, "_bucket", return_value=bucket):
        ok = results_storage.upload_results("job-1", uid="alice", results=[])
    assert ok is False
    bucket.blob.assert_not_called()


def test_upload_results_returns_false_when_storage_unavailable():
    from app import results_storage

    with patch.object(results_storage, "_bucket", return_value=None):
        ok = results_storage.upload_results("job-1", uid="alice", results=[{"a": 1}])
    assert ok is False


def test_upload_results_writes_gzipped_json(fake_bucket):
    from app import results_storage

    bucket, blob = fake_bucket
    payload = [{"email": "a@b.com", "status": "valid"}, {"email": "c@d.com", "status": "invalid"}]
    with patch.object(results_storage, "_bucket", return_value=bucket):
        ok = results_storage.upload_results("job-1", uid="alice", results=payload)
    assert ok is True
    bucket.blob.assert_called_once_with("jobs/alice/job-1.json.gz")
    # upload_from_string was called with gzipped bytes
    args, kwargs = blob.upload_from_string.call_args
    body = args[0]
    decompressed = gzip.decompress(body)
    assert json.loads(decompressed.decode("utf-8")) == payload
    assert kwargs.get("content_type") == "application/json"


def test_upload_results_swallows_storage_exception(fake_bucket):
    from app import results_storage

    bucket, blob = fake_bucket
    blob.upload_from_string.side_effect = RuntimeError("network blip")
    with patch.object(results_storage, "_bucket", return_value=bucket):
        ok = results_storage.upload_results("job-1", uid="alice", results=[{"a": 1}])
    assert ok is False  # not raised


def test_download_results_returns_none_without_uid(fake_bucket):
    from app import results_storage

    bucket, _ = fake_bucket
    with patch.object(results_storage, "_bucket", return_value=bucket):
        out = results_storage.download_results("job-1", uid=None)
    assert out is None


def test_download_results_returns_none_when_blob_missing(fake_bucket):
    from app import results_storage

    bucket, blob = fake_bucket
    blob.exists.return_value = False
    with patch.object(results_storage, "_bucket", return_value=bucket):
        out = results_storage.download_results("job-1", uid="alice")
    assert out is None
    blob.download_as_bytes.assert_not_called()


def test_download_results_decompresses_gzipped_blob(fake_bucket):
    from app import results_storage

    bucket, blob = fake_bucket
    payload = [{"email": "x@y.com", "status": "valid"}]
    blob.exists.return_value = True
    blob.download_as_bytes.return_value = gzip.compress(
        json.dumps(payload).encode("utf-8")
    )
    with patch.object(results_storage, "_bucket", return_value=bucket):
        out = results_storage.download_results("job-1", uid="alice")
    assert out == payload


def test_download_results_handles_uncompressed_legacy_blob(fake_bucket):
    """Defensive: if someone uploads via a different tool without gzip,
    we should still parse the raw JSON."""
    from app import results_storage

    bucket, blob = fake_bucket
    payload = [{"email": "x@y.com", "status": "valid"}]
    blob.exists.return_value = True
    blob.download_as_bytes.return_value = json.dumps(payload).encode("utf-8")
    with patch.object(results_storage, "_bucket", return_value=bucket):
        out = results_storage.download_results("job-1", uid="alice")
    assert out == payload


def test_download_results_swallows_storage_exception(fake_bucket):
    from app import results_storage

    bucket, blob = fake_bucket
    blob.exists.side_effect = RuntimeError("network blip")
    with patch.object(results_storage, "_bucket", return_value=bucket):
        out = results_storage.download_results("job-1", uid="alice")
    assert out is None


def test_delete_results_returns_false_without_uid(fake_bucket):
    from app import results_storage

    bucket, _ = fake_bucket
    with patch.object(results_storage, "_bucket", return_value=bucket):
        ok = results_storage.delete_results("job-1", uid=None)
    assert ok is False


def test_delete_results_returns_false_when_blob_missing(fake_bucket):
    from app import results_storage

    bucket, blob = fake_bucket
    blob.exists.return_value = False
    with patch.object(results_storage, "_bucket", return_value=bucket):
        ok = results_storage.delete_results("job-1", uid="alice")
    assert ok is False
    blob.delete.assert_not_called()


def test_delete_results_calls_blob_delete(fake_bucket):
    from app import results_storage

    bucket, blob = fake_bucket
    blob.exists.return_value = True
    with patch.object(results_storage, "_bucket", return_value=bucket):
        ok = results_storage.delete_results("job-1", uid="alice")
    assert ok is True
    blob.delete.assert_called_once()


def test_bucket_returns_none_when_firebase_not_ready():
    """``_bucket()`` should bail safely when firebase_admin isn't initialized,
    so the rest of the system never sees a misleading exception."""
    from app import results_storage

    with patch.object(results_storage.auth, "firebase_ready", return_value=False):
        out = results_storage._bucket()
    assert out is None
