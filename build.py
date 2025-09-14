"""
Build the MARV-gs desktop application into a Windows EXE using PyInstaller.

Usage (PowerShell):
  uv run python build.py --onefile
  uv run python build.py --onedir

By default, builds one-file EXE.
"""
from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent
SRC_DIR = REPO_ROOT / "src"
FRONTEND_DIR = SRC_DIR / "frontend"
ENTRYPOINT = SRC_DIR / "ui" / "server_ui.py"
DIST_DIR = REPO_ROOT / "dist"
BUILD_DIR = REPO_ROOT / "build"
SPEC_DIR = REPO_ROOT / "spec"


def ensure_tools() -> None:
    try:
        import PyInstaller  # noqa: F401
    except Exception:  # noqa: BLE001
        print("PyInstaller not found. Installing dev dependency...", flush=True)
        subprocess.check_call([sys.executable, "-m", "pip", "install", "pyinstaller"])  # fallback if uv not used


def pyinstaller_args(onefile: bool) -> list[str]:
    add_data = f"{FRONTEND_DIR};src\\frontend"  # src path;dest path (Windows ';' separator)
    base_args = [
        "pyinstaller",
        "--noconfirm",
        "--noconsole",
        "--name", "MARV-gs",
        "--add-data", add_data,
        "-p", str(SRC_DIR),
        str(ENTRYPOINT),
    ]
    if onefile:
        base_args.insert(1, "--onefile")
    return base_args


def run() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--onefile", action="store_true", help="Build a single-file EXE (default)")
    parser.add_argument("--onedir", action="store_true", help="Build a folder-based app")
    args = parser.parse_args()

    onefile = True
    if args.onedir:
        onefile = False
    elif args.onefile:
        onefile = True

    ensure_tools()

    # Clean previous outputs
    for p in (DIST_DIR, BUILD_DIR, SPEC_DIR):
        if p.exists():
            print(f"Removing {p}")
            shutil.rmtree(p, ignore_errors=True)

    cmd = pyinstaller_args(onefile)
    print("Running:", " ".join(cmd))
    try:
        subprocess.check_call(cmd)
    except subprocess.CalledProcessError as e:
        print("Build failed:", e)
        return e.returncode

    out = DIST_DIR / ("MARV-gs.exe" if onefile else "MARV-gs")
    if out.exists():
        print("Build succeeded:", out)
        return 0
    else:
        print("Build finished but expected output not found.")
        return 1


if __name__ == "__main__":
    raise SystemExit(run())
