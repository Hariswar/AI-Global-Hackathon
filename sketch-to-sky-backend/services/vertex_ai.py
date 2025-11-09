import json
import logging
import os
from typing import Any, Dict, Optional, Tuple

from google.api_core.exceptions import GoogleAPICallError  # type: ignore[import]
from google.cloud import aiplatform  # type: ignore[import]
from google.oauth2 import service_account  # type: ignore[import]

logger = logging.getLogger("sketch_to_sky")

FALLBACK_MODEL_URL = (
    "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/"
    "DamagedHelmet/glTF-Binary/DamagedHelmet.glb"
)
DEFAULT_DREAMFUSION_MODEL = "publishers/google/models/dreamfusion-text-to-3d@001"


def _fallback(prompt: str, reason: str) -> Tuple[str, Dict[str, Any]]:
    logger.warning("[AI] DreamFusion fallback triggered: %s", reason)
    return FALLBACK_MODEL_URL, {
        "provider": "fallback",
        "note": "DreamFusion model not available or credentials invalid",
        "reason": reason,
        "url": FALLBACK_MODEL_URL,
        "prompt": prompt,
    }


def _load_credentials() -> Optional[service_account.Credentials]:
    credentials_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    credentials_json = os.getenv("GOOGLE_APPLICATION_CREDENTIALS_JSON")

    if credentials_path:
        if not os.path.exists(credentials_path):
            logger.error(
                "GOOGLE_APPLICATION_CREDENTIALS points to a non-existent file: %s",
                credentials_path,
            )
            return None
        try:
            return service_account.Credentials.from_service_account_file(credentials_path)
        except Exception as exc:  # noqa: BLE001
            logger.exception("Failed to load service account file: %s", exc)
            return None

    if credentials_json:
        try:
            info = json.loads(credentials_json)
            return service_account.Credentials.from_service_account_info(info)
        except Exception as exc:  # noqa: BLE001
            logger.exception("Failed to parse GOOGLE_APPLICATION_CREDENTIALS_JSON: %s", exc)
            return None

    logger.error("Service account credentials not provided. Set GOOGLE_APPLICATION_CREDENTIALS.")
    return None


def _extract_output_uri(response: Any) -> Optional[str]:
    predictions = getattr(response, "predictions", None)
    if not predictions:
        return None

    first_prediction = predictions[0]
    if isinstance(first_prediction, str):
        return first_prediction

    if isinstance(first_prediction, dict):
        for key in ("outputUri", "output_uri", "uri", "gcsUri", "gcs_uri"):
            value = first_prediction.get(key)
            if isinstance(value, str):
                return value

    return None


def _normalise_output_uri(uri: str) -> str:
    if uri.startswith("gs://"):
        return f"https://storage.googleapis.com/{uri[5:]}"
    return uri


def generate_model(prompt: str) -> Tuple[str, Dict[str, Any]]:
    """
    Generate a 3D model via Vertex AI DreamFusion.

    Returns a tuple of (url, metadata). On failure, a fallback asset is returned.
    """
    cleaned_prompt = prompt.strip()
    if not cleaned_prompt:
        raise ValueError("Prompt cannot be empty.")

    project_id = os.getenv("GOOGLE_PROJECT_ID")
    if not project_id:
        logger.error("GOOGLE_PROJECT_ID environment variable is not set.")
        return _fallback(cleaned_prompt, "GOOGLE_PROJECT_ID missing")

    location = os.getenv("GOOGLE_LOCATION", "us-central1")
    credentials = _load_credentials()
    if credentials is None:
        return _fallback(cleaned_prompt, "Service account credentials unavailable")

    try:
        aiplatform.init(project=project_id, location=location, credentials=credentials)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Failed to initialize Vertex AI client: %s", exc)
        return _fallback(cleaned_prompt, "Unable to initialize Vertex AI client")

    try:
        model_resource = os.getenv("GOOGLE_DREAMFUSION_MODEL", DEFAULT_DREAMFUSION_MODEL)
        logger.info("Using DreamFusion model resource: %s", model_resource)
        model = aiplatform.Model(model_resource)
    except GoogleAPICallError as exc:
        logger.exception("Google API error while accessing DreamFusion model: %s", exc)
        return _fallback(cleaned_prompt, "DreamFusion model access failed")
    except ValueError as exc:
        logger.error("Invalid DreamFusion model identifier: %s", exc)
        return _fallback(cleaned_prompt, "Invalid DreamFusion model identifier")
    except Exception as exc:  # noqa: BLE001
        logger.exception("Unexpected error loading DreamFusion model: %s", exc)
        return _fallback(cleaned_prompt, "DreamFusion model load failed")

    try:
        response = model.predict(instances=[{"prompt": cleaned_prompt}])
    except GoogleAPICallError as exc:
        logger.exception("DreamFusion prediction failed: %s", exc)
        return _fallback(cleaned_prompt, "DreamFusion prediction failed")
    except Exception as exc:  # noqa: BLE001
        logger.exception("Unexpected error during DreamFusion prediction: %s", exc)
        return _fallback(cleaned_prompt, "DreamFusion prediction failed")

    output_uri = _extract_output_uri(response)
    if not output_uri:
        logger.error("DreamFusion response missing output URI: %s", getattr(response, "predictions", None))
        return _fallback(cleaned_prompt, "DreamFusion response missing output URI")

    public_url = _normalise_output_uri(output_uri)
    metadata: Dict[str, Any] = {
        "provider": "vertex-ai",
        "url": public_url,
        "output_uri": output_uri,
        "prompt": cleaned_prompt,
        "project_id": project_id,
        "location": location,
    }
    logger.info("[AI] DreamFusion generated model at %s", public_url)
    return public_url, metadata
