import { supabase } from "@/integrations/supabase/client";
import { addPending, listPending, removePending, updatePending, countPending, type PendingOp } from "./db";

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribePending(fn: Listener) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  listeners.forEach((l) => {
    try {
      l();
    } catch {}
  });
}

export async function enqueue(op: Omit<PendingOp, "id" | "createdAt" | "retries">) {
  const full: PendingOp = {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `op_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    createdAt: Date.now(),
    retries: 0,
    ...op,
  };
  await addPending(full);
  notify();
  return full;
}

export async function getPendingCount() {
  return await countPending();
}

async function runOne(op: PendingOp): Promise<{ ok: boolean; error?: string }> {
  try {
    const tbl: any = (supabase as any).from(op.table);
    let res: any;
    if (op.op === "insert") {
      res = await tbl.insert(op.payload);
    } else if (op.op === "upsert") {
      res = await tbl.upsert(op.payload);
    } else if (op.op === "update") {
      res = await tbl.update(op.payload).eq(op.match!.col, op.match!.val);
    } else if (op.op === "delete") {
      res = await tbl.delete().eq(op.match!.col, op.match!.val);
    }
    if (res?.error) return { ok: false, error: res.error.message };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? String(e) };
  }
}

let draining = false;

export async function drainQueue(): Promise<{ synced: number; failed: number }> {
  if (draining) return { synced: 0, failed: 0 };
  if (typeof navigator !== "undefined" && !navigator.onLine) return { synced: 0, failed: 0 };
  draining = true;
  let synced = 0;
  let failed = 0;
  try {
    const pending = await listPending();
    for (const op of pending) {
      const r = await runOne(op);
      if (r.ok) {
        await removePending(op.id);
        synced++;
        notify();
      } else {
        // If it looks like a network issue, stop; otherwise mark error and continue
        const isNet = /fetch|network|Failed to fetch|NetworkError/i.test(r.error ?? "");
        await updatePending({ ...op, retries: op.retries + 1, lastError: r.error ?? null });
        failed++;
        notify();
        if (isNet) break;
      }
    }
  } finally {
    draining = false;
  }
  return { synced, failed };
}
