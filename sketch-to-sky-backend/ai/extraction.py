import datetime
import logging
import math
import re
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Tuple

import numpy as np
import pandas as pd
import trimesh

logger = logging.getLogger("sketch_to_sky")

AIRFOIL_FILE = "combinedAirfoilDataLabeled.csv"
AIRFOIL_NAME = "2032c"
SCALING_FACTOR = 1_000_000.0
THICKNESS_FACTOR = 0.08
NUM_SPAN_SECTIONS = 24

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "services"
GENERATED_DIR = BASE_DIR / "generated_models"
ARCHIVE_PATH = DATA_DIR / "archive.zip"
CSV_PATH = DATA_DIR / AIRFOIL_FILE

_df_cache: pd.DataFrame | None = None


class ExtractionError(Exception):
    """Domain-specific exception raised when the local extraction pipeline fails."""


@dataclass
class WingParameters:
    root_chord: float
    semi_span: float
    sweep_angle_deg: float
    taper_ratio: float

    @property
    def sweep_angle_rad(self) -> float:
        return math.radians(self.sweep_angle_deg)

    @property
    def tip_chord(self) -> float:
        return self.root_chord * self.taper_ratio


def _ensure_directories() -> None:
    GENERATED_DIR.mkdir(parents=True, exist_ok=True)


def _load_dataset() -> pd.DataFrame:
    global _df_cache  # noqa: PLW0603
    if _df_cache is not None:
        return _df_cache

    if not CSV_PATH.exists():
        if not ARCHIVE_PATH.exists():
            raise ExtractionError(f"Required archive not found at {ARCHIVE_PATH}")
        try:
            with zipfile.ZipFile(ARCHIVE_PATH, "r") as archive:
                if AIRFOIL_FILE not in archive.namelist():
                    raise ExtractionError(
                        f"Archive {ARCHIVE_PATH} does not contain {AIRFOIL_FILE}."
                    )
                archive.extract(AIRFOIL_FILE, path=DATA_DIR)
        except zipfile.BadZipFile as exc:
            raise ExtractionError(f"Failed to extract airfoil data: {exc}") from exc

    try:
        _df_cache = pd.read_csv(CSV_PATH, low_memory=False)
    except Exception as exc:  # pylint: disable=broad-except
        raise ExtractionError(f"Unable to read airfoil dataset: {exc}") from exc
    return _df_cache


def _parse_prompt(prompt: str) -> WingParameters:
    """Very lightweight parser that extracts numeric design cues from text."""
    prompt_lower = prompt.lower()

    def _find(patterns, default):
        for pattern in patterns:
            match = re.search(pattern, prompt_lower)
            if match:
                try:
                    return float(match.group(1))
                except ValueError:
                    continue
        return default

    span_val = _find(
        [r"(\d+(?:\.\d+)?)\s*(?:m|meter(?:s)?)?\s*(?:wingspan|span)", r"span[:=]\s*(\d+(?:\.\d+)?)"],
        10.0,
    )
    root_chord_val = _find(
        [
            r"(\d+(?:\.\d+)?)\s*(?:m|meter(?:s)?)?\s*(?:root\s*chord)",
            r"chord[:=]\s*(\d+(?:\.\d+)?)",
        ],
        2.0,
    )
    sweep_val = _find(
        [r"(\d+(?:\.\d+)?)\s*(?:°|deg(?:rees)?)?\s*(?:sweep)", r"sweep[:=]\s*(\d+(?:\.\d+)?)"],
        25.0,
    )
    taper_val = _find([r"taper(?:\s*ratio)?[:=]\s*(\d+(?:\.\d+)?)"], 0.5)

    semi_span = max(span_val / 2.0, 1.0)
    taper_ratio = max(taper_val, 0.1)
    root_chord = max(root_chord_val, 0.5)
    sweep_angle = sweep_val

    return WingParameters(
        root_chord=root_chord,
        semi_span=semi_span,
        sweep_angle_deg=sweep_angle,
        taper_ratio=taper_ratio,
    )


def _validate_params(params: WingParameters) -> None:
    if params.root_chord <= 0:
        raise ExtractionError("root chord must be positive")
    if params.semi_span <= 0:
        raise ExtractionError("semi span must be positive")
    if params.taper_ratio <= 0:
        raise ExtractionError("taper ratio must be positive")
    if not -90 <= params.sweep_angle_deg <= 90:
        raise ExtractionError("sweep angle must be between -90 and 90 degrees")


