# ILE - AI Tools Platform

This is a modern, modular, and extremely clean FastAPI backend designed to securely serve AI tools via a streamlined web interface.

## System Architecture (FastAPI)

The legacy Django-style folder structure (`ile_app`) has been completely removed and rewritten into a pure **FastAPI** modular router pattern:

```text
ILE/
├── main.py                   # Main FastAPI application & server initialization
├── backend/
│   ├── database.py           # SQLAlchemy setup (Engine, Session, Base)
│   ├── models.py             # Database Models (User, ToolData, ShortURL)
│   └── routers/
│       ├── auth.py           # Google One Tap & OAuth endpoints
│       └── tools.py          # All AI Tool API endpoints (Ollama, Resume, etc.)
└── frontend/                 # Static HTML/CSS/JS interface
```

## How the AI Tools Work

### 1. Main Ollama Chat (`/api/tools/chat`)
- **Frontend:** The central `tool-search` input bar at the top of the screen.
- **Backend:** Hits your local `llama3` instance via `http://localhost:11434/api/generate`.
- **Database Tracking:** Every prompt you run is instantly saved to the `tool_data` table.

### 2. Resume Analyzer (`/api/tools/resume-analyzer`)
- **Frontend:** The user uploads a PDF and pastes a Job Description.
- **Backend:** Uses the `pypdf` library to parse the text natively, then feeds it to the local Ollama engine for ATS scoring and skill analysis.

### 3. Text to Image (Pollinations API)
- **Frontend:** Completely handled natively in `app.js`. 
- **Backend:** Calls `image.pollinations.ai` with a random mathematical seed to bypass aggressive caching, ensuring your images never show up broken.

### 4. Database Tracking (`ToolData`)
Whenever any AI endpoint in `backend/routers/tools.py` successfully completes its task, it executes:
```python
new_data = ToolData(tool_name="[Tool Name]", data="[Input/Output Data]")
db.add(new_data)
db.commit()
```
This guarantees 100% accurate system design data-sharing so the Admin Dashboard works flawlessly.
