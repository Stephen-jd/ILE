from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import User
from backend.auth import create_access_token

dev_router = APIRouter()

@dev_router.get("/dev-admin-login")
def dev_admin_login(db: Session = Depends(get_db)):
    """A developer backdoor to login as an admin instantly without Google OAuth."""
    email = "admin@ile.local"
    user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(email=email, name="Super Admin", is_admin=True)
        db.add(user)
        db.commit()
        db.refresh(user)

    if not user.is_admin:
        user.is_admin = True
        db.commit()

    access_token = create_access_token(data={"sub": user.email, "id": user.id})

    response = RedirectResponse(url=f"/?token={access_token}")
    response.set_cookie(key="access_token", value=access_token, httponly=True)
    return response
