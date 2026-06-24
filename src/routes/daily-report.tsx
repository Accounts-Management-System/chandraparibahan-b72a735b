import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useT, fmtNum, fmtDate, trBn } from "@/lib/i18n";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { FileDown, Printer } from "lucide-react";
import { exportPdfHtml } from "@/lib/exportPdf";

export const Route = createFileRoute("/daily-report")({ component: Page });

function Page() {
  const { t, lang } = useT();
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);

  const q = useQuery({
    queryKey: ["daily-report", from, to],
    queryFn: async () => {
      const [trips, exp, oth] = await Promise.all([
        supabase.from("trips").select("*").gte("trip_date", from).lte("trip_date", to).order("trip_date").order("serial_no"),
        supabase.from("expenses").select("*").gte("expense_date", from).lte("expense_date", to).order("expense_date"),
        supabase.from("other_incomes").select("*").gte("income_date", from).lte("income_date", to).order("income_date"),
      ]);
      return { trips: (trips as any).data ?? [], exp: (exp as any).data ?? [], oth: (oth as any).data ?? [] };
    },
  });

  const data = q.data ?? { trips: [], exp: [], oth: [] };

  const trips = useMemo(
    () => data.trips,
    [data.trips],
  );
  const expenses = useMemo(
    () => data.exp.filter((r: any) => !r.owner_id),
    [data.exp],
  );
  const otherDeposits = useMemo(() => data.oth.filter((r: any) => !r.owner_id), [data.oth]);
  const jamaKhorochDeposits = useMemo(() => data.oth.filter((r: any) => !!r.owner_id), [data.oth]);

  const totalJama = trips.reduce((s: number, r: any) => s + Number(r.jama_1 || 0) + Number(r.jama_2 || 0), 0);
  const totalDena = trips.reduce((s: number, r: any) => s + Number(r.dena_1 || 0) + Number(r.dena_2 || 0), 0);
  const totalFare = trips.reduce((s: number, r: any) => s + Number(r.fare_1 || 0) + Number(r.fare_2 || 0), 0);
  const totalOther = otherDeposits.reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
  const totalJamaKhoroch = jamaKhorochDeposits.reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
  const totalExpense = expenses.reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
  const totalTrips = trips.length;
  const handBalance = (totalJama - totalDena) + totalOther - totalExpense;

  const dailyRows = useMemo(() => {
    const m = new Map<string, { jama: number; dena: number; other: number; jamaKhoroch: number; expense: number }>();
    trips.forEach((r: any) => {
      const cur = m.get(r.trip_date) ?? { jama: 0, dena: 0, other: 0, jamaKhoroch: 0, expense: 0 };
      cur.jama += Number(r.jama_1 || 0) + Number(r.jama_2 || 0);
      cur.dena += Number(r.dena_1 || 0) + Number(r.dena_2 || 0);
      m.set(r.trip_date, cur);
    });
    otherDeposits.forEach((r: any) => {
      const cur = m.get(r.income_date) ?? { jama: 0, dena: 0, other: 0, jamaKhoroch: 0, expense: 0 };
      cur.other += Number(r.amount || 0);
      m.set(r.income_date, cur);
    });
    jamaKhorochDeposits.forEach((r: any) => {
      const cur = m.get(r.income_date) ?? { jama: 0, dena: 0, other: 0, jamaKhoroch: 0, expense: 0 };
      cur.jamaKhoroch += Number(r.amount || 0);
      m.set(r.income_date, cur);
    });
    expenses.forEach((r: any) => {
      const cur = m.get(r.expense_date) ?? { jama: 0, dena: 0, other: 0, jamaKhoroch: 0, expense: 0 };
      cur.expense += Number(r.amount || 0);
      m.set(r.expense_date, cur);
    });
    let running = 0;
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([date, v]) => {
      const transport = v.jama - v.dena;
      running += transport + v.other - v.expense;
      return { date, ...v, transport, balance: running };
    });
  }, [trips, otherDeposits, jamaKhorochDeposits, expenses]);

  const esc = (v: any) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const exportLandscapePdf = () => {
    const maxLen = Math.max(trips.length, expenses.length);
    const rowsHtml: string[] = [];
    for (let i = 0; i < maxLen; i++) {
      const tr = trips[i];
      const ex = expenses[i];
      const j = tr ? Number(tr.jama_1 || 0) + Number(tr.jama_2 || 0) : 0;
      const d = tr ? Number(tr.dena_1 || 0) + Number(tr.dena_2 || 0) : 0;
      const f = tr ? Number(tr.fare_1 || 0) + Number(tr.fare_2 || 0) : 0;
      const route = tr ? [tr.route_1, tr.route_2].filter(Boolean).join(" / ") : "";
      const bal = tr ? j - d : 0;
      rowsHtml.push(
        `<tr>
          <td>${tr ? esc(fmtNum(i + 1, lang)) : ""}</td>
          <td>${tr ? esc(fmtDate(tr.trip_date, lang)) : ""}</td>
          <td>${tr ? esc(tr.vehicle_no ?? "") : ""}</td>
          <td class="wrap">${tr ? esc(tr.supervisor ?? "") : ""}</td>
          <td class="c-jama">${tr ? esc(fmtNum(j, lang)) : ""}</td>
          <td class="c-dena">${tr ? esc(fmtNum(d, lang)) : ""}</td>
          <td class="${bal < 0 ? 'c-neg' : 'c-pos'}">${tr ? esc(fmtNum(j - d, lang)) : ""}</td>
          <td>${tr ? esc(fmtNum(f, lang)) : ""}</td>
          <td class="wrap">${tr ? esc(route) : ""}</td>
          <td class="sep"></td>
          <td>${ex ? esc(ex.category ?? "") : ""}</td>
          <td>${ex ? esc(ex.head ?? "") : ""}</td>
          <td class="wrap">${ex ? esc(ex.description ?? "") : ""}</td>
          <td class="c-exp">${ex ? esc(fmtNum(ex.amount, lang)) : ""}</td>
        </tr>`
      );
    }

    const subtitle = from === to
      ? `তারিখ: ${fmtDate(from, lang)}`
      : `${fmtDate(from, lang)} → ${fmtDate(to, lang)}`;

    const monthlyRows = dailyRows.map((r) => `
      <tr>
        <td>${esc(fmtDate(r.date, lang))}</td>
        <td class="${r.transport < 0 ? 'c-neg' : 'c-pos'}">${esc(fmtNum(r.transport, lang))}</td>
        <td class="c-jama">${esc(fmtNum(r.other, lang))}</td>
        <td class="c-jama">${esc(fmtNum(r.jamaKhoroch, lang))}</td>
        <td class="c-exp">${esc(fmtNum(r.expense, lang))}</td>
        <td class="${r.balance < 0 ? 'c-neg' : 'c-pos'}">${esc(fmtNum(r.balance, lang))}</td>
      </tr>`).join("");

    const body = `
      <div class="banner green-banner">চন্দ্রা পরিবহন দৈনিক জমা খরচ হিসাব</div>
      <div class="meta">${esc(subtitle)} &nbsp;|&nbsp; পরিবহন হিসাব: দৈনিক জমা/দেনা, অন্যান্য জমা, জমা-খরচের জমা ও দৈনিক খরচ</div>

      <table class="month-report">
        <thead><tr><th>তারিখ</th><th>পরিবহন জমা/দেনা</th><th>${trBn("অন্যান্য জমা", lang)}</th><th>${trBn("জমা-খরচের জমা", lang)}</th><th>${trBn("দৈনিক খরচ", lang)}</th><th>বর্তমান ব্যালেন্স</th></tr></thead>
        <tbody>${monthlyRows || `<tr><td colspan="6">${esc(t("noData"))}</td></tr>`}</tbody>
        <tfoot><tr><td>সর্বমোট</td><td class="${(totalJama-totalDena) < 0 ? 'c-neg' : 'c-pos'}">${esc(fmtNum(totalJama - totalDena, lang))}</td><td class="c-jama">${esc(fmtNum(totalOther, lang))}</td><td class="c-jama">${esc(fmtNum(totalJamaKhoroch, lang))}</td><td class="c-exp">${esc(fmtNum(totalExpense, lang))}</td><td class="${handBalance < 0 ? 'c-neg' : 'c-pos'}">${esc(fmtNum(handBalance, lang))}</td></tr></tfoot>
      </table>

      <table class="summary">
        <thead>
          <tr>
            <th colspan="8" class="head-left">জমা হিসাব</th>
            <th colspan="4" class="head-right">খরচ হিসাব</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${esc(t("totalTrips"))}<br/><b>${esc(fmtNum(totalTrips, lang))} টি</b></td>
            <td>${trBn("মোট জমা", lang)}<br/><b class="c-jama">${esc(fmtNum(totalJama, lang))}</b></td>
            <td>${trBn("মোট দেনা", lang)}<br/><b class="c-dena">${esc(fmtNum(totalDena, lang))}</b></td>
            <td>${trBn("ব্যালেন্স", lang)}<br/><b class="${(totalJama-totalDena)<0?'c-neg':'c-pos'}">${esc(fmtNum(totalJama - totalDena, lang))}</b></td>
            <td>${trBn("মোট ভাড়া", lang)}<br/><b>${esc(fmtNum(totalFare, lang))}</b></td>
            <td>${trBn("অন্যান্য জমা", lang)}<br/><b class="c-jama">${esc(fmtNum(totalOther, lang))}</b></td>
            <td>${trBn("জমা-খরচের জমা", lang)}<br/><b class="c-jama">${esc(fmtNum(totalJamaKhoroch, lang))}</b></td>
            <td>${trBn("মোট খরচ", lang)}<br/><b class="c-exp">${esc(fmtNum(totalExpense, lang))}</b></td>
            <td>${trBn("হাতে ব্যালেন্স", lang)}<br/><b class="${handBalance<0?'c-neg':'c-pos'}">${esc(fmtNum(handBalance, lang))}</b></td>
            <td colspan="4" class="formula">(জমা − দেনা) + অন্যান্য জমা − খরচ = হাতে ব্যালেন্স &nbsp;|&nbsp; জমা-খরচের জমা ওনার হিসাবে</td>
          </tr>
        </tbody>
      </table>

      <table class="main">
        <thead>
          <tr class="group">
            <th colspan="9">জমা হিসাব</th>
            <th class="sep"></th>
            <th colspan="4">খরচ হিসাব</th>
          </tr>
          <tr>
            <th>SL</th>
            <th>তারিখ</th>
            <th>গাড়ী নাম্বার</th>
            <th>সুপারভাইজার</th>
            <th>${trBn("জমা", lang)}</th>
            <th>${trBn("দেনা", lang)}</th>
            <th>${trBn("আয়/লস", lang)}</th>
            <th>${trBn("গাড়ী ভাড়া", lang)}</th>
            <th>রুট</th>
            <th class="sep"></th>
            <th>ক্যাটাগরী</th>
            <th>খাত</th>
            <th>বিবরন</th>
            <th>পরিমান</th>
          </tr>
        </thead>
        <tbody>${rowsHtml.join("")}</tbody>
        <tfoot>
          <tr>
            <td colspan="4">সর্বমোট</td>
            <td class="c-jama">${esc(fmtNum(totalJama, lang))}</td>
            <td class="c-dena">${esc(fmtNum(totalDena, lang))}</td>
            <td class="${(totalJama-totalDena)<0?'c-neg':'c-pos'}">${esc(fmtNum(totalJama - totalDena, lang))}</td>
            <td>${esc(fmtNum(totalFare, lang))}</td>
            <td></td>
            <td class="sep"></td>
            <td colspan="3">${trBn("মোট খরচ", lang)}</td>
            <td class="c-exp">${esc(fmtNum(totalExpense, lang))}</td>
          </tr>
        </tfoot>
      </table>

      ${(otherDeposits.length || jamaKhorochDeposits.length) ? `
      <div class="office-note">⚠ অফিস কতৃক পূরণ করা</div>
      <h3 style="margin:6px 0 4px;font-size:14px;text-align:center">${esc(trBn("অন্যান্য জমা ও জমা-খরচের জমা", lang))}</h3>
      <table class="other">
        <thead>
          <tr>
            <th>তারিখ</th><th>ধরন</th><th>ক্যাটাগরী</th><th>খাত</th><th>বিবরন</th><th>পরিমান</th>
          </tr>
        </thead>
        <tbody>
          ${[...otherDeposits.map((r: any) => ({ ...r, kindLabel: trBn("অন্যান্য জমা", lang) })), ...jamaKhorochDeposits.map((r: any) => ({ ...r, kindLabel: trBn("জমা-খরচের জমা", lang) }))]
            .map((r: any) => `<tr>
              <td>${esc(fmtDate(r.income_date, lang))}</td>
              <td>${esc(r.kindLabel)}</td>
              <td>${esc(r.category ?? "")}</td>
              <td>${esc(r.head ?? "")}</td>
              <td class="wrap">${esc(r.description ?? "")}</td>
              <td class="c-jama">${esc(fmtNum(r.amount, lang))}</td>
            </tr>`).join("")}
        </tbody>
        <tfoot>
          <tr><td colspan="5">${esc(trBn("মোট", lang))}</td><td class="c-jama">${esc(fmtNum(totalOther + totalJamaKhoroch, lang))}</td></tr>
        </tfoot>
      </table>` : ""}
    `;

    const extraStyle = `<style>
      .banner{background:#dbeafe;border:2px solid #525252;padding:4px;text-align:center;font-weight:700;font-size:13px;margin:2px 0}
      .green-banner{background:#c6e0b4;border:2px solid #525252;font-size:15px;color:#111}
      .meta{text-align:center;font-size:10px;margin-bottom:4px}
      table{table-layout:auto;width:100%}
      table.month-report{font-size:11px;border:2px solid #525252;margin-bottom:4px}
      table.month-report th,table.month-report td{border:1px solid #525252;text-align:center;padding:2px 4px}
      table.month-report th{background:#d1d5db;font-size:12px}
      table.summary{margin-bottom:4px;border:2px solid #525252}
      table.summary th,table.summary td{text-align:center;padding:2px 3px;border:1px solid #525252}
      table.summary th{background:#e5e7eb}
      table.summary .head-left,table.summary .head-right{background:#cbd5e1;font-size:12px}
      table.summary td{font-size:10px}
      .formula{font-style:italic;background:#f9fafb;font-size:9px}
      table.main{table-layout:auto;border:2px solid #525252}
      table.main th,table.main td{text-align:center;vertical-align:middle;white-space:nowrap;padding:2px 3px;border:1px solid #525252;font-size:10px}
      table.main th{background:#e5e7eb;font-size:11px}
      table.main tr.group th{background:#cbd5e1;font-size:12px}
      table.main td.wrap,table.main th.wrap{white-space:normal;word-break:break-word;min-width:70px}
      table.main td:nth-child(4),table.main th:nth-child(4){white-space:normal;word-break:break-word;min-width:70px}
      table.main td:nth-child(13),table.main th:nth-child(13){white-space:normal;word-break:break-word;min-width:90px}
      table.main .sep{border-top:0;border-bottom:0;border-left:2px solid #525252;border-right:2px solid #525252;background:#f1f5f9;width:8px;padding:0}
      table.summary .sep{border:0;background:#fff;width:4px;padding:0}
      table.other{border:2px solid #525252}
      table.other th,table.other td{text-align:center;padding:2px 4px;border:1px solid #525252;font-size:10px}
      table.other th{background:#e5e7eb}
      table.other td.wrap{white-space:normal;word-break:break-word;min-width:100px}
      tfoot td{font-weight:700;background:#f3f4f6}
      .c-jama{color:#1d4ed8;font-weight:700}
      .c-dena{color:#c2410c;font-weight:700}
      .c-exp{color:#b91c1c;font-weight:700}
      .c-pos{color:#15803d;font-weight:700}
      .c-neg{color:#b91c1c;font-weight:700}
      .office-note{margin-top:6px;background:#fef3c7;border:1px solid #d97706;color:#78350f;font-weight:700;text-align:center;padding:3px;font-size:11px;border-radius:3px}
    </style>`;

    exportPdfHtml({
      title: trBn("চন্দ্রা পরিবহন — প্রতিদিনের জমা ও খরচ হিসাব", lang),
      body: extraStyle + body,
      orientation: "landscape",
    });
  };


  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{lang === "en" ? "Daily Income & Expense Report" : "প্রতিদিনের জমা ও খরচ হিসাব"}</h1>
            <p className="text-xs text-muted-foreground">
              {lang === "en" ? "All vehicles: Daily Deposit/Debt + Other Deposits + Income-Expense Income − Daily Expense" : "সকল গাড়ির দৈনিক জমা/দেনা + অন্যান্য জমা + জমা-খরচের জমা − দৈনিক খরচ"}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportLandscapePdf}>
              <FileDown className="h-4 w-4 mr-2" /> {lang === "en" ? "PDF (Landscape)" : "PDF (ল্যান্ডস্কেপ)"}
            </Button>
            <Button variant="outline" onClick={exportLandscapePdf}>
              <Printer className="h-4 w-4 mr-2" /> {t("print")}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-lg border bg-card/60 p-3">
          <div>
            <label className="text-[10px] uppercase text-muted-foreground">{t("from")}</label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9" />
          </div>
          <div>
            <label className="text-[10px] uppercase text-muted-foreground">{t("to")}</label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9" />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label={t("totalTrips")} value={`${fmtNum(totalTrips, lang)}${lang === "en" ? "" : " টি"}`} />
          <Stat label={trBn("মোট জমা", lang)} value={fmtNum(totalJama, lang)} color="text-emerald-400" />
          <Stat label={trBn("মোট দেনা", lang)} value={fmtNum(totalDena, lang)} color="text-rose-400" />
          <Stat label={trBn("ব্যালেন্স (জমা−দেনা)", lang)} value={fmtNum(totalJama - totalDena, lang)} />
          <Stat label={trBn("মোট ভাড়া", lang)} value={fmtNum(totalFare, lang)} />
          <Stat label={trBn("অন্যান্য জমা", lang)} value={fmtNum(totalOther, lang)} color="text-emerald-400" />
          <Stat label={trBn("জমা-খরচের জমা", lang)} value={fmtNum(totalJamaKhoroch, lang)} color="text-emerald-400" />
          <Stat label={trBn("মোট খরচ", lang)} value={fmtNum(totalExpense, lang)} color="text-rose-400" />
          <Stat label={trBn("হাতে ব্যালেন্স", lang)} value={fmtNum(handBalance, lang)} color="text-sky-400" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="rounded-md border bg-card/60 overflow-x-auto">
            <div className="px-3 py-2 font-semibold bg-muted/40">{lang === "en" ? "Income" : "জমা হিসাব"}</div>
            <table className="w-full text-xs">
              <thead className="bg-muted/30">
                <tr>
                  <th className="px-2 py-1 text-left">{lang === "en" ? "Sl" : "সিঃ"}</th>
                  <th className="px-2 py-1 text-left">{t("date")}</th>
                  <th className="px-2 py-1 text-left">{lang === "en" ? "Vehicle" : "গাড়ী"}</th>
                  <th className="px-2 py-1 text-left">{t("supervisor")}</th>
                  <th className="px-2 py-1 text-right">{trBn("জমা", lang)}</th>
                  <th className="px-2 py-1 text-right">{trBn("দেনা", lang)}</th>
                  <th className="px-2 py-1 text-right">{trBn("আয়/লস", lang)}</th>
                  <th className="px-2 py-1 text-right">{trBn("ভাড়া", lang)}</th>
                  <th className="px-2 py-1 text-left">{t("route")}</th>
                </tr>
              </thead>
              <tbody>
                {trips.length === 0 && (
                  <tr><td colSpan={9} className="text-center py-4 text-muted-foreground">{t("noData")}</td></tr>
                )}
                {trips.map((r: any, i: number) => {
                  const j = Number(r.jama_1 || 0) + Number(r.jama_2 || 0);
                  const d = Number(r.dena_1 || 0) + Number(r.dena_2 || 0);
                  const f = Number(r.fare_1 || 0) + Number(r.fare_2 || 0);
                  return (
                    <tr key={r.id} className="border-t">
                      <td className="px-2 py-1">{fmtNum(i + 1, lang)}</td>
                      <td className="px-2 py-1">{fmtDate(r.trip_date, lang)}</td>
                      <td className="px-2 py-1">{r.vehicle_no}</td>
                      <td className="px-2 py-1">{r.supervisor ?? "—"}</td>
                      <td className="px-2 py-1 text-right">{fmtNum(j, lang)}</td>
                      <td className="px-2 py-1 text-right text-rose-400">{fmtNum(d, lang)}</td>
                      <td className="px-2 py-1 text-right">{fmtNum(j - d, lang)}</td>
                      <td className="px-2 py-1 text-right">{fmtNum(f, lang)}</td>
                      <td className="px-2 py-1">{[r.route_1, r.route_2].filter(Boolean).join(" / ") || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="rounded-md border bg-card/60 overflow-x-auto">
            <div className="px-3 py-2 font-semibold bg-muted/40">খরচ হিসাব</div>
            <table className="w-full text-xs">
              <thead className="bg-muted/30">
                <tr>
                  <th className="px-2 py-1 text-left">ক্যাটাগরী</th>
                  <th className="px-2 py-1 text-left">খাত</th>
                  <th className="px-2 py-1 text-left">বিবরন</th>
                  <th className="px-2 py-1 text-right">পরিমান</th>
                </tr>
              </thead>
              <tbody>
                {expenses.length === 0 && (
                  <tr><td colSpan={4} className="text-center py-4 text-muted-foreground">{t("noData")}</td></tr>
                )}
                {expenses.map((r: any) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-2 py-1">{r.category ?? "—"}</td>
                    <td className="px-2 py-1">{r.head ?? "—"}</td>
                    <td className="px-2 py-1">{r.description ?? "—"}</td>
                    <td className="px-2 py-1 text-right text-rose-400">{fmtNum(r.amount, lang)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted/30">
                <tr><td colSpan={3} className="px-2 py-1 font-semibold">{trBn("মোট খরচ", lang)}</td><td className="px-2 py-1 text-right font-semibold text-rose-400">{fmtNum(totalExpense, lang)}</td></tr>
              </tfoot>
            </table>
          </div>
        </div>

        {(otherDeposits.length > 0 || jamaKhorochDeposits.length > 0) && (
          <div className="rounded-md border bg-card/60 overflow-x-auto">
            <div className="px-3 py-2 font-semibold bg-muted/40">অন্যান্য জমা ও জমা-খরচের জমা</div>
            <table className="w-full text-xs">
              <thead className="bg-muted/30">
                <tr>
                  <th className="px-2 py-1 text-left">তারিখ</th>
                  <th className="px-2 py-1 text-left">ধরন</th>
                  <th className="px-2 py-1 text-left">ক্যাটাগরী</th>
                  <th className="px-2 py-1 text-left">খাত</th>
                  <th className="px-2 py-1 text-left">বিবরন</th>
                  <th className="px-2 py-1 text-right">পরিমান</th>
                </tr>
              </thead>
              <tbody>
                {[...otherDeposits.map((r: any) => ({ ...r, kindLabel: trBn("অন্যান্য জমা", lang) })), ...jamaKhorochDeposits.map((r: any) => ({ ...r, kindLabel: trBn("জমা-খরচের জমা", lang) }))].map((r: any) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-2 py-1">{fmtDate(r.income_date, lang)}</td>
                    <td className="px-2 py-1">{r.kindLabel}</td>
                    <td className="px-2 py-1">{r.category ?? "—"}</td>
                    <td className="px-2 py-1">{r.head ?? "—"}</td>
                    <td className="px-2 py-1">{r.description ?? "—"}</td>
                    <td className="px-2 py-1 text-right text-emerald-400">{fmtNum(r.amount, lang)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted/30">
                <tr><td colSpan={5} className="px-2 py-1 font-semibold">{trBn("মোট", lang)}</td><td className="px-2 py-1 text-right font-semibold text-emerald-400">{fmtNum(totalOther + totalJamaKhoroch, lang)}</td></tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-md border bg-card/70 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-lg font-bold mt-1 ${color ?? ""}`}>{value}</div>
    </div>
  );
}
