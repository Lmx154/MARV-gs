import json
import time
from typing import List

import pytest
from fastapi.testclient import TestClient

from src.backend.app import create_app


class FakeSerial:
    def __init__(self, *, port: str, baudrate: int, timeout: float):
        self.port = port
        self.baudrate = baudrate
        self.timeout = timeout
        self.is_open = True
        self._lines = [b"line1\n", b"line2\n"]

    def close(self):
        self.is_open = False

    def write(self, data: bytes) -> int:
        if not self.is_open:
            raise IOError("closed")
        return len(data)

    def readline(self) -> bytes:
        time.sleep(0.01)
        if self._lines:
            return self._lines.pop(0)
        return b""


def serial_factory(**kwargs):
    return FakeSerial(**kwargs)


def test_open_write_close_cycle():
    app = create_app(serial_factory=serial_factory)
    with TestClient(app) as client:
        # Initially closed
        with client.websocket_connect("/ws") as ws:
            msg = ws.receive_text()
            first = json.loads(msg)
            assert first["type"] == "status"
            assert first["state"] == "closed"

    # Keep a WS open to receive broadcasts
    with TestClient(app) as client:
        with client.websocket_connect("/ws") as ws:
            status_msg = json.loads(ws.receive_text())
            assert status_msg["state"] == "closed"

            # Open
            r = client.post("/open", json={"port": "COM9", "baud": 115200})
            assert r.status_code == 200
            # Consume status broadcast to open
            status_msg2 = json.loads(ws.receive_text())
            assert status_msg2["type"] == "status"
            assert status_msg2["state"] == "open"

            # Write
            w = client.post("/write", json={"cmd": "CMD"})
            assert w.status_code == 200
            assert w.json()["written"] > 0

            # WebSocket should deliver data
            data = json.loads(ws.receive_text())
            assert data["type"] == "data"
            assert "line" in data

    # Close
    c = client.post("/close")
    assert c.status_code == 200
    assert c.json()["state"] == "closed"


def test_write_rejected_when_closed():
    app = create_app(serial_factory=serial_factory)
    with TestClient(app) as client:
        w = client.post("/write", json={"cmd": "X"})
        assert w.status_code == 409


def test_get_serial_devices_endpoint(monkeypatch):
    from src.backend import app as app_module

    def fake_list():
        return [
            {"port": "COM7", "description": "Test Device", "hwid": "USB VID:PID=0000:0000"},
            {"port": "COM8", "description": "Another", "hwid": "USB VID:PID=0000:0001"},
        ]

    # Patch the reference used inside the app module
    monkeypatch.setattr(app_module, "list_serial_devices", fake_list)

    app = create_app(serial_factory=serial_factory)
    with TestClient(app) as client:
        r = client.get("/serial/devices")
        assert r.status_code == 200
        data = r.json()
        assert "devices" in data
        ports = {d["port"] for d in data["devices"]}
        assert ports == {"COM7", "COM8"}
