import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useT, fmtNum, fmtDate } from "@/lib/i18n";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { z } from "zod";

export const Route = createFileRoute("/data-bank")({
  component: Page,
  validateSearch: (s: Record<string, unknown>) =>
    z.object({
      shareholder: z.string().optional(),
      car: z.string().optional(),
      date: z.string().optional(),
      month: z.string().optional(),
    }).parse(s),
});

function Page() {
  const { t, lang } = useT();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  const [date, setDate] = useState<string>(search.date ?? "");
  const [month, setMonth] = useState<string>(search.month ?? "");
  const [car, setCar] = useState<string>(search.car ?? "");
  const [shareholderId, setShareholderId] = useState<string>(search.shareholder ?? "");

  const { data: shareholders = [] } = useQuery({
    queryKey: ["sh-list"],
    queryFn: async () => (await supabase.from("contacts").select("id,name").order("name")).data ?? [],
  });
  const { data: vehiclesAll = [] } = useQuery({
    queryKey: ["veh-shareholder"],
    queryFn: async () => (await supabase.from("vehicles").select("id,vehicle_no,shareholder_id").order("vehicle_no")).data ?? [],
  });

  // determine vehicle list filtered by shareholder
  const vehicleNosForFilter = shareholderId
    ? (vehiclesAll as any[]).filter((v) => v.shareholder_id === shareholderId).map((v) => v.vehicle_no)
    : null;

  const buildFilter = <T extends any>(q: any, dateCol: string) => {
    if (date) q = q.eq(dateCol, date);
    else if (month) {
      const start = `${month}-01`;
      const d = new Date(month + "-01");
      d.setMonth(d.getMonth() + 1);
      const end = d.toISOString().slice(0, 10);
      q = q.gte(dateCol, start).lt(dateCol, end);
    }
    if (car) q = q.eq("vehicle_no", car);
    else if (vehicleNosForFilter) q = q.in("vehicle_no", vehicleNosForFilter.length ? vehicleNosForFilter : ["__none__"]);
    return q as Promise<{ data: T[] }>;
  };

  const trips = useQuery({
    queryKey: ["db-trips", date, month, car, shareholderId],
    queryFn: async () => {
      let q: any = supabase.from("trips").select("*").order("trip_date", { ascending: false }).order("serial_no", { ascending: true }).limit(500);
      const { data } = (await buildFilter(q, "trip_date")) as any;
      return (data ?? []) as any[];
    },
  });
  const exp = useQuery({
    queryKey: ["db-exp", date, month, car, shareholderId],
    queryFn: async () => {
      let q: any = supabase.from("expenses").select("*").order("expense_date", { ascending: false }).limit(500);
      const { data } = (await buildFilter(q, "expense_date")) as any;
      return (data ?? []) as any[];
    },
  });
  const oth = useQuery({
    queryKey: ["db-oth", date, month, car, shareholderId],
    queryFn: async () => {
      let q: any = supabase.from("other_incomes").select("*").order("income_date", { ascending: false }).limit(500);
      const { data } = (await buildFilter(q, "income_date")) as any;
      return (data ?? []) as any[];
    },
  });

  const ownerByVehicle = (vno: string | null | undefined) => {
    if (!vno) return "—";
    const v = (vehiclesAll as any[]).find((x) => x.vehicle_no === vno);
    if (!v) return "—";
    const sh = (shareholders as any[]).find((s) => s.id === v.shareholder_id);
    return sh?.name ?? "—";
  };

  const totalJama = (trips.data ?? []).reduce((s, r: any) => s + Number(r.jama_1 || 0) + Number(r.jama_2 || 0), 0);
  const totalDena = (trips.data ?? []).reduce((s, r: any) => s + Number(r.dena_1 || 0) + Number(r.dena_2 || 0), 0);
  const totalBalance = totalJama - totalDena;
  const totalFare = (trips.data ?? []).reduce((s, r: any) => s + Number(r.fare_1 || 0) + Number(r.fare_2 || 0), 0);
  const totalExp = (exp.data ?? []).reduce((s, r: any) => s + Number(r.amount || 0), 0);
  const totalOth = (oth.data ?? []).reduce((s, r: any) => s + Number(r.amount || 0), 0);

  const apply = () => navigate({ search: { date: date || undefined, month: month || undefined, car: car || undefined, shareholder: shareholderId || undefined } });
  const clear = () => { setDate(""); setMonth(""); setCar(""); setShareholderId(""); navigate({ search: {} }); };

  return (
    <AppLayout>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">{t("dataBank")}</h1>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 rounded-lg border bg-card/60 p-3">
          <div>
            <label className="text-[10px] uppercase text-muted-foreground">{t("date")}</label>
            <Input type="date" value={date} onChange={(e) => { setDate(e.target.value); setMonth(""); }} className="h-9" />
          </div>
          <div>
            <label className="text-[10px] uppercase text-muted-foreground">{t("searchByMonth")}</label>
            <Input type="month" value={month} onChange={(e) => { setMonth(e.target.value); setDate(""); }} className="h-9" />
          </div>
          <div>
            <label className="text-[10px] uppercase text-muted-foreground">{t("searchByCar")}</label>
            <select value={car} onChange={(e) => setCar(e.target.value)} className="w-full h-9 rounded-md border border-input bg-input px-2 text-sm">
              <option value="">{t("all")}</option>
              {(vehiclesAll as any[]).map((v) => <option key={v.id} value={v.vehicle_no} className="bg-card">{v.vehicle_no}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase text-muted-foreground">{t("searchByShareholder")}</label>
            <select value={shareholderId} onChange={(e) => setShareholderId(e.target.value)} className="w-full h-9 rounded-md border border-input bg-input px-2 text-sm">
              <option value="">{t("all")}</option>
              {(shareholders as any[]).map((s) => <option key={s.id} value={s.id} className="bg-card">{s.name}</option>)}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <Button size="sm" onClick={apply}>{t("apply")}</Button>
            <Button size="sm" variant="outline" onClick={clear}>{t("clearForm")}</Button>
          </div>
        </div>

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
                ["__owner", t("shareholder"), (_: any, r: any) => ownerByVehicle(r.vehicle_no)],
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
                ["head", t("head")],
                ["description", t("description")],
                ["amount", t("amount"), (v: any) => fmtNum(v, lang)],
              ]}
            />
          </TabsContent>
          <TabsContent value="oth">
            <Tbl
              rows={oth.data ?? []}
              cols={[
                ["income_date", t("date"), (v: any) => fmtDate(v, lang)],
                ["vehicle_no", t("vehicleNo")],
                ["description", t("description")],
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
