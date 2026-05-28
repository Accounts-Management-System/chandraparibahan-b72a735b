import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useT, fmtNum } from "@/lib/i18n";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CategorySelect, HeadSelect } from "@/components/CategoryHeadSelect";

export type FilterState = {
  dateFrom: string;
  dateTo: string;
  vehicleNo: string;
  ownerId: string;
  category: string;
  head: string;
};

export const emptyFilters: FilterState = {
  dateFrom: "",
  dateTo: "",
  vehicleNo: "",
  ownerId: "",
  category: "",
  head: "",
};

type Props = {
  value: FilterState;
  onChange: (next: FilterState) => void;
  show?: {
    date?: boolean;
    vehicle?: boolean;
    owner?: boolean;
    category?: boolean;
    head?: boolean;
  };
};

export function SearchFilters({ value, onChange, show = {} }: Props) {
  const { t } = useT();
  const set = (patch: Partial<FilterState>) => onChange({ ...value, ...patch });
  const cfg = { date: true, vehicle: true, owner: false, category: false, head: false, ...show };

  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles-filter"],
    queryFn: async () =>
      (await supabase.from("vehicles").select("vehicle_no").order("vehicle_no")).data ?? [],
    enabled: cfg.vehicle,
  });
  const { data: owners = [] } = useQuery({
    queryKey: ["owners-filter"],
    queryFn: async () =>
      (await supabase.from("owners").select("id,name").order("name")).data ?? [],
    enabled: cfg.owner,
  });

  return (
    <Card className="p-3 border-border/50 bg-card/60 backdrop-blur">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
        {cfg.date && (
          <>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("from")}</span>
              <Input type="date" value={value.dateFrom} onChange={(e) => set({ dateFrom: e.target.value })} className="h-9" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("to")}</span>
              <Input type="date" value={value.dateTo} onChange={(e) => set({ dateTo: e.target.value })} className="h-9" />
            </label>
          </>
        )}
        {cfg.vehicle && (
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("vehicleNo")}</span>
            <select value={value.vehicleNo} onChange={(e) => set({ vehicleNo: e.target.value })} className="h-9 rounded-md border border-input bg-input px-2 text-sm">
              <option value="">{t("all")}</option>
              {(vehicles as { vehicle_no: string }[]).map((v) => (
                <option key={v.vehicle_no} value={v.vehicle_no} className="bg-card">{v.vehicle_no}</option>
              ))}
            </select>
          </label>
        )}
        {cfg.owner && (
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("owner")}</span>
            <select value={value.ownerId} onChange={(e) => set({ ownerId: e.target.value })} className="h-9 rounded-md border border-input bg-input px-2 text-sm">
              <option value="">{t("all")}</option>
              {(owners as { id: string; name: string }[]).map((o) => (
                <option key={o.id} value={o.id} className="bg-card">{o.name}</option>
              ))}
            </select>
          </label>
        )}
        {cfg.category && (
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("category")}</span>
            <CategorySelect value={value.category} onChange={(v) => set({ category: v, head: "" })} />
          </label>
        )}
        {cfg.head && (
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("head")}</span>
            <HeadSelect category={value.category} value={value.head} onChange={(v) => set({ head: v })} />
          </label>
        )}
      </div>
    </Card>
  );
}

export function MiniDashboard({
  tripCount,
  totalAmount,
  lang,
  showTrips = true,
  showAmount = true,
  showCount = false,
  countLabel,
}: {
  tripCount?: number;
  totalAmount?: number;
  lang: "bn" | "en";
  showTrips?: boolean;
  showAmount?: boolean;
  showCount?: boolean;
  countLabel?: string;
}) {
  const { t } = useT();
  return (
    <div className="grid grid-cols-2 gap-2">
      {showTrips && (
        <Card className="p-3 border-border/50 bg-card/60">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("tripCount")}</div>
          <div className="text-2xl font-bold mt-1">{fmtNum(tripCount ?? 0, lang)}</div>
        </Card>
      )}
      {showCount && (
        <Card className="p-3 border-border/50 bg-card/60">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{countLabel ?? t("total")}</div>
          <div className="text-2xl font-bold mt-1">{fmtNum(tripCount ?? 0, lang)}</div>
        </Card>
      )}
      {showAmount && (
        <Card className="p-3 border-border/50 bg-card/60">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("total")}</div>
          <div className="text-2xl font-bold mt-1 text-primary">{fmtNum(totalAmount ?? 0, lang)}</div>
        </Card>
      )}
    </div>
  );
}

export function matchesFilters(
  row: { date: string; vehicle_no?: string | null; category?: string | null; head?: string | null },
  f: FilterState,
): boolean {
  if (f.dateFrom && row.date < f.dateFrom) return false;
  if (f.dateTo && row.date > f.dateTo) return false;
  if (f.vehicleNo && row.vehicle_no !== f.vehicleNo) return false;
  if (f.category && row.category !== f.category) return false;
  if (f.head && row.head !== f.head) return false;
  return true;
}
