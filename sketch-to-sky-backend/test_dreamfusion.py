"""Quick helper script to exercise the DreamFusion Vertex AI integration."""

from __future__ import annotations

import sys

try:
    from dotenv import load_dotenv  # type: ignore[import]
except ImportError:  # pragma: no cover
    load_dotenv = None

if load_dotenv:
    load_dotenv()

from services.vertex_ai import generate_model  # noqa: E402


def main() -> int:
    prompt = "a futuristic aircraft"
    print(f"Testing DreamFusion with prompt: {prompt!r}")

    try:
        url, metadata = generate_model(prompt)
    except Exception as exc:  # noqa: BLE001
        print(f"[ERROR] DreamFusion call raised an exception: {exc}")
        return 1

    provider = metadata.get("provider")
    print(f"[INFO] Provider: {provider}")
    print(f"[INFO] URL: {url}")
    if metadata.get("reason"):
        print(f"[INFO] Reason: {metadata['reason']}")

    return 0


if __name__ == "__main__":
    sys.exit(main())

