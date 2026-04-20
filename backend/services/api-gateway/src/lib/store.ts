import fs from "fs";
import path from "path";
import { DataStore } from "../types/models";

const DB_PATH = path.resolve(__dirname, "../../data/db.json");

const EMPTY_STORE: DataStore = {
  institutions: [],
  records: [],
  consents: [],
  audits: []
};

function ensureDbPath() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(EMPTY_STORE, null, 2), "utf8");
  }
}

export function readStore(): DataStore {
  ensureDbPath();
  const raw = fs.readFileSync(DB_PATH, "utf8");
  return JSON.parse(raw) as DataStore;
}

export function writeStore(next: DataStore): void {
  ensureDbPath();
  fs.writeFileSync(DB_PATH, JSON.stringify(next, null, 2), "utf8");
}

export function updateStore(mutator: (current: DataStore) => DataStore): DataStore {
  const current = readStore();
  const next = mutator(current);
  writeStore(next);
  return next;
}
