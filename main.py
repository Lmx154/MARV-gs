import sys


def main():
    print("Python:", sys.version)
    try:
        import fastapi
        print("fastapi:", fastapi.__version__)
    except Exception as e:
        print("fastapi: not installed -", e)

    try:
        import uvicorn
        print("uvicorn:", uvicorn.__version__)
    except Exception as e:
        print("uvicorn: not installed -", e)

    try:
        import serial
        print("pyserial:", serial.VERSION)
    except Exception as e:
        print("pyserial: not installed -", e)

    try:
        import PyQt6
        # PyQt6 doesn't have a simple __version__ attr; get from pkg resources if available
        try:
            from importlib.metadata import version
            print("PyQt6:", version("PyQt6"))
        except Exception:
            print("PyQt6: installed")
    except Exception as e:
        print("PyQt6: not installed -", e)


if __name__ == "__main__":
    main()
