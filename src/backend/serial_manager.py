from __future__ import annotations

import logging
import threading
import time
from dataclasses import dataclass
from enum import Enum, auto
from typing import Callable, Optional, Protocol, List

try:
    import serial  # type: ignore
    from serial import SerialException  # type: ignore
except Exception:  # pragma: no cover - during static analysis without deps
    serial = None
    class SerialException(Exception):
        pass


class SerialState(Enum):
    CLOSED = auto()
    OPENING = auto()
    OPEN = auto()
    CLOSING = auto()
    ERROR = auto()


class SerialLike(Protocol):
    """Minimal interface for pyserial.Serial used by SerialManager."""

    port: str
    baudrate: int
    timeout: Optional[float]
    is_open: bool

    def close(self) -> None: ...
    def write(self, data: bytes) -> int: ...
    def readline(self) -> bytes: ...


class SerialStateError(RuntimeError):
    pass


class SerialOpenError(RuntimeError):
    pass


@dataclass
class SerialConfig:
    port: str
    baud: int
    timeout: float = 0.05  # seconds; aligns with 20Hz reading


def _iter_comports():
    """Internal helper to iterate available serial ports.

    Separated for easy monkeypatching in tests. Returns an iterable of objects
    that have at least attributes: device, description, and hwid.
    """
    try:  # Deferred import to avoid hard dependency during static analysis/tests
        from serial.tools import list_ports  # type: ignore
    except Exception:  # pragma: no cover - environment without pyserial
        return []
    try:
        return list_ports.comports()  # type: ignore[no-any-return]
    except Exception:  # pragma: no cover - unexpected runtime error
        return []


def list_serial_devices() -> List[dict]:
    """Enumerate connected serial devices.

    Returns a list of dicts with keys: 'port', 'description', 'hwid'.
    Safe to call even when pyserial is not installed; returns an empty list.
    """
    devices: List[dict] = []
    for p in _iter_comports() or []:
        try:
            port = getattr(p, "device", None) or getattr(p, "name", None) or ""
            desc = getattr(p, "description", "")
            hwid = getattr(p, "hwid", "")
            if port:
                devices.append({
                    "port": str(port),
                    "description": str(desc),
                    "hwid": str(hwid),
                })
        except Exception:
            # Skip malformed entries
            continue
    # Sort by port name for stable UI ordering
    devices.sort(key=lambda d: d.get("port", ""))
    return devices


