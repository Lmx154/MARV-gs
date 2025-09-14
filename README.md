# MARV-gs

FastAPI + PySerial + WebSocket backend with a minimal PyQt6 desktop launcher.

## Install UV (recommended)
- Install instructions: https://docs.astral.sh/uv/
- Verify it’s available:
```powershell
uv --version
```

## Quick commands (Windows PowerShell)

- Install deps (create/update venv):
```powershell
uv sync
```

- Run backend (dev):
```powershell
uv run uvicorn src.backend.app:app --reload
```

- Open test UI (in browser):
```
http://localhost:8000/test-ui/
```

- Start desktop UI (launch/stop server, view logs):
```powershell
uv run python -m src.ui.server_ui
```

- Build one-file EXE (packaged app):
```powershell
uv run python build.py --onefile
```

- Build one-dir app (faster start):
```powershell
uv run python build.py --onedir
```

- Run packaged app:
```powershell
./dist/MARV-gs.exe
```

Where to find the EXE
- One-file build: `dist\MARV-gs.exe`
- One-dir build: `dist\MARV-gs\MARV-gs.exe`

Notes
- API details are in `API.md`.

## Tests and coverage

- Run tests (quiet):
```powershell
uv run pytest -q
```

- Run tests with coverage summary (for `src/`):
```powershell
uv run pytest -q --cov=src --cov-report=term-missing
```

Tips
- Use `-k name` to run specific tests.

