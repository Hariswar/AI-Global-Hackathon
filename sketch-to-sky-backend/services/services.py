# services.py

import pandas as pd
import numpy as np
import zipfile
import os
import datetime
import tempfile
from google.cloud import storage
from typing import Dict, Any, Tuple
import trimesh
import json
from google import genai
from google.genai import types

# --- CONSTANTS ---
AIRFOIL_FILE = 'combinedAirfoilDataLabeled.csv'
AIRFOIL_NAME = '2032c'
SCALING_FACTOR = 1000000.0
THICKNESS_VISUAL_FACTOR = 100.0
ZIP_FILE_NAME = 'archive.zip'
GCS_BUCKET_NAME = "aircraft_airfoil"
# -----------------

# Global variables for data/client (initialized in the controller's startup event)
df_airfoils = None
storage_client = None
gemini_client = None  # NEW: Global Gemini client


# --- 2A. UTILITY FUNCTIONS ---
# (validate_wing_parameters is now less critical but can remain for sanity checks)
# (unzip_specific_file, load_airfoil_data, initialize_gcs_client remain the same)

def validate_wing_parameters(wing_dims: Dict[str, float]) -> bool:
    """Verifies that the wing dimension parameters are physically correct."""
    cr = wing_dims['root_chord']
    sem_span = wing_dims['semi_span']
    sweep_deg = wing_dims['sweep_angle_deg']
    taper_ratio = wing_dims['taper_ratio']

    if cr <= 0: raise ValueError(f"'root_chord' must be positive (currently: {cr}).")
    if sem_span <= 0: raise ValueError(f"'semi_span' must be positive (currently: {sem_span}).")
    if taper_ratio <= 0: raise ValueError(f"'taper_ratio' must be greater than 0 (currently: {taper_ratio}).")
    if not -90 <= sweep_deg <= 90:
        raise ValueError(f"'sweep_angle_deg' must be between -90 and 90 degrees (currently: {sweep_deg}).")
    return True


def unzip_specific_file(zip_path: str, file_to_extract: str, output_path: str = '.') -> bool:
    """Extracts a single file from a ZIP archive."""
    if not os.path.exists(zip_path): return False
    try:
        with zipfile.ZipFile(zip_path, 'r') as zf:
            if file_to_extract not in zf.namelist(): return False
            zf.extract(file_to_extract, path=output_path)
            return True
    except Exception:
        return False


def load_airfoil_data():
    """Handles the initial loading of airfoil data."""
    global df_airfoils

    if not os.path.exists(AIRFOIL_FILE):
        print(f"File {AIRFOIL_FILE} not found. Attempting unzip...")
        if not unzip_specific_file(ZIP_FILE_NAME, AIRFOIL_FILE):
            print("CRITICAL ERROR: Failed to load/extract airfoil data.")
            return

    try:
        df_airfoils = pd.read_csv(AIRFOIL_FILE, low_memory=False)
        print("Service: Airfoil data loaded successfully.")
    except Exception as e:
        print(f"Service ERROR: Failed to read CSV into DataFrame: {e}")
        df_airfoils = None


def initialize_gcs_client():
    """Initializes the GCS client."""
    global storage_client
    try:
        storage_client = storage.Client()
        print(f"Service: GCS client initialized for bucket '{GCS_BUCKET_NAME}'.")
    except Exception as e:
        print(f"Service ERROR: Failed to initialize GCS client: {e}")
        storage_client = None


def initialize_gemini_client():
    """Initializes the Gemini client."""
    global gemini_client
    try:
        # Looks for GEMINI_API_KEY environment variable
        gemini_client = genai.Client()
        print("Service: Gemini client initialized.")
    except Exception as e:
        print(f"Service ERROR: Failed to initialize Gemini client: {e}")
        gemini_client = None


# --- 2B. GEOMETRY AND EXPORT ---

def calculate_polynomial_y(x_points: np.ndarray, coefficients: np.ndarray) -> np.ndarray:
    """Calculates the Y-coordinate (thickness) based on 31-coeff polynomial."""
    y_points = np.zeros_like(x_points, dtype=float)
    for i, coeff in enumerate(coefficients):
        power = 30 - i
        y_points += coeff * (x_points ** power)
    return y_points


