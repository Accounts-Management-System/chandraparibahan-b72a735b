// Simple PDF export via print dialog (no extra deps).
// Opens a new window with a print-friendly HTML table and triggers print.

export function exportPdf(opts: {
  title: string;
  subtitle?: string;
  headers: string[];
  rows: (string | number | null | undefined)[][];
  footer?: string;
}) {
  const { title, subtitle, headers, rows, footer } = opts;
  const esc = (v: any) =>
    String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:'Noto Sans Bengali','Hind Siliguri',system-ui,-apple-system,sans-serif;padding:24px;color:#111;background:#fff}
  h1{font-size:20px;margin:0 0 4px;letter-spacing:.3px}
  .sub{font-size:12px;color:#555;margin-bottom:14px}
  table{width:100%;border-collapse:collapse;font-size:12px}
  th,td{border:1px solid #d0d5dd;padding:6px 8px;text-align:left;vertical-align:top}
  thead{background:#f3f4f6}
  tfoot td{font-weight:700;background:#f9fafb}
  @page{size:A4;margin:14mm}
</style></head><body>
  <h1>${esc(title)}</h1>
  ${subtitle ? `<div class="sub">${esc(subtitle)}</div>` : ""}
  <table>
    <thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>
    <tbody>
      ${rows
        .map(
          (r) =>
            `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`,
        )
        .join("")}
    </tbody>
    ${footer ? `<tfoot><tr><td colspan="${headers.length}">${esc(footer)}</td></tr></tfoot>` : ""}
  </table>
  <script>window.onload=function(){setTimeout(function(){window.print();},250);}<\/script>
</body></html>`;

  const w = window.open("", "_blank");
  if (!w) {
    alert("Pop-up blocked. Please allow pop-ups for PDF export.");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}
