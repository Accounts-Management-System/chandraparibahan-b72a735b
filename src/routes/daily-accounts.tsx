import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { DataTable } from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useT, fmtNum, fmtDate } from "@/lib/i18n";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, FileDown } from "lucide-react";
import { SearchFilters, emptyFilters, matchesFilters, type FilterState } from "@/components/SearchFilters";
import { useRole } from "@/lib/useRole";
import { exportPdf } from "@/lib/exportPdf";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/daily-accounts")({
  component: DailyAccountsPage,
});

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

type Trip = {
  id: string;
  serial_no: number | null;
  trip_date: string;
  vehicle_no: string;
  jama_1: number; jama_2: number;
  dena_1: number; dena_2: number;
  fare_1: number; fare_2: number;
  route_1: string | null;
  route_2: string | null;
  supervisor: string | null;
};

function DailyAccountsPage() {
  const { t, lang } = useT();
  const qc = useQueryClient();
  const { canWrite } = useRole();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Trip | null>(null);
  const [filters, setFilters] = useState<FilterState>(emptyFilters);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["trips"],
    queryFn: async () => {
      const { data, error } = await supabase.from("trips").select("*").order("trip_date", { ascending: false }).order("serial_no", { ascending: true, nullsFirst: false }).order("created_at", { ascending: true }).limit(1000);
      if (error) throw error;
      return (data ?? []) as Trip[];
    },
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("trips").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["trips"] }); toast.success(t("deleted")); },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = useMemo(
    () => rows.filter((r) => matchesFilters({ date: r.trip_date, vehicle_no: r.vehicle_no }, filters)),
    [rows, filters],
  );
  const totalJama = filtered.reduce((s, r) => s + Number(r.jama_1 || 0) + Number(r.jama_2 || 0), 0);
  const totalDena = filtered.reduce((s, r) => s + Number(r.dena_1 || 0) + Number(r.dena_2 || 0), 0);
  const totalBalance = totalJama - totalDena;

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{t("dailyAccounts")}</h1>
            <p className="text-sm text-muted-foreground">{t("brand")}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => exportPdf({
              title: t("dailyAccounts"),
              subtitle: `${t("total")}: ${fmtNum(filtered.length, lang)} · ${t("jamaTotal")}: ${fmtNum(totalJama, lang)} · ${t("denaTotal")}: ${fmtNum(totalDena, lang)} · ${t("balance")}: ${fmtNum(totalBalance, lang)}`,
              headers: [t("serial"), t("date"), t("vehicleNo"), t("jamaTotal"), t("denaTotal"), t("balance"), t("fareTotal"), t("supervisor")],
              rows: filtered.map((r) => [
                fmtNum(r.serial_no, lang), fmtDate(r.trip_date, lang), r.vehicle_no,
                fmtNum(Number(r.jama_1) + Number(r.jama_2), lang),
                fmtNum(Number(r.dena_1) + Number(r.dena_2), lang),
                fmtNum(Number(r.jama_1) + Number(r.jama_2) - Number(r.dena_1) - Number(r.dena_2), lang),
                fmtNum(Number(r.fare_1) + Number(r.fare_2), lang),
                r.supervisor ?? "-",
              ]),
            })}>
              <FileDown className="h-4 w-4 mr-2" />{t("exportPdf")}
            </Button>
            {canWrite && (
              <Button onClick={() => { setEditing(null); setOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" />{t("add")}
              </Button>
            )}
          </div>
        </div>

        <SearchFilters value={filters} onChange={setFilters} show={{ date: true, vehicle: true }} />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className="rounded-lg border border-border/50 bg-card/60 p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("total")}</div>
            <div className="text-2xl font-bold mt-1">{fmtNum(filtered.length, lang)}</div>
          </div>
          <div className="rounded-lg border border-border/50 bg-card/60 p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("jamaTotal")}</div>
            <div className="text-2xl font-bold mt-1 text-emerald-400">{fmtNum(totalJama, lang)}</div>
          </div>
          <div className="rounded-lg border border-border/50 bg-card/60 p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("denaTotal")}</div>
            <div className="text-2xl font-bold mt-1 text-rose-400">{fmtNum(totalDena, lang)}</div>
          </div>
          <div className="rounded-lg border border-border/50 bg-card/60 p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("balance")}</div>
            <div className="text-2xl font-bold mt-1 text-primary">{fmtNum(totalBalance, lang)}</div>
          </div>
        </div>

        <DataTable<Trip>
          rows={isLoading ? [] : filtered}
          columns={[
            { key: "serial_no", header: t("serial"), render: (r) => fmtNum(r.serial_no, lang) },
            { key: "trip_date", header: t("date"), render: (r) => fmtDate(r.trip_date, lang) },
            { key: "vehicleNo", header: t("vehicleNo"), render: (r) => r.vehicle_no },
            { key: "jama_1", header: t("jamaTotal"), render: (r) => fmtNum(Number(r.jama_1) + Number(r.jama_2), lang) },
            { key: "dena_1", header: t("denaTotal"), render: (r) => fmtNum(Number(r.dena_1) + Number(r.dena_2), lang) },
            { key: "balance", header: t("balance"), render: (r) => fmtNum(Number(r.jama_1) + Number(r.jama_2) - Number(r.dena_1) - Number(r.dena_2), lang) },
            { key: "fare_1", header: t("fareTotal"), render: (r) => fmtNum(Number(r.fare_1) + Number(r.fare_2), lang) },
            { key: "supervisor", header: t("supervisor") },
          ]}
          onEdit={canWrite ? (r) => { setEditing(r); setOpen(true); } : undefined}
          onDelete={canWrite ? (r) => del.mutate(r.id) : undefined}
          emptyText={isLoading ? t("loading") : t("noData")}
        />
      </div>

      <TripDialog open={open} onOpenChange={setOpen} editing={editing} lastDate={rows[0]?.trip_date} />
    </AppLayout>
  );
}

