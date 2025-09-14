# Desktop Server UI (PyQt6)

A simple cross-platform PyQt6 app to start/stop the FastAPI backend and view live server logs.

## Run
```powershell
uv run python -m src.ui.server_ui
```

## Features
- Start/Stop Uvicorn server (uses current Python/venv)
- Configure host/port
- View combined stdout/stderr logs
- Open the Test UI in your default browser

## Notes
- The server runs with `--reload` for convenience. Disable in production.
- The UI uses the project root as the working directory so static files resolve correctly.
