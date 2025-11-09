import logging
import os
from pathlib import Path

from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from dotenv import load_dotenv

from routers import ai

load_dotenv()

logger = logging.getLogger("sketch_to_sky")
if not logger.handlers:
    logging.basicConfig(level=logging.INFO)

project_id = os.getenv("GOOGLE_PROJECT_ID")
creds_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
creds_json = os.getenv("GOOGLE_APPLICATION_CREDENTIALS_JSON")

logger.info("Environment initialized. GOOGLE_PROJECT_ID=%s", project_id or "<unset>")
if creds_path:
    logger.info("Using GOOGLE_APPLICATION_CREDENTIALS file: %s", creds_path)
elif creds_json:
    logger.info("Using GOOGLE_APPLICATION_CREDENTIALS_JSON (length=%d)", len(creds_json))
else:
    logger.warning("No Google credentials configured. Set GOOGLE_APPLICATION_CREDENTIALS or GOOGLE_APPLICATION_CREDENTIALS_JSON.")

app = FastAPI(title="AI Aircraft Assistant API")

GENERATED_MODELS_DIR = Path(__file__).resolve().parent / "generated_models"
GENERATED_MODELS_DIR.mkdir(parents=True, exist_ok=True)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ai.router)


@app.get("/models/{model_filename}")
async def fetch_model(model_filename: str):
    target_path = (GENERATED_MODELS_DIR / model_filename).resolve()
    if GENERATED_MODELS_DIR.resolve() not in target_path.parents or not target_path.is_file():
        raise HTTPException(status_code=404, detail="Model not found")
    return FileResponse(target_path, media_type="model/gltf-binary", filename=model_filename)


@app.head("/models/{model_filename}")
async def fetch_model_head(model_filename: str):
    target_path = (GENERATED_MODELS_DIR / model_filename).resolve()
    if GENERATED_MODELS_DIR.resolve() not in target_path.parents or not target_path.is_file():
        raise HTTPException(status_code=404, detail="Model not found")
    return Response(status_code=200, media_type="model/gltf-binary")
