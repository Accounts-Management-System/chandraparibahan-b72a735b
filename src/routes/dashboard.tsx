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
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LabelList } from "recharts";
import { useMemo, useState } from "react";
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

function monthRange(ym: string): { from: string; to: string } | null {
  if (!ym) return null;
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return null;
  const from = `${y}-${String(m).padStart(2, "0")}-01`;
  const last = new Date(y, m, 0).getDate();
  const to = `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
  return { from, to };
}

function DashboardPage() {
  const { t, lang } = useT();
  const { isAdmin, canWrite } = useRole();
  const yesterday = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }, []);

  // Filters — default to previous day
  const [dateFrom, setDateFrom] = useState(yesterday);
  const [dateTo, setDateTo] = useState(yesterday);
  const [month, setMonth] = useState("");
  const [vehicle, setVehicle] = useState<string>("all");
  const [ownerId, setOwnerId] = useState<string>("all");

  const effRange = useMemo(() => {
    const mr = monthRange(month);
    return {
      from: mr?.from || dateFrom || "",
      to: mr?.to || dateTo || "",
    };
  }, [month, dateFrom, dateTo]);

  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles-list-all"],
    queryFn: async () => {
      const { data } = await supabase.from("vehicles").select("vehicle_no,owner_id").order("vehicle_no");
      return (data ?? []) as { vehicle_no: string; owner_id: string | null }[];
    },
  });
  const { data: owners = [] } = useQuery({
    queryKey: ["owners-list-dash"],
    queryFn: async () => {
      const { data } = await supabase.from("owners").select("id,name").order("name");
      return (data ?? []) as { id: string; name: string }[];
    },
  });

  const [chartMode, setChartMode] = useState<"balance" | "debit" | "deposit" | "tripCount">("balance");

  // Main / Owner account
  const mainAcc = useQuery({
    queryKey: ["dash-main", effRange.from, effRange.to, vehicle, ownerId],
    queryFn: async () => {
      let tq = supabase.from("trips").select("trip_date,vehicle_no,serial_no,jama_1,jama_2,dena_1,dena_2,fare_1,fare_2").limit(100000);
      let eq = supabase.from("expenses").select("expense_date,owner_id,amount").limit(100000);
      let oq = supabase.from("other_incomes").select("income_date,owner_id,vehicle_no,amount").limit(100000);
      if (effRange.from) { tq = tq.gte("trip_date", effRange.from); eq = eq.gte("expense_date", effRange.from); oq = oq.gte("income_date", effRange.from); }
      if (effRange.to) { tq = tq.lte("trip_date", effRange.to); eq = eq.lte("expense_date", effRange.to); oq = oq.lte("income_date", effRange.to); }
      if (vehicle !== "all") { tq = tq.eq("vehicle_no", vehicle); oq = oq.eq("vehicle_no", vehicle); }
      const [tripsRes, othRes, expRes, vehRes] = await Promise.all([tq, oq, eq, supabase.from("vehicles").select("vehicle_no,owner_id").limit(100000)]);
      const vehMap = new Map<string, string | null>();
      ((vehRes.data ?? []) as any[]).forEach((v) => vehMap.set(v.vehicle_no, v.owner_id ?? null));
      const trips = (tripsRes.data ?? []) as any[];
      const expenses = (expRes.data ?? []) as any[];
      const incomes = (othRes.data ?? []) as any[];

      if (ownerId === "all") {
        // মূল হিসাব: সকল গাড়ির দৈনিক জমা − দেনা + অন্যান্য জমা (owner_id NULL) − ownerless দৈনিক খরচ
        const otherIncome = incomes.filter((r) => !r.owner_id).reduce((s, r) => s + Number(r.amount || 0), 0);
        const expense = expenses.filter((r) => !r.owner_id).reduce((s, r) => s + Number(r.amount || 0), 0);
        const jama = trips.reduce((s, r) => s + Number(r.jama_1 || 0) + Number(r.jama_2 || 0), 0);
        const dena = trips.reduce((s, r) => s + Number(r.dena_1 || 0) + Number(r.dena_2 || 0), 0);
        const incomeLoss = jama - dena;
        return {
          mode: "main" as const,
          trips, jama, dena, incomeLoss, otherIncome, expense,
          balance: incomeLoss + otherIncome - expense,
          tripCount: new Set(trips.map((r) => r.vehicle_no)).size,
        };
      }
      // ওনার হিসাব: গাড়ী ভাড়া + জমা-খরচের জমা − জমা-খরচের খরচ
      const ownerTrips = trips.filter((r) => vehMap.get(r.vehicle_no) === ownerId);
      const fares = ownerTrips.reduce((s, r) => s + Number(r.fare_1 || 0) + Number(r.fare_2 || 0), 0);
      const jamaKhorochJama = incomes.filter((r) => r.owner_id === ownerId).reduce((s, r) => s + Number(r.amount || 0), 0);
      const jamaKhorochKhoroch = expenses.filter((r) => r.owner_id === ownerId).reduce((s, r) => s + Number(r.amount || 0), 0);
      return {
        mode: "owner" as const,
        trips: ownerTrips, fares, jamaKhorochJama, jamaKhorochKhoroch,
        balance: fares + jamaKhorochJama - jamaKhorochKhoroch,
        tripCount: new Set(ownerTrips.map((r) => r.vehicle_no)).size,
      };
    },
  });
  const mb: any = mainAcc.data ?? { mode: "main", trips: [] as any[], jama: 0, dena: 0, incomeLoss: 0, otherIncome: 0, expense: 0, balance: 0, tripCount: 0 };

  const tripRows = (mb.trips ?? []) as any[];
  const chartData = chartMode === "tripCount"
    ? Object.entries(
        tripRows.reduce<Record<string, number>>((acc: Record<string, number>, r: any) => {
          acc[r.vehicle_no] = (acc[r.vehicle_no] || 0) + 1;
          return acc;
        }, {}),
      ).map(([name, value]) => ({ name, value }))
    : tripRows.map((r: any, i: number) => {
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
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("dashboard")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("overview")}</p>
        </div>

        {/* Filters */}
        <Card className="p-3 border-border/60 bg-card shadow-sm">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] uppercase text-muted-foreground">{t("from")}</span>
              <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setMonth(""); }} className="h-9" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] uppercase text-muted-foreground">{t("to")}</span>
              <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setMonth(""); }} className="h-9" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] uppercase text-muted-foreground">{t("month")}</span>
              <Input type="month" value={month} onChange={(e) => { setMonth(e.target.value); setDateFrom(""); setDateTo(""); }} className="h-9" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] uppercase text-muted-foreground">{t("owner")}</span>
              <Select value={ownerId} onValueChange={setOwnerId}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("ownerless")} ({t("filterAll")})</SelectItem>
                  {owners.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] uppercase text-muted-foreground">{t("vehicleNo")}</span>
              <Select value={vehicle} onValueChange={setVehicle}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("allVehicles")}</SelectItem>
                  {vehicles.map((v) => <SelectItem key={v.vehicle_no} value={v.vehicle_no}>{v.vehicle_no}</SelectItem>)}
                </SelectContent>
              </Select>
            </label>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            {effRange.from ? fmtDate(effRange.from, lang) : "—"} → {effRange.to ? fmtDate(effRange.to, lang) : "—"}
          </p>
        </Card>

        {/* Main / Owner account */}
        <Card className="p-4 border-border/60 bg-card shadow-sm">
          <div className="text-sm font-semibold text-muted-foreground mb-3 flex items-center justify-between border-b pb-2">
            <span>🚌 {ownerId === "all" ? `${t("mainTransportAccount")} (${t("ownerless")})` : `ওনার হিসাব — ${owners.find((o) => o.id === ownerId)?.name ?? ""}`}</span>
            <span className="text-foreground text-xs">{t("totalTrips")}: <span className="text-primary font-bold">{fmtNum(mb.tripCount, lang)}</span></span>
          </div>
          {mb.mode === "main" ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                <MiniStat label={t("dailyJama")} value={fmtNum(mb.jama, lang)} color="text-emerald-500" />
                <MiniStat label={t("dena")} value={fmtNum(mb.dena, lang)} color="text-rose-500" />
                <MiniStat label={t("incomeLoss")} value={fmtNum(mb.incomeLoss, lang)} color={mb.incomeLoss >= 0 ? "text-emerald-600" : "text-rose-600"} />
                <MiniStat label="অন্যান্য জমা" value={fmtNum(mb.otherIncome, lang)} color="text-emerald-500" />
                <MiniStat label={t("dailyExpense")} value={fmtNum(mb.expense, lang)} color="text-rose-500" />
                <MiniStat label={t("mainBalance")} value={fmtNum(mb.balance, lang)} color={mb.balance >= 0 ? "text-sky-600" : "text-rose-600"} highlight />
              </div>
              <p className="text-[11px] text-muted-foreground mt-3 font-mono">
                ({t("dailyJama")} − {t("dena")}) + অন্যান্য জমা − {t("dailyExpense")} = {t("mainBalance")}
              </p>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <MiniStat label="গাড়ী ভাড়া" value={fmtNum(mb.fares, lang)} color="text-emerald-500" />
                <MiniStat label="জমা-খরচের জমা" value={fmtNum(mb.jamaKhorochJama, lang)} color="text-emerald-500" />
                <MiniStat label="জমা-খরচের খরচ" value={fmtNum(mb.jamaKhorochKhoroch, lang)} color="text-rose-500" />
                <MiniStat label="ব্যালেন্স" value={fmtNum(mb.balance, lang)} color={mb.balance >= 0 ? "text-sky-600" : "text-rose-600"} highlight />
              </div>
              <p className="text-[11px] text-muted-foreground mt-3 font-mono">
                গাড়ী ভাড়া + জমা-খরচের জমা − জমা-খরচের খরচ = ব্যালেন্স
              </p>
            </>
          )}
        </Card>

        {/* Per-trip chart */}
        <Card className="p-4 border-border/60 bg-card shadow-sm">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="text-sm font-semibold text-muted-foreground">{t("tripChart")}</div>
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
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0 0 0 / 0.08)" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-30} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 10 }} />
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
                  className="group relative overflow-hidden rounded-xl border border-border/60 bg-card p-5 transition-all hover:border-primary/60 hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex items-center justify-center w-11 h-11 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all mb-3">
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

function MiniStat({ label, value, color, highlight }: { label: string; value: string; color: string; highlight?: boolean }) {
  return (
    <div className={`rounded-md border p-2 ${highlight ? "bg-primary/5 border-primary/40" : "bg-muted/30"}`}>
      <div className="text-[10px] uppercase text-muted-foreground mb-1">{label}</div>
      <div className={`text-base md:text-lg font-bold ${color}`}>{value}</div>
    </div>
  );
}
