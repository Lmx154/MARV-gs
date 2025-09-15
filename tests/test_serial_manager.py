import threading
import time
from typing import List

import pytest

from src.backend.serial_manager import SerialManager, SerialState, SerialStateError, list_serial_devices


class FakeSerial:
    def __init__(self, *, port: str, baudrate: int, timeout: float):
        self.port = port
        self.baudrate = baudrate
        self.timeout = timeout
        self.is_open = True
        self._buffer = [b"hello\n", b"world\n"]
        self._lock = threading.Lock()

    def close(self):
        self.is_open = False

    def write(self, data: bytes) -> int:
        with self._lock:
            if not self.is_open:
                raise IOError("Port closed")
            # Accept any write
            return len(data)

    def readline(self) -> bytes:
        time.sleep(0.01)
        with self._lock:
            if not self._buffer:
                return b""
            return self._buffer.pop(0)


def serial_factory(**kwargs):
    return FakeSerial(**kwargs)


def test_open_and_close_transitions():
    mgr = SerialManager(serial_factory=serial_factory)
    assert mgr.state == SerialState.CLOSED

    mgr.open_port("COM1", 115200)
    # Slight wait to allow thread start
    time.sleep(0.05)
    assert mgr.state == SerialState.OPEN

    mgr.close_port()
    assert mgr.state == SerialState.CLOSED


def test_double_open_rejected():
    mgr = SerialManager(serial_factory=serial_factory)
    mgr.open_port("COM1", 115200)
    with pytest.raises(SerialStateError):
        mgr.open_port("COM1", 115200)
    mgr.close_port()


def test_write_only_when_open():
    mgr = SerialManager(serial_factory=serial_factory)
    with pytest.raises(SerialStateError):
        mgr.write_command("CMD")
    mgr.open_port("COM1", 115200)
    n = mgr.write_command("CMD")
    assert n > 0
    mgr.close_port()


def test_listener_receives_reads():
    mgr = SerialManager(serial_factory=serial_factory)
    received: List[str] = []
    mgr.register_listener(received.append)
    mgr.open_port("COM1", 115200)
    # Allow time for two buffer entries
    time.sleep(0.2)
    mgr.close_port()
    assert any("hello" in s for s in received)
    assert any("world" in s for s in received)


def test_list_serial_devices_monkeypatch(monkeypatch):
    class Port:
        def __init__(self, device, description, hwid):
            self.device = device
            self.description = description
            self.hwid = hwid

    # Patch the helper used by list_serial_devices
    from src.backend import serial_manager as sm

    monkeypatch.setattr(
        sm,
        "_iter_comports",
        lambda: [
            Port("COM3", "USB-Serial", "USB VID:PID=1A86:7523"),
            Port("COM4", "Arduino", "USB VID:PID=2341:0043"),
        ],
    )

    devices = list_serial_devices()
    assert {d["port"] for d in devices} == {"COM3", "COM4"}
