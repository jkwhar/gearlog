const DATA_KEY = "carlog-data-v1";
const SETTINGS_KEY = "carlog-settings-v1";

function generateId() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

const data = loadData();
const settings = loadSettings();

const vehicleForm = document.getElementById("vehicle-form");
const vehicleList = document.getElementById("vehicle-list");
const serviceForm = document.getElementById("service-form");
const serviceVehicleSelect = serviceForm?.querySelector("select[name=vehicleId]") ?? null;
const settingsForm = document.getElementById("sync-settings-form");
const apiBaseInput = document.getElementById("api-base");
const apiTokenInput = document.getElementById("api-token");
const scanObdButton = document.getElementById("scan-obd");
const scanObdStatus = document.getElementById("scan-obd-status");
const vinInput = vehicleForm?.querySelector("input[name=vin]");
const plateInput = vehicleForm?.querySelector("input[name=plate]");
const makeInput = vehicleForm?.querySelector("input[name=make]");
const modelInput = vehicleForm?.querySelector("input[name=model]");
const yearInput = vehicleForm?.querySelector("input[name=year]");
const engineInput = vehicleForm?.querySelector("input[name=engine]");
const vinLookupButton = document.getElementById("vin-lookup");
const vinLookupStatus = document.getElementById("vin-lookup-status");
const mileageInput = vehicleForm?.querySelector("input[name=mileage]");
const statusText = document.getElementById("status-text");
const lastSyncText = document.getElementById("last-sync-text");
const syncButton = document.getElementById("sync-button");
const serverRefreshButton = document.getElementById("refresh-server-data");
const syncHistoryList = document.getElementById("sync-history");
const serverVehiclesList = document.getElementById("server-vehicles");
const serverServicesList = document.getElementById("server-services");
const serverMileageList = document.getElementById("server-mileage");
const exportButton = document.getElementById("export-button");
const importInput = document.getElementById("import-input");
const vehicleDialog = document.getElementById("vehicle-dialog");
const vehicleDialogTitle = document.getElementById("vehicle-dialog-title");
const vehicleDialogBody = document.getElementById("vehicle-dialog-body");
const closeDialogButton = document.getElementById("close-dialog");

if (settingsForm) {
  settingsForm.addEventListener("submit", (event) => {
    event.preventDefault();
    settings.apiBaseUrl = apiBaseInput?.value.trim() ?? "";
    settings.apiToken = apiTokenInput?.value.trim() ?? "";
    persistSettings();
    setStatus("Settings saved");
    renderLastSync();
  });
  if (apiBaseInput) apiBaseInput.value = settings.apiBaseUrl;
  if (apiTokenInput) apiTokenInput.value = settings.apiToken;
  renderLastSync();
  renderSyncHistory();
}

if (vehicleForm) {
  vehicleForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(vehicleForm);
    const createdAt = new Date().toISOString();
    const vehicle = {
      id: generateId(),
      vin: formData.get("vin").trim(),
      plate: formData.get("plate").trim(),
      make: formData.get("make").trim(),
      model: formData.get("model").trim(),
      year: Number(formData.get("year")),
      engine: formData.get("engine").trim(),
      mileageHistory: [],
      serviceRecords: [],
      createdAt,
      updatedAt: createdAt,
    };

    const mileage = Number(formData.get("mileage"));
    if (!Number.isNaN(mileage) && mileage > 0) {
      vehicle.mileageHistory.push({
        id: generateId(),
        value: mileage,
        source: "manual",
        recordedAt: createdAt,
      });
    }

    data.vehicles.push(vehicle);
    persist();
    vehicleForm.reset();
    render();
  });
}

