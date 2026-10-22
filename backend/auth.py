import jwt
from datetime import datetime, timedelta
from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session
from backend.database import get_db

SECRET_KEY = "super_secret_key_change_in_production"
ALGORITHM = "HS256"
TOKEN_EXPIRE_DAYS = 7


def create_access_token(data: dict) -> str:
    payload = data.copy()
    payload["exp"] = datetime.utcnow() + timedelta(days=TOKEN_EXPIRE_DAYS)
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.PyJWTError:
        return None


def get_current_user(request: Request, db: Session = Depends(get_db)):
    header = request.headers.get("Authorization", "")
    token = header.removeprefix("Bearer ").strip() if header.startswith("Bearer ") else ""
    token = token or request.cookies.get("access_token", "").removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    from backend.models import User
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = db.query(User).filter(User.id == payload.get("id")).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user
