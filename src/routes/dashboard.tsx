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
  UserCog,
  FileText,
  Store,
  Route as RouteIcon,
  Link as LinkIcon,
  Plus,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LabelList } from "recharts";
import { useEffect, useMemo, useState } from "react";
import { useRole } from "@/lib/useRole";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
});

const tiles = [
  { to: "/daily-accounts", key: "dailyAccounts" as const, icon: Receipt },
  { to: "/daily-report", key: "dailyReport" as const, icon: FileText },
  { to: "/jama-khoroch", key: "jamaKhoroch" as const, icon: BookOpen },
  { to: "/expenses", key: "expenses" as const, icon: Wallet },
  { to: "/other-income", key: "otherIncome" as const, icon: Coins },
  { to: "/vehicles", key: "vehicles" as const, icon: Bus },
  { to: "/routes", key: "routes" as const, icon: RouteIcon },
  { to: "/vendors", key: "vendors" as const, icon: Store },
  { to: "/contacts", key: "shareholders" as const, icon: Users },
  { to: "/data-manufacturer", key: "dataManufacturer" as const, icon: Factory, writeOnly: true },
  { to: "/data-bank", key: "dataBank" as const, icon: Database },
  { to: "/data-bank", key: "supervisorDb" as const, icon: UserCog },
  { to: "/reports", key: "reports" as const, icon: FileBarChart },
  { to: "/admin", key: "admin" as const, icon: ShieldCheck, adminOnly: true },
];