if (vinLookupButton) {
  vinLookupButton.addEventListener("click", async () => {
    const vin = vinInput?.value.trim();
    if (!vin || vin.length !== 17) {
      setVinLookupStatus("Enter a 17-character VIN first.");
      return;
    }
    setVinLookupStatus("Looking up…");
    vinLookupButton.disabled = true;
    try {
      const info = await lookupVin(vin);
      if (makeInput && info.make) makeInput.value = info.make;
      if (modelInput && info.model) modelInput.value = info.model;
      if (yearInput && info.year) yearInput.value = info.year;
      if (engineInput && info.engine) engineInput.value = info.engine;
      setVinLookupStatus("Done.");
    } catch (error) {
      setVinLookupStatus("Lookup failed: " + error.message);
    } finally {
      vinLookupButton.disabled = false;
    }
  });
}

if (scanObdButton) {
  scanObdButton.addEventListener("click", async () => {
    await scanObdForVehicle();
  });
}

if (serviceForm) {
  serviceForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!data.vehicles.length) return;
    const formData = new FormData(serviceForm);
    const createdAt = new Date().toISOString();
    const service = {
      id: generateId(),
      vehicleId: formData.get("vehicleId"),
      date: formData.get("date"),
      mileage: Number(formData.get("mileage")),
      description: formData.get("description").trim(),
      notes: formData.get("notes").trim(),
      cost: Number(formData.get("cost")) || 0,
      createdAt,
      updatedAt: createdAt,
    };
    const vehicle = data.vehicles.find((v) => v.id === service.vehicleId);
    const currentMileage = vehicle ? collectMileageRecords(vehicle)[0]?.value : undefined;

    const hasMileage = !Number.isNaN(service.mileage) && service.mileage > 0;
    if (hasMileage && Number.isFinite(currentMileage) && service.mileage < currentMileage) {
      const confirmed = window.confirm(
        `Entered mileage (${service.mileage}) is lower than current recorded mileage (${currentMileage}). Save anyway?`,
      );
      if (!confirmed) return;
    }

    data.serviceRecords.push(service);
    if (vehicle && hasMileage) {
      if (!Array.isArray(vehicle.mileageHistory)) vehicle.mileageHistory = [];
      vehicle.mileageHistory.push({
        id: generateId(),
        value: service.mileage,
        source: "service",
        recordedAt: createdAt,
      });
      vehicle.updatedAt = createdAt;
    }
    persist();
    serviceForm.reset();
    render();
  });
}

if (vehicleList) {
  vehicleList.addEventListener("click", (event) => {
    const target = event.target.closest(".vehicle-item");
    if (!target) return;
    const vehicle = data.vehicles.find((v) => v.id === target.dataset.id);
    if (!vehicle || !vehicleDialog || !vehicleDialogTitle || !vehicleDialogBody) return;

    const vehicleRecords = data.serviceRecords.filter((record) => record.vehicleId === vehicle.id);
    const mileageRecords = collectMileageRecords(vehicle);

    vehicleDialogTitle.textContent = `${vehicle.make} ${vehicle.model} (${vehicle.year})`;
    vehicleDialogBody.innerHTML = `
      <p><strong>VIN:</strong> ${vehicle.vin}</p>
      <p><strong>Plate:</strong> ${vehicle.plate || "—"}</p>
      ${vehicle.engine ? `<p><strong>Engine:</strong> ${vehicle.engine}</p>` : ""}
      <p><strong>Total services:</strong> ${vehicleRecords.length}</p>
      <p><strong>Mileage entries:</strong> ${mileageRecords.length}</p>
      <div class="muted" style="margin-top: 0.5rem;">
        <p><strong>Latest mileage:</strong> ${mileageRecords[0]?.value ?? "n/a"}</p>
        <p><strong>Last update:</strong> ${mileageRecords[0]?.recordedAt ?? "n/a"}</p>
      </div>
      <h4>Service history</h4>
      <ul>
        ${vehicleRecords
          .map(
            (record) => `
              <li>
                <strong>${record.date}</strong> · ${record.description} · ${record.mileage} mi · $${record.cost}
                <div class="muted">${record.notes || "No notes"}</div>
              </li>
            `,
          )
          .join("")}
      </ul>
      <h4>Mileage readings</h4>
      <ul>
        ${mileageRecords
          .map(
            (reading) => `
              <li>${reading.value} mi · ${reading.source} · ${new Date(reading.recordedAt).toLocaleString()}</li>
            `,
          )
          .join("")}
      </ul>
    `;
    vehicleDialog.showModal();
  });
}

