import os
from google.cloud import aiplatform

PROJECT_ID = os.getenv("GOOGLE_PROJECT_ID")
LOCATION = os.getenv("GOOGLE_LOCATION", "us-central1")

def generate_model(prompt: str) -> str:
    aiplatform.init(project=PROJECT_ID, location=LOCATION)
    model = aiplatform.Model("publishers/google/models/dreamfusion-3d")
    response = model.predict(instances=[{"prompt": prompt}])
    return response.predictions[0].get("output_uri", "")
