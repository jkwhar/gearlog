# Changelog

## Unreleased
- Added local Settings page for vehicle creation and data import/export; dashboard now focuses on vehicles and service records.
- Switched UI theme to a light palette and improved header navigation.
- Added mileage update from service submissions and validation prompt for decreasing mileage entries.
- Introduced sync settings (API URL/token, last sync display) plus real sync call with merge logic and safe status handling.
- Added LAN-only Docker API (Express + SQLite) with /sync and /healthz endpoints; included docker-compose for Unraid and ignored data/node_modules.
- Clarified docker-compose auth token line (comment out to disable bearer auth).
- Added `sync.html` for sync history, server data view, and quick actions; API now serves `/data` for server snapshots.
- Switched `api/Dockerfile` to node:20-bookworm-slim, added build deps, and included source before install to avoid missing package metadata during build.
- Linked Sync navigation updates: settings now has a Sync History button; headers simplified; cache bumped to v9.
- Added OBD-II scan button on Settings → Add Vehicle (stubbed Bluetooth/Serial read with demo data fallback) and status messaging.
