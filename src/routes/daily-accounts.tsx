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
import { Plus } from "lucide-react";

export const Route = createFileRoute("/daily-accounts")({
  component: DailyAccountsPage,
});

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
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Trip | null>(null);
  const [search, setSearch] = useState("");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["trips"],
    queryFn: async () => {
      const { data, error } = await supabase.from("trips").select("*").order("trip_date", { ascending: false }).order("serial_no", { ascending: true }).limit(500);
      if (error) throw error;
      return (data ?? []) as Trip[];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("trips").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["trips"] }); toast.success(t("deleted")); },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = rows.filter((r) =>
    !search || r.vehicle_no.toLowerCase().includes(search.toLowerCase()) || r.supervisor?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{t("dailyAccounts")}</h1>
            <p className="text-sm text-muted-foreground">{t("brand")}</p>
          </div>
          <Button onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />{t("add")}
          </Button>
        </div>

        <Input placeholder={t("search")} value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />

        <DataTable<Trip>
          rows={isLoading ? [] : filtered}
          columns={[
            { key: "serial_no", header: t("serial"), render: (r) => fmtNum(r.serial_no, lang) },
            { key: "trip_date", header: t("date"), render: (r) => fmtDate(r.trip_date, lang) },
            { key: "vehicle_no", header: t("vehicleNo") },
            { key: "jama_1", header: t("jamaTotal"), render: (r) => fmtNum(Number(r.jama_1) + Number(r.jama_2), lang) },
            { key: "dena_1", header: t("denaTotal"), render: (r) => fmtNum(Number(r.dena_1) + Number(r.dena_2), lang) },
            { key: "fare_1", header: t("fareTotal"), render: (r) => fmtNum(Number(r.fare_1) + Number(r.fare_2), lang) },
            { key: "route_1", header: t("route"), render: (r) => [r.route_1, r.route_2].filter(Boolean).join(" / ") || "-" },
            { key: "supervisor", header: t("supervisor") },
          ]}
          onEdit={(r) => { setEditing(r); setOpen(true); }}
          onDelete={(r) => del.mutate(r.id)}
          emptyText={isLoading ? t("loading") : t("noData")}
        />
      </div>

      <TripDialog open={open} onOpenChange={setOpen} editing={editing} lastDate={rows[0]?.trip_date} />
    </AppLayout>
  );
}

type VRow = { vehicle_no: string };
type RouteOpt = { vehicle_id: string; name: string; fare: number };

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
  const [route1, setRoute1] = useState(editing?.route_1 ?? "");
  const [route2, setRoute2] = useState(editing?.route_2 ?? "");
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
      const { data } = await supabase.from("vehicle_routes").select("vehicle_id,name,fare");
      return (data ?? []) as RouteOpt[];
    },
  });

  // when dialog opens, reset
  useEffect(() => {
    if (open) {
      setTripDate(editing?.trip_date ?? lastDate ?? today);
      setVehicleNo(editing?.vehicle_no ?? "");
      const v = vehicles.find((x) => x.vehicle_no === (editing?.vehicle_no ?? ""));
      setVehicleId(v?.id ?? "");
      setJama1(editing?.jama_1 ?? "");
      setJama2(editing?.jama_2 ?? "");
      setDena1(editing?.dena_1 ?? "");
      setDena2(editing?.dena_2 ?? "");
      setRoute1(editing?.route_1 ?? "");
      setRoute2(editing?.route_2 ?? "");
      setFare1(editing?.fare_1 ?? "");
      setFare2(editing?.fare_2 ?? "");
      setSupervisor(editing?.supervisor ?? "");
    }
  }, [open, editing, vehicles, lastDate, today]);

  const vehicleRoutes = useMemo(
    () => allRoutes.filter((r) => r.vehicle_id === vehicleId),
    [allRoutes, vehicleId],
  );

  const pickVehicle = (vid: string) => {
    setVehicleId(vid);
    const v = vehicles.find((x) => x.id === vid);
    setVehicleNo(v?.vehicle_no ?? "");
    setRoute1(""); setRoute2(""); setFare1(""); setFare2("");
  };
  const pickRoute = (which: 1 | 2, name: string) => {
    const r = vehicleRoutes.find((x) => x.name === name);
    if (which === 1) { setRoute1(name); setFare1(r ? r.fare : ""); }
    else { setRoute2(name); setFare2(r ? r.fare : ""); }
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["trips"] }); toast.success(t("saved")); onOpenChange(false); },
    onError: (e: any) => toast.error(e.message),
  });

  // software-style: label row + input row
  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
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
              <Input value={supervisor} onChange={(e) => setSupervisor(e.target.value)} className="h-10" />
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-lg border border-border/60 p-3 bg-card/40">
            <div className="space-y-2">
              <Field label={t("route1")}>
                <select value={route1} onChange={(e) => pickRoute(1, e.target.value)} disabled={!vehicleId} className="h-10 w-full rounded-md border border-input bg-input px-3 text-sm disabled:opacity-50">
                  <option value="">— {t("selectRoute")} —</option>
                  {vehicleRoutes.map((r) => (
                    <option key={r.name} value={r.name} className="bg-card">{r.name}</option>
                  ))}
                </select>
              </Field>
              <Field label={t("fare1")}>
                <Input type="number" step="any" value={fare1} onChange={(e) => setFare1(e.target.value === "" ? "" : Number(e.target.value))} className="h-10" />
              </Field>
            </div>
            <div className="space-y-2">
              <Field label={t("route2")}>
                <select value={route2} onChange={(e) => pickRoute(2, e.target.value)} disabled={!vehicleId} className="h-10 w-full rounded-md border border-input bg-input px-3 text-sm disabled:opacity-50">
                  <option value="">— {t("selectRoute")} —</option>
                  {vehicleRoutes.map((r) => (
                    <option key={r.name} value={r.name} className="bg-card">{r.name}</option>
                  ))}
                </select>
              </Field>
              <Field label={t("fare2")}>
                <Input type="number" step="any" value={fare2} onChange={(e) => setFare2(e.target.value === "" ? "" : Number(e.target.value))} className="h-10" />
              </Field>
            </div>
          </div>

          {/* live calc preview */}
          <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground rounded-md border border-dashed border-border/60 px-3 py-2">
            <div>{t("jamaTotal")}: <span className="text-emerald-400 font-semibold">{Number(jama1 || 0) + Number(jama2 || 0)}</span></div>
            <div>{t("denaTotal")}: <span className="text-rose-400 font-semibold">{Number(dena1 || 0) + Number(dena2 || 0)}</span></div>
            <div>{t("balance")}: <span className="text-primary font-semibold">{Number(jama1 || 0) + Number(jama2 || 0) - Number(dena1 || 0) - Number(dena2 || 0)}</span></div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("cancel")}</Button>
            <Button type="submit" disabled={save.isPending}>{t("save")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
