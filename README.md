# ILE - I Love Everything

ILE is a lightweight AI text-to-audio app built with FastAPI, SQLite, and gTTS.

## What this project does

- Accepts text input from the browser
- Lets the user select a language
- Converts the text into spoken audio
- Returns the audio file to the browser
- Plays the generated voice automatically

## Main flow

1. User opens the app page
2. User types or pastes text
3. User selects the language
4. Frontend sends the request to the backend
5. Backend uses gTTS to generate audio
6. Browser plays the audio result

## Tech stack

- Backend: FastAPI
- Database: SQLite
- Frontend: HTML + JavaScript
- Voice generation: gTTS

## Project structure

```text
ILE/
├── backend/
│   ├── auth.py
│   ├── routers/
│   │   ├── auth.py
│   │   └── dev.py
│   └── services/
├── frontend/
│   ├── css/
│   ├── js/
│   ├── how-it-works.html
│   └── index.html
├── ile_app/
│   ├── models.py
│   └── views.py
├── main.py
├── ile_project_settings.py
├── README.md
├── .gitignore
└── ile.db
```

## Run locally

1. Activate the virtual environment:

```powershell
.\venv\Scripts\Activate.ps1
```

2. Start the app:

```powershell
python main.py
```

3. Open in browser:

```text
http://127.0.0.1:8000/
```

## Notes

- This project uses SQLite, not MySQL.
- The app is intentionally small and clean.
- There is a dedicated explanation page at /how-it-works.html

## Clean project status

The repository has been simplified to keep only the real app structure and remove the one-off admin and repair files.
