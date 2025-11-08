from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.vertex_ai import generate_model

router = APIRouter()

class Prompt(BaseModel):
    text: str

@router.post("/generate")
async def generate(prompt: Prompt):
    try:
        url, metadata = generate_model(prompt.text)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return {"url": url, "metadata": metadata}
