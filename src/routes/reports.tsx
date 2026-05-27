import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT, fmtNum, fmtDate } from "@/lib/i18n";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Download, Printer } from "lucide-react";

export const Route = createFileRoute("/reports")({ component: Page });

function Page() {
  const { t, lang } = useT();
  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = today.slice(0, 8) + "01";
  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(today);

  const q = useQuery({
    queryKey: ["report", from, to],
    queryFn: async () => {
      const [trips, exp, oth, xfr] = await Promise.all([
        supabase.from("trips").select("*").gte("trip_date", from).lte("trip_date", to).order("trip_date"),
        supabase.from("expenses").select("*").gte("expense_date", from).lte("expense_date", to).order("expense_date"),
        supabase.from("other_incomes").select("*").gte("income_date", from).lte("income_date", to).order("income_date"),
        supabase.from("transfers").select("*").gte("transfer_date", from).lte("transfer_date", to).order("transfer_date"),
      ]);
      return { trips: trips.data ?? [], exp: exp.data ?? [], oth: oth.data ?? [], xfr: xfr.data ?? [] };
    },
  });

  const data = q.data ?? { trips: [], exp: [], oth: [], xfr: [] };
  const jama = data.trips.reduce((s: number, r: any) => s + Number(r.jama_1 || 0) + Number(r.jama_2 || 0), 0);
  const dena = data.trips.reduce((s: number, r: any) => s + Number(r.dena_1 || 0) + Number(r.dena_2 || 0), 0);
  const fares = data.trips.reduce((s: number, r: any) => s + Number(r.fare_1 || 0) + Number(r.fare_2 || 0), 0);
  const expense = data.exp.reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
  const otherInc = data.oth.reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
  const income = jama + otherInc;
  const totalExpense = expense + dena;

  const exportCsv = () => {
    const lines: string[] = [];
    lines.push("Chandra Paribahan Report");
    lines.push(`From,${from},To,${to}`);
    lines.push("");
    lines.push("Trips");
    lines.push("Date,Vehicle,Jama1,Jama2,Dena1,Dena2,Fare1,Fare2,Supervisor");
    data.trips.forEach((r: any) => lines.push([r.trip_date, r.vehicle_no, r.jama_1, r.jama_2, r.dena_1, r.dena_2, r.fare_1, r.fare_2, r.supervisor ?? ""].join(",")));
    lines.push("");
    lines.push("Expenses");
    lines.push("Date,Category,Description,Vehicle,Amount");
    data.exp.forEach((r: any) => lines.push([r.expense_date, r.category, (r.description ?? "").replace(/,/g, " "), r.vehicle_no ?? "", r.amount].join(",")));
    lines.push("");
    lines.push("Other Incomes");
    lines.push("Date,Category,Description,Amount");
    data.oth.forEach((r: any) => lines.push([r.income_date, r.category, (r.description ?? "").replace(/,/g, " "), r.amount].join(",")));
    lines.push("");
    lines.push("Transfers");
    lines.push("Date,From,To,Amount");
    data.xfr.forEach((r: any) => lines.push([r.transfer_date, r.from_party, r.to_party, r.amount].join(",")));

    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chandra-report-${from}_to_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppLayout>
      <div className="space-y-4 print:space-y-2">
        <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
          <div>
            <h1 className="text-2xl font-bold">{t("reports")}</h1>
            <p className="text-sm text-muted-foreground">{fmtDate(from, lang)} → {fmtDate(to, lang)}</p>
          </div>
          <div className="flex gap-2 items-end flex-wrap">
            <div><Label>{t("from")}</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div><Label>{t("to")}</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
            <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-2" />{t("exportCsv")}</Button>
            <Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4 mr-2" />{t("print")}</Button>
          </div>
        </div>

        <div className="hidden print:block mb-4">
          <h1 className="text-xl font-bold text-center">{t("brand")} — {t("reports")}</h1>
          <p className="text-sm text-center">{fmtDate(from, lang)} → {fmtDate(to, lang)}</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label={t("income")} value={fmtNum(income, lang)} color="text-emerald-600" />
          <Stat label={t("expense")} value={fmtNum(totalExpense, lang)} color="text-rose-600" />
          <Stat label={t("net")} value={fmtNum(income - totalExpense, lang)} color="text-sky-600" />
          <Stat label={t("fare1") + "/" + t("fare2")} value={fmtNum(fares, lang)} color="text-amber-600" />
        </div>

        <Section title={t("dailyAccounts")} rows={data.trips} headers={[t("date"), t("vehicleNo"), t("jama1"), t("dena1"), t("fare1"), t("supervisor")]}
          cells={(r: any) => [fmtDate(r.trip_date, lang), r.vehicle_no, fmtNum(r.jama_1 + r.jama_2, lang), fmtNum(r.dena_1 + r.dena_2, lang), fmtNum(r.fare_1 + r.fare_2, lang), r.supervisor ?? "-"]} />
        <Section title={t("expenses")} rows={data.exp} headers={[t("date"), t("category"), t("description"), t("amount")]}
          cells={(r: any) => [fmtDate(r.expense_date, lang), r.category, r.description ?? "-", fmtNum(r.amount, lang)]} />
        <Section title={t("otherIncome")} rows={data.oth} headers={[t("date"), t("category"), t("description"), t("amount")]}
          cells={(r: any) => [fmtDate(r.income_date, lang), r.category, r.description ?? "-", fmtNum(r.amount, lang)]} />
        <Section title={t("transfers")} rows={data.xfr} headers={[t("date"), t("fromParty"), t("toParty"), t("amount")]}
          cells={(r: any) => [fmtDate(r.transfer_date, lang), r.from_party, r.to_party, fmtNum(r.amount, lang)]} />
      </div>
    </AppLayout>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="border bg-card rounded-lg p-4">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className={`text-xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

function Section({ title, rows, headers, cells }: { title: string; rows: any[]; headers: string[]; cells: (r: any) => any[] }) {
  const { t } = useT();
  return (
    <div className="space-y-2 break-inside-avoid">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="overflow-x-auto rounded-md border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted"><tr>{headers.map((h) => <th key={h} className="text-left px-3 py-2 font-semibold">{h}</th>)}</tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={headers.length} className="text-center py-6 text-muted-foreground">{t("noData")}</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                {cells(r).map((c, i) => <td key={i} className="px-3 py-2">{c}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
