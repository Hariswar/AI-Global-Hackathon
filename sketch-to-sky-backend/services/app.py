import os
import base64
import requests
from contextlib import asynccontextmanager

# Third-party libraries
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from google.genai import types
from google.genai.client import Client as GeminiClient
from google.cloud import storage

# --- Configuration and Globals ---
gemini_client = None
storage_client = None
# BUCKET_NAME and model file paths are kept as placeholders but not used in initialization
BUCKET_NAME = "wing-generator-models"
model_file_name = "trained_model_weights.pth"
local_model_path = "/tmp/trained_model_weights.pth"


# Define the request body schema
class PromptRequest(BaseModel):
    prompt: str


# --- Initialization Function (Critical for Startup) ---

def initialize_llm_and_storage():
    """Initializes external clients. GCS model download logic has been REMOVED to prevent startup crashes."""
    global gemini_client, storage_client

    print("Initializing clients...")

    # 1. Initialize Gemini Client (Requires GEMINI_API_KEY environment variable)
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY environment variable not set.")
    # Initialize the client from the google.genai library
    gemini_client = GeminiClient(api_key=api_key)
    print("Gemini client initialized.")

    # 2. Initialize Google Cloud Storage Client (Remains for placeholder/future use)
    # NOTE: This no longer attempts to download any model files.
    storage_client = storage.Client()
    print("Google Cloud Storage     client initialized.")


# --- Image Generation Function (New) ---

async def generate_image(prompt: str, api_key: str) -> str:
    """Calls the Imagen API to generate an image and returns base64 data."""
    print(f"Generating image with prompt: {prompt}")

    # Use the /predict endpoint for the Imagen model
    api_url = f"https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key={api_key}"

    # CORRECT payload structure to fix the 400 Client Error
    payload = {
        "instances": {
            "prompt": f"A realistic, high-fidelity engineering render of an aircraft wing with the following design: {prompt}"
        },
        "parameters": {
            "sampleCount": 1,
            "outputMimeType": "image/png",
            "aspectRatio": "16:9"
        }
    }

    try:
        response = requests.post(
            api_url,
            headers={'Content-Type': 'application/json'},
            json=payload
        )
        response.raise_for_status()  # Raise an exception for bad status codes

        result = response.json()

        # Check for image data in the response structure
        if result.get('predictions') and result['predictions'][0].get('bytesBase64Encoded'):
            return result['predictions'][0]['bytesBase64Encoded']
        else:
            raise ValueError("Image generation failed or returned no image data.")

    except requests.exceptions.HTTPError as http_err:
        print(f"HTTP Error calling Imagen: {http_err}")
        print(f"Imagen API Response: {response.text}")
        raise HTTPException(status_code=500, detail=f"Imagen API HTTP Error: {http_err}")
    except Exception as e:
        print(f"General Error during image generation: {e}")
        raise HTTPException(status_code=500, detail=f"Image generation failed: {e}")


# --- Application Lifecycle Management (FastAPI) ---

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Handles application startup and shutdown events.
    """
    try:
        # CRITICAL: Initialize on startup
        initialize_llm_and_storage()
        print("Application startup successful.")
    except Exception as e:
        print(f"FastAPI Lifespan Startup Failed: {e}")

    yield
    # Cleanup logic (if any) goes here
    print("Application shutdown complete.")


# Initialize FastAPI App
# NOTE: We pass the 'lifespan' context manager here.
app = FastAPI(title="Wing Generator API", lifespan=lifespan)


# --- Endpoints ---

@app.post("/generate-wing")
async def generate_wing(request: PromptRequest):
    """
    Generates a description and an image for a new aircraft wing.
    """
    # Check if initialization was successful (i.e., gemini_client exists)
    if gemini_client is None:
        raise HTTPException(
            status_code=503,
            detail="Service is unavailable. Model initialization failed during startup. Check backend logs for CRITICAL INITIALIZATION ERROR."
        )

    api_key = os.getenv("GEMINI_API_KEY")

    try:
        # --- 1. GENERATE TEXT BRIEF (LLM) ---
        system_instruction = (
            "You are an expert aerospace engineer specializing in wing design. "
            "Analyze the user's prompt and generate a concise, detailed, and technically "
            "accurate design brief for the wing, focusing on airfoil, sweep, and construction material. "
            "Use clear, professional terminology. The output must be in Markdown table format."
        )

        llm_response = gemini_client.models.generate_content(
            model='gemini-2.5-flash-preview-09-2025',
            contents=[request.prompt],
            config=types.GenerateContentConfig(
                system_instruction=system_instruction
            )
        )
        design_brief = llm_response.text.strip()

        # --- 2. GENERATE IMAGE (IMAGEN) ---
        # We use the detailed design brief as the prompt for the image model
        image_data_base64 = await generate_image(design_brief, api_key)

        # --- 3. RETURN BOTH ---
        return {
            "design_brief": design_brief,
            "image_data_base64": image_data_base64
        }

    except HTTPException:
        # Re-raise HTTPExceptions that may have come from generate_image
        raise
    except Exception as e:
        print(f"General Error during wing/image generation: {e}")
        raise HTTPException(status_code=500, detail=f"Generation pipeline failed: {e}")


@app.get("/health")
def health_check():
    """Simple health check endpoint."""
    status = "READY" if gemini_client is not None else "PENDING_INITIALIZATION"
    return {"status": status}