// Simple PDF export via print dialog (no extra deps).
// Opens a new window with a print-friendly HTML table and triggers print.

export function exportPdf(opts: {
  title: string;
  subtitle?: string;
  headers: string[];
  rows: (string | number | null | undefined)[][];
  footer?: string;
  orientation?: "portrait" | "landscape";
}) {
  const { title, subtitle, headers, rows, footer, orientation = "portrait" } = opts;
  const body = `
    <table>
      <thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>
      <tbody>
        ${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}
      </tbody>
      ${footer ? `<tfoot><tr><td colspan="${headers.length}">${esc(footer)}</td></tr></tfoot>` : ""}
    </table>`;
  openPrint({ title, subtitle, body, orientation });
}

// Export arbitrary HTML body (e.g. multiple tables, T-account layout)
export function exportPdfHtml(opts: {
  title: string;
  subtitle?: string;
  body: string;
  orientation?: "portrait" | "landscape";
}) {
  openPrint({ ...opts, orientation: opts.orientation ?? "portrait" });
}

function esc(v: any) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function openPrint(opts: { title: string; subtitle?: string; body: string; orientation: "portrait" | "landscape" }) {
  const { title, subtitle, body, orientation } = opts;
  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:'Noto Sans Bengali','Hind Siliguri',system-ui,-apple-system,sans-serif;padding:18px;color:#111;background:#fff}
  .brand{text-align:center;font-size:22px;font-weight:800;letter-spacing:.5px;color:#0c2f3d;border-bottom:2px solid #0c2f3d;padding-bottom:6px;margin-bottom:10px}
  h1{font-size:18px;margin:0 0 4px;letter-spacing:.3px}
  h2{font-size:14px;margin:14px 0 6px}
  .sub{font-size:12px;color:#555;margin-bottom:14px}
  table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:10px}
  th,td{border:1px solid #d0d5dd;padding:6px 8px;text-align:left;vertical-align:top}
  thead{background:#eaf1f7}
  tbody tr:nth-child(odd) td{background:#ffffff}
  tbody tr:nth-child(even) td{background:#f4f6f9}
  tfoot td{font-weight:700;background:#e8eef5}
  .num-jama{color:#1d4ed8;font-weight:700}
  .num-khoroch{color:#c2410c;font-weight:700}
  .num-pos{color:#15803d;font-weight:700}
  .num-neg{color:#b91c1c;font-weight:700}
  .t-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .t-grid h3{margin:0 0 6px;font-size:13px;text-align:center;background:#eef2f7;padding:6px;border:1px solid #d0d5dd}
  .totals{margin-top:8px;display:flex;justify-content:space-between;font-weight:700;border-top:2px solid #111;padding-top:6px}
  @page{size:A4 ${orientation};margin:12mm}
</style></head><body>
  <div class="brand">চন্দ্রা পরিবহন</div>
  <h1>${esc(title)}</h1>
  ${subtitle ? `<div class="sub">${esc(subtitle)}</div>` : ""}
  ${body}
  <script>
    (function(){
      function classify(header){
        var h=(header||'').toString();
        if(/জমা|আয়|ইনকাম|income/i.test(h)) return 'jama';
        if(/খরচ|দেনা|ব্যয়|expense/i.test(h)) return 'khoroch';
        if(/ব্যালেন্স|মুনাফা|লাভ|balance|profit|net/i.test(h)) return 'balance';
        return '';
      }
      function parseNum(t){
        if(!t) return NaN;
        var s=t.toString().replace(/[,\s৳]/g,'').replace(/[০-৯]/g,function(d){return '০১২৩৪৫৬৭৮৯'.indexOf(d);});
        var n=parseFloat(s);
        return isNaN(n)?NaN:n;
      }
      document.querySelectorAll('table').forEach(function(tbl){
        var ths=tbl.querySelectorAll('thead th');
        var map=[];
        ths.forEach(function(th){ map.push(classify(th.textContent)); });
        if(!map.some(Boolean)) return;
        var rows=tbl.querySelectorAll('tbody tr, tfoot tr');
        rows.forEach(function(tr){
          var cells=tr.children;
          for(var i=0;i<cells.length && i<map.length;i++){
            var kind=map[i]; if(!kind) continue;
            var td=cells[i];
            var n=parseNum(td.textContent);
            if(isNaN(n)) continue;
            if(kind==='jama') td.classList.add('num-jama');
            else if(kind==='khoroch') td.classList.add('num-khoroch');
            else if(kind==='balance') td.classList.add(n<0?'num-neg':'num-pos');
          }
        });
      });
      setTimeout(function(){window.print();},250);
    })();
  <\/script>
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