type CustomLink = { id: string; label: string; url: string };
const LINKS_KEY = "dashboard-custom-links";
function loadLinks(): CustomLink[] {
  try { return JSON.parse(localStorage.getItem(LINKS_KEY) || "[]"); } catch { return []; }
}
function saveLinks(v: CustomLink[]) {
  try { localStorage.setItem(LINKS_KEY, JSON.stringify(v)); } catch {}
}

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
  const { isAdmin, canWrite, isOwner } = useRole();
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
  const [activeBar, setActiveBar] = useState<string | null>(null);
  const [links, setLinks] = useState<CustomLink[]>([]);
  const [linksOpen, setLinksOpen] = useState(false);
  useEffect(() => { setLinks(loadLinks()); }, []);
  const updateLinks = (next: CustomLink[]) => { setLinks(next); saveLinks(next); };

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
          tripCount: trips.length,
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
        tripCount: ownerTrips.length,
      };
    },
  });
  const mb: any = mainAcc.data ?? { mode: "main", trips: [] as any[], jama: 0, dena: 0, incomeLoss: 0, otherIncome: 0, expense: 0, balance: 0, tripCount: 0 };

  const tripRows = (mb.trips ?? []) as any[];
  // Find last date in range for display only; chart totals must use the full
  // selected day/month range for every mode.
  const lastDate = tripRows.reduce<string>((mx, r: any) => (r.trip_date > mx ? r.trip_date : mx), "");
  const aggSource = tripRows;
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
        ? { from: "#67E8F9", to: "#0891B2" } // cyan
        : { from: "oklch(0.72 0.18 270)", to: "oklch(0.5 0.18 270)" };
  const gradId = `barGrad-${chartMode}`;
  const labelGradId = `labelGrad-${chartMode}`;
  const labelBlurId = `labelBlur-${chartMode}`;

  // Uniform pill size: compute once from longest formatted value in data
  const maxLabelLen = Math.max(
    3,
    ...chartData.map((d) => fmtNum(Number(d.value), lang).length),
  );
  const pillH = Math.max(34, maxLabelLen * 7 + 14);
  const pillW = 20;
  const ValueLabel = (props: any) => {
    const { x, y, width, value } = props;
    if (value == null) return null;
    const text = fmtNum(Number(value), lang);
    const cx = x + width / 2;
    const cy = y - pillH / 2 - 6;
    return (
      <g transform={`translate(${cx}, ${cy})`}>
        {/* outer shadow for 3D lift */}
        <rect x={-pillW / 2 + 1} y={-pillH / 2 + 2} rx={8} ry={8} width={pillW} height={pillH}
          fill="rgba(0,0,0,0.28)" filter={`url(#${labelBlurId})`} />
        {/* main gradient body */}
        <rect x={-pillW / 2} y={-pillH / 2} rx={8} ry={8} width={pillW} height={pillH}
          fill={`url(#${labelGradId})`} />
        {/* top highlight (bevel) */}
        <rect x={-pillW / 2 + 1.5} y={-pillH / 2 + 1.5} rx={7} ry={7} width={pillW - 3} height={pillH / 2 - 1}
          fill="rgba(255,255,255,0.45)" />
        {/* bottom shade */}
        <rect x={-pillW / 2 + 1.5} y={1} rx={7} ry={7} width={pillW - 3} height={pillH / 2 - 2}
          fill="rgba(0,0,0,0.18)" />
        {/* crisp border */}
        <rect x={-pillW / 2} y={-pillH / 2} rx={8} ry={8} width={pillW} height={pillH}
          fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth={0.9} />
        <text x={0} y={0} textAnchor="middle" transform="rotate(-90)"
          dominantBaseline="middle"
          style={{ fontSize: 10, fontWeight: 800, fill: "#fff", letterSpacing: 0.3, paintOrder: "stroke", stroke: "rgba(0,0,0,0.55)", strokeWidth: 0.6 }}>
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
        <Card className="p-3 border-border/40 bg-card/30 backdrop-blur-md shadow-sm">
          <style>{`
            @keyframes bubbleRise {
              0%   { transform: translateY(0) scale(0.6); opacity: 0; }
              15%  { opacity: 0.85; }
              80%  { opacity: 0.7; }
              100% { transform: translateY(var(--rise, -60px)) scale(1); opacity: 0; }
            }
            .bubble { transform-origin: center; animation: bubbleRise 2.6s ease-in-out infinite; }
          `}</style>
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
        <Card className="p-4 border-border/40 bg-card/30 backdrop-blur-md shadow-sm">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="text-sm font-semibold text-muted-foreground">{t("tripChart")}</div>
            <div className="inline-flex rounded-md border border-border/60 bg-muted p-0.5 text-xs">
              {(["tripCount", "deposit", "debit", "balance"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setChartMode(m)}
                  className={`px-3 py-1 rounded transition-colors ${chartMode === m ? "bg-background text-foreground" : "text-muted-foreground hover:bg-background hover:text-foreground"}`}
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
                    <Tooltip cursor={false} contentStyle={{ background: "color-mix(in oklab, var(--card) 70%, transparent)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, backdropFilter: "blur(6px)" }} formatter={(v: any) => fmtNum(Number(v), lang)} />
                    <Bar
                      dataKey="value"
                      fill={`url(#${gradId})`}
                      radius={[6, 6, 0, 0]}
                      onClick={(d: any) => setActiveBar((prev) => (prev === d?.name ? null : d?.name))}
                      shape={(props: any) => {
                        const { x, y, width, height, payload } = props;
                        const isActive = payload?.name === activeBar;
                        // Bubbles always rise gently inside the bar; more on active.
                        const count = isActive ? 7 : 4;
                        const clipId = `clip-${payload?.name}-${chartMode}`;
                        const bubbles = Array.from({ length: count }).map((_, i) => {
                          const seed = (i * 9301 + 49297) % 233280;
                          const rand = seed / 233280;
                          const cxOff = (rand - 0.5) * (width * 0.7);
                          const r = 1.6 + ((i * 1.7) % 3);
                          const rise = -(height - 8);
                          const delay = (i * 0.35) % 2.6;
                          return (
                            <circle
                              key={i}
                              cx={x + width / 2 + cxOff}
                              cy={y + height - 4}
                              r={r}
                              fill="rgba(255,255,255,0.55)"
                              stroke="rgba(255,255,255,0.85)"
                              strokeWidth={0.4}
                              className="bubble"
                              style={{ ["--rise" as any]: `${rise}px`, animationDelay: `${delay}s` }}
                            />
                          );
                        });
                        return (
                          <g style={{ cursor: "pointer" }}>
                            <clipPath id={clipId}>
                              <rect x={x} y={y} width={width} height={height} rx={6} ry={6} />
                            </clipPath>
                            <rect x={x} y={y} width={width} height={height} rx={6} ry={6} fill={`url(#${gradId})`} />
                            <g clipPath={`url(#${clipId})`}>{bubbles}</g>
                          </g>
                        );
                      }}

                    >
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
              return tiles.filter((tile) => (!("adminOnly" in tile) || !tile.adminOnly || isAdmin) && (!("writeOnly" in tile) || !tile.writeOnly || canWrite || isOwner)).map((tile, i) => {
                const Icon = tile.icon;
                const tone = tones[i % tones.length];
                return (
                  <Link
                    key={`${tile.to}-${tile.key}`}
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
            <button
              type="button"
              onClick={() => setLinksOpen(true)}
              className="tile-3d tile-amber group relative overflow-hidden p-5 transition-all hover:-translate-y-0.5 hover:shadow-md text-left"
            >
              <div className="flex items-center justify-center w-11 h-11 rounded-lg bg-primary/15 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all mb-3">
                <LinkIcon className="h-5 w-5" />
              </div>
              <div className="font-medium text-sm text-foreground">{t("addLink")}</div>
            </button>
          </div>

          {links.length > 0 && (
            <div className="mt-6">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{t("customLinks")}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {links.map((l) => (
                  <a
                    key={l.id}
                    href={l.url}
                    target="_blank"
                    rel="noreferrer"
                    className="tile-3d tile-cyan group relative overflow-hidden p-4 transition-all hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/15 text-primary mb-2">
                      <ExternalLink className="h-4 w-4" />
                    </div>
                    <div className="font-medium text-sm text-foreground truncate">{l.label}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{l.url}</div>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        <LinksDialog
          open={linksOpen}
          onOpenChange={setLinksOpen}
          links={links}
          onChange={updateLinks}
          t={t}
        />
      </div>
    </AppLayout>
  );
}

function MiniStat({ label, value, tone = "blue", highlight }: { label: string; value: string; tone?: "blue"|"mint"|"peach"|"lavender"|"pink"|"cyan"|"amber"; highlight?: boolean }) {
  const toneText: Record<string, string> = {
    blue: "text-sky-600 dark:text-sky-400",
    mint: "text-emerald-600 dark:text-emerald-400",
    peach: "text-orange-600 dark:text-orange-400",
    lavender: "text-violet-600 dark:text-violet-400",
    pink: "text-rose-600 dark:text-rose-400",
    cyan: "text-cyan-600 dark:text-cyan-400",
    amber: "text-amber-600 dark:text-amber-400",
  };
  return (
    <div className={`tile-3d tile-${tone} p-3 ${highlight ? "ring-2 ring-primary/50" : ""}`}>
      <div className="text-[10px] uppercase text-foreground/60 mb-1 font-semibold tracking-wide">{label}</div>
      <div className={`text-base md:text-lg font-extrabold ${toneText[tone]}`}>{value}</div>
    </div>
  );
}

function LinksDialog({
  open, onOpenChange, links, onChange, t,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  links: CustomLink[];
  onChange: (next: CustomLink[]) => void;
  t: (k: any) => string;
}) {
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const add = () => {
    const trimmedLabel = label.trim();
    let trimmedUrl = url.trim();
    if (!trimmedLabel || !trimmedUrl) return;
    if (!/^https?:\/\//i.test(trimmedUrl)) trimmedUrl = `https://${trimmedUrl}`;
    onChange([...links, { id: crypto.randomUUID(), label: trimmedLabel, url: trimmedUrl }]);
    setLabel(""); setUrl("");
  };
  const remove = (id: string) => onChange(links.filter((l) => l.id !== id));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{t("manageLinks")}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-2">
            <Input placeholder={t("linkLabel")} value={label} onChange={(e) => setLabel(e.target.value)} />
            <Input placeholder={t("linkUrl")} value={url} onChange={(e) => setUrl(e.target.value)} />
            <Button onClick={add} type="button"><Plus className="h-4 w-4 mr-1" />{t("addLink")}</Button>
          </div>
          <div className="border-t pt-3 space-y-1 max-h-64 overflow-y-auto">
            {links.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">{t("noLinks")}</p>
            ) : links.map((l) => (
              <div key={l.id} className="flex items-center justify-between gap-2 rounded px-2 py-1.5 border border-border/40 bg-card/40">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{l.label}</div>
                  <a href={l.url} target="_blank" rel="noreferrer" className="text-[10px] text-primary truncate block hover:underline">{l.url}</a>
                </div>
                <Button variant="ghost" size="icon" onClick={() => remove(l.id)} aria-label="delete">
                  <Trash2 className="h-4 w-4 text-rose-500" />
                </Button>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("cancel")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
