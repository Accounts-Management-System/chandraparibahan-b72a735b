import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useT, fmtNum, fmtDate } from "@/lib/i18n";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { z } from "zod";

export const Route = createFileRoute("/data-bank")({
  component: Page,
  validateSearch: (s: Record<string, unknown>) =>
    z.object({
      owner: z.string().optional(),
      car: z.string().optional(),
      date: z.string().optional(),
      month: z.string().optional(),
    }).parse(s),
});

const CHANDRA_ID = "674def72-609b-434c-8186-15aa3d351d28";
const isMainOwner = (oid: string | null | undefined) => !oid || oid === CHANDRA_ID;

function Page() {
  const { t, lang } = useT();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  const [date, setDate] = useState<string>(search.date ?? "");
  const [month, setMonth] = useState<string>(search.month ?? "");
  const [car, setCar] = useState<string>(search.car ?? "");
  const [ownerId, setOwnerId] = useState<string>(search.owner ?? "");

  const { data: owners = [] } = useQuery({
    queryKey: ["owners-list"],
    queryFn: async () => (await supabase.from("owners").select("id,name").order("name")).data ?? [],
  });
  const { data: vehiclesAll = [] } = useQuery({
    queryKey: ["veh-owner"],
    queryFn: async () => (await supabase.from("vehicles").select("id,vehicle_no,owner_id").order("vehicle_no")).data ?? [],
  });

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
    return q as Promise<{ data: T[] }>;
  };

  const trips = useQuery({
    queryKey: ["db-trips", date, month, car],
    queryFn: async () => {
      const q: any = supabase.from("trips").select("*").order("trip_date", { ascending: false }).order("serial_no", { ascending: true }).limit(500);
      const { data } = (await buildFilter(q, "trip_date")) as any;
      return (data ?? []) as any[];
    },
  });
  const exp = useQuery({
    queryKey: ["db-exp", date, month, car],
    queryFn: async () => {
      const q: any = supabase.from("expenses").select("*").order("expense_date", { ascending: false }).limit(500);
      const { data } = (await buildFilter(q, "expense_date")) as any;
      return (data ?? []) as any[];
    },
  });
  const oth = useQuery({
    queryKey: ["db-oth", date, month, car],
    queryFn: async () => {
      const q: any = supabase.from("other_incomes").select("*").order("income_date", { ascending: false }).limit(500);
      const { data } = (await buildFilter(q, "income_date")) as any;
      return (data ?? []) as any[];
    },
  });

  const ownerByVehicle = (vno: string | null | undefined) => {
    if (!vno) return "—";
    const v = (vehiclesAll as any[]).find((x) => x.vehicle_no === vno);
    if (!v) return "—";
    const o = (owners as any[]).find((s) => s.id === v.owner_id);
    return o?.name ?? "—";
  };

  const ownerName = (oid: string | null | undefined) => (owners as any[]).find((o) => o.id === oid)?.name ?? "—";

  const ownerVehNos = useMemo(() => {
    const m = new Map<string, string | null>();
    (vehiclesAll as any[]).forEach((v) => m.set(v.vehicle_no, v.owner_id ?? null));
    return m;
  }, [vehiclesAll]);

  const tripRows = trips.data ?? [];
  const expRows = exp.data ?? [];
  const othRows = oth.data ?? [];

  const matchedOwnerId = (r: any) => r.owner_id ?? ownerVehNos.get(r.vehicle_no) ?? null;
  const mainExp = useMemo(() => expRows.filter((r: any) => isMainOwner(matchedOwnerId(r))), [expRows, ownerVehNos]);
  const mainOth = useMemo(() => othRows.filter((r: any) => isMainOwner(matchedOwnerId(r))), [othRows, ownerVehNos]);

  const ownerMatch = (oid: string | null | undefined) => Boolean(oid && oid !== CHANDRA_ID && (!ownerId || oid === ownerId));
  const jkTrips = useMemo(() => tripRows.filter((r: any) => ownerMatch(ownerVehNos.get(r.vehicle_no))), [tripRows, ownerVehNos, ownerId]);
  const jkExp = useMemo(() => expRows.filter((r: any) => ownerMatch(matchedOwnerId(r))), [expRows, ownerVehNos, ownerId]);
  const jkOth = useMemo(() => othRows.filter((r: any) => ownerMatch(matchedOwnerId(r))), [othRows, ownerVehNos, ownerId]);

  const totalDailyJama = tripRows.reduce((s, r: any) => s + Number(r.jama_1 || 0) + Number(r.jama_2 || 0), 0);
  const totalDena = tripRows.reduce((s, r: any) => s + Number(r.dena_1 || 0) + Number(r.dena_2 || 0), 0);
  const totalFare = tripRows.reduce((s, r: any) => s + Number(r.fare_1 || 0) + Number(r.fare_2 || 0), 0);
  const mainExpense = mainExp.reduce((s, r: any) => s + Number(r.amount || 0), 0);
  const mainOther = mainOth.reduce((s, r: any) => s + Number(r.amount || 0), 0);
  const mainBalance = totalDailyJama + mainOther - mainExpense;

  const jkFare = jkTrips.reduce((s, r: any) => s + Number(r.fare_1 || 0) + Number(r.fare_2 || 0), 0);
  const jkJama = jkOth.reduce((s, r: any) => s + Number(r.amount || 0), 0);
  const jkKhoroch = jkExp.reduce((s, r: any) => s + Number(r.amount || 0), 0);
  const jkBalance = jkFare + jkJama - jkKhoroch;

  const apply = () => navigate({ search: { date: date || undefined, month: month || undefined, car: car || undefined, owner: ownerId || undefined } });
  const clear = () => { setDate(""); setMonth(""); setCar(""); setOwnerId(""); navigate({ search: {} }); };

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
            <label className="text-[10px] uppercase text-muted-foreground">{t("searchByOwner")}</label>
            <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className="w-full h-9 rounded-md border border-input bg-input px-2 text-sm">
              <option value="">{t("all")}</option>
              {(owners as any[]).filter((s) => s.id !== CHANDRA_ID).map((s) => <option key={s.id} value={s.id} className="bg-card">{s.name}</option>)}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <Button size="sm" onClick={apply}>{t("apply")}</Button>
            <Button size="sm" variant="outline" onClick={clear}>{t("clearForm")}</Button>
          </div>
        </div>

        <Tabs defaultValue="dashboard">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="dashboard">ড্যাশবোর্ড</TabsTrigger>
            <TabsTrigger value="trips">দৈনিক জমা</TabsTrigger>
            <TabsTrigger value="oth">অন্যান্য জমা</TabsTrigger>
            <TabsTrigger value="exp">দৈনিক খরচ</TabsTrigger>
            <TabsTrigger value="jk">জমা-খরচ (ওনার)</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat label="দৈনিক জমা" value={fmtNum(totalDailyJama, lang)} color="text-emerald-400" />
              <Stat label="অন্যান্য জমা" value={fmtNum(mainOther, lang)} color="text-emerald-400" />
              <Stat label="দৈনিক খরচ" value={fmtNum(mainExpense, lang)} color="text-rose-400" />
              <Stat label="মূল ব্যালেন্স" value={fmtNum(mainBalance, lang)} color={mainBalance >= 0 ? "text-primary" : "text-rose-500"} />
            </div>
          </TabsContent>

          <TabsContent value="trips">
            <Tbl
              rows={tripRows}
              cols={[
                ["serial_no", t("serial"), (v: any) => fmtNum(v, lang)],
                ["trip_date", t("date"), (v: any) => fmtDate(v, lang)],
                ["vehicle_no", t("vehicleNo")],
                ["__owner", t("owner"), (_: any, r: any) => ownerByVehicle(r.vehicle_no)],
                ["__jama", t("jamaTotal"), (_: any, r: any) => fmtNum(Number(r.jama_1 || 0) + Number(r.jama_2 || 0), lang)],
                ["__dena", t("denaTotal"), (_: any, r: any) => fmtNum(Number(r.dena_1 || 0) + Number(r.dena_2 || 0), lang)],
                ["__bal", t("balance"), (_: any, r: any) => fmtNum(Number(r.jama_1 || 0) + Number(r.jama_2 || 0) - Number(r.dena_1 || 0) - Number(r.dena_2 || 0), lang)],
                ["__fare", t("fareTotal"), (_: any, r: any) => fmtNum(Number(r.fare_1 || 0) + Number(r.fare_2 || 0), lang)],
                ["__route", t("route"), (_: any, r: any) => [r.route_1, r.route_2].filter(Boolean).join(" / ") || "-"],
                ["supervisor", t("supervisor")],
              ]}
              footer={[t("grandTotal"), "", "", "", fmtNum(totalDailyJama, lang), fmtNum(totalDena, lang), fmtNum(totalDailyJama - totalDena, lang), fmtNum(totalFare, lang), "", ""]}
            />
          </TabsContent>

          <TabsContent value="oth">
            <Tbl
              rows={mainOth}
              cols={[
                ["income_date", t("date"), (v: any) => fmtDate(v, lang)],
                ["vehicle_no", t("vehicleNo"), (v: any) => v ?? "—"],
                ["category", t("category")],
                ["head", t("head")],
                ["description", t("description")],
                ["amount", t("amount"), (v: any) => fmtNum(v, lang)],
              ]}
              footer={[t("grandTotal"), "", "", "", "", fmtNum(mainOther, lang)]}
            />
          </TabsContent>

          <TabsContent value="exp">
            <Tbl
              rows={mainExp}
              cols={[
                ["expense_date", t("date"), (v: any) => fmtDate(v, lang)],
                ["vehicle_no", t("vehicleNo"), (v: any) => v ?? "—"],
                ["category", t("category")],
                ["head", t("head")],
                ["description", t("description")],
                ["amount", t("amount"), (v: any) => fmtNum(v, lang)],
              ]}
              footer={[t("grandTotal"), "", "", "", "", fmtNum(mainExpense, lang)]}
            />
          </TabsContent>

          <TabsContent value="jk">
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Stat label="গাড়ি ভাড়া" value={fmtNum(jkFare, lang)} color="text-amber-400" />
                <Stat label="জমা" value={fmtNum(jkJama, lang)} color="text-emerald-400" />
                <Stat label="খরচ" value={fmtNum(jkKhoroch, lang)} color="text-rose-400" />
                <Stat label="ব্যালেন্স" value={fmtNum(jkBalance, lang)} color={jkBalance >= 0 ? "text-primary" : "text-rose-500"} />
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-2">গাড়ি ভাড়া (দৈনিক জমা থেকে)</h3>
                <Tbl
                  rows={jkTrips}
                  cols={[
                    ["trip_date", t("date"), (v: any) => fmtDate(v, lang)],
                    ["__owner", t("owner"), (_: any, r: any) => ownerName(ownerVehNos.get(r.vehicle_no))],
                    ["vehicle_no", t("vehicleNo")],
                    ["__fare", t("fareTotal"), (_: any, r: any) => fmtNum(Number(r.fare_1 || 0) + Number(r.fare_2 || 0), lang)],
                  ]}
                  footer={[t("grandTotal"), "", "", fmtNum(jkFare, lang)]}
                />
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-2">জমা-খরচ জমা</h3>
                <Tbl
                  rows={jkOth}
                  cols={[
                    ["income_date", t("date"), (v: any) => fmtDate(v, lang)],
                    ["owner_id", t("owner"), (_: any, r: any) => ownerName(matchedOwnerId(r))],
                    ["vendor", t("vendors"), (v: any) => v ?? "—"],
                    ["vehicle_no", t("vehicleNo"), (v: any) => v ?? "—"],
                    ["category", t("category")],
                    ["head", t("head")],
                    ["description", t("description")],
                    ["amount", t("amount"), (v: any) => fmtNum(v, lang)],
                  ]}
                  footer={[t("grandTotal"), "", "", "", "", "", "", fmtNum(jkJama, lang)]}
                />
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-2">জমা-খরচ খরচ</h3>
                <Tbl
                  rows={jkExp}
                  cols={[
                    ["expense_date", t("date"), (v: any) => fmtDate(v, lang)],
                    ["owner_id", t("owner"), (_: any, r: any) => ownerName(matchedOwnerId(r))],
                    ["vendor", t("vendors"), (v: any) => v ?? "—"],
                    ["vehicle_no", t("vehicleNo"), (v: any) => v ?? "—"],
                    ["category", t("category")],
                    ["head", t("head")],
                    ["description", t("description")],
                    ["amount", t("amount"), (v: any) => fmtNum(v, lang)],
                  ]}
                  footer={[t("grandTotal"), "", "", "", "", "", "", fmtNum(jkKhoroch, lang)]}
                />
              </div>
            </div>
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

function Tbl({ rows, cols, footer }: { rows: any[]; cols: [string, string, ((v: any, r?: any) => any)?][]; footer?: (string | number)[] }) {
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
        {footer && rows.length > 0 && (
          <tfoot className="bg-muted/40 font-bold border-t">
            <tr>{footer.map((c, i) => <td key={i} className="px-3 py-2">{c}</td>)}</tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
