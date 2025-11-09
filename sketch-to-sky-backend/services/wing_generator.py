import logging
import os
import shutil
import re
from datetime import datetime
from pathlib import Path
from typing import Dict, Tuple, Optional
from urllib.parse import urlparse

import httpx  # type: ignore[import]
from google.genai import types as genai_types  # type: ignore[import]
from google.genai.client import Client as GeminiClient  # type: ignore[import]

from ai.extraction import ExtractionError, generate_3d_model
from services.parametric_wing import generate_wing_local as generate_parametric_wing
from services.vertex_ai import generate_model as dreamfusion_generate_model

logger = logging.getLogger("sketch_to_sky")

REMOTE_ENDPOINT = os.getenv(
    "WING_GENERATOR_API",
    "https://wing-generator-api-78228379179.us-central1.run.app/generate-wing",
)
REMOTE_TIMEOUT = int(os.getenv("WING_GENERATOR_TIMEOUT", "120"))
BASE_URL = os.getenv("PUBLIC_BASE_URL", "http://127.0.0.1:8000")
GENERATED_DIR = Path("generated_models")
GENERATED_DIR.mkdir(parents=True, exist_ok=True)

_gemini_client: GeminiClient | None = None
GEMINI_MODEL = os.getenv("GEMINI_TEXT_MODEL", "gemini-2.5-flash")


class WingGeneratorError(Exception):
    """Raised when the remote wing generator fails."""


def _resolve_viewer_url(filename: str) -> str:
    return f"{BASE_URL.rstrip('/')}/models/{filename}"


def _download_or_copy_asset(
    source_url_or_path: str,
    filename_prefix: str,
    client: httpx.Client | None = None,
) -> Tuple[Path, str]:
    if not source_url_or_path or not source_url_or_path.strip():
        raise WingGeneratorError("No model asset reference provided.")

    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename = f"{filename_prefix}_{timestamp}.glb"
    destination_path = GENERATED_DIR / filename

    parsed = urlparse(source_url_or_path)
    scheme = parsed.scheme.lower()

    if scheme in {"http", "https"}:
        http_client = client or httpx.Client(timeout=REMOTE_TIMEOUT)
        try:
            response = http_client.get(source_url_or_path)
            response.raise_for_status()
        except httpx.HTTPError as exc:
            raise WingGeneratorError(f"Failed to download asset from {source_url_or_path}: {exc}") from exc
        destination_path.write_bytes(response.content)
    else:
        source_path = Path(source_url_or_path)
        if not source_path.is_file():
            raise WingGeneratorError(f"Model file not found at {source_url_or_path}")
        shutil.copyfile(source_path, destination_path)

    viewer_url = _resolve_viewer_url(filename)
    logger.info("[AI] Stored generated GLB at %s (viewer URL: %s)", destination_path, viewer_url)
    return destination_path, viewer_url


def _require_numeric(params: Dict[str, object], key: str) -> float:
    try:
        value = params[key]
    except KeyError as exc:
        raise WingGeneratorError(f"Missing required parameter '{key}'.") from exc
    try:
        return float(value)
    except (TypeError, ValueError) as exc:
        raise WingGeneratorError(f"Parameter '{key}' must be numeric.") from exc


def _extract_wing_params_from_prompt(prompt: str) -> Dict[str, float]:
    """
    Extract numeric wing parameters from a text prompt using regex.
    Returns a dictionary with keys: root_chord, semi_span, sweep_angle_deg, taper_ratio.
    """
    # Default fallback values
    params = {
        "root_chord": 5.0,
        "semi_span": 10.0,
        "sweep_angle_deg": 25.0,
        "taper_ratio": 0.5,
    }

    try:
        root_match = re.search(r"root chord\s*of\s*(\d+(?:\.\d+)?)", prompt, re.IGNORECASE)
        if root_match:
            params["root_chord"] = float(root_match.group(1))

        span_match = re.search(r"semi[- ]span\s*of\s*(\d+(?:\.\d+)?)", prompt, re.IGNORECASE)
        if span_match:
            params["semi_span"] = float(span_match.group(1))

        sweep_match = re.search(r"sweep angle\s*of\s*(\d+(?:\.\d+)?)", prompt, re.IGNORECASE)
        if sweep_match:
            params["sweep_angle_deg"] = float(sweep_match.group(1))

        taper_match = re.search(r"taper ratio\s*of\s*(\d+(?:\.\d+)?)", prompt, re.IGNORECASE)
        if taper_match:
            params["taper_ratio"] = float(taper_match.group(1))
    except Exception as e:
        logger.warning("Failed to parse prompt for parameters: %s", e)

    return params


def generate_with_parametric(params: Dict[str, object]) -> Dict[str, object]:
    """
    Generates a wing using the standalone parametric wing generator.
    Now respects 'prompt' if provided, by extracting numeric values.
    """
    logger.info("[AI] Generating wing using parametric wing generator...")

    prompt_text = (params.get("prompt_text") or "").strip()
    if prompt_text:
        extracted_params = _extract_wing_params_from_prompt(prompt_text)
        root_chord = extracted_params["root_chord"]
        semi_span = extracted_params["semi_span"]
        sweep_angle = extracted_params["sweep_angle_deg"]
        taper_ratio = extracted_params["taper_ratio"]
    else:
        root_chord = _require_numeric(params, "root_chord")
        semi_span = _require_numeric(params, "semi_span")
        sweep_angle = _require_numeric(params, "sweep_angle_deg")
        taper_ratio = _require_numeric(params, "taper_ratio")

    try:
        path, metadata = generate_parametric_wing(
            {
                "root_chord": root_chord,
                "semi_span": semi_span,
                "sweep_angle_deg": sweep_angle,
                "taper_ratio": taper_ratio,
                "prompt": "generate airoplane seat in 3d",
            }
        )
    except Exception as exc:
        raise WingGeneratorError(f"Parametric wing generation failed: {exc}") from exc

    viewer_url = _resolve_viewer_url(path.name)

    payload = {
        "message": "Wing model generated using parametric wing generator.",
        "viewer_url": viewer_url,
        "public_url": viewer_url,
        "local_path": str(path),
        "root_chord": root_chord,
        "total_span": metadata.get("total_span"),
        "aspect_ratio": metadata.get("aspect_ratio"),
        "wing_area": metadata.get("wing_area"),
        "tip_chord": metadata.get("tip_chord"),
        "source": "parametric",
    }
    if prompt_text:
        payload.setdefault("original_prompt", prompt_text)
    payload["metadata"] = metadata

    logger.info("[AI] Parametric wing generation completed. Viewer URL: %s", viewer_url)
    return payload
