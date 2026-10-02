import io
import random
import string

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response
from gtts import gTTS
from sqlalchemy.orm import Session

from ile_project_settings import get_db
from ile_app.models import ShortURL

tools_router = APIRouter()


def generate_short_code(length=6):
    chars = string.ascii_letters + string.digits
    return "".join(random.choice(chars) for _ in range(length))


@tools_router.get("/health")
def health_check():
    return {"status": "ok"}


@tools_router.post("/shorten")
def create_short_url(request: Request, payload: dict, db: Session = Depends(get_db)):
    original_url = (payload or {}).get("url", "").strip()
    if not original_url:
        raise HTTPException(status_code=400, detail="URL is required")

    if not original_url.startswith(("http://", "https://")):
        original_url = "http://" + original_url

    existing = db.query(ShortURL).filter(ShortURL.original_url == original_url).first()
    if existing:
        return {"short_url": f"{request.base_url}s/{existing.short_code}"}

    short_code = generate_short_code()
    while db.query(ShortURL).filter(ShortURL.short_code == short_code).first():
        short_code = generate_short_code()

    new_url = ShortURL(original_url=original_url, short_code=short_code)
    db.add(new_url)
    db.commit()
    db.refresh(new_url)

    return {"short_url": f"{request.base_url}s/{new_url.short_code}"}


@tools_router.post("/text-to-audio")
async def text_to_audio(payload: dict):
    text = (payload or {}).get("text", "").strip()
    language = (payload or {}).get("lang", "en").strip() or "en"

    if not text:
        raise HTTPException(status_code=400, detail="Text is required")

    try:
        tts = gTTS(text=text, lang=language, slow=False)
        buffer = io.BytesIO()
        tts.write_to_fp(buffer)
        buffer.seek(0)
        return Response(content=buffer.read(), media_type="audio/mpeg")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"TTS Error: {str(exc)}")
from sqlalchemy import func


@tools_router.get("/admin-stats")
def get_admin_stats(db: Session = Depends(get_db)):
    from ile_app.models import User, ToolData
    from sqlalchemy import func
    
    users = db.query(User).all()
    user_data = [{"name": u.name, "email": u.email, "is_admin": u.is_admin} for u in users]
    
    tool_counts = db.query(ToolData.tool_name, func.count(ToolData.id)).group_by(ToolData.tool_name).all()
    labels = [tc[0] for tc in tool_counts] if tool_counts else ['No Data']
    data = [tc[1] for tc in tool_counts] if tool_counts else [1]

    return {
        "users": len(users),
        "user_list": user_data,
        "tool_labels": labels,
        "tool_data": data
    }


from pydantic import BaseModel
class ChatRequest(BaseModel):
    prompt: str

@tools_router.post("/chat")
def ollama_chat(req: ChatRequest, db: Session = Depends(get_db)):
    import requests
    try:
        response = requests.post('http://localhost:11434/api/generate', json={
            "model": "llama3",
            "prompt": req.prompt,
            "stream": False
        })
        ai_resp = response.json().get('response', '')
        
        from ile_app.models import ToolData
        new_data = ToolData(tool_name="Main AI Chat", data=req.prompt)
        db.add(new_data)
        db.commit()
        
        return {"response": ai_resp}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
