# From Sketch to Sky – AI-Assisted 3D Aircraft Design

## Project Structure

- `sketch-to-sky-ui/` – React + Vite frontend that drives the AI design studio experience.
- `sketch-to-sky-backend/` – FastAPI service that proxies AI model generation.

## Prerequisites

- Node.js 22.12+ (or at minimum 20.19+) and npm.
- Python 3.10+.
- Set your AWS profile to `dev-deployer` when authenticating with AWS-backed services.

## Running the Backend (FastAPI)

1. Install dependencies:
   ```bash
   cd sketch-to-sky-backend
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```

2. Provide any required environment variables (Vertex AI, etc.) in `.env` or your shell. Example:
   ```bash
   GOOGLE_PROJECT_ID=your-project-id
   GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/service-account.json
   # optional override for DreamFusion model resource:
   # GOOGLE_DREAMFUSION_MODEL=publishers/google/models/dreamfusion-text-to-3d@001
   # optional: enable Gemini generator (requires API key)
   # GEMINI_API_KEY=your-gemini-api-key
   # GEMINI_TEXT_MODEL=gemini-2.5-flash
   ```

3. Start the API:
   ```bash
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```

   The service responds on `http://localhost:8000`.

### Local Extraction & Remote Generator

- The backend first calls the remote wing generator (`REMOTE_WING_API`, default `https://…/generate`).
- If the remote call fails, it falls back to the Vertex AI DreamFusion pipeline, then the Gemini-assisted local pipeline, and finally the purely local extraction workflow before surfacing demo assets.
- Generated `.glb` files are stored under `sketch-to-sky-backend/generated_models/` and served via `GET /models/{filename}`. Set `PUBLIC_BASE_URL` if the backend is not running on `http://127.0.0.1:8000`.
- Quick test:
  ```bash
  curl -X POST http://localhost:8000/test-extraction \
       -H "Content-Type: application/json" \
       -d '"Generate a swept wing 30m span"'
  ```

## Running the Frontend (React + Vite)

1. Install dependencies:
   ```bash
   cd sketch-to-sky-ui
   npm install
   ```

2. Configure environment variables. Create `.env` (or `.env.local`) with:
   ```
   VITE_API_URL=http://localhost:8000
   ```

3. Launch the dev server:
   ```bash
   npm run dev
   ```

   Vite serves the app at `http://localhost:5173/`.

Ensure the backend is running before generating models from the frontend UI. Adjust the API URL if your backend is hosted elsewhere.


python3 -m venv .venv

source .venv/bin/activate

uvicorn main:app --host 0.0.0.0 --port 8000

pip install -r requirements.txt