if (closeDialogButton) {
  closeDialogButton.addEventListener("click", () => vehicleDialog?.close());
}

if (syncButton) {
  syncButton.addEventListener("click", async () => {
    await syncNow();
  });
}

if (serverRefreshButton) {
  serverRefreshButton.addEventListener("click", async () => {
    await fetchServerData();
  });
}

if (exportButton) {
  exportButton.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "carlog-data.json";
    link.click();
    URL.revokeObjectURL(url);
  });
}

if (importInput) {
  importInput.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const imported = JSON.parse(ev.target?.result ?? "{}");
        data.vehicles = normalizeVehicles(imported.vehicles ?? []);
        data.serviceRecords = normalizeServiceRecords(imported.serviceRecords ?? []);
        data.mileageReadings = normalizeMileage(imported.mileageReadings ?? []);
        persist();
        render();
        setStatus("Import completed");
      } catch (error) {
        setStatus("Import failed: invalid file");
      }
    };
    reader.readAsText(file);
  });
}

function render() {
  if (serviceVehicleSelect) renderVehicleOptions(serviceVehicleSelect);
  if (vehicleList) renderVehicleList();
  renderLastSync();
  renderSyncHistory();
}

function renderVehicleOptions(select) {
  select.innerHTML = data.vehicles.length
    ? data.vehicles.map((vehicle) => `<option value="${vehicle.id}">${vehicle.make} ${vehicle.model} (${vehicle.year})</option>`).join("")
    : "<option value='' disabled>No vehicles yet — add one in Settings</option>";
}

function renderVehicleList() {
  if (!data.vehicles.length) {
    vehicleList.innerHTML = `<p class="muted">No vehicles yet. Add one in Settings.</p>`;
    return;
  }

  vehicleList.innerHTML = data.vehicles
    .map((vehicle) => {
      const latestMileage = collectMileageRecords(vehicle)[0]?.value;

      return `
        <article class="vehicle-item" data-id="${vehicle.id}">
          <div><strong>${vehicle.make} ${vehicle.model}</strong> (${vehicle.year})</div>
          ${vehicle.engine ? `<div class="muted">${vehicle.engine}</div>` : ""}
          <div class="muted">VIN: ${vehicle.vin}</div>
          <div class="muted">Plate: ${vehicle.plate || "—"}</div>
          <div class="muted">Latest mileage: ${latestMileage ?? "n/a"}</div>
        </article>
      `;
    })
    .join("");
}

function collectMileageRecords(vehicle) {
  const vehicleServiceRecords = data.serviceRecords
    .filter((record) => record.vehicleId === vehicle.id && Number.isFinite(record.mileage))
    .map((record) => ({
      id: record.id,
      value: record.mileage,
      source: "service",
      recordedAt: record.createdAt || record.date || new Date().toISOString(),
    }));

  const allRecords = [
    ...((vehicle.mileageHistory ?? []).map((entry) => ({
      id: entry.id,
      value: entry.value,
      source: entry.source ?? "manual",
      recordedAt: entry.recordedAt ?? entry.createdAt ?? new Date().toISOString(),
    })) ?? []),
    ...data.mileageReadings
      .filter((reading) => reading.vehicleId === vehicle.id)
      .map((reading) => ({
        id: reading.id,
        value: reading.value,
        source: reading.source,
        recordedAt: reading.recordedAt,
      })),
    ...vehicleServiceRecords,
  ];

  const withTimestamps = allRecords.map((entry) => {
    const ts = new Date(entry.recordedAt).getTime();
    const safeTimestamp = Number.isFinite(ts) ? ts : -Infinity;
    return { ...entry, timestamp: safeTimestamp };
  });

  return withTimestamps.sort((a, b) => {
    if (b.timestamp === a.timestamp) return (b.value ?? 0) - (a.value ?? 0);
    return b.timestamp - a.timestamp;
  });
}

