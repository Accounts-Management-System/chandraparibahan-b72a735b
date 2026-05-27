import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useT, fmtNum, fmtDate } from "@/lib/i18n";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/data-bank")({ component: Page });

function Page() {
  const { t, lang } = useT();
  const trips = useQuery({ queryKey: ["db-trips"], queryFn: async () => (await supabase.from("trips").select("*").order("trip_date", { ascending: false }).limit(1000)).data ?? [] });
  const exp = useQuery({ queryKey: ["db-exp"], queryFn: async () => (await supabase.from("expenses").select("*").order("expense_date", { ascending: false }).limit(1000)).data ?? [] });
  const oth = useQuery({ queryKey: ["db-oth"], queryFn: async () => (await supabase.from("other_incomes").select("*").order("income_date", { ascending: false }).limit(1000)).data ?? [] });
  const xfr = useQuery({ queryKey: ["db-xfr"], queryFn: async () => (await supabase.from("transfers").select("*").order("transfer_date", { ascending: false }).limit(1000)).data ?? [] });

  const totalJama = (trips.data ?? []).reduce((s, r: any) => s + Number(r.jama_1 || 0) + Number(r.jama_2 || 0), 0);
  const totalDena = (trips.data ?? []).reduce((s, r: any) => s + Number(r.dena_1 || 0) + Number(r.dena_2 || 0), 0);
  const totalExp = (exp.data ?? []).reduce((s, r: any) => s + Number(r.amount || 0), 0);
  const totalOth = (oth.data ?? []).reduce((s, r: any) => s + Number(r.amount || 0), 0);

  return (
    <AppLayout>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">{t("dataBank")}</h1>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label={t("dailyAccounts") + " — " + t("total") + " (জমা)"} value={fmtNum(totalJama, lang)} color="text-emerald-600" />
          <Stat label={t("dailyAccounts") + " — " + t("total") + " (দেনা)"} value={fmtNum(totalDena, lang)} color="text-rose-600" />
          <Stat label={t("otherIncome") + " " + t("total")} value={fmtNum(totalOth, lang)} color="text-amber-600" />
          <Stat label={t("expenses") + " " + t("total")} value={fmtNum(totalExp, lang)} color="text-rose-700" />
        </div>

        <Tabs defaultValue="trips">
          <TabsList>
            <TabsTrigger value="trips">{t("dailyAccounts")}</TabsTrigger>
            <TabsTrigger value="exp">{t("expenses")}</TabsTrigger>
            <TabsTrigger value="oth">{t("otherIncome")}</TabsTrigger>
            <TabsTrigger value="xfr">{t("transfers")}</TabsTrigger>
          </TabsList>
          <TabsContent value="trips"><Tbl rows={trips.data ?? []} cols={[
            ["trip_date", t("date"), (v: any) => fmtDate(v, lang)],
            ["vehicle_no", t("vehicleNo")],
            ["jama_1", t("jama1"), (v: any) => fmtNum(v, lang)],
            ["jama_2", t("jama2"), (v: any) => fmtNum(v, lang)],
            ["dena_1", t("dena1"), (v: any) => fmtNum(v, lang)],
            ["fare_1", t("fare1"), (v: any) => fmtNum(v, lang)],
            ["supervisor", t("supervisor")],
          ]} /></TabsContent>
          <TabsContent value="exp"><Tbl rows={exp.data ?? []} cols={[
            ["expense_date", t("date"), (v: any) => fmtDate(v, lang)],
            ["category", t("category")],
            ["description", t("description")],
            ["vehicle_no", t("vehicleNo")],
            ["amount", t("amount"), (v: any) => fmtNum(v, lang)],
          ]} /></TabsContent>
          <TabsContent value="oth"><Tbl rows={oth.data ?? []} cols={[
            ["income_date", t("date"), (v: any) => fmtDate(v, lang)],
            ["category", t("category")],
            ["description", t("description")],
            ["amount", t("amount"), (v: any) => fmtNum(v, lang)],
          ]} /></TabsContent>
          <TabsContent value="xfr"><Tbl rows={xfr.data ?? []} cols={[
            ["transfer_date", t("date"), (v: any) => fmtDate(v, lang)],
            ["from_party", t("fromParty")],
            ["to_party", t("toParty")],
            ["amount", t("amount"), (v: any) => fmtNum(v, lang)],
          ]} /></TabsContent>
        </Tabs>
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

function Tbl({ rows, cols }: { rows: any[]; cols: [string, string, ((v: any) => any)?][] }) {
  const { t } = useT();
  return (
    <div className="overflow-x-auto rounded-md border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted">
          <tr>{cols.map(([k, h]) => <th key={k} className="text-left px-3 py-2 font-semibold">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={cols.length} className="text-center py-8 text-muted-foreground">{t("noData")}</td></tr>}
          {rows.map((r) => (
            <tr key={r.id} className="border-t">
              {cols.map(([k, , fmt]) => <td key={k} className="px-3 py-2">{fmt ? fmt(r[k]) : (r[k] ?? "-")}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
