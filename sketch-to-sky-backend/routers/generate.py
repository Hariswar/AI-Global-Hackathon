from fastapi import APIRouter
from pydantic import BaseModel
from services.vertex_ai import generate_model

router = APIRouter()

class Prompt(BaseModel):
    text: str

@router.post("/generate")
async def generate(prompt: Prompt):
    url = generate_model(prompt.text)
    return {"url": url}
