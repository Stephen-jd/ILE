import io
import os
import re
import secrets
import string
from urllib.parse import urlsplit

import requests
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import Response
from gtts import gTTS
from pypdf import PdfReader
from sqlalchemy.orm import Session

from ile_app.models import ShortURL
from ile_project_settings import get_db

tools_router = APIRouter()
OLLAMA_URL = os.getenv("ILE_OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("ILE_OLLAMA_MODEL", "llama3")


def _ask_ollama(prompt: str) -> str:
    try:
        response = requests.post(
            f"{OLLAMA_URL.rstrip('/')}/api/generate",
            json={"model": OLLAMA_MODEL, "prompt": prompt, "stream": False},
            timeout=120,
        )
        response.raise_for_status()
        answer = response.json().get("response", "").strip()
        if not answer:
            raise HTTPException(status_code=502, detail="The local AI model returned an empty response.")
        return answer
    except requests.RequestException as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Ollama is unavailable. Start Ollama and install the '{OLLAMA_MODEL}' model.",
        ) from exc


def _read_pdf(contents: bytes) -> str:
    try:
        reader = PdfReader(io.BytesIO(contents))
        text = "\n".join(page.extract_text() or "" for page in reader.pages).strip()
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Could not read this PDF. Check that it is a valid, unencrypted PDF.") from exc
    if not text:
        raise HTTPException(status_code=400, detail="No selectable text was found in this PDF.")
    return text


def generate_short_code(length: int = 6) -> str:
    return "".join(secrets.choice(string.ascii_letters + string.digits) for _ in range(length))


@tools_router.get("/health")
def health_check():
    return {"status": "ok"}


@tools_router.post("/shorten")
def create_short_url(request: Request, payload: dict, db: Session = Depends(get_db)):
    original_url = (payload or {}).get("url", "").strip()
    if not original_url:
        raise HTTPException(status_code=400, detail="URL is required")
    parsed_url = urlsplit(original_url)
    if parsed_url.scheme and parsed_url.scheme not in {"http", "https"}:
        raise HTTPException(status_code=400, detail="Enter a valid HTTP or HTTPS URL")
    if not parsed_url.scheme:
        original_url = "https://" + original_url
    try:
        parsed_url = urlsplit(original_url)
        valid_destination = parsed_url.scheme in {"http", "https"} and bool(parsed_url.hostname)
        parsed_url.port
    except ValueError:
        valid_destination = False
    if not valid_destination:
        raise HTTPException(status_code=400, detail="Enter a valid HTTP or HTTPS URL")

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
        buffer = io.BytesIO()
        gTTS(text=text, lang=language, slow=False).write_to_fp(buffer)
        return Response(content=buffer.getvalue(), media_type="audio/mpeg")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not generate speech for this language: {exc}") from exc


@tools_router.post("/pdf-to-text")
async def pdf_to_text(pdf: UploadFile = File(...)):
    return {"text": _read_pdf(await pdf.read())}


@tools_router.post("/resume-analyzer")
async def resume_analyzer(job_description: str = Form(...), resume: UploadFile = File(...)):
    resume_text = _read_pdf(await resume.read())[:18000]
    job_description = job_description.strip()
    if not job_description:
        raise HTTPException(status_code=400, detail="A job description is required.")

    answer = _ask_ollama(
        "Compare this resume with the job description. Return a match score from 0 to 100, "
        "then summarize matching skills, missing skills, and concrete resume improvements. "
        "Do not invent experience.\n\n"
        f"JOB DESCRIPTION:\n{job_description[:12000]}\n\nRESUME:\n{resume_text}"
    )
    score_match = re.search(r"(?:score|match)[^0-9]{0,20}(\d{1,3})\s*(?:/\s*100|%)?", answer, re.IGNORECASE)
    score = min(100, int(score_match.group(1))) if score_match else None
    return {"score": score if score is not None else "N/A", "analysis": answer, "corrections": "See the analysis above for suggested improvements."}


@tools_router.post("/explain-code")
def explain_code(payload: dict):
    code = (payload or {}).get("code", "").strip()
    if not code:
        raise HTTPException(status_code=400, detail="Paste code to explain.")
    return {"explanation": _ask_ollama(f"Explain this code clearly for a beginner. Describe its purpose and important steps.\n\n{code[:16000]}")}


@tools_router.post("/beautify-message")
def beautify_message(payload: dict):
    message = (payload or {}).get("message", "").strip()
    if not message:
        raise HTTPException(status_code=400, detail="Enter a draft message first.")
    return {"beautified": _ask_ollama(f"Rewrite this message to be clear, polite, and grammatically correct. Preserve its original meaning. Return only the rewritten message.\n\n{message[:12000]}")}