def get_airfoil_coords() -> Tuple[np.ndarray, np.ndarray] | Tuple[None, None]:
    """Retrieves the final normalized X and Y coordinates for a single airfoil profile."""
    if df_airfoils is None:
        return None, None

    airfoil_data = df_airfoils[df_airfoils['airfoilName'] == AIRFOIL_NAME]
    if airfoil_data.empty: return None, None
    upper_coeffs = airfoil_data.filter(regex='upperSurfaceCoeff').iloc[0].values
    lower_coeffs = airfoil_data.filter(regex='lowerSurfaceCoeff').iloc[0].values

    x_calc = np.linspace(0.0, 1.0, 100)
    y_upper_scaled = calculate_polynomial_y(x_calc, upper_coeffs) / SCALING_FACTOR
    y_lower_scaled = calculate_polynomial_y(x_calc, lower_coeffs)

    x_profile = np.concatenate((x_calc[::-1], x_calc))
    y_profile = np.concatenate((y_upper_scaled[::-1], y_lower_scaled))

    return x_profile, y_profile


def extract_parameters_from_prompt(prompt: str) -> Dict[str, float]:
    """
    Uses the Gemini API to extract and validate the four required
    numerical parameters from a natural language prompt.
    """
    if gemini_client is None:
        raise ConnectionError("Gemini client is not initialized.")

    # 1. Define the desired output schema (Pydantic style)
    target_schema = types.Schema(
        type=types.Type.OBJECT,
        properties={
            "root_chord": types.Schema(type=types.Type.NUMBER, description="The wing root chord in meters."),
            "semi_span": types.Schema(type=types.Type.NUMBER, description="Half the wingspan in meters."),
            "sweep_angle_deg": types.Schema(type=types.Type.NUMBER, description="The sweep angle in degrees."),
            "taper_ratio": types.Schema(type=types.Type.NUMBER,
                                        description="The ratio of tip chord to root chord (Ct/Cr).")
        },
        required=["root_chord", "semi_span", "sweep_angle_deg", "taper_ratio"]
    )

    system_instruction = (
        "You are an AI assistant specialized in aerospace engineering. Your task is to extract "
        "the four critical numerical parameters for a wing design from the user's prompt. "
        "Return the output as a valid JSON object matching the provided schema, using sensible "
        "default values (e.g., Cr=2.0, SemiSpan=5.0, Sweep=25.0, Taper=0.5) if any parameters are missing."
    )

    try:
        # 2. Call the Gemini API, enforcing JSON output
        response = gemini_client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                response_mime_type="application/json",
                response_schema=target_schema
            )
        )

        # 3. Parse the JSON response text
        parsed_data = json.loads(response.text)
        return parsed_data

    except Exception as e:
        print(f"Gemini Extraction Error: {e}")
        # Re-raise as a ValueError so FastAPI returns a 400 Bad Request
        raise ValueError("Failed to extract valid wing parameters from the prompt. Please be more specific.")


