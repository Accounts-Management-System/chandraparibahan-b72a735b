import { drainQueue } from "./queue";
import { toast } from "sonner";
import type { QueryClient } from "@tanstack/react-query";

let installed = false;

export function installSync(queryClient: QueryClient) {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const tryDrain = async (announce: boolean) => {
    const { synced, failed } = await drainQueue();
    if (synced > 0) {
      queryClient.invalidateQueries();
      if (announce) toast.success(`${synced} টি অফলাইন এন্ট্রি সিঙ্ক হয়েছে`);
    }
    if (failed > 0 && announce) {
      toast.error(`${failed} টি এন্ট্রি সিঙ্ক করা যায়নি, পরে আবার চেষ্টা হবে`);
    }
  };

  window.addEventListener("online", () => tryDrain(true));
  // periodic retry while online
  setInterval(() => {
    if (navigator.onLine) tryDrain(false);
  }, 30_000);
  // attempt once on load (in case there are pending from previous session)
  if (navigator.onLine) setTimeout(() => tryDrain(true), 1500);
}
