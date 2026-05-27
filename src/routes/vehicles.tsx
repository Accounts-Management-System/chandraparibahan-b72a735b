import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { DataTable } from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useT, fmtNum } from "@/lib/i18n";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, X, Check } from "lucide-react";

export const Route = createFileRoute("/vehicles")({ component: Page });

type Vehicle = { id: string; vehicle_no: string; owner_name: string | null };
type RouteRow = { id: string; vehicle_id: string; name: string; fare: number };

function Page() {
  const { t, lang } = useT();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["vehicles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vehicles").select("id,vehicle_no,owner_name").order("vehicle_no");
      if (error) throw error;
      return data as Vehicle[];
    },
  });

  const { data: routesByVehicle = {} } = useQuery({
    queryKey: ["vehicle_routes_all"],
    queryFn: async () => {
      const { data } = await supabase.from("vehicle_routes").select("*");
      const map: Record<string, RouteRow[]> = {};
      (data ?? []).forEach((r: any) => {
        (map[r.vehicle_id] ||= []).push(r);
      });
      return map;
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vehicles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vehicles"] });
      qc.invalidateQueries({ queryKey: ["vehicle_routes_all"] });
      toast.success(t("deleted"));
    },
  });

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{t("vehicles")}</h1>
          <Button onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />{t("add")}
          </Button>
        </div>
        <DataTable<Vehicle>
          rows={isLoading ? [] : rows}
          columns={[
            { key: "vehicle_no", header: t("vehicleNo") },
            { key: "owner_name", header: t("owner") },
            {
              key: "id",
              header: t("routes"),
              render: (r) => {
                const list = routesByVehicle[r.id] ?? [];
                if (!list.length) return <span className="text-muted-foreground">-</span>;
                return (
                  <div className="flex flex-wrap gap-1">
                    {list.map((rt) => (
                      <span key={rt.id} className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs border border-primary/20">
                        {rt.name} · {fmtNum(rt.fare, lang)}
                      </span>
                    ))}
                  </div>
                );
              },
            },
          ]}
          onEdit={(r) => { setEditing(r); setOpen(true); }}
          onDelete={(r) => { if (confirm(t("confirmDelete"))) del.mutate(r.id); }}
          emptyText={isLoading ? t("loading") : t("noData")}
        />
      </div>
      <VehicleDialog open={open} onOpenChange={setOpen} editing={editing} />
    </AppLayout>
  );
}

