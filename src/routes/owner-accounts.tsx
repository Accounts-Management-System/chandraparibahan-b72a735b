import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { useT, fmtNum } from "@/lib/i18n";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FileDown } from "lucide-react";
import { exportPdf } from "@/lib/exportPdf";

export const Route = createFileRoute("/owner-accounts")({ component: Page });

function Page() {
  const { t, lang } = useT();
  const [ownerId, setOwnerId] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const { data: owners = [] } = useQuery({
    queryKey: ["oa-owners"],
    queryFn: async () => ((await supabase.from("owners").select("id,name").order("name")).data ?? []) as any[],
  });
  const { data: vehiclesAll = [] } = useQuery({
    queryKey: ["oa-vehicles"],
    queryFn: async () => ((await supabase.from("vehicles").select("id,vehicle_no,owner_id").order("vehicle_no")).data ?? []) as any[],
  });
  const { data: trips = [] } = useQuery({
    queryKey: ["oa-trips"],
    queryFn: async () => ((await supabase.from("trips").select("trip_date,vehicle_no,fare_1,fare_2").limit(10000)).data ?? []) as any[],
  });
  const { data: expenses = [] } = useQuery({
    queryKey: ["oa-expenses"],
    queryFn: async () => ((await supabase.from("expenses").select("expense_date,vehicle_no,amount").limit(10000)).data ?? []) as any[],
  });
  const { data: otherIncomes = [] } = useQuery({
    queryKey: ["oa-oth"],
    queryFn: async () => ((await supabase.from("other_incomes").select("income_date,vehicle_no,amount").limit(10000)).data ?? []) as any[],
  });

  const inRange = (d: string) => {
    if (dateFrom && d < dateFrom) return false;
    if (dateTo && d > dateTo) return false;
    return true;
  };

  const ownerVehicles = useMemo(
    () => (vehiclesAll as any[]).filter((v) => !ownerId || v.owner_id === ownerId),
    [vehiclesAll, ownerId],
  );

  const perVehicle = useMemo(() => {
    return ownerVehicles.map((v: any) => {
      const fare = (trips as any[])
        .filter((r) => r.vehicle_no === v.vehicle_no && inRange(r.trip_date))
        .reduce((s, r) => s + Number(r.fare_1 || 0) + Number(r.fare_2 || 0), 0);
      const other = (otherIncomes as any[])
        .filter((r) => r.vehicle_no === v.vehicle_no && inRange(r.income_date))
        .reduce((s, r) => s + Number(r.amount || 0), 0);
      const exp = (expenses as any[])
        .filter((r) => r.vehicle_no === v.vehicle_no && inRange(r.expense_date))
        .reduce((s, r) => s + Number(r.amount || 0), 0);
      const income = fare + other;
      return { id: v.id, vehicle_no: v.vehicle_no, income, expense: exp, balance: income - exp };
    });
  }, [ownerVehicles, trips, otherIncomes, expenses, dateFrom, dateTo]);

  const totals = perVehicle.reduce(
    (s, r) => ({ income: s.income + r.income, expense: s.expense + r.expense, balance: s.balance + r.balance }),
    { income: 0, expense: 0, balance: 0 },
  );

  const ownerName = (owners as any[]).find((o) => o.id === ownerId)?.name ?? t("all");

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">{t("ownerAccounts")}</h1>
          <Button
            variant="outline"
            onClick={() =>
              exportPdf({
                title: `${t("ownerAccounts")} — ${ownerName}`,
                subtitle: `${t("balance")}: ${fmtNum(totals.balance, lang)}`,
                headers: [t("vehicleNo"), t("totalIncome"), t("totalExpense"), t("balance")],
                rows: perVehicle.map((r) => [r.vehicle_no, fmtNum(r.income, lang), fmtNum(r.expense, lang), fmtNum(r.balance, lang)]),
              })
            }
          >
            <FileDown className="h-4 w-4 mr-2" /> {t("exportPdf")}
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 rounded-lg border bg-card/60 p-3">
          <div>
            <label className="text-[10px] uppercase text-muted-foreground">{t("selectOwner")}</label>
            <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className="w-full h-9 rounded-md border border-input bg-input px-2 text-sm">
              <option value="">{t("all")}</option>
              {(owners as any[]).map((o) => <option key={o.id} value={o.id} className="bg-card">{o.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase text-muted-foreground">{t("from")}</label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9" />
          </div>
          <div>
            <label className="text-[10px] uppercase text-muted-foreground">{t("to")}</label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Stat label={t("totalIncome")} value={fmtNum(totals.income, lang)} color="text-emerald-500" />
          <Stat label={t("totalExpense")} value={fmtNum(totals.expense, lang)} color="text-rose-500" />
          <Stat label={t("balance")} value={fmtNum(totals.balance, lang)} color={totals.balance >= 0 ? "text-emerald-500" : "text-rose-500"} />
        </div>

        <div className="overflow-x-auto rounded-md border bg-card/70">
          <table className="w-full text-sm">
            <thead className="bg-muted/60">
              <tr>
                <th className="text-left px-3 py-2">{t("vehicleNo")}</th>
                <th className="text-right px-3 py-2">{t("totalIncome")}</th>
                <th className="text-right px-3 py-2">{t("totalExpense")}</th>
                <th className="text-right px-3 py-2">{t("balance")}</th>
              </tr>
            </thead>
            <tbody>
              {perVehicle.length === 0 && (
                <tr><td colSpan={4} className="text-center py-8 text-muted-foreground">{t("noData")}</td></tr>
              )}
              {perVehicle.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-3 py-2 font-medium">{r.vehicle_no}</td>
                  <td className="px-3 py-2 text-right text-emerald-400">{fmtNum(r.income, lang)}</td>
                  <td className="px-3 py-2 text-right text-rose-400">{fmtNum(r.expense, lang)}</td>
                  <td className={`px-3 py-2 text-right font-semibold ${r.balance >= 0 ? "text-emerald-500" : "text-rose-500"}`}>{fmtNum(r.balance, lang)}</td>
                </tr>
              ))}
            </tbody>
            {perVehicle.length > 0 && (
              <tfoot className="bg-muted/40 font-bold">
                <tr>
                  <td className="px-3 py-2">{t("grandTotal")}</td>
                  <td className="px-3 py-2 text-right text-emerald-500">{fmtNum(totals.income, lang)}</td>
                  <td className="px-3 py-2 text-right text-rose-500">{fmtNum(totals.expense, lang)}</td>
                  <td className={`px-3 py-2 text-right ${totals.balance >= 0 ? "text-emerald-500" : "text-rose-500"}`}>{fmtNum(totals.balance, lang)}</td>
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
