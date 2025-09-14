from __future__ import annotations

import os
import sys
from pathlib import Path

from PyQt6.QtCore import QProcess, Qt, QTimer
from PyQt6.QtGui import QAction
from PyQt6.QtWidgets import (
    QApplication,
    QGridLayout,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QMainWindow,
    QMessageBox,
    QPushButton,
    QTextEdit,
    QWidget,
)


class ServerWindow(QMainWindow):
    def __init__(self) -> None:
        super().__init__()
        self.setWindowTitle("MARV-gs Server UI")
        self.resize(900, 600)

        central = QWidget(self)
        self.setCentralWidget(central)
        layout = QGridLayout(central)

        # Controls
        self.host_edit = QLineEdit("127.0.0.1")
        self.port_edit = QLineEdit("8000")
        self.start_btn = QPushButton("Start Server")
        self.stop_btn = QPushButton("Stop Server")
        self.open_ui_btn = QPushButton("Open Test UI")
        self.log_view = QTextEdit()
        self.log_view.setReadOnly(True)
        self.log_view.setLineWrapMode(QTextEdit.LineWrapMode.NoWrap)

        layout.addWidget(QLabel("Host:"), 0, 0)
        layout.addWidget(self.host_edit, 0, 1)
        layout.addWidget(QLabel("Port:"), 0, 2)
        layout.addWidget(self.port_edit, 0, 3)
        layout.addWidget(self.start_btn, 0, 4)
        layout.addWidget(self.stop_btn, 0, 5)
        layout.addWidget(self.open_ui_btn, 0, 6)
        layout.addWidget(self.log_view, 1, 0, 1, 7)

        self.proc = QProcess(self)
        self.proc.setProcessChannelMode(QProcess.ProcessChannelMode.MergedChannels)
        self.proc.readyReadStandardOutput.connect(self._on_proc_output)
        self.proc.errorOccurred.connect(self._on_proc_error)
        self.proc.finished.connect(self._on_proc_finished)

        self.start_btn.clicked.connect(self.start_server)
        self.stop_btn.clicked.connect(self.stop_server)
        self.open_ui_btn.clicked.connect(self.open_test_ui)

        self._update_buttons()

    def _append_log(self, text: str) -> None:
        self.log_view.moveCursor(self.log_view.textCursor().MoveOperation.End)
        self.log_view.insertPlainText(text)
        self.log_view.moveCursor(self.log_view.textCursor().MoveOperation.End)

    def _on_proc_output(self) -> None:
        data = self.proc.readAllStandardOutput()
        try:
            text = bytes(data).decode("utf-8", errors="replace")
        except Exception:
            text = str(bytes(data))
        self._append_log(text)

    def _on_proc_error(self, err) -> None:  # noqa: ANN001
        self._append_log(f"\n[process error] {err}\n")
        self._update_buttons()

    def _on_proc_finished(self, code: int, status) -> None:  # noqa: ANN001
        self._append_log(f"\n[process finished] code={code}\n")
        self._update_buttons()

    def _update_buttons(self) -> None:
        running = self.proc.state() != QProcess.ProcessState.NotRunning
        self.start_btn.setEnabled(not running)
        self.stop_btn.setEnabled(running)

    def _python_exe(self) -> str:
        # Prefer the current interpreter in a UV/venv context
        return sys.executable

    def start_server(self) -> None:
        if self.proc.state() != QProcess.ProcessState.NotRunning:
            return
        host = self.host_edit.text().strip() or "127.0.0.1"
        port = self.port_edit.text().strip() or "8000"
        try:
            int(port)
        except ValueError:
            QMessageBox.warning(self, "Invalid Port", "Port must be a number")
            return

        # Prefer in-process server for packaged builds; fallback to external process in dev
        try:
            import threading
            import uvicorn

            # Use a simple logging config to avoid uvicorn's 'default' formatter (not importable when frozen)
            LOG_CONFIG = {
                "version": 1,
                "disable_existing_loggers": False,
                "formatters": {
                    "standard": {"format": "%(asctime)s %(levelname)s %(name)s: %(message)s"}
                },
                "handlers": {
                    "console": {"class": "logging.StreamHandler", "formatter": "standard", "stream": "ext://sys.stdout"}
                },
                "loggers": {
                    "uvicorn": {"handlers": ["console"], "level": "INFO"},
                    "uvicorn.error": {"handlers": ["console"], "level": "INFO", "propagate": False},
                    "uvicorn.access": {"handlers": ["console"], "level": "INFO", "propagate": False},
                },
            }

            if getattr(sys, 'frozen', False):
                # Frozen build: run uvicorn in a thread (no reload)
                self._append_log(f"Starting embedded server on {host}:{port}\n")
                config = uvicorn.Config(
                    "src.backend.app:app",
                    host=host,
                    port=int(port),
                    reload=False,
                    log_level="info",
                    log_config=LOG_CONFIG,
                )
                self._server = uvicorn.Server(config)
                self._thread = threading.Thread(target=self._server.run, daemon=True)
                self._thread.start()
            else:
                # Dev: use external process with reload
                project_root = str(Path(__file__).resolve().parents[2])
                self.proc.setWorkingDirectory(project_root)
                python = self._python_exe()
                args = ["-m", "uvicorn", "src.backend.app:app", "--host", host, "--port", port, "--reload"]
                self._append_log(f"Starting server on {host}:{port}\n")
                self.proc.start(python, args)

        except Exception as e:  # noqa: BLE001
            QMessageBox.critical(self, "Start Failed", str(e))
        finally:
            self._update_buttons()

    def stop_server(self) -> None:
        self._append_log("Stopping server...\n")
        try:
            if getattr(self, "_server", None) is not None:
                # uvicorn.Server lacks a public stop; use should_exit flag
                self._server.should_exit = True  # type: ignore[attr-defined]
                if getattr(self, "_thread", None) is not None:
                    self._thread.join(timeout=2.0)
                self._server = None
                self._thread = None
            else:
                if self.proc.state() != QProcess.ProcessState.NotRunning:
                    self.proc.terminate()
                    if not self.proc.waitForFinished(2000):
                        self.proc.kill()
        finally:
            self._update_buttons()

    def open_test_ui(self) -> None:
        import webbrowser
        host = self.host_edit.text().strip() or "127.0.0.1"
        port = self.port_edit.text().strip() or "8000"
        url = f"http://{host}:{port}/test-ui/"
        webbrowser.open(url)


def main() -> int:
    app = QApplication(sys.argv)
    w = ServerWindow()
    w.show()
    return app.exec()


if __name__ == "__main__":
    raise SystemExit(main())
