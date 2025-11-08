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
   cd /Users/vimit/dev/Hackathon - Global/sketch-to-sky/AI-Global-Hackathon/sketch-to-sky-backend
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```

2. Provide any required environment variables (for example AI credentials) via `.env` or your shell session.

3. Start the API:
   ```bash
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```

   The service responds on `http://localhost:8000`.

## Running the Frontend (React + Vite)

1. Install dependencies:
   ```bash
   cd /Users/vimit/dev/Hackathon - Global/sketch-to-sky/AI-Global-Hackathon/sketch-to-sky-ui
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

Ensure the backend is running before generating models from the frontend UI. Adjust the API URL if your backend is hosted elsewhere.*** End Patch

Run frontend	npm run dev
Run backend	cd backend && uvicorn main:app --reload