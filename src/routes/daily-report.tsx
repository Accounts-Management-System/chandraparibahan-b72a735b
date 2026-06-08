import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useT, fmtNum, fmtDate } from "@/lib/i18n";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { FileDown, Printer } from "lucide-react";
import { exportPdfHtml } from "@/lib/exportPdf";
import { fetchOfficeDeposits } from "@/lib/officeDeposits";

export const Route = createFileRoute("/daily-report")({ component: Page });

function Page() {
  const { t, lang } = useT();
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);

  const q = useQuery({
    queryKey: ["daily-report", from, to],
    queryFn: async () => {
      const [trips, exp, office] = await Promise.all([
        supabase.from("trips").select("*").gte("trip_date", from).lte("trip_date", to).order("trip_date").order("serial_no"),
        supabase.from("expenses").select("*").gte("expense_date", from).lte("expense_date", to).order("expense_date"),
        fetchOfficeDeposits({ from, to }),
      ]);
      return { trips: (trips as any).data ?? [], exp: (exp as any).data ?? [], office: office ?? [] };
    },
  });

  const data = q.data ?? { trips: [], exp: [], office: [] };

  const trips = useMemo(
    () => data.trips,
    [data.trips],
  );
  const expenses = useMemo(
    () => data.exp.filter((r: any) => !r.owner_id),
    [data.exp],
  );
  const officeDeposits = useMemo(
    () => data.office,
    [data.office],
  );

  const totalJama = trips.reduce((s: number, r: any) => s + Number(r.jama_1 || 0) + Number(r.jama_2 || 0), 0);
  const totalDena = trips.reduce((s: number, r: any) => s + Number(r.dena_1 || 0) + Number(r.dena_2 || 0), 0);
  const totalFare = trips.reduce((s: number, r: any) => s + Number(r.fare_1 || 0) + Number(r.fare_2 || 0), 0);
  const totalOffice = officeDeposits.reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
  const totalExpense = expenses.reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
  const totalTrips = trips.length;
  const handBalance = (totalJama - totalDena) + totalOffice - totalExpense;

  const dailyRows = useMemo(() => {
    const m = new Map<string, { jama: number; dena: number; office: number; expense: number }>();
    trips.forEach((r: any) => {
      const cur = m.get(r.trip_date) ?? { jama: 0, dena: 0, office: 0, expense: 0 };
      cur.jama += Number(r.jama_1 || 0) + Number(r.jama_2 || 0);
      cur.dena += Number(r.dena_1 || 0) + Number(r.dena_2 || 0);
      m.set(r.trip_date, cur);
    });
    officeDeposits.forEach((r: any) => {
      const cur = m.get(r.deposit_date) ?? { jama: 0, dena: 0, office: 0, expense: 0 };
      cur.office += Number(r.amount || 0);
      m.set(r.deposit_date, cur);
    });
    expenses.forEach((r: any) => {
      const cur = m.get(r.expense_date) ?? { jama: 0, dena: 0, office: 0, expense: 0 };
      cur.expense += Number(r.amount || 0);
      m.set(r.expense_date, cur);
    });
    let running = 0;
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([date, v]) => {
      const transport = v.jama - v.dena;
      running += transport + v.office - v.expense;
      return { date, ...v, transport, balance: running };
    });
  }, [trips, officeDeposits, expenses]);

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
      rowsHtml.push(
        `<tr>
          <td>${tr ? esc(fmtNum(i + 1, lang)) : ""}</td>
          <td>${tr ? esc(fmtDate(tr.trip_date, lang)) : ""}</td>
          <td>${tr ? esc(tr.vehicle_no ?? "") : ""}</td>
          <td>${tr ? esc(tr.supervisor ?? "") : ""}</td>
          <td class="num">${tr ? esc(fmtNum(j, lang)) : ""}</td>
          <td class="num">${tr ? esc(fmtNum(d, lang)) : ""}</td>
          <td class="num">${tr ? esc(fmtNum(j - d, lang)) : ""}</td>
          <td class="num">${tr ? esc(fmtNum(f, lang)) : ""}</td>
          <td>${tr ? esc(route) : ""}</td>
          <td class="sep"></td>
          <td>${ex ? esc(ex.category ?? "") : ""}</td>
          <td>${ex ? esc(ex.head ?? "") : ""}</td>
          <td>${ex ? esc(ex.description ?? "") : ""}</td>
          <td class="num">${ex ? esc(fmtNum(ex.amount, lang)) : ""}</td>
        </tr>`
      );
    }

    const subtitle = from === to
      ? `তারিখ: ${fmtDate(from, lang)}`
      : `${fmtDate(from, lang)} → ${fmtDate(to, lang)}`;

    const monthlyRows = dailyRows.map((r) => `
      <tr>
        <td>${esc(fmtDate(r.date, lang))}</td>
        <td class="num">${esc(fmtNum(r.transport, lang))}</td>
        <td class="num">${esc(fmtNum(r.office, lang))}</td>
        <td class="num">${esc(fmtNum(r.expense, lang))}</td>
        <td class="num">${esc(fmtNum(r.balance, lang))}</td>
      </tr>`).join("");

    const body = `
      <div class="banner green-banner">চন্দ্রা পরিবহন দৈনিক জমা খরচ হিসাব</div>
      <div class="meta">${esc(subtitle)} &nbsp;|&nbsp; পরিবহন হিসাব: সকল গাড়ির দৈনিক জমা/দেনা, অফিস জমা ও ওনার-বিহীন দৈনিক খরচ</div>

      <table class="month-report">
        <thead><tr><th>তারিখ</th><th>পরিবহন জমা/দেনা</th><th>অফিস কতৃক জমা</th><th>দৈনিক খরচ</th><th>বর্তমান ব্যালেন্স</th></tr></thead>
        <tbody>${monthlyRows || `<tr><td colspan="5">${esc(t("noData"))}</td></tr>`}</tbody>
        <tfoot><tr><td>সর্বমোট</td><td class="num">${esc(fmtNum(totalJama - totalDena, lang))}</td><td class="num">${esc(fmtNum(totalOffice, lang))}</td><td class="num">${esc(fmtNum(totalExpense, lang))}</td><td class="num">${esc(fmtNum(handBalance, lang))}</td></tr></tfoot>
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
            <td>মোট জমা<br/><b class="green">${esc(fmtNum(totalJama, lang))}</b></td>
            <td>মোট দেনা<br/><b class="red">${esc(fmtNum(totalDena, lang))}</b></td>
            <td>ব্যালেন্স<br/><b>${esc(fmtNum(totalJama - totalDena, lang))}</b></td>
            <td>মোট ভাড়া<br/><b>${esc(fmtNum(totalFare, lang))}</b></td>
            <td>অফিস কতৃক জমা<br/><b class="green">${esc(fmtNum(totalOffice, lang))}</b></td>
            <td>মোট খরচ<br/><b class="red">${esc(fmtNum(totalExpense, lang))}</b></td>
            <td>হাতে ব্যালেন্স<br/><b class="blue">${esc(fmtNum(handBalance, lang))}</b></td>
            <td colspan="4" class="formula">(জমা − দেনা) + অফিস কতৃক জমা − খরচ = হাতে ব্যালেন্স</td>
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
            <th>সিরিয়াল</th>
            <th>তারিখ</th>
            <th>গাড়ী নাম্বার</th>
            <th>সুপারভাইজার</th>
            <th>জমা</th>
            <th>দেনা</th>
            <th>আয়/লস</th>
            <th>গাড়ী ভাড়া</th>
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
            <td class="num">${esc(fmtNum(totalJama, lang))}</td>
            <td class="num">${esc(fmtNum(totalDena, lang))}</td>
            <td class="num">${esc(fmtNum(totalJama - totalDena, lang))}</td>
            <td class="num">${esc(fmtNum(totalFare, lang))}</td>
            <td></td>
            <td class="sep"></td>
            <td colspan="3">মোট খরচ</td>
            <td class="num">${esc(fmtNum(totalExpense, lang))}</td>
          </tr>
        </tfoot>
      </table>
    `;

    const extraStyle = `<style>
      .banner{background:#dbeafe;border:1px solid #94a3b8;padding:8px;text-align:center;font-weight:700;font-size:16px;margin:6px 0}
      .green-banner{background:#c6e0b4;border:3px solid #525252;font-size:22px;color:#111}
      .meta{text-align:center;font-size:11px;margin-bottom:8px}
      table.month-report{font-size:15px;border:2px solid #525252;margin-bottom:10px}
      table.month-report th,table.month-report td{border:2px solid #525252;text-align:center;padding:4px 8px}
      table.month-report th{background:#d1d5db;font-size:16px}
      table.month-report .num{text-align:right}
      table.summary{margin-bottom:6px}
      table.summary th{background:#e5e7eb}
      table.summary .head-left{text-align:center;background:#cbd5e1}
      table.summary .head-right{text-align:center;background:#cbd5e1}
      table.summary td{text-align:center;font-size:11px}
      .green{color:#047857}
      .red{color:#b91c1c}
      .blue{color:#1d4ed8}
      .formula{text-align:center;font-style:italic;background:#f9fafb}
      table.main th{background:#e5e7eb;text-align:center}
      table.main tr.group th{background:#cbd5e1;font-size:13px}
      table.main td.num,table.main th.num{text-align:right}
      table.main .sep,table.summary .sep{border:0;background:#fff;width:6px;padding:0}
      tfoot td{font-weight:700;background:#f3f4f6}
    </style>`;

    exportPdfHtml({
      title: "চন্দ্রা পরিবহন — প্রতিদিনের জমা ও খরচ হিসাব",
      body: extraStyle + body,
      orientation: "landscape",
    });
  };

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">প্রতিদিনের জমা ও খরচ হিসাব</h1>
            <p className="text-xs text-muted-foreground">
              সকল গাড়ির দৈনিক জমা/দেনা + অফিস কতৃক জমা − ওনার-বিহীন দৈনিক খরচ
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportLandscapePdf}>
              <FileDown className="h-4 w-4 mr-2" /> PDF (ল্যান্ডস্কেপ)
            </Button>
            <Button variant="outline" onClick={() => window.print()}>
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
          <Stat label={t("totalTrips")} value={`${fmtNum(totalTrips, lang)} টি`} />
          <Stat label="মোট জমা" value={fmtNum(totalJama, lang)} color="text-emerald-400" />
          <Stat label="মোট দেনা" value={fmtNum(totalDena, lang)} color="text-rose-400" />
          <Stat label="ব্যালেন্স (জমা−দেনা)" value={fmtNum(totalJama - totalDena, lang)} />
          <Stat label="মোট ভাড়া" value={fmtNum(totalFare, lang)} />
          <Stat label="অফিস কতৃক জমা" value={fmtNum(totalOffice, lang)} color="text-emerald-400" />
          <Stat label="মোট খরচ" value={fmtNum(totalExpense, lang)} color="text-rose-400" />
          <Stat label="হাতে ব্যালেন্স" value={fmtNum(handBalance, lang)} color="text-sky-400" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="rounded-md border bg-card/60 overflow-x-auto">
            <div className="px-3 py-2 font-semibold bg-muted/40">জমা হিসাব</div>
            <table className="w-full text-xs">
              <thead className="bg-muted/30">
                <tr>
                  <th className="px-2 py-1 text-left">সিঃ</th>
                  <th className="px-2 py-1 text-left">তারিখ</th>
                  <th className="px-2 py-1 text-left">গাড়ী</th>
                  <th className="px-2 py-1 text-left">সুপারভাইজার</th>
                  <th className="px-2 py-1 text-right">জমা</th>
                  <th className="px-2 py-1 text-right">দেনা</th>
                  <th className="px-2 py-1 text-right">আয়/লস</th>
                  <th className="px-2 py-1 text-right">ভাড়া</th>
                  <th className="px-2 py-1 text-left">রুট</th>
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
                <tr><td colSpan={3} className="px-2 py-1 font-semibold">মোট খরচ</td><td className="px-2 py-1 text-right font-semibold text-rose-400">{fmtNum(totalExpense, lang)}</td></tr>
              </tfoot>
            </table>
          </div>
        </div>

        {officeDeposits.length > 0 && (
          <div className="rounded-md border bg-card/60 overflow-x-auto">
            <div className="px-3 py-2 font-semibold bg-muted/40">অফিস কতৃক জমা</div>
            <table className="w-full text-xs">
              <thead className="bg-muted/30">
                <tr>
                  <th className="px-2 py-1 text-left">তারিখ</th>
                  <th className="px-2 py-1 text-left">ক্যাটাগরী</th>
                  <th className="px-2 py-1 text-left">খাত</th>
                  <th className="px-2 py-1 text-left">বিবরন</th>
                  <th className="px-2 py-1 text-right">পরিমান</th>
                </tr>
              </thead>
              <tbody>
                {officeDeposits.map((r: any) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-2 py-1">{fmtDate(r.deposit_date, lang)}</td>
                    <td className="px-2 py-1">{r.category ?? "—"}</td>
                    <td className="px-2 py-1">{r.head ?? "—"}</td>
                    <td className="px-2 py-1">{r.description ?? "—"}</td>
                    <td className="px-2 py-1 text-right text-emerald-400">{fmtNum(r.amount, lang)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted/30">
                <tr><td colSpan={4} className="px-2 py-1 font-semibold">মোট</td><td className="px-2 py-1 text-right font-semibold text-emerald-400">{fmtNum(totalOffice, lang)}</td></tr>
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
