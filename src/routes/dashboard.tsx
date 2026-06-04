import { createFileRoute, Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { useT, fmtDate, fmtNum } from "@/lib/i18n";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Receipt,
  Wallet,
  Coins,
  Bus,
  Users,
  Database,
  FileBarChart,
  Factory,
  BookOpen,
  ShieldCheck,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useState } from "react";
import { useRole } from "@/lib/useRole";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
});

const tiles = [
  { to: "/daily-accounts", key: "dailyAccounts" as const, icon: Receipt },
  { to: "/jama-khoroch", key: "jamaKhoroch" as const, icon: BookOpen },
  { to: "/expenses", key: "expenses" as const, icon: Wallet },
  { to: "/other-income", key: "otherIncome" as const, icon: Coins },
  { to: "/vehicles", key: "vehicles" as const, icon: Bus },
  { to: "/contacts", key: "shareholders" as const, icon: Users },
  { to: "/data-manufacturer", key: "dataManufacturer" as const, icon: Factory, writeOnly: true },
  { to: "/data-bank", key: "dataBank" as const, icon: Database },
  { to: "/reports", key: "reports" as const, icon: FileBarChart },
  { to: "/admin", key: "admin" as const, icon: ShieldCheck, adminOnly: true },
];

function DashboardPage() {
  const { t, lang } = useT();
  const { isAdmin, canWrite } = useRole();
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [vehicle, setVehicle] = useState<string>("all");

  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles-list"],
    queryFn: async () => {
      const { data } = await supabase.from("vehicles").select("vehicle_no").order("vehicle_no");
      return (data ?? []) as { vehicle_no: string }[];
    },
  });

  const [chartMode, setChartMode] = useState<"balance" | "debit" | "deposit" | "tripCount">("balance");

  const summary = useQuery({
    queryKey: ["dash-trips", date, vehicle],
    queryFn: async () => {
      let q = supabase
        .from("trips")
        .select("vehicle_no,serial_no,jama_1,jama_2,dena_1,dena_2")
        .eq("trip_date", date)
        .order("serial_no", { ascending: true });
      if (vehicle !== "all") q = q.eq("vehicle_no", vehicle);
      const { data } = await q;
      return (data ?? []) as { vehicle_no: string; serial_no: number | null; jama_1: number; jama_2: number; dena_1: number; dena_2: number }[];
    },
  });

  // মূল পরিবহন হিসাব (সকল ডাটা): দৈনিক জমা + অন্যান্য জমা − দৈনিক খরচ
  const mainBalance = useQuery({
    queryKey: ["dash-main-balance"],
    queryFn: async () => {
      const [tripsRes, othRes, expRes] = await Promise.all([
        supabase.from("trips").select("jama_1,jama_2").limit(100000),
        supabase.from("other_incomes").select("amount").limit(100000),
        supabase.from("expenses").select("amount").limit(100000),
      ]);
      const dailyJama = ((tripsRes.data ?? []) as any[]).reduce(
        (s, r) => s + Number(r.jama_1 || 0) + Number(r.jama_2 || 0),
        0,
      );
      const otherJama = ((othRes.data ?? []) as any[]).reduce((s, r) => s + Number(r.amount || 0), 0);
      const dailyExpense = ((expRes.data ?? []) as any[]).reduce((s, r) => s + Number(r.amount || 0), 0);
      return { dailyJama, otherJama, dailyExpense, balance: dailyJama + otherJama - dailyExpense };
    },
  });
  const mb = mainBalance.data ?? { dailyJama: 0, otherJama: 0, dailyExpense: 0, balance: 0 };

  const tripRows = summary.data ?? [];
  const chartData = chartMode === "tripCount"
    ? Object.entries(
        tripRows.reduce<Record<string, number>>((acc, r) => {
          acc[r.vehicle_no] = (acc[r.vehicle_no] || 0) + 1;
          return acc;
        }, {}),
      ).map(([name, value]) => ({ name, value }))
    : tripRows.map((r, i) => {
        const jama = Number(r.jama_1 || 0) + Number(r.jama_2 || 0);
        const dena = Number(r.dena_1 || 0) + Number(r.dena_2 || 0);
        return {
          name: `${r.vehicle_no}${r.serial_no ? "·" + r.serial_no : "·" + (i + 1)}`,
          value: chartMode === "balance" ? jama - dena : chartMode === "debit" ? dena : jama,
        };
      });
  const chartColor = chartMode === "debit" ? "oklch(0.65 0.2 25)" : chartMode === "deposit" ? "oklch(0.7 0.18 150)" : chartMode === "tripCount" ? "oklch(0.75 0.15 80)" : "var(--primary)";

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("dashboard")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("overview")}</p>
        </div>

        {/* মূল পরিবহন হিসাব */}
        <Card className="p-4 border-border/50 bg-card/70 backdrop-blur">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
            মূল পরিবহন হিসাব
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MiniStat label="দৈনিক জমা" value={fmtNum(mb.dailyJama, lang)} color="text-emerald-400" />
            <MiniStat label="অন্যান্য জমা" value={fmtNum(mb.otherJama, lang)} color="text-emerald-400" />
            <MiniStat label="দৈনিক খরচ" value={fmtNum(mb.dailyExpense, lang)} color="text-rose-400" />
            <MiniStat
              label="ব্যালেন্স"
              value={fmtNum(mb.balance, lang)}
              color={mb.balance >= 0 ? "text-sky-400" : "text-rose-500"}
            />
          </div>
          <p className="text-[11px] text-muted-foreground mt-3">
            (দৈনিক জমা + অন্যান্য জমা) − দৈনিক খরচ = ব্যালেন্স
          </p>
        </Card>

        {/* Filters */}
        <Card className="p-4 border-border/50 bg-card/60 backdrop-blur">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-11"
            />
            <Select value={vehicle} onValueChange={setVehicle}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder={t("selectVehicle")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allVehicles")}</SelectItem>
                {vehicles.map((v) => (
                  <SelectItem key={v.vehicle_no} value={v.vehicle_no}>
                    {v.vehicle_no}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            {fmtDate(date, lang)} · {vehicle === "all" ? t("allVehicles") : vehicle}
          </p>
        </Card>

        {/* Per-trip chart */}
        <Card className="p-4 border-border/50 bg-card/70 backdrop-blur">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              {t("tripChart")}
            </div>
            <div className="inline-flex rounded-md border border-border/60 bg-muted/40 p-0.5 text-xs">
              {(["balance", "debit", "deposit", "tripCount"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setChartMode(m)}
                  className={`px-3 py-1 rounded transition-colors ${chartMode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {m === "balance" ? t("chartBalance") : m === "debit" ? t("chartDebit") : m === "deposit" ? t("chartDeposit") : t("chartTripCount")}
                </button>
              ))}
            </div>
          </div>
          {chartData.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">{t("noData")}</p>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.08)" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "oklch(0.7 0.04 270)" }} interval={0} angle={-30} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 10, fill: "oklch(0.7 0.04 270)" }} />
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="value" fill={chartColor} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>


        {/* Module buttons */}
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            {t("quickEntry")}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {tiles.filter((tile) => (!("adminOnly" in tile) || !tile.adminOnly || isAdmin) && (!("writeOnly" in tile) || !tile.writeOnly || canWrite)).map((tile) => {
              const Icon = tile.icon;
              return (
                <Link
                  key={tile.to}
                  to={tile.to}
                  className="group relative overflow-hidden rounded-xl border border-border/60 bg-card/70 p-5 transition-all hover:border-primary/60 hover:bg-card hover:-translate-y-0.5 hover:shadow-[0_8px_30px_-8px] hover:shadow-primary/40"
                >
                  <div className="flex items-center justify-center w-11 h-11 rounded-lg bg-gradient-to-br from-primary/30 to-accent/30 text-primary group-hover:from-primary group-hover:to-primary-glow group-hover:text-primary-foreground transition-all mb-3">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="font-medium text-sm">{t(tile.key)}</div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg border bg-card/60 p-3">
      <div className="text-[10px] uppercase text-muted-foreground mb-1">{label}</div>
      <div className={`text-lg font-bold ${color}`}>{value}</div>
    </div>
  );
}

