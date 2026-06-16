import { Wifi, WifiOff, CloudUpload } from "lucide-react";
import { useOnline, usePendingCount } from "@/lib/offline/useOnline";
import { useT } from "@/lib/i18n";

export function OfflineIndicator() {
  const online = useOnline();
  const pending = usePendingCount();
  const { lang } = useT();

  if (online && pending === 0) return null;

  const label = !online
    ? lang === "bn"
      ? `অফলাইন${pending ? ` • ${pending} অপেক্ষমান` : ""}`
      : `Offline${pending ? ` • ${pending} pending` : ""}`
    : lang === "bn"
    ? `সিঙ্ক হচ্ছে • ${pending}`
    : `Syncing • ${pending}`;

  const Icon = !online ? WifiOff : pending > 0 ? CloudUpload : Wifi;
  const cls = !online
    ? "bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/40"
    : "bg-sky-500/15 text-sky-600 dark:text-sky-300 border-sky-500/40";

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${cls}`}
      title={label}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
    </div>
  );
}
