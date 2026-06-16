import { supabase } from "@/integrations/supabase/client";
import { enqueue } from "./queue";

type Result = { data: any; error: { message: string } | null };

function isOnline() {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

function isNetworkError(err: any): boolean {
  const m = err?.message ?? String(err ?? "");
  return /fetch|network|Failed to fetch|NetworkError|ERR_INTERNET|ERR_NETWORK/i.test(m);
}

async function runOrQueue(
  table: string,
  op: "insert" | "update" | "delete" | "upsert",
  payload?: any,
  match?: { col: string; val: any },
): Promise<Result> {
  // If clearly offline, enqueue first
  if (!isOnline()) {
    await enqueue({ table, op, payload, match });
    return { data: null, error: null };
  }
  try {
    const tbl: any = (supabase as any).from(table);
    let res: any;
    if (op === "insert") res = await tbl.insert(payload);
    else if (op === "upsert") res = await tbl.upsert(payload);
    else if (op === "update") res = await tbl.update(payload).eq(match!.col, match!.val);
    else if (op === "delete") res = await tbl.delete().eq(match!.col, match!.val);
    if (res?.error && isNetworkError(res.error)) {
      await enqueue({ table, op, payload, match });
      return { data: null, error: null };
    }
    return res as Result;
  } catch (e: any) {
    if (isNetworkError(e)) {
      await enqueue({ table, op, payload, match });
      return { data: null, error: null };
    }
    return { data: null, error: { message: e?.message ?? String(e) } };
  }
}

/**
 * Offline-aware wrapper that mirrors a small subset of the Supabase mutation API.
 * Usage:
 *   offlineFrom("trips").insert(payload)
 *   offlineFrom("trips").update(payload).eq("id", id)
 *   offlineFrom("trips").delete().eq("id", id)
 *   offlineFrom("trips").upsert(payload)
 *
 * When offline (or the request fails with a network error), the operation is
 * stored in IndexedDB and replayed once the device is back online.
 */
export function offlineFrom(table: string) {
  return {
    insert: (payload: any) => runOrQueue(table, "insert", payload),
    upsert: (payload: any) => runOrQueue(table, "upsert", payload),
    update: (payload: any) => ({
      eq: (col: string, val: any) => runOrQueue(table, "update", payload, { col, val }),
    }),
    delete: () => ({
      eq: (col: string, val: any) => runOrQueue(table, "delete", undefined, { col, val }),
    }),
  };
}
