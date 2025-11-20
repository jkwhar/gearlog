# carLog
Track car maintenance with an offline-first PWA that can sync to your own server.

## Quick start (static demo)
1. Serve the files locally (for example):
   ```bash
   python -m http.server 8000
   ```
2. Open http://localhost:8000 in your browser.
3. Add vehicles, service records, and mileage readings. Data is stored locally (localStorage).
4. Use **Export JSON** to back up or move data; **Import JSON** restores a backup.
5. The service worker caches assets so the UI works offline after first load.

## LAN sync with Docker (Unraid-friendly)
1. Start the API locally (same LAN as your device):
   ```bash
   docker-compose up -d
   ```
   - API listens on `http://<server-ip>:5000` (configure `AUTH_TOKEN` env var if you want a bearer token).
   - Data persists under `api/data/`.
2. Open `settings.html`, set the API Base URL (e.g., `http://192.168.x.x:5000`) and token if configured, then save.
3. Use “Queue Sync” on any page to push/pull data. Visit `sync.html` to see sync history and server-side data snapshots. The API merges by `updatedAt` and returns the merged dataset.

## Docs
- [Architecture](docs/architecture.md)
- [Proof-of-Concept Plan](docs/poc-plan.md)
