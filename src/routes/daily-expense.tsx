import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { useT, fmtNum, fmtDate, trBn } from "@/lib/i18n";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useMemo } from "react";
import { SearchFilters, emptyFilters, matchesFilters, type FilterState } from "@/components/SearchFilters";
import { Button } from "@/components/ui/button";
import { FileDown } from "lucide-react";
import { exportPdf } from "@/lib/exportPdf";

export const Route = createFileRoute("/daily-expense")({ component: Page });



function Page() {
  const { t, lang } = useT();
  const [filters, setFilters] = useState<FilterState>(emptyFilters);

  const { data: expenses = [] } = useQuery({
    queryKey: ["de-expenses"],
    queryFn: async () =>
      ((await supabase.from("expenses").select("id,expense_date,vehicle_no,category,head,description,amount,owner_id").order("expense_date", { ascending: false }).limit(5000)).data ?? []) as any[],
  });
  const { data: trips = [] } = useQuery({
    queryKey: ["de-trips"],
    queryFn: async () => ((await supabase.from("trips").select("trip_date,vehicle_no,fare_1,fare_2").limit(5000)).data ?? []) as any[],
  });
  const { data: otherIncomes = [] } = useQuery({
    queryKey: ["de-oth"],
    queryFn: async () => ((await supabase.from("other_incomes").select("income_date,vehicle_no,category,head,amount").limit(5000)).data ?? []) as any[],
  });
  const { data: vehiclesAll = [] } = useQuery({
    queryKey: ["de-vehicles"],
    queryFn: async () => ((await supabase.from("vehicles").select("vehicle_no,owner_id")).data ?? []) as any[],
  });
  const { data: ownersAll = [] } = useQuery({
    queryKey: ["de-owners"],
    queryFn: async () => ((await supabase.from("owners").select("id,name")).data ?? []) as any[],
  });

  const ownerVehNos = useMemo(() => {
    const m = new Map<string, string | null>();
    (vehiclesAll as any[]).forEach((v) => m.set(v.vehicle_no, v.owner_id ?? null));
    return m;
  }, [vehiclesAll]);
  const ownerName = (oid: string | null | undefined) => (ownersAll as any[]).find((o) => o.id === oid)?.name ?? "—";
  const rowOwner = (r: any) => ownerName(r.owner_id ?? ownerVehNos.get(r.vehicle_no ?? "") ?? null);

  const ownerVehicleSet = useMemo(() => {
    if (!filters.ownerId) return null;
    return new Set((vehiclesAll as any[]).filter((v: any) => v.owner_id === filters.ownerId).map((v: any) => v.vehicle_no));
  }, [filters.ownerId, vehiclesAll]);

  const passes = (date: string, vno: string | null, category?: string | null, head?: string | null) => {
    if (!matchesFilters({ date, vehicle_no: vno, category, head }, filters)) return false;
    if (ownerVehicleSet && !ownerVehicleSet.has(vno ?? "")) return false;
    return true;
  };

  const rows = useMemo(() => {
    return (expenses as any[])
      .filter((r: any) => passes(r.expense_date, r.vehicle_no, r.category, r.head))
      .map((r: any) => ({ id: r.id, date: r.expense_date, vehicle_no: r.vehicle_no, owner: rowOwner(r), head: r.head, description: r.description, amount: Number(r.amount || 0) }));
  }, [expenses, filters, ownerVehicleSet, ownerVehNos, ownersAll]);

  const totalExpense = rows.reduce((s, r) => s + r.amount, 0);
  const totalFare = trips.filter((r: any) => passes(r.trip_date, r.vehicle_no)).reduce((s: number, r: any) => s + Number(r.fare_1 || 0) + Number(r.fare_2 || 0), 0);
  const totalOther = otherIncomes
    .filter((r: any) => passes(r.income_date, r.vehicle_no, r.category, r.head))
    .reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
  const net = totalFare + totalOther - totalExpense;

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">{t("dailyExpense")}</h1>
          <Button
            variant="outline"
            onClick={() =>
              exportPdf({
                title: t("dailyExpense"),
                subtitle: `${t("totalExpense")}: ${fmtNum(totalExpense, lang)} | ${t("net")}: ${fmtNum(net, lang)}`,
                headers: ["#", t("date"), trBn("ওনার", lang), t("head"), t("vehicleNo"), t("description"), t("amount")],
                rows: rows.map((r, i) => [fmtNum(i + 1, lang), fmtDate(r.date, lang), r.owner, r.head ?? "—", r.vehicle_no ?? "—", r.description ?? "—", fmtNum(r.amount, lang)]),
                orientation: "landscape",
              })
            }
          >
            <FileDown className="h-4 w-4 mr-2" /> {t("exportPdf")}
          </Button>
        </div>

        <SearchFilters value={filters} onChange={setFilters} show={{ date: true, vehicle: true, owner: true, category: true, head: true }} />

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Stat label={t("totalIncome")} value={fmtNum(totalFare + totalOther, lang)} color="text-emerald-500" />
          <Stat label={t("totalExpense")} value={fmtNum(totalExpense, lang)} color="text-rose-500" />
          <Stat label={t("net")} value={fmtNum(net, lang)} color={net >= 0 ? "text-emerald-500" : "text-rose-500"} />
        </div>

        <div className="overflow-x-auto rounded-md border bg-card/70">
          <table className="w-full text-sm">
            <thead className="bg-muted/60">
              <tr>
                <th className="text-left px-3 py-2 w-12">#</th>
                <th className="text-left px-3 py-2">{t("date")}</th>
                <th className="text-left px-3 py-2">ওনার</th>
                <th className="text-left px-3 py-2">{t("head")}</th>
                <th className="text-left px-3 py-2">{t("vehicleNo")}</th>
                <th className="text-left px-3 py-2">{t("description")}</th>
                <th className="text-right px-3 py-2">{t("amount")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">{t("noData")}</td></tr>
              )}
              {rows.map((r, i) => (
                <tr key={r.id} className="border-t">
                  <td className="px-3 py-2 text-muted-foreground">{fmtNum(i + 1, lang)}</td>
                  <td className="px-3 py-2">{fmtDate(r.date, lang)}</td>
                  <td className="px-3 py-2">{r.owner}</td>
                  <td className="px-3 py-2">{r.head ?? "—"}</td>
                  <td className="px-3 py-2">{r.vehicle_no ?? "—"}</td>
                  <td className="px-3 py-2">{r.description ?? "—"}</td>
                  <td className="px-3 py-2 text-right text-rose-400">{fmtNum(r.amount, lang)}</td>
                </tr>
              ))}
            </tbody>
            {rows.length > 0 && (
              <tfoot className="bg-muted/40 font-semibold">
                <tr>
                  <td className="px-3 py-2" colSpan={6}>{t("totalExpense")}</td>
                  <td className="px-3 py-2 text-right text-rose-500">{fmtNum(totalExpense, lang)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
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
