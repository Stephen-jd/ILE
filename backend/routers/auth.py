from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from ile_project_settings import get_db
from ile_app.models import User
from backend.auth import create_access_token
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

@router.get("/login")
async def login(request: Request):
    redirect_uri = request.url_for('auth')
    return await oauth.google.authorize_redirect(request, redirect_uri)

@router.get("/auth")
async def auth(request: Request, db: Session = Depends(get_db)):
    try:
        token = await oauth.google.authorize_access_token(request)
        user_info = token.get('userinfo')
        if not user_info:
            raise HTTPException(status_code=400, detail="Could not validate credentials")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    email = user_info.get("email")
    name = user_info.get("name")
    picture = user_info.get("picture")

    user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(email=email, name=name, picture=picture)
        db.add(user)
        db.commit()
        db.refresh(user)

    access_token = create_access_token(data={"sub": user.email, "id": user.id})
    
    # Redirect to frontend with token
    response = RedirectResponse(url=f"/?token={access_token}")
    response.set_cookie(key="access_token", value=f"Bearer {access_token}", httponly=True)
    return response

@router.get("/me")
def read_users_me(request: Request, db: Session = Depends(get_db)):
    from backend.auth import decode_access_token
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        token = request.cookies.get("access_token")
        if token and token.startswith('Bearer '):
            token = token.split(" ")[1]
        else:
            raise HTTPException(status_code=401, detail="Not authenticated")
    else:
        token = auth_header.split(" ")[1]

    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = db.query(User).filter(User.id == payload.get("id")).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
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
