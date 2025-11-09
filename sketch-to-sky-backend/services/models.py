# models.py

from pydantic import BaseModel, Field

class WingParameters(BaseModel):
    """
    Defines the required geometric parameters for the wing.
    Used for request body validation and OpenAPI documentation.
    """
    root_chord: float = Field(2.0, description="Root chord length (Cr) in meters.")
    semi_span: float = Field(5.0, description="Semi-span length (b/2) in meters.")
    sweep_angle_deg: float = Field(25.0, description="Leading edge sweep angle in degrees.")
    taper_ratio: float = Field(0.5, description="Taper ratio (Ct/Cr).")

class WingResult(BaseModel):
    """
    Defines the response structure for the API call.
    """
    message: str
    gcs_path: str
    public_url: str
    root_chord: float
    total_span: float
    aspect_ratio: float
    wing_area: float