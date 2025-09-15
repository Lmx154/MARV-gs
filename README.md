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

- Run the MARV GUI (Vite dev, auto-proxy to backend):
```powershell
cd src/frontend/MARV-gui
npm install
npm run dev
```
Then open:
```
http://localhost:5173/
```
The dev server proxies API/WebSocket calls to http://localhost:8000.

- Start desktop UI (launch/stop server, view logs):
```powershell
uv run python -m src.ui.server_ui
```
From the window, click "Open GUI" to launch the integrated dashboard. If a production build exists it opens http://localhost:8000/gui/; otherwise it opens the Vite dev server.

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
- The Vite-based MARV GUI is built into `src/frontend/gui` and packaged automatically (if Node/npm are available). In the packaged app, open http://127.0.0.1:8000/gui/.

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

