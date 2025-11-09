# services.py

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d import Axes3D
import zipfile
import os
import datetime
import tempfile
from google.cloud import storage
from typing import Dict, Any, Tuple

# --- CONSTANTS ---
AIRFOIL_FILE = 'combinedAirfoilDataLabeled.csv'
AIRFOIL_NAME = '2032c'
SCALING_FACTOR = 1000000.0
THICKNESS_VISUAL_FACTOR = 100.0
ZIP_FILE_NAME = 'archive.zip'
GCS_BUCKET_NAME = "aircraft_airfoil"  # Bucket name is now defined here
# -----------------

# Global variables for data/client (initialized in the controller's startup event)
df_airfoils = None
storage_client = None


# --- 2A. UTILITY FUNCTIONS ---

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


# --- 2B. GEOMETRY AND PLOTTING ---

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


def plot_3d_wing(x_profile_norm, y_profile_norm, cr, sem_span, sweep_deg, taper_ratio, output_file_path: str) -> Dict[
    str, float]:
    """
    Generates the 3D plot and saves it to the specified path.
    Returns calculated geometric data.
    """

    # ... (Calculations for total_span, tip_chord, wing_area, aspect_ratio) ...
    n_span = 20
    sweep_rad = np.deg2rad(sweep_deg)
    y_span_right = np.linspace(0, sem_span, n_span)
    chord_at_y = cr * (1 - (1 - taper_ratio) * (y_span_right / sem_span))
    x_LE_at_y = y_span_right * np.tan(sweep_rad)

    total_span = sem_span * 2.0
    tip_chord = cr * taper_ratio
    wing_area = ((cr + tip_chord) / 2.0) * total_span
    aspect_ratio = (total_span ** 2) / wing_area

    # ... (Plotting logic, markers, labels, title, and scaling remain the same) ...
    X_right, Y_right, Z_right = [], [], []
    for i in range(n_span):
        c_i = chord_at_y[i]
        x_LE_i = x_LE_at_y[i]
        x_airfoil = (x_profile_norm * c_i) + x_LE_i
        z_airfoil = y_profile_norm * c_i * THICKNESS_VISUAL_FACTOR
        y_airfoil = np.full_like(x_airfoil, y_span_right[i])
        X_right.append(x_airfoil);
        Y_right.append(y_airfoil);
        Z_right.append(z_airfoil)

    Y_left = [-y_coord for y_coord in Y_right];
    X_left = X_right;
    Z_left = Z_right
    X_full = np.concatenate(X_left + X_right);
    Y_full = np.concatenate(Y_left + Y_right);
    Z_full = np.concatenate(Z_left + Z_right)
    X_plot = X_left + X_right;
    Y_plot = Y_left + Y_right;
    Z_plot = Z_left + Z_right

    fig = plt.figure(figsize=(12, 9))
    ax = fig.add_subplot(111, projection='3d')
    for i in range(len(X_plot)):
        ax.plot(X_plot[i], Y_plot[i], Z_plot[i], color='blue', linewidth=0.5, alpha=0.7)

    # Markers
    X_TE_center = x_LE_at_y[0] + cr * x_profile_norm[0]
    ax.plot([X_TE_center, X_TE_center], [-sem_span, sem_span], [0, 0], color='red', linestyle='--', linewidth=2,
            alpha=0.8, label=f'Span (b={total_span:.1f}m)')
    x_min_root = x_LE_at_y[0];
    x_max_root = x_LE_at_y[0] + cr
    ax.plot([x_min_root, x_max_root], [0, 0], [0, 0], color='green', linestyle=':', linewidth=2, alpha=0.8,
            label=f'Chord (Cr={cr:.1f}m)')

    # Labels and Title
    ax.set_xlabel('X (Chord, m)');
    ax.set_ylabel('Y (Span, m)');
    ax.set_zlabel(f'Z (Thickness x{THICKNESS_VISUAL_FACTOR:.0f})')
    ax.set_title(
        f'3D Full Wing: $\\Lambda$={sweep_deg}° | $c_r$={cr:.1f}m | $b$={total_span:.1f}m \nAR={aspect_ratio:.1f} | $S_{{ref}}$={wing_area:.1f}m²',
        fontsize=14)
    ax.legend(loc='upper right')
    ax.set_box_aspect([1, (total_span / cr), 0.2])

    plt.savefig(output_file_path, format='png', bbox_inches='tight')
    plt.close(fig)

    return {
        "aspect_ratio": aspect_ratio,
        "wing_area": wing_area,
        "total_span": total_span
    }


# --- 2C. PRIMARY SERVICE FUNCTION ---

def generate_and_upload_wing(params: Dict[str, float]) -> Dict[str, Any]:
    """
    Main service function: runs geometry calc, plotting, and GCS upload.
    """
    if df_airfoils is None:
        raise ConnectionError("Airfoil data is unavailable.")
    if storage_client is None:
        raise ConnectionError("GCS client is not initialized.")

    # 1. Get Airfoil Coords
    x_norm, y_norm = get_airfoil_coords()
    if x_norm is None:
        raise ValueError(f"Airfoil name '{AIRFOIL_NAME}' not found in dataset.")

    # Generate a unique filename
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    gcs_filename = f"wing_design/wing_{timestamp}_{params['sweep_angle_deg']}deg.png"

    # Use a temporary file to save the matplotlib output
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp_file:
        temp_file_path = tmp_file.name

    try:
        # 2. Plot and Save locally
        calculated_data = plot_3d_wing(
            x_profile_norm=x_norm, y_profile_norm=y_norm,
            cr=params['root_chord'], sem_span=params['semi_span'],
            sweep_deg=params['sweep_angle_deg'], taper_ratio=params['taper_ratio'],
            output_file_path=temp_file_path
        )

        # 3. Upload to GCS
        bucket = storage_client.bucket(GCS_BUCKET_NAME)
        blob = bucket.blob(gcs_filename)
        blob.upload_from_filename(temp_file_path)

        blob.make_public()
        public_url = blob.public_url

        # 4. Return results
        return {
            "message": "Wing image generated and uploaded successfully.",
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