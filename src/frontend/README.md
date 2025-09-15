# Frontend and Test UI

This folder hosts the static files served by the backend and a modern React + TypeScript test UI for local verification.

## What changed?
- The legacy `test-ui/index.html` has been replaced by a redirect.
- A React + TypeScript app now lives in `src/frontend/test-ui/app` and builds to `src/frontend/test-ui/dist`.
- The backend continues to serve everything under `src/frontend/` as static files, so the built test UI is available at `/test-ui/`.

## Dev workflow (React + TypeScript)

From the React app folder:

```powershell
cd src/frontend/test-ui/app
npm install
npm run dev
```

This starts a dev server on `http://localhost:5173` and proxies API/WebSocket calls to the backend on port `8000`.

In another terminal, run the backend:

```powershell
uv run uvicorn src.backend.app:app --reload
```

Now open:
- Dev UI: `http://localhost:5173/test-ui/` (dev server with HMR)
- Backend-served UI (after build): `http://localhost:8000/test-ui/dist/`

## Build for backend to serve

```powershell
cd src/frontend/test-ui/app
npm run build
```

This outputs static assets to `src/frontend/test-ui/dist`. With the backend running, visit:

```
http://localhost:8000/test-ui/dist/
```

## API endpoints used by the Test UI

- `POST /open` body: `{ port: string, baud: number }`
- `POST /close`
- `POST /write` body: `{ cmd: string }`
- WebSocket: `/ws`

Messages from the backend:
- Status: `{ "type": "status", "state": "closed|opening|open|closing|error" }`
- Data: `{ "type": "data", "line": "...", "ts": <epoch-seconds> }`

Writes automatically append a newline on the backend before sending to the serial device.
