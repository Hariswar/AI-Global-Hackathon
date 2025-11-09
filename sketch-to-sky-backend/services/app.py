# app.py

import models
import services
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from google.cloud import storage


# --- LIFESPAN CONTEXT MANAGER (Replaces @app.on_event("startup")) ---

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Handles startup and shutdown events for the application.
    Initializes required resources before the app starts accepting requests.
    """
    print("🚀 API Startup: Initializing resources...")

    # --- STARTUP LOGIC ---
    services.load_airfoil_data()
    services.initialize_gcs_client()

    # Yield control back to FastAPI to begin processing requests
    yield

    # --- SHUTDOWN LOGIC (Executed when the application shuts down) ---
    print("🛑 API Shutdown: Finished.")


# --- API SETUP (Controller) ---

app = FastAPI(
    title="Parametric Wing Generator API",
    description="Microservice to generate and store 3D wing geometry plots in GCS.",
    lifespan=lifespan  # Use the new lifespan context manager
)


# --- API ENDPOINT ---

@app.post("/generate-wing", response_model=models.WingResult)
def generate_wing_endpoint(params: models.WingParameters):
    """
    Accepts wing parameters, validates them, calls the service, and returns the upload details.
    """
    try:
        # 1. Validation
        services.validate_wing_parameters(params.model_dump())

        # 2. Call the Service (Business Logic)
        result = services.generate_and_upload_wing(params.model_dump())

        # 3. Return the structured response
        return result

    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Bad Request: {e}")

    except ConnectionError as e:
        raise HTTPException(status_code=503, detail=f"Service Unavailable: {e}")

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {e}")