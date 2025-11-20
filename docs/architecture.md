# CarLog Architecture Overview

## Goal
Offline-first progressive web app (PWA) for tracking maintenance on multiple vehicles, with periodic sync to a self-hosted backend. Support reading VIN and mileage via Bluetooth OBD-II (SPP/serial) when available, with manual fallback.

## Platform choice
- **Web PWA**: runs in Chrome/Edge/Firefox on Android tablet; can be installed to home screen.
- **Offline-first**: Service Worker + IndexedDB for local cache; minimal API required for bootstrapping.
- **Sync later**: Background sync when online; user-triggered manual sync as fallback.

## High-level components
- **Frontend (PWA)**
  - Built with Vite + React + TypeScript (suggested) and Workbox for service worker generation.
  - UI focus: tablet-friendly controls, large hit targets, quick data entry.
  - Modules: vehicles, odometer readings, service records, attachments, reminders (future).
  - Local storage: IndexedDB via Dexie (or idb). Records marked with `updated_at` and `dirty` flags for sync.
  - Bluetooth OBD-II module using Web Bluetooth (Serial/Custom UUID) or fallback to Web Serial if tablet browser supports; otherwise bridge via native wrapper later.
- **Backend API (self-hosted)**
  - REST/JSON with token auth (single-user initially; future multi-user support).
  - Endpoints for vehicles, odometer readings, service records, attachments, and sync (delta upload/download).
  - File uploads for photos/receipts (JPEG/PDF) stored in object storage (e.g., S3-compatible/minio).

## Data model (initial)
- **Vehicle**: `id`, `vin`, `plate`, `make`, `model`, `year`, `color?`, `notes?`, `created_at`, `updated_at`.
- **OdometerReading**: `id`, `vehicle_id`, `mileage`, `unit` (mi/km), `source` (manual|obd), `recorded_at`, `created_at`, `updated_at`.
- **ServiceRecord**: `id`, `vehicle_id`, `title`, `performed_at`, `mileage`, `service_notes`, `labor_cost`, `parts_cost`, `total_cost`, `attachments[]`, `created_at`, `updated_at`.
- **Attachment**: `id`, `service_record_id`, `type` (photo|receipt|pdf), `file_name`, `content_type`, `size`, `url` (remote), `blob_id` (local temp), `created_at`, `updated_at`.
- **User** (future): `id`, `email`, `role`, `created_at`, `updated_at`.
- **Reminder** (future): `id`, `vehicle_id`, `type`, `interval_miles`, `interval_days`, `last_reset_at`, `next_due_at`, `created_at`, `updated_at`.

## Sync strategy
- **Client state**: Every record has `id` (UUID), `updated_at` (ISO timestamp), and `deleted` flag.
- **Upload**: Client sends all `dirty` records per table since last successful sync. Backend resolves conflicts via latest `updated_at` (can evolve to per-field merge).
- **Download**: Backend returns records updated after client's `last_sync_at`.
- **Attachments**: Upload blobs after metadata record created; retry queue for offline.
- **Security**: HTTPS; token scoped to user (refresh token optional later). No encryption-at-rest for local PoC.

## OBD-II integration (proof-of-concept)
- **VIN**: Mode 09 PID 02 request over OBD-II.
- **Mileage**: No universal PID; attempt service 01 PID A6 or manufacturer-specific. Provide manual entry fallback and flag when mileage source is OBD vs manual.
- **Bluetooth**: Start with Web Serial / Web Bluetooth SPP if supported; create abstraction so native wrapper (e.g., Capacitor/Android WebView) can provide bridge if browser lacks APIs.
- **Error handling**: Timeouts, unsupported PIDs, adapter disconnected -> prompt manual entry.

## UI flows (PoC)
1. **Vehicles list**: Add vehicle manually or "Scan via OBD" to prefill VIN/mileage; capture plate/make/model/year.
2. **Vehicle detail**: Show latest mileage, service history.
3. **Add service**: Date, mileage, description/notes, labor/parts/total cost, attachments (camera/file picker), save offline.
4. **Sync center**: Show pending changes, last sync time, "Sync now" button.

## Tech stack (recommended)
- **Frontend**: Vite + React + TypeScript, Dexie, Workbox, Tailwind (later), React Router.
- **Backend**: FastAPI/Node/Go; simple REST for PoC. SQLite/Postgres; S3-compatible storage for files.
- **Testing**: Unit tests for data mappers and sync logic; integration tests mocking IndexedDB and network.

## Milestones
1. **Scaffold PWA** with IndexedDB schema, stub API client, manual data entry UI.
2. **Add sync endpoint + local queue** with conflict resolution.
3. **Integrate OBD-II read** (VIN + mileage) via Web Serial/Bluetooth; mock for development.
4. **File uploads**: local caching + background upload; render previews.
5. **Polish**: reminders, multi-user auth, reports/export (CSV/PDF).