async function lookupVin(vin) {
  const url = `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(vin)}?format=json`;
  console.log("[VIN lookup] URL:", url);

  let res;
  try {
    res = await fetch(url);
  } catch (networkError) {
    console.error("[VIN lookup] Network error:", networkError);
    throw new Error("Network error — check connectivity");
  }

  console.log("[VIN lookup] HTTP status:", res.status);
  if (!res.ok) throw new Error(`NHTSA API returned ${res.status}`);

  const json = await res.json();
  console.log("[VIN lookup] Raw response:", json);

  const r = json.Results?.[0];
  if (!r) throw new Error("No results returned");

  console.log("[VIN lookup] Decoded fields:", {
    ModelYear: r.ModelYear,
    Make: r.Make,
    Model: r.Model,
    DisplacementL: r.DisplacementL,
    EngineCylinders: r.EngineCylinders,
    FuelTypePrimary: r.FuelTypePrimary,
    ErrorCode: r.ErrorCode,
    ErrorText: r.ErrorText,
  });

  const displacementL = r.DisplacementL ? `${parseFloat(r.DisplacementL).toFixed(1)}L` : "";
  const cylinders = r.EngineCylinders ? `${r.EngineCylinders}-cyl` : "";
  const fuel = r.FuelTypePrimary || "";
  const engine = [displacementL, cylinders, fuel].filter(Boolean).join(" ");

  return {
    year: r.ModelYear || "",
    make: r.Make || "",
    model: r.Model || "",
    engine,
  };
}

function setVinLookupStatus(message) {
  if (vinLookupStatus) vinLookupStatus.textContent = message;
}

async function scanObdForVehicle() {
  if (!vinInput && !mileageInput) {
    setObdStatus("Vehicle form not available");
    return;
  }
  setObdStatus("Requesting OBD-II adapter…");
  const supportsBluetooth = !!navigator.bluetooth;
  const supportsSerial = !!navigator.serial;

  if (!supportsBluetooth && !supportsSerial) {
    const mock = mockObdReading();
    applyObdToForm(mock);
    setObdStatus("Browser not supported; filled with demo data.");
    return;
  }

  try {
    const reading = await mockOrRequestObd();
    applyObdToForm(reading);
    setObdStatus("OBD-II data applied.");
  } catch (error) {
    if (error?.message === "cancelled") {
      setObdStatus("Scan cancelled.");
    } else {
      console.error("OBD-II scan failed", error);
      setObdStatus("OBD-II scan failed; try again.");
    }
  }
}

function applyObdToForm(reading) {
  if (vinInput && reading.vin) vinInput.value = reading.vin;
  if (plateInput && reading.plate) plateInput.value = reading.plate;
  if (mileageInput && Number.isFinite(reading.mileage)) mileageInput.value = reading.mileage;
}

async function mockOrRequestObd() {
  if (navigator.serial) {
    return await serialObdScan();
  }
  return mockObdReading();
}

function mockObdReading() {
  const vin = `TESTVIN${String(Math.floor(Math.random() * 1_00000)).padStart(5, "0")}`;
  const mileage = 100000 + Math.floor(Math.random() * 5000);
  return { vin, mileage, plate: "" };
}

function setObdStatus(message) {
  if (scanObdStatus) scanObdStatus.textContent = message;
}

