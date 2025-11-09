import logging
import os
import shutil
from datetime import datetime
from pathlib import Path
from typing import Dict, Tuple
from urllib.parse import urlparse

import httpx  # type: ignore[import]
from google.genai import types as genai_types  # type: ignore[import]
from google.genai.client import Client as GeminiClient  # type: ignore[import]

from ai.extraction import ExtractionError, generate_3d_model
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
    """
    Ensures a local copy of the generated GLB exists and returns (path, viewer_url).
    Accepts either an HTTP(S) URL or a filesystem path.
    """
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
    except KeyError as exc:  # noqa: PERF203
        raise WingGeneratorError(f"Missing required parameter '{key}'.") from exc
    try:
        return float(value)
    except (TypeError, ValueError) as exc:  # noqa: PERF203
        raise WingGeneratorError(f"Parameter '{key}' must be numeric.") from exc


def generate_with_remote_api(params: Dict[str, object]) -> Dict[str, object]:
    logger.info("[AI] Sending request to Wing Generator API...")
    root_chord = _require_numeric(params, "root_chord")
    semi_span = _require_numeric(params, "semi_span")
    sweep_angle = _require_numeric(params, "sweep_angle_deg")
    taper_ratio = _require_numeric(params, "taper_ratio")

    prompt_text = (params.get("prompt_text") or "").strip()
    structured_prompt = (
        "Aircraft wing concept with root chord {root:.2f} m, semi-span {span:.2f} m, "
        "sweep angle {sweep:.1f} degrees, taper ratio {taper:.2f}."
    ).format(
        root=root_chord,
        span=semi_span,
        sweep=sweep_angle,
        taper=taper_ratio,
    )
    combined_prompt = f"{prompt_text}\n\n{structured_prompt}" if prompt_text else structured_prompt

    try:
        with httpx.Client(timeout=REMOTE_TIMEOUT) as client:
            request_payload = {
                "root_chord": root_chord,
                "semi_span": semi_span,
                "sweep_angle_deg": sweep_angle,
                "taper_ratio": taper_ratio,
                "prompt": combined_prompt,
            }
            response = client.post(REMOTE_ENDPOINT, json=request_payload)
            response.raise_for_status()

            payload = response.json()

            public_url = payload.get("public_url") or (payload.get("model") or {}).get("glb_url")
            if not public_url:
                detail = payload.get("detail") or payload
                raise WingGeneratorError(f"Remote response missing public_url. Payload: {detail}")

            local_path, viewer_url = _download_or_copy_asset(public_url, "remote_wing", client)

    except httpx.HTTPError as exc:  # noqa: PERF203
        message = exc.response.json() if getattr(exc, "response", None) else str(exc)
        raise WingGeneratorError(f"Remote generator request failed: {message}") from exc

    payload.setdefault("message", "Wing model generated and uploaded successfully.")
    payload["source"] = payload.get("source", "remote")
    payload["viewer_url"] = viewer_url
    payload["local_path"] = str(local_path)
    payload["public_url"] = public_url
    payload.setdefault("root_chord", request_payload["root_chord"])
    payload.setdefault("semi_span", request_payload["semi_span"])
    payload.setdefault("sweep_angle_deg", request_payload["sweep_angle_deg"])
    payload.setdefault("taper_ratio", request_payload["taper_ratio"])
    if params.get("prompt_text"):
        payload.setdefault("original_prompt", params["prompt_text"])
    logger.info("[AI] Remote success, model URL: %s", viewer_url)
    return payload


def _get_gemini_client() -> GeminiClient:
    global _gemini_client  # noqa: PLW0603
    if _gemini_client is not None:
        return _gemini_client

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise WingGeneratorError("GEMINI_API_KEY environment variable is not set.")

    try:
        _gemini_client = GeminiClient(api_key=api_key)
    except Exception as exc:  # noqa: BLE001
        raise WingGeneratorError(f"Failed to initialize Gemini client: {exc}") from exc
    return _gemini_client


def generate_with_local_model(params: Dict[str, object]) -> Dict[str, object]:
    logger.info("[AI] Remote failed: using local Extraction fallback model...")

    root_chord = _require_numeric(params, "root_chord")
    semi_span = _require_numeric(params, "semi_span")
    sweep_angle = _require_numeric(params, "sweep_angle_deg")
    taper_ratio = _require_numeric(params, "taper_ratio")

    prompt = (
        f"Wing design with root chord {root_chord} m, "
        f"semi span {semi_span} m, sweep {sweep_angle} degrees, "
        f"taper ratio {taper_ratio}."
    )
    try:
        path, metadata = generate_3d_model(prompt)
    except ExtractionError as exc:
        raise WingGeneratorError(f"Local extraction failed: {exc}") from exc

    public_url = f"{BASE_URL.rstrip('/')}/models/{path.name}"
    total_span = metadata.get("total_span")
    wing_area = metadata.get("wing_area")
    aspect_ratio = metadata.get("aspect_ratio")

    payload = {
        "message": "Wing model generated locally (fallback).",
        "gcs_path": str(path),
        "public_url": public_url,
        "viewer_url": public_url,
        "local_path": str(path),
        "root_chord": root_chord,
        "total_span": total_span,
        "aspect_ratio": aspect_ratio,
        "wing_area": wing_area,
        "source": "local",
    }
    if params.get("prompt_text"):
        payload.setdefault("original_prompt", params["prompt_text"])
    logger.info("[AI] Local extraction succeeded, model URL: %s", public_url)
    return payload


