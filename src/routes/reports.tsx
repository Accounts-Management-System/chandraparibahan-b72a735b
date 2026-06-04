import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useT, fmtNum, fmtDate } from "@/lib/i18n";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Download, Printer, FileDown } from "lucide-react";
import { exportPdf } from "@/lib/exportPdf";

export const Route = createFileRoute("/reports")({ component: Page });

const CHANDRA_ID = "674def72-609b-434c-8186-15aa3d351d28";

function Page() {
  const { t, lang } = useT();
  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = today.slice(0, 8) + "01";
  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(today);
  const [car, setCar] = useState("");
  const [ownerId, setOwnerId] = useState("");

  const { data: owners = [] } = useQuery({
    queryKey: ["rp-owners"],
    queryFn: async () => ((await supabase.from("owners").select("id,name").order("name")).data ?? []) as any[],
  });
  const { data: vehiclesAll = [] } = useQuery({
    queryKey: ["rp-vehicles"],
    queryFn: async () => ((await supabase.from("vehicles").select("id,vehicle_no,owner_id").order("vehicle_no")).data ?? []) as any[],
  });

  const vehicleNosForFilter = ownerId
    ? (vehiclesAll as any[]).filter((v) => v.owner_id === ownerId).map((v) => v.vehicle_no)
    : null;

  const buildFilter = (q: any, dateCol: string) => {
    q = q.gte(dateCol, from).lte(dateCol, to);
    if (car) q = q.eq("vehicle_no", car);
    else if (vehicleNosForFilter) q = q.in("vehicle_no", vehicleNosForFilter.length ? vehicleNosForFilter : ["__none__"]);
    return q;
  };
  const scopeOwner = (q: any) => (ownerId ? q.eq("owner_id", ownerId) : q.or(`owner_id.is.null,owner_id.eq.${CHANDRA_ID}`));

  const q = useQuery({
    queryKey: ["report", from, to, car, ownerId],
    queryFn: async () => {
      const tripsQ = buildFilter(supabase.from("trips").select("*").order("trip_date").order("serial_no"), "trip_date");
      const expQ = buildFilter(scopeOwner(supabase.from("expenses").select("*").order("expense_date")), "expense_date");
      // other_incomes: independent — skip when owner selected (owner accounts don't pull from other_incomes)
      const othQ = ownerId
        ? Promise.resolve({ data: [] as any[] })
        : supabase.from("other_incomes").select("*").gte("income_date", from).lte("income_date", to).order("income_date");
      const [trips, exp, oth] = await Promise.all([tripsQ, expQ, othQ]);
      return { trips: (trips as any).data ?? [], exp: (exp as any).data ?? [], oth: (oth as any).data ?? [] };
    },
  });

  const data = q.data ?? { trips: [], exp: [], oth: [] };
  const jama = data.trips.reduce((s: number, r: any) => s + Number(r.jama_1 || 0) + Number(r.jama_2 || 0), 0);
  const dena = data.trips.reduce((s: number, r: any) => s + Number(r.dena_1 || 0) + Number(r.dena_2 || 0), 0);
  const fares = data.trips.reduce((s: number, r: any) => s + Number(r.fare_1 || 0) + Number(r.fare_2 || 0), 0);
  const expense = data.exp.reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
  const otherInc = data.oth.reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
  const income = fares + jama + otherInc;
  const totalExpense = expense + dena;

  const exportCsv = () => {
    const lines: string[] = [];
    lines.push("Chandra Paribahan Report");
    lines.push(`From,${from},To,${to}`);
    lines.push("");
    lines.push("Trips");
    lines.push("Serial,Date,Vehicle,Jama,Dena,Balance,Fare,Route,Supervisor");
    data.trips.forEach((r: any) => {
      const j = Number(r.jama_1 || 0) + Number(r.jama_2 || 0);
      const d = Number(r.dena_1 || 0) + Number(r.dena_2 || 0);
      const f = Number(r.fare_1 || 0) + Number(r.fare_2 || 0);
      const rt = [r.route_1, r.route_2].filter(Boolean).join(" / ");
      lines.push([r.serial_no ?? "", r.trip_date, r.vehicle_no, j, d, j - d, f, rt, r.supervisor ?? ""].join(","));
    });
    lines.push("");
    lines.push("Expenses");
    lines.push("Date,Category,Vehicle,Amount");
    data.exp.forEach((r: any) => lines.push([r.expense_date, r.category, r.vehicle_no ?? "", r.amount].join(",")));
    lines.push("");
    lines.push("Other Incomes");
    lines.push("Date,Category,Amount");
    data.oth.forEach((r: any) => lines.push([r.income_date, r.category, r.amount].join(",")));

    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chandra-report-${from}_to_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clear = () => { setCar(""); setOwnerId(""); setFrom(firstOfMonth); setTo(today); };

  return (
    <AppLayout>
      <div className="space-y-4 print:space-y-2">
        <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
          <div>
            <h1 className="text-2xl font-bold">{t("reports")}</h1>
            <p className="text-sm text-muted-foreground">{fmtDate(from, lang)} → {fmtDate(to, lang)}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-2" />{t("exportCsv")}</Button>
            <Button variant="outline" onClick={() => {
              const sub = `${fmtDate(from, lang)} → ${fmtDate(to, lang)} · ${t("income")}: ${fmtNum(income, lang)} · ${t("expense")}: ${fmtNum(totalExpense, lang)} · ${t("net")}: ${fmtNum(income - totalExpense, lang)}`;
              exportPdf({
                title: `${t("brand")} — ${t("reports")}`,
                subtitle: sub,
                headers: [t("serial"), t("date"), t("vehicleNo"), t("jamaTotal"), t("denaTotal"), t("balance"), t("fareTotal"), t("route"), t("supervisor")],
                rows: data.trips.map((r: any) => {
                  const j = Number(r.jama_1 || 0) + Number(r.jama_2 || 0);
                  const d = Number(r.dena_1 || 0) + Number(r.dena_2 || 0);
                  const f = Number(r.fare_1 || 0) + Number(r.fare_2 || 0);
                  return [fmtNum(r.serial_no, lang), fmtDate(r.trip_date, lang), r.vehicle_no, fmtNum(j, lang), fmtNum(d, lang), fmtNum(j - d, lang), fmtNum(f, lang), [r.route_1, r.route_2].filter(Boolean).join(" / ") || "-", r.supervisor ?? "-"];
                }),
              });
            }}><FileDown className="h-4 w-4 mr-2" />{t("exportPdf")}</Button>
            <Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4 mr-2" />{t("print")}</Button>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 rounded-lg border bg-card/60 p-3 print:hidden">
          <div>
            <label className="text-[10px] uppercase text-muted-foreground">{t("from")}</label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9" />
          </div>
          <div>
            <label className="text-[10px] uppercase text-muted-foreground">{t("to")}</label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9" />
          </div>
          <div>
            <label className="text-[10px] uppercase text-muted-foreground">{t("searchByCar")}</label>
            <select value={car} onChange={(e) => setCar(e.target.value)} className="w-full h-9 rounded-md border border-input bg-input px-2 text-sm">
              <option value="">{t("all")}</option>
              {(vehiclesAll as any[]).map((v) => <option key={v.id} value={v.vehicle_no} className="bg-card">{v.vehicle_no}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase text-muted-foreground">{t("searchByOwner")}</label>
            <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className="w-full h-9 rounded-md border border-input bg-input px-2 text-sm">
              <option value="">{t("all")}</option>
              {(owners as any[]).map((s) => <option key={s.id} value={s.id} className="bg-card">{s.name}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <Button size="sm" variant="outline" onClick={clear}>{t("clearForm")}</Button>
          </div>
        </div>

        <div className="hidden print:block mb-4">
          <h1 className="text-xl font-bold text-center">{t("brand")} — {t("reports")}</h1>
          <p className="text-sm text-center">{fmtDate(from, lang)} → {fmtDate(to, lang)}</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label={t("income")} value={fmtNum(income, lang)} color="text-emerald-400" />
          <Stat label={t("expense")} value={fmtNum(totalExpense, lang)} color="text-rose-400" />
          <Stat label={t("net")} value={fmtNum(income - totalExpense, lang)} color="text-sky-400" />
          <Stat label={t("fareTotal")} value={fmtNum(fares, lang)} color="text-amber-400" />
        </div>

        <Tabs defaultValue="trips">
          <TabsList>
            <TabsTrigger value="trips">{t("dailyAccounts")} ({fmtNum(data.trips.length, lang)})</TabsTrigger>
            <TabsTrigger value="exp">{t("expenses")} ({fmtNum(expense, lang)})</TabsTrigger>
            <TabsTrigger value="oth">{t("otherIncome")} ({fmtNum(otherInc, lang)})</TabsTrigger>
          </TabsList>

          <TabsContent value="trips">
            <Section
              headers={[t("serial"), t("date"), t("vehicleNo"), t("jamaTotal"), t("denaTotal"), t("balance"), t("fareTotal"), t("route"), t("supervisor")]}
              rows={data.trips}
              cells={(r: any) => {
                const j = Number(r.jama_1 || 0) + Number(r.jama_2 || 0);
                const d = Number(r.dena_1 || 0) + Number(r.dena_2 || 0);
                const f = Number(r.fare_1 || 0) + Number(r.fare_2 || 0);
                return [fmtNum(r.serial_no, lang), fmtDate(r.trip_date, lang), r.vehicle_no, fmtNum(j, lang), fmtNum(d, lang), fmtNum(j - d, lang), fmtNum(f, lang), [r.route_1, r.route_2].filter(Boolean).join(" / ") || "-", r.supervisor ?? "-"];
              }}
              footer={[t("grandTotal"), "", "", fmtNum(jama, lang), fmtNum(dena, lang), fmtNum(jama - dena, lang), fmtNum(fares, lang), "", ""]}
            />
          </TabsContent>
          <TabsContent value="exp">
            <Section
              headers={[t("date"), t("category"), t("vehicleNo"), t("amount")]}
              rows={data.exp}
              cells={(r: any) => [fmtDate(r.expense_date, lang), r.category, r.vehicle_no ?? "-", fmtNum(r.amount, lang)]}
              footer={[t("grandTotal"), "", "", fmtNum(expense, lang)]}
            />
          </TabsContent>
          <TabsContent value="oth">
            <Section
              headers={[t("date"), t("category"), t("amount")]}
              rows={data.oth}
              cells={(r: any) => [fmtDate(r.income_date, lang), r.category, fmtNum(r.amount, lang)]}
              footer={[t("grandTotal"), "", fmtNum(otherInc, lang)]}
            />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="border bg-card/70 backdrop-blur rounded-lg p-4">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className={`text-xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

function Section({ headers, rows, cells, footer }: { headers: string[]; rows: any[]; cells: (r: any) => any[]; footer?: (string | number)[] }) {
  const { t } = useT();
  return (
    <div className="overflow-x-auto rounded-md border bg-card/70 backdrop-blur">
      <table className="w-full text-sm">
        <thead className="bg-muted/60"><tr>{headers.map((h) => <th key={h} className="text-left px-3 py-2 font-semibold">{h}</th>)}</tr></thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={headers.length} className="text-center py-6 text-muted-foreground">{t("noData")}</td></tr>}
          {rows.map((r) => (
            <tr key={r.id} className="border-t">
              {cells(r).map((c, i) => <td key={i} className="px-3 py-2">{c}</td>)}
            </tr>
          ))}
        </tbody>
        {footer && rows.length > 0 && (
          <tfoot className="bg-muted/40 font-bold border-t"><tr>{footer.map((c, i) => <td key={i} className="px-3 py-2">{c}</td>)}</tr></tfoot>
        )}
      </table>
    </div>
  );
}