async function serialObdScan() {
  setObdStatus("Connecting to adapter…");
  const port = await navigator.serial.requestPort();
  await port.open({ baudRate: 115200 });
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const reader = port.readable.getReader();
  const writer = port.writable.getWriter();

  const readWithTimeout = (timeoutMs = 1500) =>
    Promise.race([
      reader.read(),
      new Promise((resolve) => setTimeout(() => resolve({ value: null, done: true, timeout: true }), timeoutMs)),
    ]);

  const send = async (cmd, timeoutMs = 1500) => {
    await writer.write(encoder.encode(cmd + "\r"));
    let text = "";
    while (true) {
      const result = await readWithTimeout(timeoutMs);
      if (!result || result.done) break;
      if (result.value) text += decoder.decode(result.value, { stream: true });
      if (text.includes(">")) break;
    }
    return text;
  };

  let vin = "";
  let mileage;

  try {
    await send("ATZ", 1200);
    await send("ATE0", 800);
    await send("ATL0", 800);
    await send("ATS0", 800);
    await send("ATH1", 800);
    await send("ATSP0", 1200);

    const vinResp = await send("0902", 1800);
    vin = parseVin(vinResp) || "";

    const mileageResp = await send("01A6", 1800);
    mileage = parseMileageA6(mileageResp);
    if (!Number.isFinite(mileage)) {
      const distResp = await send("0131", 1800);
      mileage = parsePid31(distResp);
    }
  } finally {
    try {
      reader.releaseLock();
      writer.releaseLock();
      await port.close();
    } catch (error) {
      console.warn("Port close warning", error);
    }
  }

  return {
    vin: vin || "",
    mileage: Number.isFinite(mileage) ? Math.round(mileage) : undefined,
    plate: "",
  };
}