def export_3d_wing(x_profile_norm, y_profile_norm, cr, sem_span, sweep_deg, taper_ratio, output_file_path: str) -> Dict[
    str, float]:
    """
    Generates the 3D mesh and saves it to the specified path as a GLB file.
    NOTE: The meshing logic uses a complex Trimesh operation (convex_hull).
    """
    n_span = 20
    sweep_rad = np.deg2rad(sweep_deg)
    y_span_right = np.linspace(0, sem_span, n_span)
    chord_at_y = cr * (1 - (1 - taper_ratio) * (y_span_right / sem_span))
    x_LE_at_y = y_span_right * np.tan(sweep_rad)

    total_span = sem_span * 2.0
    tip_chord = cr * taper_ratio
    wing_area = ((cr + tip_chord) / 2.0) * total_span
    aspect_ratio = (total_span ** 2) / wing_area

    # --- TRIAINGULATION/MESHING LOGIC ---
    all_vertices = []

    # 1. Generate all points for the wing surface (Right Half)
    for i in range(n_span):
        c_i = chord_at_y[i]
        x_LE_i = x_LE_at_y[i]
        y_i = y_span_right[i]

        x_airfoil = (x_profile_norm * c_i) + x_LE_i
        z_airfoil = y_profile_norm * c_i * THICKNESS_VISUAL_FACTOR

        current_station_points = np.column_stack([
            x_airfoil,
            np.full_like(x_airfoil, y_i),
            z_airfoil
        ])
        all_vertices.extend(current_station_points.tolist())

    # 2. Add Left Half (Mirroring across the XZ plane)
    left_vertices = [
        [v[0], -v[1], v[2]] for v in all_vertices if v[1] > 0
    ]
    all_vertices.extend(left_vertices)

    # 3. Create Mesh (Uses convex hull as a simplification)
    vertices = np.array(all_vertices)
    try:
        mesh = trimesh.Trimesh(vertices=vertices).convex_hull
    except trimesh.exceptions.TrimeshException as e:
        raise ValueError(f"Failed to create 3D mesh (Triangulation required): {e}")

    # 4. Export the GLB file
    try:
        with open(output_file_path, 'wb') as f:
            f.write(trimesh.exchange.gltf.export_glb(mesh))
    except Exception as e:
        raise ConnectionError(f"Failed to export GLB file: {e}")

    return {
        "aspect_ratio": aspect_ratio,
        "wing_area": wing_area,
        "total_span": total_span
    }


# --- 2C. PRIMARY SERVICE FUNCTION ---

def generate_and_upload_wing(prompt_data: Dict[str, str]) -> Dict[str, Any]:
    """
    Main service function: runs Gemini extraction, geometry calc, meshing, and GCS upload.
    """
    if df_airfoils is None:
        raise ConnectionError("Airfoil data is unavailable.")
    if storage_client is None:
        raise ConnectionError("GCS client is not initialized.")
    if gemini_client is None:
        raise ConnectionError("Gemini client is not initialized.")

    # 1. NEW STEP: Extract Parameters from Prompt
    params = extract_parameters_from_prompt(prompt_data['prompt'])

    # 2. Validate extracted parameters (Uses original validation logic)
    validate_wing_parameters(params)

    # 3. Get Airfoil Coords
    x_norm, y_norm = get_airfoil_coords()
    if x_norm is None:
        raise ValueError(f"Airfoil name '{AIRFOIL_NAME}' not found in dataset.")

    # Generate a unique filename and use GLB extension
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    # Use the extracted sweep angle in the filename
    gcs_filename = f"wing_design/wing_{timestamp}_{params['sweep_angle_deg']}deg.glb"

    # Use a temporary file to save the trimesh output with GLB suffix
    with tempfile.NamedTemporaryFile(suffix=".glb", delete=False) as tmp_file:
        temp_file_path = tmp_file.name

    try:
        # 4. Export and Save locally (using new export function)
        calculated_data = export_3d_wing(
            x_profile_norm=x_norm, y_profile_norm=y_norm,
            cr=params['root_chord'], sem_span=params['semi_span'],
            sweep_deg=params['sweep_angle_deg'], taper_ratio=params['taper_ratio'],
            output_file_path=temp_file_path
        )

        # 5. Upload to GCS
        bucket = storage_client.bucket(GCS_BUCKET_NAME)
        blob = bucket.blob(gcs_filename)
        blob.upload_from_filename(temp_file_path)

        # Get public URL (Assumes public read permission is set on the bucket)
        public_url = blob.public_url

        # 6. Return results
        return {
            "message": "Wing model generated and uploaded successfully.",
            "gcs_path": f"gs://{GCS_BUCKET_NAME}/{gcs_filename}",
            "public_url": public_url,
            "root_chord": params['root_chord'],
            "total_span": calculated_data['total_span'],
            "aspect_ratio": calculated_data['aspect_ratio'],
            "wing_area": calculated_data['wing_area']
        }

    finally:
        # Clean up
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)