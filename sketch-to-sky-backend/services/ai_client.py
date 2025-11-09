import base64
import logging
import os
from pathlib import Path
from typing import Dict, Tuple
from urllib.parse import urljoin, urlparse

import requests

from ai.extraction import ExtractionError, generate_3d_model

logger = logging.getLogger("sketch_to_sky")

REMOTE_API_DEFAULT = "https://wing-generator-api-78228379179.us-central1.run.app/generate"
REMOTE_API_URL = os.getenv("REMOTE_WING_API", REMOTE_API_DEFAULT)

GENERATED_MODELS_DIR = Path(__file__).resolve().parent.parent / "generated_models"
GENERATED_MODELS_DIR.mkdir(parents=True, exist_ok=True)

REQUEST_TIMEOUT = int(os.getenv("REMOTE_WING_API_TIMEOUT", "300"))


class RemoteAIError(Exception):
    """Raised when the remote wing generator fails or returns malformed data."""


class LocalAIError(Exception):
    """Raised when the local extraction pipeline fails."""


def _derive_filename(suggested: str | None, fallback: str) -> str:
    if suggested and suggested.strip():
        name = suggested.strip()
    else:
        name = fallback
    if not name.lower().endswith(".glb"):
        name += ".glb"
    return name


def _download_file(url: str) -> requests.Response:
    try:
        response = requests.get(url, timeout=REQUEST_TIMEOUT)
        response.raise_for_status()
        return response
    except requests.RequestException as exc:  # noqa: PERF203
        raise RemoteAIError(f"Failed to download remote GLB from {url}: {exc}") from exc


def generate_with_remote_api(prompt: str) -> Tuple[Path, Dict[str, object]]:
    """Send prompt to remote API and persist resulting GLB locally."""
    if not prompt.strip():
        raise RemoteAIError("Prompt cannot be empty")

    logger.info("[AI] Sending prompt to remote generator...")
    try:
        response = requests.post(
            REMOTE_API_URL,
            json={"prompt": prompt},
            timeout=REQUEST_TIMEOUT,
        )
        response.raise_for_status()
    except requests.RequestException as exc:  # noqa: PERF203
        raise RemoteAIError(f"Remote AI request failed: {exc}") from exc

    content_type = response.headers.get("Content-Type", "")
    metadata: Dict[str, object] = {"provider": "remote"}
    file_bytes: bytes
    filename: str | None = None

    if content_type.startswith("application/json"):
        try:
            payload = response.json()
        except ValueError as exc:
            raise RemoteAIError(f"Failed to decode remote JSON response: {exc}") from exc

        metadata.update({k: v for k, v in payload.items() if k not in {"file_url", "file_data", "filename"}})

        if file_url := payload.get("file_url") or payload.get("glb_url"):
            resolved_url = urljoin(REMOTE_API_URL, file_url)
            download_resp = _download_file(resolved_url)
            file_bytes = download_resp.content
            filename = _derive_filename(
                payload.get("filename") or os.path.basename(urlparse(resolved_url).path),
                "wing_remote.glb",
            )
        elif file_data := payload.get("file_data"):
            try:
                file_bytes = base64.b64decode(file_data)
            except (ValueError, TypeError) as exc:
                raise RemoteAIError(f"Invalid base64 file data from remote API: {exc}") from exc
            filename = _derive_filename(payload.get("filename"), "wing_remote.glb")
        else:
            raise RemoteAIError("Remote API response did not include file data or URL")
    else:
        file_bytes = response.content
        filename = _derive_filename(
            response.headers.get("X-Filename")
            or response.headers.get("Content-Disposition", "").split("filename=")[-1].strip("\"")
            or "wing_remote.glb",
            "wing_remote.glb",
        )

    if not file_bytes:
        raise RemoteAIError("Remote API returned empty model data")

    output_path = GENERATED_MODELS_DIR / filename
    try:
        output_path.write_bytes(file_bytes)
    except OSError as exc:
        raise RemoteAIError(f"Failed to store generated GLB: {exc}") from exc

    logger.info("[AI] Model received successfully! Saved to %s", output_path)
    return output_path, metadata


def generate_with_local_model(prompt: str) -> Tuple[Path, Dict[str, float]]:
    if not prompt.strip():
        raise LocalAIError("Prompt cannot be empty")

    try:
        path, metadata = generate_3d_model(prompt)
    except ExtractionError as exc:
        raise LocalAIError(f"Local extraction failed: {exc}") from exc

    return path, metadata
