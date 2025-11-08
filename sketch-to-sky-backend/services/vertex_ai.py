import logging
import os
from typing import Any, Dict, Tuple

from google.api_core.exceptions import GoogleAPICallError
from google.cloud import aiplatform

PROJECT_ID = os.getenv("GOOGLE_PROJECT_ID")
LOCATION = os.getenv("GOOGLE_LOCATION", "us-central1")
FALLBACK_MODEL_URL = os.getenv(
    "FALLBACK_MODEL_URL",
    "https://storage.googleapis.com/ai-aircraft-assets/sample-aircraft.glb",
)

logger = logging.getLogger(__name__)


def _credential_is_configured() -> bool:
    return bool(
        PROJECT_ID
        and (
            os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
            or os.getenv("GOOGLE_APPLICATION_CREDENTIALS_JSON")
        )
    )


def generate_model(prompt: str) -> Tuple[str, Dict[str, Any]]:
    if not prompt.strip():
        raise ValueError("Prompt cannot be empty.")

    if not _credential_is_configured():
        logger.warning("Google Cloud credentials not configured. Using fallback model URL.")
        return FALLBACK_MODEL_URL, {
            "provider": "fallback",
            "prompt": prompt,
            "note": "Returned static demo model because Google Cloud credentials are not configured.",
        }

    try:
        aiplatform.init(project=PROJECT_ID, location=LOCATION)
        model = aiplatform.Model("publishers/google/models/dreamfusion-3d")
        response = model.predict(instances=[{"prompt": prompt}])
        predictions = getattr(response, "predictions", [])
        if predictions:
            result = predictions[0]
            output_uri = result.get("output_uri")
            if output_uri:
                metadata = {k: v for k, v in result.items() if k != "output_uri"}
                metadata.update({"provider": "vertex-ai"})
                return output_uri, metadata
        logger.warning("Vertex AI response did not contain a usable output_uri. Falling back.")
    except GoogleAPICallError as exc:
        logger.exception("Vertex AI API call failed: %s", exc)
    except Exception as exc:  # pylint: disable=broad-except
        logger.exception("Unexpected error during model generation: %s", exc)

    return FALLBACK_MODEL_URL, {
        "provider": "fallback",
        "prompt": prompt,
        "note": "Failed to generate model via Vertex AI. Returned static demo asset instead.",
    }
