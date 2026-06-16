import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import type { QueryClient } from "@tanstack/react-query";

let installed = false;

export function installQueryPersister(queryClient: QueryClient) {
  if (installed || typeof window === "undefined") return;
  installed = true;
  try {
    const persister = createSyncStoragePersister({
      storage: window.localStorage,
      key: "cp-rq-cache",
      throttleTime: 1000,
    });
    persistQueryClient({
      queryClient,
      persister,
      maxAge: 1000 * 60 * 60 * 24 * 14, // 14 days
      buster: "v1",
    });
  } catch {
    /* ignore persistence failures */
  }
}
