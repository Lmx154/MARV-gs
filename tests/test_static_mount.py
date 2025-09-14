from fastapi.testclient import TestClient

from src.backend.app import create_app


def test_root_serves_html():
    app = create_app()
    with TestClient(app) as client:
        r = client.get("/")
        assert r.status_code == 200
        assert "text/html" in r.headers.get("content-type", "")