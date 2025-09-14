# Project Checkpoints

We will proceed incrementally and only move to the next phase after verifying the current one.

- [x] Checkpoint 1: Project Setup and Dependency Management
	- Initialize project structure under `src/`
	- Add `pyproject.toml` managed by UV
	- Add core deps: fastapi, uvicorn, pyserial, pyqt6
	- Create `main.py` to print versions and verify env via `uv run`

- [x] Checkpoint 2: Serial Manager with State Machine
	- Implement `SerialManager` class with FSM and logging
	- Methods: `open_port`, `close_port`, `write_command`
	- Thread-safe access and 20Hz loop placeholder
	- Unit tests (pytest) for state transitions

- [x] Checkpoint 3: FastAPI Backend with API Endpoints
	- REST: `/open`, `/close`, `/write` with Pydantic models
	- WebSocket `/ws` streaming at 20Hz
	- Integrate `SerialManager`

- [ ] Checkpoint 4: Frontend Integration
	- Basic HTML/JS with buttons and live data via WebSocket
	- Serve statically via FastAPI

- [ ] Checkpoint 5: Backend Desktop UI
	- PyQt6 GUI to start/stop server and show logs

- [ ] Checkpoint 6: Full Integration and Polish
	- Error handling, config, docs, end-to-end tests