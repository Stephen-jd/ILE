from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import User
from backend.auth import create_access_token, get_current_user
from authlib.integrations.starlette_client import OAuth
from starlette.config import Config
import json
import os

router = APIRouter()

# Load Google secrets
try:
    with open("client_secret.json", "r") as f:
        creds = json.load(f)["web"]
    GOOGLE_CLIENT_ID = creds["client_id"]
    GOOGLE_CLIENT_SECRET = creds["client_secret"]
except FileNotFoundError:
    print("Warning: client_secret.json not found. Google login will fail.")
    GOOGLE_CLIENT_ID = ""
    GOOGLE_CLIENT_SECRET = ""

config = Config(environ={"GOOGLE_CLIENT_ID": GOOGLE_CLIENT_ID, "GOOGLE_CLIENT_SECRET": GOOGLE_CLIENT_SECRET})
oauth = OAuth(config)

oauth.register(
    name='google',
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    client_kwargs={
        'scope': 'openid email profile'
    }
)

@router.get("/config")
def google_auth_config():
    return {"enabled": bool(GOOGLE_CLIENT_ID), "client_id": GOOGLE_CLIENT_ID}

@router.get("/login")
async def login(request: Request):
    redirect_uri = 'http://127.0.0.1:8000/accounts/google/login/callback/'
    return await oauth.google.authorize_redirect(request, redirect_uri)

@router.get("/me")
def read_users_me(user: User = Depends(get_current_user)):
    return {"id": user.id, "email": user.email, "name": user.name, "picture": user.picture, "is_admin": user.is_admin}

from pydantic import BaseModel
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

class OneTapRequest(BaseModel):
    credential: str

@router.post("/onetap")
async def onetap(data: OneTapRequest, db: Session = Depends(get_db)):
    try:
        idinfo = id_token.verify_oauth2_token(data.credential, google_requests.Request(), GOOGLE_CLIENT_ID)
        email = idinfo['email']
        name = idinfo.get('name', '')
        picture = idinfo.get('picture', '')
        
        user = db.query(User).filter(User.email == email).first()
        if not user:
            user = User(email=email, name=name, picture=picture)
            db.add(user)
            db.commit()
            db.refresh(user)

        access_token = create_access_token(data={"sub": user.email, "id": user.id})
        return {"token": access_token}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
