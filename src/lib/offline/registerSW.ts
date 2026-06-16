// Guarded service worker registration for Lovable preview safety.
// Only registers in production on the published origin.
export function registerServiceWorker() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  const host = window.location.hostname;
  const isPreview =
    host.startsWith("id-preview--") ||
    host.startsWith("preview--") ||
    host === "lovableproject.com" ||
    host.endsWith(".lovableproject.com") ||
    host === "lovableproject-dev.com" ||
    host.endsWith(".lovableproject-dev.com") ||
    host === "beta.lovable.dev" ||
    host.endsWith(".beta.lovable.dev");
  const inIframe = window.top !== window.self;
  const isDev = !import.meta.env.PROD;
  const killSwitch = new URLSearchParams(window.location.search).get("sw") === "off";

  if (isPreview || inIframe || isDev || killSwitch) {
    // Unregister any existing app SW so stale registrations don't linger
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => {
        regs.forEach((r) => {
          if (r.active?.scriptURL?.endsWith("/sw.js")) r.unregister();
        });
      })
      .catch(() => {});
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      /* ignore */
    });
  });
}
