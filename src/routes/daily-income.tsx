import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { useT, fmtNum, fmtDate } from "@/lib/i18n";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useMemo } from "react";
import { SearchFilters, emptyFilters, matchesFilters, type FilterState } from "@/components/SearchFilters";
import { Button } from "@/components/ui/button";
import { FileDown } from "lucide-react";
import { exportPdf } from "@/lib/exportPdf";

export const Route = createFileRoute("/daily-income")({ component: Page });

function Page() {
  const { t, lang } = useT();
  const [filters, setFilters] = useState<FilterState>(emptyFilters);

  const { data: trips = [] } = useQuery({
    queryKey: ["di-trips"],
    queryFn: async () =>
      ((await supabase.from("trips").select("id,trip_date,vehicle_no,fare_1,fare_2").order("trip_date", { ascending: false }).limit(5000)).data ?? []) as any[],
  });
  const { data: vehiclesAll = [] } = useQuery({
    queryKey: ["di-vehicles"],
    queryFn: async () => ((await supabase.from("vehicles").select("vehicle_no,owner_id")).data ?? []) as any[],
  });

  const ownerVehicleSet = useMemo(() => {
    if (!filters.ownerId) return null;
    return new Set(vehiclesAll.filter((v: any) => v.owner_id === filters.ownerId).map((v: any) => v.vehicle_no));
  }, [filters.ownerId, vehiclesAll]);

  const rows = useMemo(() => {
    return trips
      .filter((r: any) => matchesFilters({ date: r.trip_date, vehicle_no: r.vehicle_no }, filters))
      .filter((r: any) => !ownerVehicleSet || ownerVehicleSet.has(r.vehicle_no))
      .map((r: any) => ({ id: r.id, date: r.trip_date, vehicle_no: r.vehicle_no, fare: Number(r.fare_1 || 0) + Number(r.fare_2 || 0) }));
  }, [trips, filters, ownerVehicleSet]);

  const total = rows.reduce((s, r) => s + r.fare, 0);

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">{t("dailyIncome")}</h1>
          <Button
            variant="outline"
            onClick={() =>
              exportPdf({
                title: t("dailyIncome"),
                subtitle: `${t("total")}: ${fmtNum(total, lang)}`,
                headers: [t("date"), t("vehicleNo"), t("fare")],
                rows: rows.map((r) => [fmtDate(r.date, lang), r.vehicle_no ?? "—", fmtNum(r.fare, lang)]),
              })
            }
          >
            <FileDown className="h-4 w-4 mr-2" /> {t("exportPdf")}
          </Button>
        </div>

        <SearchFilters value={filters} onChange={setFilters} show={{ date: true, vehicle: true, owner: true }} />

        <div className="rounded-lg border bg-card/70 p-4">
          <div className="text-xs text-muted-foreground">{t("total")}</div>
          <div className="text-3xl font-bold text-emerald-500">{fmtNum(total, lang)}</div>
        </div>

        <div className="overflow-x-auto rounded-md border bg-card/70">
          <table className="w-full text-sm">
            <thead className="bg-muted/60">
              <tr>
                <th className="text-left px-3 py-2">{t("date")}</th>
                <th className="text-left px-3 py-2">{t("vehicleNo")}</th>
                <th className="text-right px-3 py-2">{t("fare")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={3} className="text-center py-8 text-muted-foreground">{t("noData")}</td></tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-3 py-2">{fmtDate(r.date, lang)}</td>
                  <td className="px-3 py-2">{r.vehicle_no ?? "—"}</td>
                  <td className="px-3 py-2 text-right text-emerald-400">{fmtNum(r.fare, lang)}</td>
                </tr>
              ))}
            </tbody>
            {rows.length > 0 && (
              <tfoot className="bg-muted/40 font-semibold">
                <tr>
                  <td className="px-3 py-2" colSpan={2}>{t("total")}</td>
                  <td className="px-3 py-2 text-right text-emerald-500">{fmtNum(total, lang)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
