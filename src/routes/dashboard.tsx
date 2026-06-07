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

function DashboardPage() {
  const { t, lang } = useT();
  const { isAdmin, canWrite } = useRole();
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [vehicle, setVehicle] = useState<string>("all");

  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles-list-all"],
    queryFn: async () => {
      const { data } = await supabase.from("vehicles").select("vehicle_no,owner_id").order("vehicle_no");
      return (data ?? []) as { vehicle_no: string; owner_id: string | null }[];
    },
  });
  const { data: owners = [] } = useQuery({
    queryKey: ["dash-owners"],
    queryFn: async () => ((await supabase.from("owners").select("id,name").order("name")).data ?? []) as { id: string; name: string }[],
  });

  const ownerVehMap = useMemo(() => {
    const m = new Map<string, string | null>();
    vehicles.forEach((v) => m.set(v.vehicle_no, v.owner_id ?? null));
    return m;
  }, [vehicles]);

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

  // মূল পরিবহন হিসাব: শুধু ownerless গাড়ি
  const mainBalance = useQuery({
    queryKey: ["dash-main-balance"],
    queryFn: async () => {
      const [tripsRes, officeRes, expRes, vehRes] = await Promise.all([
        supabase.from("trips").select("vehicle_no,jama_1,jama_2,dena_1,dena_2,fare_1,fare_2").limit(100000),
        (supabase as any).from("office_deposits").select("amount").limit(100000),
        supabase.from("expenses").select("owner_id,amount").is("owner_id", null).limit(100000),
        supabase.from("vehicles").select("vehicle_no,owner_id").limit(100000),
      ]);
      const vehMap = new Map<string, string | null>();
      ((vehRes.data ?? []) as any[]).forEach((v) => vehMap.set(v.vehicle_no, v.owner_id ?? null));
      const allTrips = (tripsRes.data ?? []) as any[];
      const mainTrips = allTrips.filter((r) => !vehMap.get(r.vehicle_no));
      const jama = mainTrips.reduce((s, r) => s + Number(r.jama_1 || 0) + Number(r.jama_2 || 0), 0);
      const dena = mainTrips.reduce((s, r) => s + Number(r.dena_1 || 0) + Number(r.dena_2 || 0), 0);
      const office = ((officeRes.data ?? []) as any[]).reduce((s, r) => s + Number(r.amount || 0), 0);
      const expense = ((expRes.data ?? []) as any[]).reduce((s, r) => s + Number(r.amount || 0), 0);
      const incomeLoss = jama - dena;
      return {
        jama, dena, incomeLoss, office, expense,
        balance: incomeLoss + office - expense,
        tripCount: mainTrips.length,
      };
    },
  });
  const mb = mainBalance.data ?? { jama: 0, dena: 0, incomeLoss: 0, office: 0, expense: 0, balance: 0, tripCount: 0 };

  // প্রতি ওনারের জন্য হিসাব
  const ownerBalances = useQuery({
    queryKey: ["dash-owner-balances"],
    queryFn: async () => {
      const [tripsRes, expRes, othRes, vehRes, ownRes] = await Promise.all([
        supabase.from("trips").select("vehicle_no,fare_1,fare_2").limit(100000),
        supabase.from("expenses").select("owner_id,amount").not("owner_id", "is", null).limit(100000),
        supabase.from("other_incomes").select("owner_id,amount,category").not("owner_id", "is", null).limit(100000),
        supabase.from("vehicles").select("vehicle_no,owner_id").limit(100000),
        supabase.from("owners").select("id,name").order("name"),
      ]);
      const vehMap = new Map<string, string | null>();
      ((vehRes.data ?? []) as any[]).forEach((v) => vehMap.set(v.vehicle_no, v.owner_id ?? null));
      const trips = (tripsRes.data ?? []) as any[];
      const exp = (expRes.data ?? []) as any[];
      const oth = ((othRes.data ?? []) as any[]).filter((r) => r.category !== "অফিস কতৃক জমা");
      const ownersList = ((ownRes.data ?? []) as any[]);
      return ownersList.map((o) => {
        const fare = trips
          .filter((r) => vehMap.get(r.vehicle_no) === o.id)
          .reduce((s, r) => s + Number(r.fare_1 || 0) + Number(r.fare_2 || 0), 0);
        const jama = oth.filter((r) => r.owner_id === o.id).reduce((s, r) => s + Number(r.amount || 0), 0);
        const khoroch = exp.filter((r) => r.owner_id === o.id).reduce((s, r) => s + Number(r.amount || 0), 0);
        return { id: o.id, name: o.name, fare, jama, khoroch, balance: fare + jama - khoroch };
      });
    },
  });
  const ob = ownerBalances.data ?? [];


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
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("dashboard")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("overview")}</p>
        </div>

        {/* মূল পরিবহন হিসাব */}
        <Card className="p-4 border-border/60 bg-card shadow-sm">
          <div className="text-sm font-semibold text-muted-foreground mb-3 flex items-center justify-between border-b pb-2">
            <span>🚌 মূল পরিবহন হিসাব (ওনার বিহীন)</span>
            <span className="text-foreground text-xs">মোট ট্রিপ: <span className="text-primary font-bold">{fmtNum(mb.tripCount, lang)}</span></span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
            <MiniStat label="দৈনিক জমা" value={fmtNum(mb.jama, lang)} color="text-emerald-500" />
            <MiniStat label="দেনা" value={fmtNum(mb.dena, lang)} color="text-rose-500" />
            <MiniStat label="আয়/লস" value={fmtNum(mb.incomeLoss, lang)} color={mb.incomeLoss >= 0 ? "text-emerald-600" : "text-rose-600"} />
            <MiniStat label="অন্যান্য জমা" value={fmtNum(mb.office, lang)} color="text-emerald-500" />
            <MiniStat label="দৈনিক খরচ" value={fmtNum(mb.expense, lang)} color="text-rose-500" />
            <MiniStat
              label="মুল ব্যালেন্স"
              value={fmtNum(mb.balance, lang)}
              color={mb.balance >= 0 ? "text-sky-600" : "text-rose-600"}
              highlight
            />
          </div>
          <p className="text-[11px] text-muted-foreground mt-3 font-mono">
            (দৈনিক জমা − দেনা) + অন্যান্য জমা − দৈনিক খরচ = মুল ব্যালেন্স
          </p>
        </Card>

        {/* ওনারদের হিসাব — অটো */}
        {ob.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wide">👤 ওনারদের হিসাব</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {ob.map((o) => (
                <Card key={o.id} className="p-3 border-border/60 bg-card shadow-sm">
                  <div className="flex items-center justify-between border-b pb-2 mb-2">
                    <span className="font-bold text-sm">{o.name}</span>
                    <span className={`font-bold text-base ${o.balance >= 0 ? "text-sky-600" : "text-rose-600"}`}>
                      ব্যালেন্স: {fmtNum(o.balance, lang)}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <MiniStat label="গাড়ী ভাড়া" value={fmtNum(o.fare, lang)} color="text-amber-600" />
                    <MiniStat label="জমা-খরচ (জমা)" value={fmtNum(o.jama, lang)} color="text-emerald-500" />
                    <MiniStat label="জমা-খরচ (খরচ)" value={fmtNum(o.khoroch, lang)} color="text-rose-500" />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2 font-mono">
                    গাড়ী ভাড়া + জমা − খরচ = ব্যালেন্স
                  </p>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <Card className="p-4 border-border/60 bg-card shadow-sm">
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
        <Card className="p-4 border-border/60 bg-card shadow-sm">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="text-sm font-semibold text-muted-foreground">
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