function parseVin(resp) {
  if (!resp) return "";
  const lines = resp
    .replace(/\r/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const dataLines = lines.filter((l) => l.includes("49 02"));
  if (!dataLines.length) return "";
  const bytes = [];
  dataLines.forEach((line) => {
    const parts = line
      .split(" ")
      .map((p) => p.trim())
      .filter(Boolean);
    const start = parts.findIndex((p, idx) => p === "49" && parts[idx + 1] === "02");
    const payload = start >= 0 ? parts.slice(start + 3) : [];
    payload.forEach((p) => {
      const val = parseInt(p, 16);
      if (Number.isInteger(val) && val > 31 && val < 127) bytes.push(val);
    });
  });
  return String.fromCharCode(...bytes).replace(/[^\x20-\x7E]/g, "").slice(0, 17);
}

function parseMileageA6(resp) {
  if (!resp) return undefined;
  const parts = cleanPidParts(resp);
  const idx = parts.findIndex((p, i) => p === "41" && parts[i + 1] === "A6");
  if (idx >= 0 && parts.length >= idx + 4) {
    const hi = parseInt(parts[idx + 2], 16);
    const lo = parseInt(parts[idx + 3], 16);
    if (Number.isFinite(hi) && Number.isFinite(lo)) {
      // PID A6: Odometer (km) in some adapters
      return hi * 256 + lo;
    }
  }
  return undefined;
}

function parsePid31(resp) {
  if (!resp) return undefined;
  const parts = cleanPidParts(resp);
  const idx = parts.findIndex((p, i) => p === "41" && parts[i + 1] === "31");
  if (idx >= 0 && parts.length >= idx + 4) {
    const hi = parseInt(parts[idx + 2], 16);
    const lo = parseInt(parts[idx + 3], 16);
    if (Number.isFinite(hi) && Number.isFinite(lo)) {
      // Distance since codes cleared (km); convert to miles roughly
      const km = hi * 256 + lo;
      return Math.round(km * 0.621371);
    }
  }
  return undefined;
}

function cleanPidParts(resp) {
  return resp
    .replace(/\r/g, "\n")
    .split(/[\n ]+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => p.toUpperCase());
}

async function syncNow() {
  if (!settings.apiBaseUrl) {
    setStatus("Set API base URL in Settings");
    return;
  }

  setStatus("Syncing…");
  const url = settings.apiBaseUrl.replace(/\/$/, "") + "/sync";
  const payload = {
    vehicles: data.vehicles,
    serviceRecords: data.serviceRecords,
    mileageReadings: data.mileageReadings,
    lastSyncAt: settings.lastSyncAt,
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(settings.apiToken ? { Authorization: `Bearer ${settings.apiToken}` } : {}),
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    if (!res.ok) {
      setStatus(`Sync failed (${res.status})`);
      return;
    }

    const body = await res.json();
    data.vehicles = mergeRecords(data.vehicles, normalizeVehicles(body.vehicles ?? []));
    data.serviceRecords = mergeRecords(data.serviceRecords, normalizeServiceRecords(body.serviceRecords ?? []));
    data.mileageReadings = mergeRecords(data.mileageReadings, normalizeMileage(body.mileageReadings ?? []));
    settings.lastSyncAt = body.serverTime ?? new Date().toISOString();
    recordSyncResult({
      status: "success",
      at: settings.lastSyncAt,
      counts: {
        vehicles: data.vehicles.length,
        services: data.serviceRecords.length,
        mileage: data.mileageReadings.length,
      },
    });
    persist();
    persistSettings();
    renderSyncHistory();
    render();
    setStatus("Synced");
  } catch (error) {
    console.error("Sync error", error);
    setStatus("Sync failed: " + error.message);
  }
}

function mergeRecords(localRecords, incomingRecords) {
  const index = new Map();
  const all = [...localRecords, ...incomingRecords];

  all.forEach((record) => {
    if (!record.id) return;
    const existing = index.get(record.id);
    if (!existing) {
      index.set(record.id, record);
      return;
    }

    const existingTs = getTimestamp(existing);
    const nextTs = getTimestamp(record);
    if (nextTs >= existingTs) {
      index.set(record.id, record);
    }
  });

  return Array.from(index.values());
}

function getTimestamp(record) {
  const ts = new Date(record.updatedAt ?? record.createdAt ?? 0).getTime();
  return Number.isFinite(ts) ? ts : -Infinity;
}

function recordSyncResult(entry) {
  const history = settings.syncHistory ?? [];
  const next = [{ ...entry }, ...history].slice(0, 20);
  settings.syncHistory = next;
  persistSettings();
  renderSyncHistory();
}

function renderSyncHistory() {
  if (!syncHistoryList) return;
  const history = settings.syncHistory ?? [];
  if (!history.length) {
    syncHistoryList.innerHTML = `<li class="muted">No syncs yet.</li>`;
    return;
  }
  syncHistoryList.innerHTML = history
    .map(
      (item) => `
        <li>
          <div><strong>${item.status}</strong> – ${new Date(item.at).toLocaleString()}</div>
          <div class="muted">Vehicles: ${item.counts?.vehicles ?? 0} · Services: ${item.counts?.services ?? 0} · Mileage: ${item.counts?.mileage ?? 0}</div>
        </li>
      `,
    )
    .join("");
}

async function fetchServerData() {
  if (!settings.apiBaseUrl) {
    setStatus("Set API base URL in Settings");
    return;
  }
  setStatus("Loading server data…");
  const url = settings.apiBaseUrl.replace(/\/$/, "") + "/data";
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        ...(settings.apiToken ? { Authorization: `Bearer ${settings.apiToken}` } : {}),
      },
      cache: "no-store",
    });
    if (!res.ok) {
      setStatus(`Server data failed (${res.status})`);
      return;
    }
    const body = await res.json();
    renderServerData(body);
    setStatus("Server data loaded");
  } catch (error) {
    console.error("Server data error", error);
    setStatus("Server data failed: " + error.message);
  }
}