class SerialManager:
    """
    Thread-safe serial connection manager with a finite state machine (FSM).

    - States: CLOSED -> OPENING -> OPEN -> CLOSING -> CLOSED, with ERROR handling
    - Provides open_port, close_port, write_command
    - Background reader thread emits data at ~20Hz via listener callbacks
    """

    def __init__(
        self,
        *,
        serial_factory: Optional[Callable[..., SerialLike]] = None,
        logger: Optional[logging.Logger] = None,
    ) -> None:
        self._logger = logger or logging.getLogger(__name__)
        self._state: SerialState = SerialState.CLOSED
        self._state_lock = threading.Lock()
        self._ser: Optional[SerialLike] = None
        self._read_thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        self._listeners: List[Callable[[str], None]] = []
        # Allow injection for tests; default to pyserial Serial
        self._serial_factory = serial_factory or self._default_serial_factory

    # -------------- Public API --------------
    @property
    def state(self) -> SerialState:
        with self._state_lock:
            return self._state

    def register_listener(self, fn: Callable[[str], None]) -> Callable[[], None]:
        self._listeners.append(fn)
        def unsubscribe() -> None:
            try:
                self._listeners.remove(fn)
            except ValueError:
                pass
        return unsubscribe

    def open_port(self, port: str, baud: int) -> None:
        with self._state_lock:
            if self._state in (SerialState.OPEN, SerialState.OPENING):
                raise SerialStateError("Port is already open or opening")
            self._transition_to(SerialState.OPENING)

        cfg = SerialConfig(port=port, baud=baud)
        self._logger.info("Opening serial port %s @ %d", cfg.port, cfg.baud)
        try:
            ser = self._serial_factory(port=cfg.port, baudrate=cfg.baud, timeout=cfg.timeout)
            # pyserial opens on construction; ensure flag reflects reality
            if not getattr(ser, "is_open", True):
                # some factories may require explicit open; try to open if available
                open_method = getattr(ser, "open", None)
                if callable(open_method):
                    open_method()

            self._ser = ser
        except Exception as e:
            self._logger.exception("Failed to open serial port: %s", e)
            with self._state_lock:
                self._transition_to(SerialState.ERROR)
            raise SerialOpenError(str(e))

        # Start background reader
        self._stop_event.clear()
        self._read_thread = threading.Thread(target=self._reader_loop, name="serial-reader", daemon=True)
        self._read_thread.start()

        with self._state_lock:
            self._transition_to(SerialState.OPEN)
        self._logger.info("Serial port opened")

    def close_port(self) -> None:
        with self._state_lock:
            if self._state in (SerialState.CLOSED, SerialState.CLOSING):
                self._logger.debug("close_port ignored; state=%s", self._state.name)
                return
            self._transition_to(SerialState.CLOSING)

        self._logger.info("Closing serial port")
        # Stop thread
        self._stop_event.set()
        if self._read_thread and self._read_thread.is_alive():
            self._read_thread.join(timeout=1.0)
        self._read_thread = None

        # Close serial
        try:
            if self._ser is not None:
                self._ser.close()
        except Exception as e:
            self._logger.exception("Error closing serial port: %s", e)
            with self._state_lock:
                self._transition_to(SerialState.ERROR)
            return
        finally:
            self._ser = None

        with self._state_lock:
            self._transition_to(SerialState.CLOSED)
        self._logger.info("Serial port closed")

    def reset_after_error(self) -> None:
        with self._state_lock:
            if self._state != SerialState.ERROR:
                return
            self._transition_to(SerialState.CLOSED)
            self._logger.info("State reset to CLOSED after error")

    def write_command(self, cmd: str) -> int:
        if not isinstance(cmd, str) or cmd.strip() == "":
            raise ValueError("Command must be a non-empty string")
        with self._state_lock:
            if self._state != SerialState.OPEN:
                raise SerialStateError("Cannot write when port is not open")
            ser = self._ser
        if ser is None:
            raise SerialStateError("Serial object missing in OPEN state")
        data = (cmd + "\n").encode("utf-8")
        try:
            n = ser.write(data)
            self._logger.debug("Wrote %d bytes", n)
            return n
        except Exception as e:
            self._logger.exception("Write failed: %s", e)
            with self._state_lock:
                self._transition_to(SerialState.ERROR)
            raise

    # -------------- Internals --------------
    def _transition_to(self, new_state: SerialState) -> None:
        self._logger.debug("State %s -> %s", self._state.name, new_state.name)
        self._state = new_state

    def _default_serial_factory(self, *, port: str, baudrate: int, timeout: float) -> SerialLike:
        if serial is None:
            raise RuntimeError("pyserial not available")
        return serial.Serial(port=port, baudrate=baudrate, timeout=timeout)

    def _emit(self, line: str) -> None:
        for fn in list(self._listeners):
            try:
                fn(line)
            except Exception:
                self._logger.exception("Listener error")

    def _reader_loop(self) -> None:
        self._logger.debug("Reader loop start")
        # Aim for ~20Hz
        interval = 0.05
        last = time.perf_counter()
        while not self._stop_event.is_set():
            try:
                ser = self._ser
                if ser is None:
                    break
                raw = ser.readline()  # should respect timeout set during open
                if raw:
                    try:
                        # Decode but preserve original content including newlines
                        line = raw.decode("utf-8", errors="replace")
                    except Exception:
                        line = str(raw)
                    self._logger.debug("Read: %s", line)
                    self._emit(line)
            except Exception as e:
                self._logger.exception("Read failed: %s", e)
                with self._state_lock:
                    self._transition_to(SerialState.ERROR)
                break

            # pacing for ~20Hz without busy-waiting
            now = time.perf_counter()
            dt = now - last
            if dt < interval:
                time.sleep(interval - dt)
            last = now
        self._logger.debug("Reader loop exit")
