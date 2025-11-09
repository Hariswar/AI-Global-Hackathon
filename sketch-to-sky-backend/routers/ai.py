import logging
from typing import Dict, Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, ConfigDict

from services.wing_generator import (
    WingGeneratorError,
    generate_with_local_model,
    generate_with_dreamfusion,
    generate_with_remote_api,
)

logger = logging.getLogger("sketch_to_sky")

router = APIRouter()


class WingParameters(BaseModel):
    root_chord: float = Field(..., description="Root chord length in meters")
    semi_span: float = Field(..., description="Semi span length in meters")
    sweep_angle_deg: float = Field(..., description="Sweep angle in degrees")
    taper_ratio: float = Field(..., description="Taper ratio")
    prompt_text: str | None = Field(
        default=None,
        description="Original user prompt text (optional, used for DreamFusion context).",
    )
    generator: Literal["auto", "remote", "local", "dreamfusion"] = Field(
        "auto",
        description="Select which generation pipeline to use. Defaults to auto (remote → dreamfusion → local fallback).",
    )

    model_config = ConfigDict(extra="ignore")


@router.post("/generate")
async def generate_wing_model(params: WingParameters) -> Dict[str, object]:
    logger.info("Received generation request: %s", params.model_dump_json())

    payload = params.model_dump()
    generator_mode = payload.pop("generator", "auto")

    def _wrap_error(message: str, exc: Exception, status_code: int = 502) -> HTTPException:
        return HTTPException(status_code=status_code, detail=f"{message}: {exc}")

    if generator_mode == "remote":
        try:
            return generate_with_remote_api(payload)
        except WingGeneratorError as exc:
            logger.error("[AI] Remote generator failed (explicit remote request): %s", exc)
            raise _wrap_error("Remote generation failed", exc)

    if generator_mode == "local":
        try:
            return generate_with_local_model(payload)
        except WingGeneratorError as exc:
            logger.error("[AI] Local generator failed (explicit local request): %s", exc)
            raise _wrap_error("Local generation failed", exc)

    if generator_mode == "dreamfusion":
        try:
            return generate_with_dreamfusion(payload)
        except WingGeneratorError as exc:
            logger.error("[AI] DreamFusion generator failed: %s", exc)
            raise _wrap_error("DreamFusion generation failed", exc)

    # Auto mode: try remote -> dreamfusion -> local
    try:
        return generate_with_remote_api(payload)
    except WingGeneratorError as exc:
        logger.warning("[AI] Remote generator failed (%s). Trying DreamFusion...", exc)
    except Exception as exc:  # noqa: BLE001
        logger.exception("[AI] Unexpected error during remote generation.")
        raise _wrap_error("Remote generation failed due to unexpected error", exc, status_code=500)

    try:
        return generate_with_dreamfusion(payload)
    except WingGeneratorError as exc:
        logger.warning("[AI] DreamFusion generator failed (%s). Falling back to local Extraction...", exc)
    except Exception as exc:  # noqa: BLE001
        logger.exception("[AI] Unexpected error during DreamFusion generation.")
        raise _wrap_error("DreamFusion generation failed due to unexpected error", exc, status_code=500)

    try:
        return generate_with_local_model(payload)
    except WingGeneratorError as exc:
        logger.error("[AI] Local fallback failed: %s", exc)
        raise _wrap_error("Local generation failed", exc, status_code=500)
    except Exception as exc:  # noqa: BLE001
        logger.exception("[AI] Unexpected error during local generation.")
        raise _wrap_error("Local generation failed due to unexpected error", exc, status_code=500)
