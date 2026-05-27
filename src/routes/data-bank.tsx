import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { useT, fmtNum, fmtDate } from "@/lib/i18n";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";

export const Route = createFileRoute("/data-bank")({ component: Page });

function Page() {
  const { t, lang } = useT();
  const [date, setDate] = useState<string>("");

  // last entry date
  const { data: lastDate } = useQuery({
    queryKey: ["last-trip-date"],
    queryFn: async () => {
      const { data } = await supabase.from("trips").select("trip_date").order("trip_date", { ascending: false }).limit(1);
      return data?.[0]?.trip_date ?? new Date().toISOString().slice(0, 10);
    },
  });
  const effectiveDate = date || lastDate || new Date().toISOString().slice(0, 10);

  const trips = useQuery({
    queryKey: ["db-trips", effectiveDate],
    queryFn: async () => (await supabase.from("trips").select("*").eq("trip_date", effectiveDate).order("serial_no", { ascending: true })).data ?? [],
  });
  const exp = useQuery({
    queryKey: ["db-exp", effectiveDate],
    queryFn: async () => (await supabase.from("expenses").select("*").eq("expense_date", effectiveDate).order("created_at")).data ?? [],
  });
  const oth = useQuery({
    queryKey: ["db-oth", effectiveDate],
    queryFn: async () => (await supabase.from("other_incomes").select("*").eq("income_date", effectiveDate).order("created_at")).data ?? [],
  });

  const totalJama = (trips.data ?? []).reduce((s, r: any) => s + Number(r.jama_1 || 0) + Number(r.jama_2 || 0), 0);
  const totalDena = (trips.data ?? []).reduce((s, r: any) => s + Number(r.dena_1 || 0) + Number(r.dena_2 || 0), 0);
  const totalBalance = totalJama - totalDena;
  const totalFare = (trips.data ?? []).reduce((s, r: any) => s + Number(r.fare_1 || 0) + Number(r.fare_2 || 0), 0);
  const totalExp = (exp.data ?? []).reduce((s, r: any) => s + Number(r.amount || 0), 0);
  const totalOth = (oth.data ?? []).reduce((s, r: any) => s + Number(r.amount || 0), 0);

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">{t("dataBank")}</h1>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{t("date")}:</span>
            <Input type="date" value={effectiveDate} onChange={(e) => setDate(e.target.value)} className="h-9 w-auto" />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{fmtDate(effectiveDate, lang)}</p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label={t("jamaTotal")} value={fmtNum(totalJama, lang)} color="text-emerald-400" />
          <Stat label={t("denaTotal")} value={fmtNum(totalDena, lang)} color="text-rose-400" />
          <Stat label={t("balance")} value={fmtNum(totalBalance, lang)} color="text-primary" />
          <Stat label={t("fareTotal")} value={fmtNum(totalFare, lang)} color="text-amber-400" />
        </div>

        <Tabs defaultValue="trips">
          <TabsList>
            <TabsTrigger value="trips">{t("dailyAccounts")}</TabsTrigger>
            <TabsTrigger value="exp">{t("expenses")} ({fmtNum(totalExp, lang)})</TabsTrigger>
            <TabsTrigger value="oth">{t("otherIncome")} ({fmtNum(totalOth, lang)})</TabsTrigger>
          </TabsList>

          <TabsContent value="trips">
            <Tbl
              rows={trips.data ?? []}
              cols={[
                ["serial_no", t("serial"), (v: any) => fmtNum(v, lang)],
                ["trip_date", t("date"), (v: any) => fmtDate(v, lang)],
                ["vehicle_no", t("vehicleNo")],
                ["__jama", t("jamaTotal"), (_: any, r: any) => fmtNum(Number(r.jama_1 || 0) + Number(r.jama_2 || 0), lang)],
                ["__dena", t("denaTotal"), (_: any, r: any) => fmtNum(Number(r.dena_1 || 0) + Number(r.dena_2 || 0), lang)],
                ["__bal", t("balance"), (_: any, r: any) => fmtNum(Number(r.jama_1 || 0) + Number(r.jama_2 || 0) - Number(r.dena_1 || 0) - Number(r.dena_2 || 0), lang)],
                ["__fare", t("fareTotal"), (_: any, r: any) => fmtNum(Number(r.fare_1 || 0) + Number(r.fare_2 || 0), lang)],
                ["__route", t("route"), (_: any, r: any) => [r.route_1, r.route_2].filter(Boolean).join(" / ") || "-"],
                ["supervisor", t("supervisor")],
              ]}
            />
          </TabsContent>
          <TabsContent value="exp">
            <Tbl
              rows={exp.data ?? []}
              cols={[
                ["expense_date", t("date"), (v: any) => fmtDate(v, lang)],
                ["category", t("category")],
                ["vehicle_no", t("vehicleNo")],
                ["amount", t("amount"), (v: any) => fmtNum(v, lang)],
              ]}
            />
          </TabsContent>
          <TabsContent value="oth">
            <Tbl
              rows={oth.data ?? []}
              cols={[
                ["income_date", t("date"), (v: any) => fmtDate(v, lang)],
                ["category", t("category")],
                ["amount", t("amount"), (v: any) => fmtNum(v, lang)],
              ]}
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

function Tbl({ rows, cols }: { rows: any[]; cols: [string, string, ((v: any, r?: any) => any)?][] }) {
  const { t } = useT();
  return (
    <div className="overflow-x-auto rounded-md border bg-card/70 backdrop-blur">
      <table className="w-full text-sm">
        <thead className="bg-muted/60">
          <tr>{cols.map(([k, h]) => <th key={k} className="text-left px-3 py-2 font-semibold">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={cols.length} className="text-center py-8 text-muted-foreground">{t("noData")}</td></tr>}
          {rows.map((r) => (
            <tr key={r.id} className="border-t">
              {cols.map(([k, , fmt]) => <td key={k} className="px-3 py-2">{fmt ? fmt(r[k], r) : (r[k] ?? "-")}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
