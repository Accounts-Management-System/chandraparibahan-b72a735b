import { openDB, type IDBPDatabase } from "idb";

export type PendingOp = {
  id: string;
  table: string;
  op: "insert" | "update" | "delete" | "upsert";
  payload?: any;
  match?: { col: string; val: any };
  createdAt: number;
  retries: number;
  lastError?: string | null;
};

const DB_NAME = "cp-offline";
const DB_VERSION = 1;
const STORE = "pending_mutations";
const KV = "kv";

let _db: Promise<IDBPDatabase> | null = null;

export function getDB() {
  if (typeof indexedDB === "undefined") return null;
  if (!_db) {
    _db = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(KV)) {
          db.createObjectStore(KV);
        }
      },
    });
  }
  return _db;
}

export async function addPending(op: PendingOp) {
  const db = await getDB();
  if (!db) return;
  await db.put(STORE, op);
}

export async function listPending(): Promise<PendingOp[]> {
  const db = await getDB();
  if (!db) return [];
  const all = (await db.getAll(STORE)) as PendingOp[];
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

export async function removePending(id: string) {
  const db = await getDB();
  if (!db) return;
  await db.delete(STORE, id);
}

export async function updatePending(op: PendingOp) {
  const db = await getDB();
  if (!db) return;
  await db.put(STORE, op);
}

export async function countPending(): Promise<number> {
  const db = await getDB();
  if (!db) return 0;
  return await db.count(STORE);
}
