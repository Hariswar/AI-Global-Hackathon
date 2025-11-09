"""
Local Parametric Wing Generator

A standalone wing generation module that creates 3D wing meshes using pure geometric
parameters without requiring airfoil datasets. This serves as a backup/fallback option.
"""

import logging
import math
from datetime import datetime
from pathlib import Path
from typing import Dict, Tuple

import numpy as np
import trimesh

logger = logging.getLogger("sketch_to_sky")

# Output directory for generated wings
PARAMETRIC_WING_DIR = Path(__file__).resolve().parent.parent / "generated_models"
PARAMETRIC_WING_DIR.mkdir(parents=True, exist_ok=True)

# Geometric constants
NUM_SPAN_SECTIONS = 20
NUM_CHORD_POINTS = 50
THICKNESS_RATIO = 0.12  # Wing thickness as fraction of chord


def _create_simple_airfoil_profile(num_points: int = NUM_CHORD_POINTS) -> Tuple[np.ndarray, np.ndarray]:
    """
    Creates a simple symmetric airfoil profile using NACA-like geometry.
    Returns normalized x and z coordinates (0 to 1).
    """
    x = np.linspace(0.0, 1.0, num_points)
    # Simple symmetric airfoil: z = thickness * (4 * x * (1 - x))^0.5
    # This creates a rounded leading edge and tapered trailing edge
    z_upper = THICKNESS_RATIO * np.sqrt(4 * x * (1 - x))
    z_lower = -z_upper

    # Combine upper and lower surfaces
    x_profile = np.concatenate((x[::-1], x[1:]))
    z_profile = np.concatenate((z_upper[::-1], z_lower[1:]))

    return x_profile.astype(np.float32), z_profile.astype(np.float32)


def _build_parametric_wing_mesh(
    root_chord: float,
    semi_span: float,
    sweep_angle_deg: float,
    taper_ratio: float,
) -> trimesh.Trimesh:
    """
    Builds a 3D wing mesh from parametric inputs.
    """
    sweep_rad = math.radians(sweep_angle_deg)

    # Get base airfoil profile
    x_profile, z_profile = _create_simple_airfoil_profile()
    num_points = len(x_profile)

    # Spanwise positions (from root to tip, then mirrored)
    y_positions = np.linspace(0, semi_span, NUM_SPAN_SECTIONS)

    # Calculate chord length at each span position
    chord_lengths = root_chord * (1 - (1 - taper_ratio) * (y_positions / semi_span))
    chord_lengths = np.clip(chord_lengths, 0.05, None)  # Minimum chord

    # Calculate leading edge offset due to sweep
    leading_edge_offsets = y_positions * math.tan(sweep_rad)

    # Generate vertices for right half
    vertices_right = []
    for idx, y_val in enumerate(y_positions):
        chord = chord_lengths[idx]
        x_le = leading_edge_offsets[idx]

        # Scale airfoil profile by chord
        x_coords = x_profile * chord + x_le
        z_coords = z_profile * chord

        # Create section at this span position
        y_coords = np.full_like(x_coords, y_val)
        section = np.column_stack((x_coords, y_coords, z_coords))
        vertices_right.append(section)

    # Mirror to create left half
    vertices_left = []
    for section in vertices_right:
        left_section = section.copy()
        left_section[:, 1] = -left_section[:, 1]  # Mirror Y
        vertices_left.append(left_section)

    # Combine all vertices
    all_vertices = vertices_right + vertices_left
    vertices = np.vstack(all_vertices).astype(np.float32)

    # Generate faces
    faces = []
    n_sections = len(y_positions)

    # Right half faces
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

    # Left half faces (mirrored)
    for sec in range(n_sections - 1):
        start_curr = (n_sections + sec) * num_points
        start_next = (n_sections + sec + 1) * num_points
        for pt in range(num_points - 1):
            v0 = start_curr + pt
            v1 = start_next + pt
            v2 = start_curr + pt + 1
            v3 = start_next + pt + 1
            faces.append([v2, v1, v0])  # Reverse winding
            faces.append([v3, v1, v2])
        v0 = start_curr + num_points - 1
        v1 = start_next + num_points - 1
        v2 = start_curr
        v3 = start_next
        faces.append([v2, v1, v0])
        faces.append([v3, v1, v2])

    mesh = trimesh.Trimesh(vertices=vertices, faces=np.array(faces), process=False)

    # Clean up mesh
    mesh.remove_degenerate_faces()
    mesh.remove_duplicate_faces()
    mesh.remove_infinite_values()
    mesh.remove_unreferenced_vertices()
    mesh.fix_normals()
    mesh.merge_vertices()

    return mesh


def generate_wing_local(params: Dict[str, float]) -> Tuple[Path, Dict[str, float]]:
    """
    Generates a parametric wing mesh and saves it as a GLB file.
    Dynamic prompt support added: pass 'prompt' attribute in params.
    """
    root_chord = float(params["root_chord"])
    semi_span = float(params["semi_span"])
    sweep_angle_deg = float(params["sweep_angle_deg"])
    taper_ratio = float(params["taper_ratio"])
    prompt_text = params.get("prompt", "").strip()  # <-- dynamic prompt support

    logger.info(
        "[Parametric] Generating wing: root_chord=%.2f, semi_span=%.2f, sweep=%.1f°, taper=%.2f, prompt=%s",
        root_chord,
        semi_span,
        sweep_angle_deg,
        taper_ratio,
        prompt_text or "N/A",
    )

    # Build mesh
    mesh = _build_parametric_wing_mesh(root_chord, semi_span, sweep_angle_deg, taper_ratio)

    # Calculate wing properties
    total_span = semi_span * 2.0
    tip_chord = root_chord * taper_ratio
    wing_area = ((root_chord + tip_chord) / 2.0) * total_span
    aspect_ratio = (total_span ** 2) / wing_area if wing_area > 0 else 0

    # Generate filename
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename = f"parametric_wing_{timestamp}.glb"
    file_path = PARAMETRIC_WING_DIR / filename

    # Export GLB
    glb_data = trimesh.exchange.gltf.export_glb(mesh)
    file_path.write_bytes(glb_data)
    logger.info("[Parametric] Wing saved to %s", file_path)

    metadata = {
        "total_span": total_span,
        "wing_area": wing_area,
        "aspect_ratio": aspect_ratio,
        "tip_chord": tip_chord,
        "root_chord": root_chord,
        "semi_span": semi_span,
        "sweep_angle_deg": sweep_angle_deg,
        "taper_ratio": taper_ratio,
        "prompt": prompt_text,  # <-- store prompt
    }

    return file_path, metadata
