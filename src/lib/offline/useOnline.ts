import { useEffect, useState } from "react";
import { getPendingCount, subscribePending } from "./queue";

export function useOnline() {
  const [online, setOnline] = useState<boolean>(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

export function usePendingCount() {
  const [n, setN] = useState(0);
  useEffect(() => {
    let alive = true;
    const refresh = () => {
      getPendingCount().then((c) => alive && setN(c));
    };
    refresh();
    const unsub = subscribePending(refresh);
    const t = setInterval(refresh, 5000);
    return () => {
      alive = false;
      unsub();
      clearInterval(t);
    };
  }, []);
  return n;
}
