# models.py

from pydantic import BaseModel, Field

class WingParameters(BaseModel):
    """
    Defines the required parameter input: a single text prompt.
    """
    prompt: str = Field("A large, swept-back wing with a 10m total span and a high taper ratio.", description="Natural language description of the wing geometry.")

class WingResult(BaseModel):
    """
    Defines the response structure for the API call (GLB URL).
    """
    message: str
    gcs_path: str
    public_url: str
    root_chord: float
    total_span: float
    aspect_ratio: float
    wing_area: float