def _get_airfoil_profile(df: pd.DataFrame) -> Tuple[np.ndarray, np.ndarray]:
    airfoil_data = df[df["airfoilName"] == AIRFOIL_NAME]
    if airfoil_data.empty:
        raise ExtractionError(f"Airfoil '{AIRFOIL_NAME}' not found in dataset")

    upper_coeffs = airfoil_data.filter(regex="upperSurfaceCoeff").iloc[0].values
    lower_coeffs = airfoil_data.filter(regex="lowerSurfaceCoeff").iloc[0].values

    x_calc = np.linspace(0.0, 1.0, 120)
    y_upper_scaled = _evaluate_polynomial(x_calc, upper_coeffs) / SCALING_FACTOR
    y_lower_scaled = _evaluate_polynomial(x_calc, lower_coeffs)

    x_profile = np.concatenate((x_calc[::-1], x_calc))
    y_profile = np.concatenate((y_upper_scaled[::-1], y_lower_scaled))
    return x_profile.astype(np.float32), y_profile.astype(np.float32)


def _evaluate_polynomial(x_points: np.ndarray, coefficients: np.ndarray) -> np.ndarray:
    y_points = np.zeros_like(x_points, dtype=float)
    for i, coeff in enumerate(coefficients):
        power = 30 - i
        y_points += coeff * np.power(x_points, power)
    return y_points


def _build_wing_mesh(
    x_profile: np.ndarray,
    z_profile: np.ndarray,
    params: WingParameters,
) -> trimesh.Trimesh:
    num_points = len(x_profile)
    if num_points < 4:
        raise ExtractionError("Insufficient airfoil resolution to build mesh")

    # Spanwise positions (mirrored left/right)
    y_positions = np.linspace(-params.semi_span, params.semi_span, NUM_SPAN_SECTIONS)
    y_abs = np.abs(y_positions)
    chord_lengths = params.root_chord * (1 - (1 - params.taper_ratio) * (y_abs / params.semi_span))
    chord_lengths = np.clip(chord_lengths, 0.05, None)
    leading_edge_offsets = y_abs * math.tan(params.sweep_angle_rad)

    vertices = []
    for idx, y_val in enumerate(y_positions):
        chord = chord_lengths[idx]
        x_le = leading_edge_offsets[idx]
        x_coords = x_profile * chord + x_le
        z_coords = z_profile * chord * THICKNESS_FACTOR
        y_coords = np.full_like(x_coords, y_val)
        section = np.column_stack((x_coords, y_coords, z_coords))
        vertices.append(section)

    vertices = np.vstack(vertices).astype(np.float32)

    faces = []
    n_sections = len(y_positions)
    for sec in range(n_sections - 1):
        start_curr = sec * num_points
        start_next = (sec + 1) * num_points
        for pt in range(num_points - 1):
            v0 = start_curr + pt
            v1 = start_next + pt
            v2 = start_curr + pt + 1
            v3 = start_next + pt + 1
            faces.append([v0, v1, v2])
            faces.append([v2, v1, v3])
        v0 = start_curr + num_points - 1
        v1 = start_next + num_points - 1
        v2 = start_curr
        v3 = start_next
        faces.append([v0, v1, v2])
        faces.append([v2, v1, v3])

    mesh = trimesh.Trimesh(vertices=vertices, faces=np.array(faces), process=False)
    mesh.remove_degenerate_faces()
    mesh.remove_duplicate_faces()
    mesh.remove_infinite_values()
    mesh.remove_unreferenced_vertices()
    mesh.fix_normals()
    mesh.merge_vertices()
    return mesh


def generate_3d_model(prompt: str) -> Tuple[Path, Dict[str, float]]:
    """Runs the local extraction pipeline and returns the path to a GLB model."""
    logger.info("[AI] Using local Extraction model...")
    _ensure_directories()

    df = _load_dataset()
    params = _parse_prompt(prompt)
    _validate_params(params)
    x_profile, z_profile = _get_airfoil_profile(df)

    mesh = _build_wing_mesh(x_profile, z_profile, params)

    timestamp = datetime.datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename = f"wing_{timestamp}.glb"
    output_path = GENERATED_DIR / filename

    try:
        mesh.export(output_path, file_type="glb")
    except Exception as exc:  # pylint: disable=broad-except
        raise ExtractionError(f"Failed to export GLB: {exc}") from exc

    logger.info("[AI] Model generated successfully: %s", output_path)
    total_span = params.semi_span * 2.0
    wing_area = params.semi_span * (params.root_chord + params.tip_chord)
    aspect_ratio = (total_span ** 2) / wing_area if wing_area > 0 else None
    metadata = {
        "provider": "extraction",
        "root_chord": params.root_chord,
        "semi_span": params.semi_span,
        "sweep_angle_deg": params.sweep_angle_deg,
        "taper_ratio": params.taper_ratio,
        "total_span": total_span,
        "wing_area": wing_area,
        "aspect_ratio": aspect_ratio,
    }
    return output_path, metadata
