import { createFileRoute, Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { useT, fmtNum } from "@/lib/i18n";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Wallet, Bus } from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
});

const tiles: { to: string; key: any; color: string }[] = [
  { to: "/daily-accounts", key: "dailyAccounts", color: "bg-emerald-500" },
  { to: "/expenses", key: "expenses", color: "bg-rose-500" },
  { to: "/other-income", key: "otherIncome", color: "bg-amber-500" },
  { to: "/vehicles", key: "vehicles", color: "bg-sky-500" },
  { to: "/contacts?type=individual", key: "individual", color: "bg-indigo-500" },
  { to: "/contacts?type=company", key: "company", color: "bg-violet-500" },
  { to: "/contacts?type=rental", key: "rental", color: "bg-fuchsia-500" },
  { to: "/contacts?type=vendor", key: "vendor", color: "bg-pink-500" },
  { to: "/contacts?type=owner", key: "owner", color: "bg-orange-500" },
  { to: "/contacts?type=helper", key: "helper", color: "bg-lime-500" },
  { to: "/contacts?type=dada_bhai", key: "dada_bhai", color: "bg-teal-500" },
  { to: "/contacts?type=mejho_bhai", key: "mejho_bhai", color: "bg-cyan-500" },
  { to: "/contacts?type=choto_bhai", key: "choto_bhai", color: "bg-blue-500" },
  { to: "/contacts?type=bordidi", key: "bordidi", color: "bg-purple-500" },
  { to: "/contacts?type=mejhdidi", key: "mejhdidi", color: "bg-red-500" },
  { to: "/transfers", key: "transfers", color: "bg-yellow-600" },
  { to: "/data-bank", key: "dataBank", color: "bg-slate-600" },
  { to: "/reports", key: "reports", color: "bg-stone-600" },
];

function DashboardPage() {
  const { t, lang } = useT();

  const today = new Date().toISOString().slice(0, 10);
  const summary = useQuery({
    queryKey: ["dash-summary", today],
    queryFn: async () => {
      const [trips, exp, oth] = await Promise.all([
        supabase.from("trips").select("jama_1,jama_2,dena_1,dena_2,fare_1,fare_2").eq("trip_date", today),
        supabase.from("expenses").select("amount").eq("expense_date", today),
        supabase.from("other_incomes").select("amount").eq("income_date", today),
      ]);
      const jama = (trips.data ?? []).reduce(
        (s, r: any) => s + Number(r.jama_1 || 0) + Number(r.jama_2 || 0),
        0,
      );
      const dena = (trips.data ?? []).reduce(
        (s, r: any) => s + Number(r.dena_1 || 0) + Number(r.dena_2 || 0),
        0,
      );
      const fares = (trips.data ?? []).reduce(
        (s, r: any) => s + Number(r.fare_1 || 0) + Number(r.fare_2 || 0),
        0,
      );
      const expense = (exp.data ?? []).reduce((s, r: any) => s + Number(r.amount || 0), 0);
      const otherInc = (oth.data ?? []).reduce((s, r: any) => s + Number(r.amount || 0), 0);
      return { jama, dena, fares, expense, otherInc, tripCount: trips.data?.length ?? 0 };
    },
  });

  const s = summary.data;
  const income = (s?.jama ?? 0) + (s?.otherInc ?? 0);
  const expense = (s?.expense ?? 0) + (s?.dena ?? 0);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">{t("dashboard")}</h1>
          <p className="text-sm text-muted-foreground">{t("todaysSummary")}</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SummaryCard icon={TrendingUp} label={t("income")} value={fmtNum(income, lang)} color="text-emerald-600" />
          <SummaryCard icon={TrendingDown} label={t("expense")} value={fmtNum(expense, lang)} color="text-rose-600" />
          <SummaryCard icon={Wallet} label={t("net")} value={fmtNum(income - expense, lang)} color="text-sky-600" />
          <SummaryCard icon={Bus} label={t("recentTrips")} value={fmtNum(s?.tripCount ?? 0, lang)} color="text-violet-600" />
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-3">{t("brand")}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {tiles.map((tile) => (
              <Link
                key={tile.to}
                to={tile.to}
                className="group rounded-lg border bg-card p-4 hover:shadow-md hover:border-primary transition-all"
              >
                <div className={`w-10 h-10 rounded-md ${tile.color} mb-3`} />
                <div className="font-medium text-sm">{t(tile.key)}</div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function SummaryCard({ icon: Icon, label, value, color }: any) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon className={`h-4 w-4 ${color}`} />
      </div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </Card>
  );
}
