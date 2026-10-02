from fastapi import FastAPI, Request, Depends, HTTPException
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from ile_project_settings import engine, Base, get_db
from ile_app.models import ShortURL
from backend.routers import auth, dev
from ile_app import views
import os

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="I Love Everything API")

# We need session middleware for Authlib
app.add_middleware(SessionMiddleware, secret_key="some-random-string")

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(dev.dev_router, prefix="/api/dev", tags=["dev"])
app.include_router(views.tools_router, prefix="/api/tools", tags=["tools"])

@app.get("/s/{short_code}")
def redirect_to_url(short_code: str, db: Session = Depends(get_db)):
    db_url = db.query(ShortURL).filter(ShortURL.short_code == short_code).first()
    if not db_url:
        raise HTTPException(status_code=404, detail="URL not found")
    
    db_url.clicks += 1
    db.commit()
    return RedirectResponse(url=db_url.original_url)

# Mount static files for frontend
frontend_dir = os.path.join(os.path.dirname(__file__), "frontend")
app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