def generate_with_dreamfusion(params: Dict[str, object]) -> Dict[str, object]:
    logger.info("[AI] Generating wing using DreamFusion pipeline...")

    root_chord = _require_numeric(params, "root_chord")
    semi_span = _require_numeric(params, "semi_span")
    sweep_angle = _require_numeric(params, "sweep_angle_deg")
    taper_ratio = _require_numeric(params, "taper_ratio")
    original_prompt = (params.get("prompt_text") or "").strip()
    structured_prompt = (
        "DreamFusion wing concept with root chord {root:.2f} m, semi-span {span:.2f} m, "
        "sweep angle {sweep:.1f} degrees, taper ratio {taper:.2f}."
    ).format(
        root=root_chord,
        span=semi_span,
        sweep=sweep_angle,
        taper=taper_ratio,
    )
    combined_prompt = f"{original_prompt}\n\n{structured_prompt}" if original_prompt else structured_prompt

    try:
        model_url, metadata = dreamfusion_generate_model(combined_prompt)
    except Exception as exc:  # noqa: BLE001
        raise WingGeneratorError(f"DreamFusion generation failed: {exc}") from exc

    if not model_url:
        raise WingGeneratorError("DreamFusion did not return a model URL.")

    metadata = metadata or {}
    metadata.setdefault("original_prompt", original_prompt)
    metadata.setdefault("structured_prompt", structured_prompt)

    viewer_url = metadata.get("url", model_url)
    if viewer_url.startswith("gs://"):
        viewer_url = f"https://storage.googleapis.com/{viewer_url[5:]}"

    total_span = metadata.get("total_span") or semi_span * 2.0
    wing_area = metadata.get("wing_area")
    aspect_ratio = metadata.get("aspect_ratio")
    provider = metadata.get("provider", "dreamfusion")

    payload = {
        "message": metadata.get("note") or metadata.get("message") or "Wing model generated via DreamFusion.",
        "public_url": viewer_url,
        "viewer_url": viewer_url,
        "root_chord": root_chord,
        "total_span": total_span,
        "aspect_ratio": aspect_ratio,
        "wing_area": wing_area,
        "source": "dreamfusion" if provider == "vertex-ai" else "dreamfusion",
        "original_prompt": original_prompt,
        "structured_prompt": structured_prompt,
        "dreamfusion": metadata,
    }

    logger.info("[AI] DreamFusion generation completed. Viewer URL: %s", viewer_url)
    return payload


def generate_with_gemini(params: Dict[str, object]) -> Dict[str, object]:
    logger.info("[AI] Generating wing using Gemini-aided pipeline...")

    client = _get_gemini_client()

    root_chord = _require_numeric(params, "root_chord")
    semi_span = _require_numeric(params, "semi_span")
    sweep_angle = _require_numeric(params, "sweep_angle_deg")
    taper_ratio = _require_numeric(params, "taper_ratio")
    original_prompt = (params.get("prompt_text") or "").strip()

    structured_prompt = (
        "High-fidelity wing concept. Root chord {root:.2f} m, semi-span {span:.2f} m, "
        "sweep angle {sweep:.1f} degrees, taper ratio {taper:.2f}. "
        "Prioritize aerodynamic efficiency and manufacturability."
    ).format(
        root=root_chord,
        span=semi_span,
        sweep=sweep_angle,
        taper=taper_ratio,
    )
    combined_prompt = f"{original_prompt}\n\n{structured_prompt}" if original_prompt else structured_prompt

    design_brief: str | None = None
    try:
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=[combined_prompt],
            config=genai_types.GenerateContentConfig(
                system_instruction=(
                    "You are an aerospace design assistant. Produce a concise, technical summary "
                    "for the requested wing concept. Return Markdown with two sections: "
                    "1) Key design notes (bulleted) and 2) Recommended materials."
                ),
            ),
        )
        design_brief = (response.text or "").strip()
    except Exception as exc:  # noqa: BLE001
        logger.warning("Gemini text generation failed: %s", exc)

    try:
        path, metadata = generate_3d_model(combined_prompt)
    except ExtractionError as exc:
        raise WingGeneratorError(f"Gemini-assisted local generation failed: {exc}") from exc

    viewer_url = _resolve_viewer_url(path.name)

    metadata = metadata or {}
    metadata.update(
        {
            "provider": "gemini",
            "gemini_design_brief": design_brief,
            "original_prompt": original_prompt,
            "structured_prompt": structured_prompt,
        }
    )

    payload = {
        "message": "Wing model generated using Gemini-assisted design pipeline.",
        "viewer_url": viewer_url,
        "public_url": viewer_url,
        "local_path": str(path),
        "root_chord": root_chord,
        "total_span": metadata.get("total_span"),
        "aspect_ratio": metadata.get("aspect_ratio"),
        "wing_area": metadata.get("wing_area"),
        "source": "gemini",
        "gemini_design_brief": design_brief,
        "structured_prompt": structured_prompt,
    }
    if params.get("prompt_text"):
        payload.setdefault("original_prompt", params["prompt_text"])
    payload["metadata"] = metadata

    logger.info("[AI] Gemini pipeline completed. Viewer URL: %s", viewer_url)
    return payload