function renderServerData(payload) {
  if (serverVehiclesList) {
    const vehicles = normalizeVehicles(payload.vehicles ?? []);
    serverVehiclesList.innerHTML = vehicles.length
      ? vehicles
          .map(
            (v) => `
              <li>
                <strong>${v.make} ${v.model}</strong> (${v.year}) · VIN: ${v.vin}
                <div class="muted">Updated: ${new Date(v.updatedAt).toLocaleString()}</div>
              </li>
            `,
          )
          .join("")
      : `<li class="muted">No vehicles on server.</li>`;
  }

  if (serverServicesList) {
    const services = normalizeServiceRecords(payload.serviceRecords ?? []);
    serverServicesList.innerHTML = services.length
      ? services
          .map(
            (s) => `
              <li>
                <strong>${s.date || "No date"}</strong> · ${s.description || "Service"} · ${s.mileage ?? "n/a"} mi
                <div class="muted">Vehicle: ${s.vehicleId} · Updated: ${new Date(s.updatedAt).toLocaleString()}</div>
              </li>
            `,
          )
          .join("")
      : `<li class="muted">No service records on server.</li>`;
  }

  if (serverMileageList) {
    const mileage = normalizeMileage(payload.mileageReadings ?? []);
    serverMileageList.innerHTML = mileage.length
      ? mileage
          .map(
            (m) => `
              <li>${m.value} mi · ${m.source || "manual"} · ${new Date(m.recordedAt).toLocaleString()}
                <div class="muted">Vehicle: ${m.vehicleId}</div>
              </li>
            `,
          )
          .join("")
      : `<li class="muted">No mileage readings on server.</li>`;
  }
}

function normalizeVehicles(list) {
  return (list ?? []).map((vehicle) => {
    const fallbackDate = vehicle.createdAt ?? new Date().toISOString();
    return {
      ...vehicle,
      createdAt: vehicle.createdAt ?? fallbackDate,
      updatedAt: vehicle.updatedAt ?? fallbackDate,
      mileageHistory: vehicle.mileageHistory ?? [],
    };
  });
}

function normalizeServiceRecords(list) {
  return (list ?? []).map((record) => {
    const fallbackDate = record.createdAt ?? new Date().toISOString();
    return {
      ...record,
      createdAt: record.createdAt ?? fallbackDate,
      updatedAt: record.updatedAt ?? fallbackDate,
    };
  });
}

function normalizeMileage(list) {
  return (list ?? []).map((entry) => ({
    ...entry,
    recordedAt: entry.recordedAt ?? entry.createdAt ?? new Date().toISOString(),
    createdAt: entry.createdAt ?? entry.recordedAt ?? new Date().toISOString(),
    updatedAt: entry.updatedAt ?? entry.recordedAt ?? entry.createdAt ?? new Date().toISOString(),
  }));
}

function loadData() {
  try {
    const stored = localStorage.getItem(DATA_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        vehicles: normalizeVehicles(parsed.vehicles ?? []),
        serviceRecords: normalizeServiceRecords(parsed.serviceRecords ?? []),
        mileageReadings: normalizeMileage(parsed.mileageReadings ?? []),
      };
    }
  } catch (error) {
    console.warn("Could not parse stored data", error);
  }
  return { vehicles: [], serviceRecords: [], mileageReadings: [] };
}

function loadSettings() {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        apiBaseUrl: parsed.apiBaseUrl ?? "",
        apiToken: parsed.apiToken ?? "",
        lastSyncAt: parsed.lastSyncAt ?? null,
        syncHistory: parsed.syncHistory ?? [],
      };
    }
  } catch (error) {
    console.warn("Could not parse settings", error);
  }
  return { apiBaseUrl: "", apiToken: "", lastSyncAt: null, syncHistory: [] };
}

function persist() {
  localStorage.setItem(DATA_KEY, JSON.stringify(data));
}

function persistSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function renderLastSync() {
  if (!lastSyncText) return;
  lastSyncText.textContent = settings.lastSyncAt
    ? `Last sync: ${new Date(settings.lastSyncAt).toLocaleString()}`
    : "Not synced yet";
}

function setStatus(message) {
  if (!statusText) return;
  statusText.textContent = message;
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker
    .register("/sw.js")
    .then(() => console.log("Service worker registered"))
    .catch((error) => console.error("Service worker registration failed", error));
}

render();
registerServiceWorker();

// If sync page is open, pull server data on load
if (serverVehiclesList || serverServicesList || serverMileageList) {
  fetchServerData();
}
