import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useT, fmtNum, fmtDate, trBn } from "@/lib/i18n";
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

  const buildFilter = (q: any, dateCol: string) => {
    if (date) q = q.eq(dateCol, date);
    else if (month) {
      const start = `${month}-01`;
      const d = new Date(month + "-01");
      d.setMonth(d.getMonth() + 1);
      const end = d.toISOString().slice(0, 10);
      q = q.gte(dateCol, start).lt(dateCol, end);
    }
    if (car) q = q.eq("vehicle_no", car);
    return q;
  };

  const trips = useQuery({
    queryKey: ["db-trips", date, month, car],
    queryFn: async () => {
      const q: any = supabase.from("trips").select("*").order("trip_date", { ascending: false }).order("serial_no", { ascending: true }).limit(100000);
      const { data } = await buildFilter(q, "trip_date");
      return (data ?? []) as any[];
    },
  });
  const exp = useQuery({
    queryKey: ["db-exp", date, month, car],
    queryFn: async () => {
      const q: any = supabase.from("expenses").select("*").order("expense_date", { ascending: false }).limit(100000);
      const { data } = await buildFilter(q, "expense_date");
      return (data ?? []) as any[];
    },
  });
  const oth = useQuery({
    queryKey: ["db-oth", date, month, car],
    queryFn: async () => {
      const q: any = supabase.from("other_incomes").select("*").order("income_date", { ascending: false }).limit(100000);
      const { data } = await buildFilter(q, "income_date");
      return (data ?? []) as any[];
    },
  });
  const ownerName = (oid: string | null | undefined) => (owners as any[]).find((o) => o.id === oid)?.name ?? "—";
  const ownerVehNos = useMemo(() => {
    const m = new Map<string, string | null>();
    (vehiclesAll as any[]).forEach((v) => m.set(v.vehicle_no, v.owner_id ?? null));
    return m;
  }, [vehiclesAll]);
  const rowOwnerId = (r: any) => r.owner_id ?? ownerVehNos.get(r.vehicle_no) ?? null;

  const allTrips = trips.data ?? [];
  const allExp = exp.data ?? [];
  const allOth = oth.data ?? [];

  // দৈনিক জমা: সব ট্রিপ; owner filter দিলে সেই ওনারের গাড়ি
  const tripRows = useMemo(() => ownerId
    ? allTrips.filter((r: any) => (ownerVehNos.get(r.vehicle_no) ?? null) === ownerId)
    : allTrips, [allTrips, ownerId, ownerVehNos]);

  // অন্যান্য জমা: owner_id null → মূল; owner filter দিলে সেই ওনারের
  const othRows = useMemo(() => ownerId
    ? allOth.filter((r: any) => r.owner_id === ownerId)
    : allOth.filter((r: any) => !r.owner_id), [allOth, ownerId]);

  // দৈনিক খরচ: একই
  const expRows = useMemo(() => ownerId
    ? allExp.filter((r: any) => r.owner_id === ownerId)
    : allExp.filter((r: any) => !r.owner_id), [allExp, ownerId]);

  // ওনার হিসাব
  const ownerTrips = useMemo(() => allTrips.filter((r: any) => {
    const oid = ownerVehNos.get(r.vehicle_no);
    if (!oid) return false;
    return ownerId ? oid === ownerId : true;
  }), [allTrips, ownerId, ownerVehNos]);
  const ownerOth = useMemo(() => allOth.filter((r: any) => r.owner_id && (ownerId ? r.owner_id === ownerId : true)), [allOth, ownerId]);
  const ownerExp = useMemo(() => allExp.filter((r: any) => r.owner_id && (ownerId ? r.owner_id === ownerId : true)), [allExp, ownerId]);

  const totalDailyJama = tripRows.reduce((s: number, r: any) => s + Number(r.jama_1 || 0) + Number(r.jama_2 || 0), 0);
  const totalDena = tripRows.reduce((s: number, r: any) => s + Number(r.dena_1 || 0) + Number(r.dena_2 || 0), 0);
  const totalFare = tripRows.reduce((s: number, r: any) => s + Number(r.fare_1 || 0) + Number(r.fare_2 || 0), 0);
  const totalOth = othRows.reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
  const totalExp = expRows.reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
  const ownerFares = ownerTrips.reduce((s: number, r: any) => s + Number(r.fare_1 || 0) + Number(r.fare_2 || 0), 0);
  const ownerJama = ownerOth.reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
  const ownerKhoroch = ownerExp.reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
  const mainJamaKhorochJama = ownerId ? 0 : ownerJama;
  const balance = ownerId ? ownerFares + ownerJama - ownerKhoroch : (totalDailyJama - totalDena) + totalOth + mainJamaKhorochJama - totalExp;

  const ownerByVehicle = useMemo(() => {
    const m = new Map<string, { vno: string; owner: string; trips: number; fare: number }>();
    ownerTrips.forEach((r: any) => {
      const f = Number(r.fare_1 || 0) + Number(r.fare_2 || 0);
      const oid = ownerVehNos.get(r.vehicle_no) ?? null;
      const cur = m.get(r.vehicle_no) ?? { vno: r.vehicle_no, owner: ownerName(oid), trips: 0, fare: 0 };
      cur.trips += 1; cur.fare += f;
      m.set(r.vehicle_no, cur);
    });
    return Array.from(m.values()).sort((a, b) => a.vno.localeCompare(b.vno));
  }, [ownerTrips, ownerVehNos, owners]);

  const byDate = useMemo(() => {
    const m = new Map<string, number>();
    tripRows.forEach((r: any) => m.set(r.trip_date, (m.get(r.trip_date) ?? 0) + 1));
    return Array.from(m.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [tripRows]);

  const apply = () => navigate({ search: { date: date || undefined, month: month || undefined, car: car || undefined, owner: ownerId || undefined } });
  const clear = () => { setDate(""); setMonth(""); setCar(""); setOwnerId(""); navigate({ search: {} }); };

  return (
    <AppLayout>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">{t("dataBank")}</h1>

        {/* Owner tabs: All + each owner */}
        <div className="flex flex-wrap gap-1.5 rounded-lg border bg-card/60 p-2">
          <button
            onClick={() => { setOwnerId(""); navigate({ search: { date: date || undefined, month: month || undefined, car: car || undefined } }); }}
            className={`px-3 py-1.5 text-xs rounded-md transition-colors ${ownerId === "" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-accent"}`}
          >
            {trBn("সকল", lang)} ({trBn("মূল", lang)})
          </button>
          {(owners as any[]).map((o) => (
            <button
              key={o.id}
              onClick={() => { setOwnerId(o.id); navigate({ search: { date: date || undefined, month: month || undefined, car: car || undefined, owner: o.id } }); }}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${ownerId === o.id ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-accent"}`}
            >
              {o.name}
            </button>
          ))}
        </div>

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
              <option value="">{t("all")} ({trBn("মূল", lang)})</option>
              {(owners as any[]).map((s) => <option key={s.id} value={s.id} className="bg-card">{s.name}</option>)}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <Button size="sm" onClick={apply}>{t("apply")}</Button>
            <Button size="sm" variant="outline" onClick={clear}>{t("clearForm")}</Button>
          </div>
        </div>

        <Tabs defaultValue="dashboard">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="dashboard">{trBn("ড্যাশবোর্ড", lang)}</TabsTrigger>
            <TabsTrigger value="trips">{trBn("দৈনিক জমা", lang)} ({fmtNum(tripRows.length, lang)})</TabsTrigger>
            <TabsTrigger value="oth">{trBn("অন্যান্য জমা", lang)} ({fmtNum(totalOth, lang)})</TabsTrigger>
            <TabsTrigger value="exp">{trBn("দৈনিক খরচ", lang)} ({fmtNum(totalExp, lang)})</TabsTrigger>
            <TabsTrigger value="owner">{trBn("ওনার হিসাব", lang)}</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Stat label={trBn("দৈনিক জমা", lang)} value={fmtNum(totalDailyJama, lang)} color="text-emerald-400" />
              <Stat label={trBn("দেনা", lang)} value={fmtNum(totalDena, lang)} color="text-rose-400" />
              <Stat label={trBn("অন্যান্য জমা", lang)} value={fmtNum(totalOth, lang)} color="text-emerald-400" />
              <Stat label={trBn("জমা-খরচের জমা", lang)} value={fmtNum(mainJamaKhorochJama, lang)} color="text-emerald-400" />
              <Stat label={trBn("দৈনিক খরচ", lang)} value={fmtNum(totalExp, lang)} color="text-rose-400" />
              <Stat label={trBn("ব্যালেন্স", lang)} value={fmtNum(balance, lang)} color={balance >= 0 ? "text-primary" : "text-rose-500"} />
            </div>
            <p className="text-xs text-muted-foreground mt-2">{trBn("তারিখ অনুযায়ী ট্রিপ", lang)}: {byDate.map(([d, c]) => `${fmtDate(d, lang)}: ${fmtNum(c, lang)}`).join(" · ")}</p>
          </TabsContent>



          <TabsContent value="trips">
            <Tbl
              rows={tripRows}
              cols={[
                ["serial_no", t("serial"), (v: any) => fmtNum(v, lang)],
                ["trip_date", t("date"), (v: any) => fmtDate(v, lang)],
                ["vehicle_no", t("vehicleNo")],
                ["__owner", t("owner"), (_: any, r: any) => ownerName(ownerVehNos.get(r.vehicle_no))],
                ["__jama", t("jamaTotal"), (_: any, r: any) => fmtNum(Number(r.jama_1 || 0) + Number(r.jama_2 || 0), lang)],
                ["__dena", t("denaTotal"), (_: any, r: any) => fmtNum(Number(r.dena_1 || 0) + Number(r.dena_2 || 0), lang)],
                ["__bal", t("balance"), (_: any, r: any) => fmtNum(Number(r.jama_1 || 0) + Number(r.jama_2 || 0) - Number(r.dena_1 || 0) - Number(r.dena_2 || 0), lang)],
                ["__fare", t("fareTotal"), (_: any, r: any) => fmtNum(Number(r.fare_1 || 0) + Number(r.fare_2 || 0), lang)],
                ["supervisor", t("supervisor")],
              ]}
              footer={[t("grandTotal"), "", "", "", fmtNum(totalDailyJama, lang), fmtNum(totalDena, lang), fmtNum(totalDailyJama - totalDena, lang), fmtNum(totalFare, lang), ""]}
            />
          </TabsContent>

          <TabsContent value="oth">
            <Tbl
              rows={othRows}
              cols={[
                ["income_date", t("date"), (v: any) => fmtDate(v, lang)],
                ["__owner", t("owner"), (_: any, r: any) => ownerName(rowOwnerId(r))],
                ["vehicle_no", t("vehicleNo"), (v: any) => v ?? "—"],
                ["category", t("category")],
                ["head", t("head")],
                ["description", t("description")],
                ["amount", t("amount"), (v: any) => fmtNum(v, lang)],
              ]}
              footer={[t("grandTotal"), "", "", "", "", "", fmtNum(totalOth, lang)]}
            />
          </TabsContent>

          <TabsContent value="exp">
            <Tbl
              rows={expRows}
              cols={[
                ["expense_date", t("date"), (v: any) => fmtDate(v, lang)],
                ["__owner", t("owner"), (_: any, r: any) => ownerName(rowOwnerId(r))],
                ["vehicle_no", t("vehicleNo"), (v: any) => v ?? "—"],
                ["category", t("category")],
                ["head", t("head")],
                ["description", t("description")],
                ["amount", t("amount"), (v: any) => fmtNum(v, lang)],
              ]}
              footer={[t("grandTotal"), "", "", "", "", "", fmtNum(totalExp, lang)]}
            />
          </TabsContent>

          <TabsContent value="owner">
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Stat label={trBn("গাড়ি ভাড়া", lang)} value={fmtNum(ownerFares, lang)} color="text-amber-400" />
                <Stat label={trBn("জমা-খরচের জমা", lang)} value={fmtNum(ownerJama, lang)} color="text-emerald-400" />
                <Stat label={trBn("জমা-খরচের খরচ", lang)} value={fmtNum(ownerKhoroch, lang)} color="text-rose-400" />
                <Stat label={t("totalTrips")} value={fmtNum(ownerTrips.length, lang)} color="text-sky-400" />
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-2">{trBn("গাড়ি অনুযায়ী ভাড়া", lang)}</h3>
                <Tbl
                  rows={ownerByVehicle}
                  cols={[
                    ["vno", t("vehicleNo")],
                    ["owner", t("owner")],
                    ["trips", t("tripCount"), (v: any) => fmtNum(v, lang)],
                    ["fare", t("fareTotal"), (v: any) => fmtNum(v, lang)],
                  ]}
                  footer={[t("grandTotal"), "", fmtNum(ownerTrips.length, lang), fmtNum(ownerFares, lang)]}
                />
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-2">{trBn("ট্রিপ বিবরণ", lang)}</h3>
                <Tbl
                  rows={ownerTrips}
                  cols={[
                    ["trip_date", t("date"), (v: any) => fmtDate(v, lang)],
                    ["__owner", t("owner"), (_: any, r: any) => ownerName(ownerVehNos.get(r.vehicle_no))],
                    ["vehicle_no", t("vehicleNo")],
                    ["__fare", t("fareTotal"), (_: any, r: any) => fmtNum(Number(r.fare_1 || 0) + Number(r.fare_2 || 0), lang)],
                  ]}
                  footer={[t("grandTotal"), "", "", fmtNum(ownerFares, lang)]}
                />
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-2">জমা-খরচের জমা</h3>
                <Tbl
                  rows={ownerOth}
                  cols={[
                    ["income_date", t("date"), (v: any) => fmtDate(v, lang)],
                    ["__owner", t("owner"), (_: any, r: any) => ownerName(rowOwnerId(r))],
                    ["vehicle_no", t("vehicleNo"), (v: any) => v ?? "—"],
                    ["category", t("category")],
                    ["head", t("head")],
                    ["description", t("description")],
                    ["amount", t("amount"), (v: any) => fmtNum(v, lang)],
                  ]}
                  footer={[t("grandTotal"), "", "", "", "", "", fmtNum(ownerJama, lang)]}
                />
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-2">জমা-খরচের খরচ</h3>
                <Tbl
                  rows={ownerExp}
                  cols={[
                    ["expense_date", t("date"), (v: any) => fmtDate(v, lang)],
                    ["__owner", t("owner"), (_: any, r: any) => ownerName(rowOwnerId(r))],
                    ["vehicle_no", t("vehicleNo"), (v: any) => v ?? "—"],
                    ["category", t("category")],
                    ["head", t("head")],
                    ["description", t("description")],
                    ["amount", t("amount"), (v: any) => fmtNum(v, lang)],
                  ]}
                  footer={[t("grandTotal"), "", "", "", "", "", fmtNum(ownerKhoroch, lang)]}
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
          {rows.map((r, idx) => (
            <tr key={r.id ?? idx} className="border-t">
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
