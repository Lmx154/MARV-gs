from __future__ import annotations

import json
import logging
import os
import time
from pathlib import Path
import sys
from typing import Callable, Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi import status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from starlette.staticfiles import StaticFiles

from .serial_manager import SerialManager, SerialState, list_serial_devices
from contextlib import asynccontextmanager


logger = logging.getLogger(__name__)


class OpenRequest(BaseModel):
    port: str = Field(..., description="Serial port e.g. COM3 or /dev/ttyUSB0")
    baud: int = Field(..., ge=1200, le=10000000, description="Baud rate")


class WriteRequest(BaseModel):
    cmd: str = Field(..., min_length=1)


class ConnectionManager:
    def __init__(self) -> None:
        self.active: set[WebSocket] = set()

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active.add(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        self.active.discard(websocket)

    async def broadcast_json(self, message: dict) -> None:
        dead: list[WebSocket] = []
        data = json.dumps(message)
        for ws in list(self.active):
            try:
                await ws.send_text(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


def _frontend_dir() -> str:
    """Resolve the frontend directory in dev and frozen (PyInstaller) builds.

    In frozen builds, PyInstaller extracts files under sys._MEIPASS.
    """
    base = getattr(sys, "_MEIPASS", None)
    if base:
        return str(Path(base) / "src" / "frontend")
    here = Path(__file__).resolve()
    root = here.parents[2]
    return str(root / "src" / "frontend")


def create_app(*, serial_factory: Optional[Callable[..., object]] = None) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        import asyncio
        app.state.loop = asyncio.get_running_loop()
        try:
            yield
        finally:
            app.state.loop = None

    app = FastAPI(title="MARV-gs Backend", version="0.1.0", lifespan=lifespan)

    # CORS optional (local dev convenience)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    ws_manager = ConnectionManager()
    serial_mgr = SerialManager(serial_factory=serial_factory)
    app.state.loop = None  # will be set on startup

    # Bridge SerialManager data -> WebSocket broadcast
    def on_line(line: str) -> None:
        # Schedule broadcast on the main event loop from reader thread
        try:
            import asyncio
            loop = getattr(app.state, "loop", None)
            if loop is not None:
                loop.call_soon_threadsafe(
                    asyncio.create_task,
                    ws_manager.broadcast_json({"type": "data", "line": line, "ts": time.time()}),
                )
        except Exception:
            logger.exception("Broadcast schedule failure")

    serial_mgr.register_listener(on_line)

    @app.post("/open")
    async def open_port(req: OpenRequest):
        try:
            serial_mgr.open_port(req.port, req.baud)
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
        # notify clients of state
        await ws_manager.broadcast_json({"type": "status", "state": serial_mgr.state.name.lower()})
        return {"state": serial_mgr.state.name.lower(), "port": req.port, "baud": req.baud}

    @app.post("/close")
    async def close_port():
        serial_mgr.close_port()
        await ws_manager.broadcast_json({"type": "status", "state": serial_mgr.state.name.lower()})
        return {"state": serial_mgr.state.name.lower()}

    @app.get("/serial/devices")
    async def get_serial_devices():
        try:
            devices = list_serial_devices()
        except Exception as e:  # noqa: BLE001
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
        return {"devices": devices}

    @app.post("/write")
    async def write(req: WriteRequest):
        try:
            n = serial_mgr.write_command(req.cmd)
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
        return {"written": n}

    @app.websocket("/ws")
    async def websocket_endpoint(websocket: WebSocket):
        await ws_manager.connect(websocket)
        try:
            # Send immediate status snapshot
            await websocket.send_text(json.dumps({"type": "status", "state": serial_mgr.state.name.lower()}))
            while True:
                # Keep connection open; receive to detect disconnects
                try:
                    await websocket.receive_text()
                except WebSocketDisconnect:
                    break
        finally:
            ws_manager.disconnect(websocket)

    # Static frontend
    frontend_dir = _frontend_dir()
    if os.path.isdir(frontend_dir):
        # Mount last so that API routes take precedence
        app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="static")

    # Expose objects for testing
    app.state.serial_mgr = serial_mgr
    app.state.ws_manager = ws_manager
    return app

# default ASGI app
app = create_app()