type VRow = { vehicle_no: string };
type RouteOpt = { name: string; fare: number };

function TripDialog({
  open, onOpenChange, editing, lastDate,
}: { open: boolean; onOpenChange: (v: boolean) => void; editing: Trip | null; lastDate?: string }) {
  const { t } = useT();
  const qc = useQueryClient();

  const today = new Date().toISOString().slice(0, 10);
  const defaultDate = editing?.trip_date ?? lastDate ?? today;

  const [tripDate, setTripDate] = useState(defaultDate);
  const [vehicleId, setVehicleId] = useState<string>("");
  const [vehicleNo, setVehicleNo] = useState(editing?.vehicle_no ?? "");
  const [jama1, setJama1] = useState<number | "">(editing?.jama_1 ?? "");
  const [jama2, setJama2] = useState<number | "">(editing?.jama_2 ?? "");
  const [dena1, setDena1] = useState<number | "">(editing?.dena_1 ?? "");
  const [dena2, setDena2] = useState<number | "">(editing?.dena_2 ?? "");
  const [fare1, setFare1] = useState<number | "">(editing?.fare_1 ?? "");
  const [fare2, setFare2] = useState<number | "">(editing?.fare_2 ?? "");
  const [supervisor, setSupervisor] = useState(editing?.supervisor ?? "");

  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles-with-routes"],
    queryFn: async () => {
      const { data } = await supabase.from("vehicles").select("id,vehicle_no").order("vehicle_no");
      return (data ?? []) as (VRow & { id: string })[];
    },
  });
  const { data: allRoutes = [] } = useQuery({
    queryKey: ["all-routes"],
    queryFn: async () => {
      const { data } = await supabase.from("vehicle_routes").select("name,fare");
      return (data ?? []) as RouteOpt[];
    },
  });

  // Last entered trip (for prefill defaults when adding new)
  const { data: lastTrip } = useQuery({
    queryKey: ["last-trip"],
    queryFn: async () => {
      const { data } = await supabase.from("trips").select("*").order("created_at", { ascending: false }).limit(1).maybeSingle();
      return (data ?? null) as Trip | null;
    },
  });

  const { data: supervisors = [] } = useQuery({
    queryKey: ["entry_lookups", "supervisor"],
    queryFn: async () => {
      const { data } = await supabase
        .from("entry_lookups")
        .select("value")
        .eq("kind", "supervisor")
        .order("value");
      return ((data ?? []) as { value: string }[]).map((r) => r.value);
    },
  });

  const applyDefaults = (source: Trip | null) => {
    setTripDate(source?.trip_date ?? today);
    const vNo = source?.vehicle_no ?? "";
    setVehicleNo(vNo);
    const v = vehicles.find((x) => x.vehicle_no === vNo);
    setVehicleId(v?.id ?? "");
    setJama1(source?.jama_1 ?? "");
    setJama2(source?.jama_2 ?? "");
    setDena1(source?.dena_1 ?? "");
    setDena2(source?.dena_2 ?? "");
    setFare1(source?.fare_1 ?? "");
    setFare2(source?.fare_2 ?? "");
    setSupervisor(source?.supervisor ?? "");
  };

  const clearForm = () => {
    setTripDate(today);
    setVehicleId(""); setVehicleNo("");
    setJama1(""); setJama2(""); setDena1(""); setDena2("");
    setFare1(""); setFare2("");
    setSupervisor("");
  };

  // when dialog opens, prefill from editing or last entry
  useEffect(() => {
    if (open) {
      applyDefaults(editing ?? lastTrip ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing, vehicles, lastTrip]);

  // Auto-derive route name aligned to fare amount (Excel VLOOKUP-style)
  const matchRoute = (f: number | "") => {
    const n = Number(f || 0);
    if (!n) return "";
    const hit = allRoutes.find((r) => Number(r.fare) === n);
    return hit?.name ?? "";
  };
  const route1 = matchRoute(fare1);
  const route2 = matchRoute(fare2);
  const routeTotal = matchRoute((Number(fare1 || 0) + Number(fare2 || 0)) as number);

  const pickVehicle = (vid: string) => {
    setVehicleId(vid);
    const v = vehicles.find((x) => x.id === vid);
    setVehicleNo(v?.vehicle_no ?? "");
  };


  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        trip_date: tripDate,
        vehicle_no: vehicleNo,
        jama_1: Number(jama1 || 0),
        jama_2: Number(jama2 || 0),
        dena_1: Number(dena1 || 0),
        dena_2: Number(dena2 || 0),
        route_1: route1 || null,
        route_2: route2 || null,
        fare_1: Number(fare1 || 0),
        fare_2: Number(fare2 || 0),
        supervisor: supervisor || null,
      };
      if (editing) {
        const { error } = await supabase.from("trips").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("trips").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["trips"] }); qc.invalidateQueries({ queryKey: ["last-trip"] }); toast.success(t("saved")); onOpenChange(false); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{t("dailyAccounts")}</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Field label={t("date")}>
              <Input type="date" value={tripDate} onChange={(e) => setTripDate(e.target.value)} required className="h-10" />
            </Field>
            <Field label={t("vehicleNo")}>
              <select value={vehicleId} onChange={(e) => pickVehicle(e.target.value)} required className="h-10 w-full rounded-md border border-input bg-input px-3 text-sm">
                <option value="">— {t("selectVehicle")} —</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id} className="bg-card">{v.vehicle_no}</option>
                ))}
              </select>
            </Field>
            <Field label={t("supervisor")}>
              <Select value={supervisor || undefined} onValueChange={setSupervisor}>
                <SelectTrigger className="h-10 w-full">
                  <SelectValue placeholder={t("selectSupervisor")} />
                </SelectTrigger>
                <SelectContent>
                  {supervisors.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 rounded-lg border border-border/60 p-3 bg-card/40">
            <Field label={t("jama1")}>
              <Input type="number" step="any" value={jama1} onChange={(e) => setJama1(e.target.value === "" ? "" : Number(e.target.value))} className="h-10" />
            </Field>
            <Field label={t("jama2")}>
              <Input type="number" step="any" value={jama2} onChange={(e) => setJama2(e.target.value === "" ? "" : Number(e.target.value))} className="h-10" />
            </Field>
            <Field label={t("dena1")}>
              <Input type="number" step="any" value={dena1} onChange={(e) => setDena1(e.target.value === "" ? "" : Number(e.target.value))} className="h-10" />
            </Field>
            <Field label={t("dena2")}>
              <Input type="number" step="any" value={dena2} onChange={(e) => setDena2(e.target.value === "" ? "" : Number(e.target.value))} className="h-10" />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3 rounded-lg border border-border/60 p-3 bg-card/40">
            <Field label={t("fare1")}>
              <Input type="number" step="any" value={fare1} onChange={(e) => setFare1(e.target.value === "" ? "" : Number(e.target.value))} className="h-10" />
            </Field>
            <Field label={t("fare2")}>
              <Input type="number" step="any" value={fare2} onChange={(e) => setFare2(e.target.value === "" ? "" : Number(e.target.value))} className="h-10" />
            </Field>
          </div>

          {/* live calc preview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-muted-foreground rounded-md border border-dashed border-border/60 px-3 py-2">
            <div>{t("jamaTotal")}: <span className="text-emerald-400 font-semibold">{Number(jama1 || 0) + Number(jama2 || 0)}</span></div>
            <div>{t("denaTotal")}: <span className="text-rose-400 font-semibold">{Number(dena1 || 0) + Number(dena2 || 0)}</span></div>
            <div>{t("balance")}: <span className="text-primary font-semibold">{Number(jama1 || 0) + Number(jama2 || 0) - Number(dena1 || 0) - Number(dena2 || 0)}</span></div>
            <div>{t("fareTotal")}: <span className="text-primary font-semibold">{Number(fare1 || 0) + Number(fare2 || 0)}</span></div>
          </div>
          {/* hidden auto route values — saved silently with the trip */}
          <input type="hidden" value={route1} readOnly />
          <input type="hidden" value={route2} readOnly />
          <input type="hidden" value={routeTotal} readOnly />



          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={clearForm}>{t("clearForm")}</Button>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>{t("cancel")}</Button>
            <Button type="submit" disabled={save.isPending}>
              {editing ? t("update") : t("submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
