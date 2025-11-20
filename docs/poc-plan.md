# Proof-of-Concept Plan

This PoC prioritizes offline usability on the Android tablet while leaving room for server sync and future multi-user support.

## Scope for first iteration
- Installable PWA shell with service worker caching core assets and pages.
- IndexedDB schema for vehicles, odometer readings, and service records.
- Basic forms for adding a vehicle and logging a service entry (with mileage and notes).
- Manual mileage entry plus a mock OBD-II read flow that simulates VIN + mileage until adapter support is validated.
- Simple sync screen that queues local changes and shows pending counts; actual API calls stubbed for now.

## Data shape (JSON examples)
### Vehicle
```json
{
  "id": "uuid",
  "vin": "1HGBH41JXMN109186",
  "plate": "ABC123",
  "make": "Honda",
  "model": "Civic",
  "year": 2015,
  "color": "Blue",
  "notes": "Primary commuter",
  "updated_at": "2024-07-01T12:00:00Z",
  "deleted": false
}
```

### Odometer reading
```json
{
  "id": "uuid",
  "vehicle_id": "uuid",
  "mileage": 75213,
  "unit": "mi",
  "source": "manual",
  "recorded_at": "2024-07-01",
  "updated_at": "2024-07-01T12:00:00Z",
  "deleted": false
}
```

### Service record
```json
{
  "id": "uuid",
  "vehicle_id": "uuid",
  "title": "Oil change",
  "performed_at": "2024-06-15",
  "mileage": 75000,
  "service_notes": "5W-30 synthetic, new filter",
  "labor_cost": 60,
  "parts_cost": 35,
  "total_cost": 95,
  "updated_at": "2024-07-01T12:00:00Z",
  "deleted": false
}
```

## Offline and sync flow
1. On launch, load shell from cache; read data from IndexedDB.
2. User can add/edit records; mark `dirty=true` on anything changed locally.
3. Sync screen shows pending counts per table; "Sync now" pushes dirty items when network is available.
4. Server responds with latest records (changed after last sync timestamp). Client updates IndexedDB and clears `dirty` flags.

## OBD-II discovery approach
- Start with **mock adapter** in development: simulate VIN/mileage to validate UI/flows.
- Try **Web Bluetooth** Serial profile (or Web Serial) on the tablet browser to talk to the Autel/Otofix VCI.
- Issue requests:
  - VIN: Service 09 PID 02.
  - Mileage: Attempt 01 PID A6; fall back to manual entry if unsupported/timeout.
- Surface adapter status to the user (connecting, reading, unsupported) and always allow manual override.

## Minimal backend contract (for later)
- `POST /sync/upload` accepts arrays of dirty records (vehicles, odometer_readings, service_records, attachments metadata).
- `GET /sync/changes?since=timestamp` returns updated records per table.
- `POST /attachments` for binary uploads after metadata is registered; returns remote URL.
- Auth header reserved for later (bearer token); skip enforcement for PoC if running locally.

## Next steps after PoC
- Real OBD-II adapter integration and error handling.
- File attachments (photos/receipts) with local caching and retryable uploads.
- Reminders and notifications (date/mileage).
- Multi-user login/roles and audit trail.
- CSV/PDF export of maintenance history.
