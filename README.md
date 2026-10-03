# ILE - I Love Everything

ILE is a small multi-tool workspace with a FastAPI backend, SQLite database, and browser-based interface. The dashboard includes Resume Analyzer, Text to Image, Code Explainer, Markdown to HTML, Message Beautifier, PDF to Text, Text to Audio, and Image Resize.

## Requirements

- Python 3.10 or newer
- Python packages from `requirements.txt`
- Internet access for gTTS and online image generation
- Ollama plus an installed model (default: `llama3`) for Resume Analyzer, Code Explainer, and Message Beautifier
- Optional Google OAuth credentials in `client_secret.json` for login; tool use does not require login

Scanned image-only PDFs are not OCR'd. Image Resize and Markdown conversion run locally in the browser. Full setup details are on `/how-it-works.html`.

## Run locally

```powershell
python -m pip install -r requirements.txt
ollama pull llama3
python main.py
```

Open `http://127.0.0.1:8000/`. Ollama is only required for the three AI analysis tools. Set `ILE_OLLAMA_MODEL` or `ILE_OLLAMA_URL` to use another local model or Ollama address.

## Main structure

```text
frontend/       Dashboard, styles, browser tool workflows
ile_app/views.py FastAPI tool endpoints
ile_app/models.py SQLite models
ile_project_settings.py SQLite connection
main.py         Application startup and static hosting
```

