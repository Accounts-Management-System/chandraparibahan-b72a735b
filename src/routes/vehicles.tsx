import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { DataTable } from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useT, fmtNum } from "@/lib/i18n";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/vehicles")({ component: Page });

type Vehicle = { id: string; vehicle_no: string; owner_name: string | null };
type RouteRow = { id?: string; vehicle_id?: string; name: string; fare: number; _new?: boolean };

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
      <VehicleDialog open={open} onOpenChange={setOpen} editing={editing} existingRoutes={editing ? (routesByVehicle[editing.id] ?? []) : []} />
    </AppLayout>
  );
}

function VehicleDialog({
  open, onOpenChange, editing, existingRoutes,
}: { open: boolean; onOpenChange: (v: boolean) => void; editing: Vehicle | null; existingRoutes: RouteRow[] }) {
  const { t } = useT();
  const qc = useQueryClient();
  const [vehicleNo, setVehicleNo] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [routes, setRoutes] = useState<RouteRow[]>([]);

  useEffect(() => {
    if (open) {
      setVehicleNo(editing?.vehicle_no ?? "");
      setOwnerName(editing?.owner_name ?? "");
      setRoutes(existingRoutes.map((r) => ({ ...r })));
    }
  }, [open, editing, existingRoutes]);

  const save = useMutation({
    mutationFn: async () => {
      let vehicleId = editing?.id;
      if (editing) {
        const { error } = await supabase.from("vehicles").update({ vehicle_no: vehicleNo, owner_name: ownerName || null }).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("vehicles").insert({ vehicle_no: vehicleNo, owner_name: ownerName || null }).select("id").single();
        if (error) throw error;
        vehicleId = data.id;
      }
      // sync routes
      const existingIds = new Set(existingRoutes.map((r) => r.id));
      const keptIds = new Set(routes.filter((r) => r.id).map((r) => r.id!));
      const toDelete = [...existingIds].filter((id) => !keptIds.has(id!));
      if (toDelete.length) {
        await supabase.from("vehicle_routes").delete().in("id", toDelete as string[]);
      }
      for (const r of routes) {
        if (!r.name.trim()) continue;
        if (r.id) {
          await supabase.from("vehicle_routes").update({ name: r.name, fare: r.fare }).eq("id", r.id);
        } else {
          await supabase.from("vehicle_routes").insert({ vehicle_id: vehicleId!, name: r.name, fare: r.fare });
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vehicles"] });
      qc.invalidateQueries({ queryKey: ["vehicle_routes_all"] });
      toast.success(t("saved"));
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{t("vehicles")}</DialogTitle></DialogHeader>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <div className="grid grid-cols-2 gap-3">
            <Input value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value)} placeholder={t("vehicleNo")} required className="h-11" />
            <Input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder={t("owner")} className="h-11" />
          </div>

          <div className="space-y-2 rounded-lg border border-border/60 p-3 bg-card/50">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">{t("routes")}</h3>
              <Button type="button" size="sm" variant="outline" onClick={() => setRoutes((r) => [...r, { name: "", fare: 0, _new: true }])}>
                <Plus className="h-3 w-3 mr-1" />{t("addRoute")}
              </Button>
            </div>
            {routes.length === 0 && <p className="text-xs text-muted-foreground">{t("noData")}</p>}
            {routes.map((r, i) => (
              <div key={i} className="grid grid-cols-[1fr_120px_auto] gap-2 items-center">
                <Input value={r.name} onChange={(e) => setRoutes((arr) => arr.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} placeholder={t("routeName")} className="h-9" />
                <Input type="number" step="any" value={r.fare} onChange={(e) => setRoutes((arr) => arr.map((x, j) => j === i ? { ...x, fare: Number(e.target.value) } : x))} placeholder={t("fare")} className="h-9" />
                <Button type="button" size="icon" variant="ghost" onClick={() => setRoutes((arr) => arr.filter((_, j) => j !== i))}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
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
