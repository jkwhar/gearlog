"use strict";

const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
const Database = require("better-sqlite3");

const PORT = process.env.PORT || 5000;
const AUTH_TOKEN = process.env.AUTH_TOKEN;
const DATA_DIR = path.join(__dirname, "data");
const DB_PATH = path.join(DATA_DIR, "carlog.db");

fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
ensureTables();

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(authGuard);

app.get("/healthz", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/data", (_req, res) => {
  res.json({
    serverTime: new Date().toISOString(),
    vehicles: fetchAll("vehicles"),
    serviceRecords: fetchAll("service_records"),
    mileageReadings: fetchAll("mileage_readings"),
  });
});

app.post("/sync", (req, res) => {
  const now = new Date().toISOString();
  const payload = req.body || {};

  const vehicles = normalizeList(payload.vehicles, "vehicle");
  const serviceRecords = normalizeList(payload.serviceRecords, "service");
  const mileageReadings = normalizeList(payload.mileageReadings, "mileage");

  upsertMany("vehicles", vehicles);
  upsertMany("service_records", serviceRecords);
  upsertMany("mileage_readings", mileageReadings);

  res.json({
    serverTime: now,
    vehicles: fetchAll("vehicles"),
    serviceRecords: fetchAll("service_records"),
    mileageReadings: fetchAll("mileage_readings"),
  });
});

app.listen(PORT, () => {
  console.log(`[carlog-api] listening on ${PORT}`);
});

function ensureTables() {
  db.prepare(
    `CREATE TABLE IF NOT EXISTS vehicles (
      id TEXT PRIMARY KEY,
      updated_at TEXT NOT NULL,
      body TEXT NOT NULL
    )`,
  ).run();

  db.prepare(
    `CREATE TABLE IF NOT EXISTS service_records (
      id TEXT PRIMARY KEY,
      updated_at TEXT NOT NULL,
      body TEXT NOT NULL
    )`,
  ).run();

  db.prepare(
    `CREATE TABLE IF NOT EXISTS mileage_readings (
      id TEXT PRIMARY KEY,
      updated_at TEXT NOT NULL,
      body TEXT NOT NULL
    )`,
  ).run();
}

function authGuard(req, res, next) {
  if (!AUTH_TOKEN) return next();
  const header = req.headers.authorization || "";
  const token = header.replace("Bearer ", "").trim();
  if (token !== AUTH_TOKEN) {
    return res.status(401).json({ error: "unauthorized" });
  }
  return next();
}

function normalizeList(list, kind) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((item) => item && item.id)
    .map((item) => {
      const fallback = item.createdAt || item.updatedAt || new Date().toISOString();
      return {
        ...item,
        createdAt: item.createdAt || fallback,
        updatedAt: item.updatedAt || fallback,
        kind,
      };
    });
}

function upsertMany(table, records) {
  const select = db.prepare(`SELECT updated_at, body FROM ${table} WHERE id = ?`);
  const insert = db.prepare(`INSERT INTO ${table} (id, updated_at, body) VALUES (?, ?, ?)`);
  const update = db.prepare(`UPDATE ${table} SET updated_at = ?, body = ? WHERE id = ?`);

  records.forEach((record) => {
    const current = select.get(record.id);
    if (!current) {
      insert.run(record.id, record.updatedAt, JSON.stringify(record));
      return;
    }
    const existingBody = JSON.parse(current.body);
    const existingTs = timestampFrom(existingBody);
    const incomingTs = timestampFrom(record);
    if (incomingTs >= existingTs) {
      update.run(record.updatedAt, JSON.stringify(record), record.id);
    }
  });
}

function fetchAll(table) {
  const rows = db.prepare(`SELECT body FROM ${table}`).all();
  return rows.map((row) => JSON.parse(row.body));
}

function timestampFrom(record) {
  const ts = new Date(record.updatedAt || record.createdAt || 0).getTime();
  return Number.isFinite(ts) ? ts : -Infinity;
}