function VehicleDialog({
  open, onOpenChange, editing,
}: { open: boolean; onOpenChange: (v: boolean) => void; editing: Vehicle | null }) {
  const { t, lang } = useT();
  const qc = useQueryClient();

  // local copy so we can switch from "create" to "edit" after first save
  const [vehicle, setVehicle] = useState<Vehicle | null>(editing);
  const [vehicleNo, setVehicleNo] = useState("");
  const [ownerName, setOwnerName] = useState("");

  useEffect(() => {
    if (open) {
      setVehicle(editing);
      setVehicleNo(editing?.vehicle_no ?? "");
      setOwnerName(editing?.owner_name ?? "");
    }
  }, [open, editing]);

  const saveVehicle = useMutation({
    mutationFn: async () => {
      if (vehicle) {
        const { data, error } = await supabase.from("vehicles")
          .update({ vehicle_no: vehicleNo, owner_name: ownerName || null })
          .eq("id", vehicle.id).select().single();
        if (error) throw error;
        return data as Vehicle;
      } else {
        const { data, error } = await supabase.from("vehicles")
          .insert({ vehicle_no: vehicleNo, owner_name: ownerName || null })
          .select().single();
        if (error) throw error;
        return data as Vehicle;
      }
    },
    onSuccess: (v) => {
      setVehicle(v);
      qc.invalidateQueries({ queryKey: ["vehicles"] });
      toast.success(t("saved"));
    },
    onError: (e: any) => toast.error(e.message),
  });

  const clearVehicleForm = () => {
    setVehicleNo(""); setOwnerName("");
  };

  // Routes for this vehicle
  const { data: routes = [] } = useQuery({
    queryKey: ["vehicle_routes", vehicle?.id],
    enabled: !!vehicle?.id,
    queryFn: async () => {
      const { data } = await supabase.from("vehicle_routes").select("*").eq("vehicle_id", vehicle!.id).order("name");
      return (data ?? []) as RouteRow[];
    },
  });

  const [routeName, setRouteName] = useState("");
  const [routeFare, setRouteFare] = useState<number | "">("");
  const [editingRouteId, setEditingRouteId] = useState<string | null>(null);

  const clearRouteForm = () => {
    setRouteName(""); setRouteFare(""); setEditingRouteId(null);
  };

  const saveRoute = useMutation({
    mutationFn: async () => {
      if (!vehicle) throw new Error(t("selectVehicle"));
      if (!routeName.trim()) throw new Error(t("routeName"));
      const payload = { vehicle_id: vehicle.id, name: routeName.trim(), fare: Number(routeFare || 0) };
      if (editingRouteId) {
        const { error } = await supabase.from("vehicle_routes").update(payload).eq("id", editingRouteId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("vehicle_routes").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vehicle_routes", vehicle?.id] });
      qc.invalidateQueries({ queryKey: ["vehicle_routes_all"] });
      toast.success(t("saved"));
      clearRouteForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteRoute = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vehicle_routes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vehicle_routes", vehicle?.id] });
      qc.invalidateQueries({ queryKey: ["vehicle_routes_all"] });
      toast.success(t("deleted"));
      clearRouteForm();
    },
  });

  const startEditRoute = (r: RouteRow) => {
    setEditingRouteId(r.id);
    setRouteName(r.name);
    setRouteFare(r.fare);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>{t("vehicles")}</DialogTitle></DialogHeader>

        <div className="space-y-5">
          {/* A) Vehicle form */}
          <form
            onSubmit={(e) => { e.preventDefault(); saveVehicle.mutate(); }}
            className="space-y-3 rounded-lg border border-border/60 p-3 bg-card/40"
          >
            <h3 className="text-sm font-semibold tracking-wide text-primary">{t("vehicleInfo")}</h3>
            <div className="grid grid-cols-2 gap-3">
              <Input value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value)} placeholder={t("vehicleNo")} required className="h-10" />
              <Input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder={t("owner")} className="h-10" />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={clearVehicleForm}>{t("clearForm")}</Button>
              <Button type="submit" size="sm" disabled={saveVehicle.isPending}>
                {vehicle ? t("update") : t("submit")}
              </Button>
            </div>
          </form>

          {/* B) Routes (requires vehicle saved first) */}
          <form
            onSubmit={(e) => { e.preventDefault(); saveRoute.mutate(); }}
            className={`space-y-3 rounded-lg border border-border/60 p-3 bg-card/40 ${!vehicle ? "opacity-60" : ""}`}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold tracking-wide text-primary">{t("addRouteSection")}</h3>
              {!vehicle && <span className="text-[11px] text-muted-foreground">— {t("vehicleInfo")} —</span>}
            </div>
            <div className="grid grid-cols-[1fr_120px] gap-2">
              <Input value={routeName} onChange={(e) => setRouteName(e.target.value)} placeholder={t("routeName")} disabled={!vehicle} className="h-10" />
              <Input type="number" step="any" value={routeFare} onChange={(e) => setRouteFare(e.target.value === "" ? "" : Number(e.target.value))} placeholder={t("fare")} disabled={!vehicle} className="h-10" />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={clearRouteForm} disabled={!vehicle}>{t("clearForm")}</Button>
              <Button type="submit" size="sm" disabled={!vehicle || saveRoute.isPending}>
                {editingRouteId ? t("update") : t("submit")}
              </Button>
            </div>

            {/* Existing routes list */}
            {!!routes.length && (
              <div className="pt-2 border-t border-border/40 space-y-1">
                {routes.map((r) => (
                  <div key={r.id} className={`flex items-center gap-2 text-sm rounded-md px-2 py-1 ${editingRouteId === r.id ? "bg-primary/10" : "hover:bg-muted/40"}`}>
                    <span className="flex-1 truncate">{r.name}</span>
                    <span className="text-muted-foreground">{fmtNum(r.fare, lang)}</span>
                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEditRoute(r)}>
                      {editingRouteId === r.id ? <Check className="h-3.5 w-3.5 text-primary" /> : <Pencil className="h-3.5 w-3.5" />}
                    </Button>
                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => { if (confirm(t("confirmDelete"))) deleteRoute.mutate(r.id); }}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </form>

          <div className="flex justify-end">
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4 mr-1" />{t("cancel")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
