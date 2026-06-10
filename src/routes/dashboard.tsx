import { createFileRoute, Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { useT, fmtDate, fmtNum, trBn } from "@/lib/i18n";
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

  const [chartMode, setChartMode] = useState<"balance" | "debit" | "deposit" | "tripCount">("tripCount");

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
  // Find last date in range, filter only last-date rows for sum-per-vehicle
  const lastDate = tripRows.reduce<string>((mx, r: any) => (r.trip_date > mx ? r.trip_date : mx), "");
  const lastDateRows = lastDate ? tripRows.filter((r: any) => r.trip_date === lastDate) : tripRows;
  const aggSource = chartMode === "tripCount" ? tripRows : lastDateRows;
  const aggregated = aggSource.reduce<Record<string, number>>((acc, r: any) => {
    const jama = Number(r.jama_1 || 0) + Number(r.jama_2 || 0);
    const dena = Number(r.dena_1 || 0) + Number(r.dena_2 || 0);
    const v = chartMode === "tripCount" ? 1
      : chartMode === "deposit" ? jama
      : chartMode === "debit" ? dena
      : jama - dena;
    acc[r.vehicle_no] = (acc[r.vehicle_no] || 0) + v;
    return acc;
  }, {});
  const chartData = Object.entries(aggregated).map(([name, value]) => ({ name, value }));
  const chartStops = chartMode === "debit"
    ? { from: "oklch(0.72 0.22 25)", to: "oklch(0.55 0.18 25)" }
    : chartMode === "deposit"
      ? { from: "oklch(0.78 0.18 150)", to: "oklch(0.55 0.15 150)" }
      : chartMode === "tripCount"
        ? { from: "#C9B6FF", to: "#7C5BD9" } // lavender
        : { from: "oklch(0.72 0.18 270)", to: "oklch(0.5 0.18 270)" };
  const gradId = `barGrad-${chartMode}`;
  const labelGradId = `labelGrad-${chartMode}`;
  const labelBlurId = `labelBlur-${chartMode}`;

  // Custom vector label: vertical (rotated) text in rounded pill with gradient + glow
  const ValueLabel = (props: any) => {
    const { x, y, width, value } = props;
    if (value == null) return null;
    const text = fmtNum(Number(value), lang);
    const cx = x + width / 2;
    const charW = 7;
    const padY = 6;
    const h = Math.max(28, text.length * charW + padY * 2);
    const w = 16;
    const cy = y - h / 2 - 4;
    return (
      <g transform={`translate(${cx}, ${cy})`}>
        <rect x={-w / 2} y={-h / 2} rx={7} ry={7} width={w} height={h}
          fill={`url(#${labelGradId})`} filter={`url(#${labelBlurId})`} opacity={0.95} />
        <rect x={-w / 2} y={-h / 2} rx={7} ry={7} width={w} height={h}
          fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={0.7} />
        <text x={0} y={0} textAnchor="middle" transform="rotate(-90)"
          dominantBaseline="middle"
          style={{ fontSize: 10, fontWeight: 700, fill: "#fff", letterSpacing: 0.3 }}>
          {text}
        </text>
      </g>
    );
  };

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

        {/* Main / Owner account — compact pastel tiles, no big container */}
        <div>
          <div className="text-sm font-semibold text-muted-foreground mb-2 flex items-center justify-between">
            <span>🚌 {ownerId === "all" ? `${t("mainTransportAccount")} (${t("ownerless")})` : `${trBn("ওনার হিসাব", lang)} — ${owners.find((o) => o.id === ownerId)?.name ?? ""}`}</span>
            <span className="text-foreground text-xs">{t("totalTrips")}: <span className="text-primary font-bold">{fmtNum(mb.tripCount, lang)}</span></span>
          </div>
          {mb.mode === "main" ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                <MiniStat tone="mint"     label={t("dailyJama")} value={fmtNum(mb.jama, lang)} />
                <MiniStat tone="pink"     label={t("dena")} value={fmtNum(mb.dena, lang)} />
                <MiniStat tone="lavender" label={t("incomeLoss")} value={fmtNum(mb.incomeLoss, lang)} />
                <MiniStat tone="cyan"     label={trBn("অন্যান্য জমা", lang)} value={fmtNum(mb.otherIncome, lang)} />
                <MiniStat tone="peach"    label={t("dailyExpense")} value={fmtNum(mb.expense, lang)} />
                <MiniStat tone="blue"     label={t("mainBalance")} value={fmtNum(mb.balance, lang)} highlight />
              </div>
              <p className="text-[11px] text-muted-foreground mt-2 font-mono">
                ({t("dailyJama")} − {t("dena")}) + {trBn("অন্যান্য জমা", lang)} − {t("dailyExpense")} = {t("mainBalance")}
              </p>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <MiniStat tone="mint"  label={trBn("গাড়ী ভাড়া", lang)} value={fmtNum(mb.fares, lang)} />
                <MiniStat tone="cyan"  label={trBn("জমা-খরচের জমা", lang)} value={fmtNum(mb.jamaKhorochJama, lang)} />
                <MiniStat tone="pink"  label={trBn("জমা-খরচের খরচ", lang)} value={fmtNum(mb.jamaKhorochKhoroch, lang)} />
                <MiniStat tone="blue"  label={trBn("ব্যালেন্স", lang)} value={fmtNum(mb.balance, lang)} highlight />
              </div>
              <p className="text-[11px] text-muted-foreground mt-2 font-mono">
                গাড়ী ভাড়া + জমা-খরচের জমা − জমা-খরচের খরচ = ব্যালেন্স
              </p>
            </>
          )}
        </div>

        {/* Per-trip chart */}
        <Card className="p-4 border-border/60 bg-card shadow-sm">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="text-sm font-semibold text-muted-foreground">{t("tripChart")}</div>
            <div className="inline-flex rounded-md border border-border/60 bg-muted/40 p-0.5 text-xs">
              {(["tripCount", "deposit", "debit", "balance"] as const).map((m) => (
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
            <>
              {lastDate && (
                <p className="text-[11px] text-muted-foreground mb-2">
                  {trBn("সর্বশেষ তারিখ", lang)}: <span className="font-semibold text-foreground">{fmtDate(lastDate, lang)}</span>
                </p>
              )}
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 48, right: 8, left: 0, bottom: 8 }}>
                    <defs>
                      <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={chartStops.from} />
                        <stop offset="100%" stopColor={chartStops.to} />
                      </linearGradient>
                      <linearGradient id={labelGradId} x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor={chartStops.from} stopOpacity={0.95} />
                        <stop offset="100%" stopColor={chartStops.to} stopOpacity={0.95} />
                      </linearGradient>
                      <filter id={labelBlurId} x="-30%" y="-30%" width="160%" height="160%">
                        <feGaussianBlur in="SourceGraphic" stdDeviation="0.6" />
                      </filter>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0 0 0 / 0.08)" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-30} textAnchor="end" height={60} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => fmtNum(v, lang)} />
                    <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} formatter={(v: any) => fmtNum(Number(v), lang)} />
                    <Bar dataKey="value" fill={`url(#${gradId})`} radius={[6, 6, 0, 0]}>
                      <LabelList dataKey="value" position="top" content={<ValueLabel />} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </Card>

        {/* Module buttons */}
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            {t("quickEntry")}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {(() => {
              const tones = ["blue","mint","peach","lavender","pink","cyan","amber"] as const;
              return tiles.filter((tile) => (!("adminOnly" in tile) || !tile.adminOnly || isAdmin) && (!("writeOnly" in tile) || !tile.writeOnly || canWrite)).map((tile, i) => {
                const Icon = tile.icon;
                const tone = tones[i % tones.length];
                return (
                  <Link
                    key={tile.to}
                    to={tile.to}
                    className={`tile-3d tile-${tone} group relative overflow-hidden p-5 transition-all hover:-translate-y-0.5 hover:shadow-md`}
                  >
                    <div className="flex items-center justify-center w-11 h-11 rounded-lg bg-primary/15 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all mb-3">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="font-medium text-sm text-foreground">{t(tile.key)}</div>
                  </Link>
                );
              });
            })()}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function MiniStat({ label, value, tone = "blue", highlight }: { label: string; value: string; tone?: "blue"|"mint"|"peach"|"lavender"|"pink"|"cyan"|"amber"; highlight?: boolean }) {
  return (
    <div className={`tile-3d tile-${tone} p-3 ${highlight ? "ring-2 ring-primary/50" : ""}`}>
      <div className="text-[10px] uppercase text-foreground/60 mb-1 font-semibold tracking-wide">{label}</div>
      <div className="text-base md:text-lg font-extrabold text-foreground">{value}</div>
    </div>
  );
}
