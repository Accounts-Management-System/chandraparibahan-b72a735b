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
  const waMsg = `চন্দ্রা পরিবহন — ${title}${subtitle ? "\n" + subtitle : ""}\n\n(নিচে PDF ফাইলটি অ্যাটাচ করা হয়েছে)`;
  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
  *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
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

  .toolbar{position:sticky;top:0;z-index:10;background:#0c2f3d;color:#fff;padding:10px 12px;margin:-18px -18px 14px;display:flex;flex-wrap:wrap;gap:8px;align-items:center;box-shadow:0 2px 6px rgba(0,0,0,.2)}
  .toolbar b{font-size:13px;margin-right:6px}
  .toolbar select,.toolbar input,.toolbar button{font:inherit;padding:6px 10px;border-radius:6px;border:1px solid #ffffff44;background:#ffffff1a;color:#fff}
  .toolbar input{color:#fff}
  .toolbar input::placeholder{color:#ffffffaa}
  .toolbar select{color:#111;background:#fff}
  .toolbar button{cursor:pointer;font-weight:700}
  .toolbar .send{background:#25D366;border-color:#25D366;color:#000}
  .toolbar .print{background:#fff;color:#0c2f3d}
  .toolbar .add{background:#fff;color:#0c2f3d}
  .toolbar .del{background:#ffffff1a;color:#fff;padding:6px 9px}
  .toolbar .group{display:flex;gap:6px;align-items:center}
  .toolbar .hint{font-size:11px;color:#ffffffc0;flex-basis:100%;margin-top:2px}
  .toolbar .status{flex-basis:100%;margin-top:4px;padding:6px 10px;border-radius:6px;font-weight:700;font-size:12px;display:none}
  .toolbar .status.show{display:block}
  .toolbar .status.saved{background:#15803d;color:#fff}
  .toolbar .status.ready{background:#1d4ed8;color:#fff}
  .toolbar .status.failed{background:#b91c1c;color:#fff}
  @media print { .toolbar{display:none !important} body{padding:0} }
  @page{size:A4 ${orientation};margin:12mm}
</style></head><body>
  <div class="toolbar">
    <b>📱 WhatsApp:</b>
    <div class="group">
      <select id="wa-list"></select>
      <button class="del" id="wa-del" title="মুছুন">✕</button>
    </div>
    <div class="group">
      <input id="wa-new" placeholder="নাম্বার (8801XXXXXXXXX)" size="20"/>
      <input id="wa-name" placeholder="নাম" size="10"/>
      <button class="add" id="wa-add">+ যোগ</button>
    </div>
    <button class="send" id="wa-send">📤 WhatsApp এ পাঠান</button>
    <button class="print" id="wa-print">🖨️ Print / Save PDF</button>
    <div class="hint">প্রথমে "Print / Save PDF" ক্লিক করে PDF টি সেভ করুন, এরপর "WhatsApp এ পাঠান" এ ক্লিক করলে চ্যাট খুলবে — সেখানে সেভ করা PDF ফাইলটি অ্যাটাচ করে পাঠান।</div>
    <div id="wa-status" class="status"></div>
  </div>

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
        var s=t.toString().replace(/[,\\s৳]/g,'').replace(/[০-৯]/g,function(d){return '০১২৩৪৫৬৭৮৯'.indexOf(d);});
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

      // ---- WhatsApp manual share toolbar ----
      var KEY='cp_whatsapp_numbers_v1';
      function load(){ try{ return JSON.parse(localStorage.getItem(KEY)||'[]'); }catch(e){ return []; } }
      function save(list){ localStorage.setItem(KEY, JSON.stringify(list)); }
      function clean(n){ return (n||'').replace(/[^0-9]/g,''); }
      var sel=document.getElementById('wa-list');
      function refresh(){
        var list=load(); sel.innerHTML='';
        if(!list.length){
          var o=document.createElement('option'); o.value=''; o.textContent='— সংরক্ষিত নাম্বার নেই —'; sel.appendChild(o); return;
        }
        list.forEach(function(item){
          var o=document.createElement('option');
          o.value=item.num; o.textContent=(item.name?item.name+' — ':'')+item.num;
          sel.appendChild(o);
        });
      }
      refresh();
      document.getElementById('wa-add').onclick=function(){
        var num=clean(document.getElementById('wa-new').value);
        var name=document.getElementById('wa-name').value.trim();
        if(num.length<8){ alert('সঠিক নাম্বার দিন (দেশের কোড সহ, যেমন 8801XXXXXXXXX)'); return; }
        var list=load();
        if(list.some(function(x){return x.num===num;})){ alert('এই নাম্বার আগে থেকেই সংরক্ষিত'); return; }
        list.push({num:num,name:name}); save(list); refresh();
        document.getElementById('wa-new').value=''; document.getElementById('wa-name').value='';
        sel.value=num;
      };
      document.getElementById('wa-del').onclick=function(){
        var v=sel.value; if(!v) return;
        if(!confirm('এই নাম্বার মুছে ফেলবেন?')) return;
        save(load().filter(function(x){return x.num!==v;})); refresh();
      };
      var statusEl=document.getElementById('wa-status');
      var pdfSaved=false;
      function setStatus(kind,msg){
        statusEl.className='status show '+kind;
        statusEl.textContent=msg;
      }
      document.getElementById('wa-send').onclick=function(){
        var num=clean(sel.value)||clean(document.getElementById('wa-new').value);
        if(!num){ setStatus('failed','❌ Failed — আগে একটি WhatsApp নাম্বার নির্বাচন বা যোগ করুন'); return; }
        if(!pdfSaved){ setStatus('failed','❌ Failed — আগে "Print / Save PDF" ক্লিক করে PDF সেভ করুন, তারপর আবার পাঠান'); return; }
        var msg=${JSON.stringify(waMsg)};
        var url='https://wa.me/'+num+'?text='+encodeURIComponent(msg);
        var win=window.open(url,'_blank');
        if(!win){ setStatus('failed','❌ Failed — পপআপ ব্লক হয়েছে, অনুমতি দিন'); return; }
        setStatus('ready','✅ Ready — WhatsApp চ্যাট খোলা হয়েছে। এখন সেভ করা PDF ফাইলটি অ্যাটাচ করে পাঠান।');
      };
      document.getElementById('wa-print').onclick=function(){
        setStatus('ready','🖨️ Print ডায়ালগ খোলা হচ্ছে — "Save as PDF" নির্বাচন করুন...');
        window.print();
      };
      window.addEventListener('afterprint',function(){
        pdfSaved=true;
        setStatus('saved','✅ Saved — PDF সেভ হয়েছে। এখন "WhatsApp এ পাঠান" ক্লিক করুন।');
      });
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
