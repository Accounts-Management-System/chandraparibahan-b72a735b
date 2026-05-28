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
import { useRole } from "@/lib/useRole";
import { SearchFilters, MiniDashboard, emptyFilters, type FilterState } from "@/components/SearchFilters";

export const Route = createFileRoute("/owners")({ component: Page });

type Owner = { id: string; name: string };
type Veh = { id: string; vehicle_no: string; owner_id: string | null };
type Trip = { trip_date: string; vehicle_no: string; fare_1: number; fare_2: number };

type FareRow = {
  id: string;
  owner_name: string;
  vehicle_no: string;
  fare: number;
  owner_id: string;
};

function Page() {
  const { t, lang } = useT();
  const { canWrite } = useRole();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Owner | null>(null);
  const [filters, setFilters] = useState<FilterState>(emptyFilters);

  const { data: owners = [], isLoading } = useQuery({
    queryKey: ["owners"],
    queryFn: async () => ((await supabase.from("owners").select("id,name").order("name")).data ?? []) as Owner[],
  });
  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles-with-owner"],
    queryFn: async () => ((await supabase.from("vehicles").select("id,vehicle_no,owner_id").order("vehicle_no")).data ?? []) as Veh[],
  });
  const { data: trips = [] } = useQuery({
    queryKey: ["trips-all-for-owners"],
    queryFn: async () => ((await supabase.from("trips").select("trip_date,vehicle_no,fare_1,fare_2").limit(5000)).data ?? []) as Trip[],
  });

  const fareRows: FareRow[] = useMemo(() => {
    const veh = vehicles.filter((v) => {
      if (filters.ownerId && v.owner_id !== filters.ownerId) return false;
      if (filters.vehicleNo && v.vehicle_no !== filters.vehicleNo) return false;
      return !!v.owner_id;
    });
    const ownerName = (id: string | null) => owners.find((o) => o.id === id)?.name ?? "—";
    return veh.map((v) => {
      const fare = trips
        .filter((tr) => tr.vehicle_no === v.vehicle_no)
        .filter((tr) => !filters.dateFrom || tr.trip_date >= filters.dateFrom)
        .filter((tr) => !filters.dateTo || tr.trip_date <= filters.dateTo)
        .reduce((s, tr) => s + Number(tr.fare_1 || 0) + Number(tr.fare_2 || 0), 0);
      return { id: v.id, owner_name: ownerName(v.owner_id), vehicle_no: v.vehicle_no, fare, owner_id: v.owner_id! };
    });
  }, [vehicles, trips, owners, filters]);

  const totalFare = fareRows.reduce((s, r) => s + r.fare, 0);

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("owners").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["owners"] }); qc.invalidateQueries({ queryKey: ["vehicles-with-owner"] }); toast.success(t("deleted")); },
  });

  const hasFilter = filters.dateFrom || filters.dateTo || filters.ownerId || filters.vehicleNo;

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{t("owners")}</h1>
          {canWrite && <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="h-4 w-4 mr-2" />{t("add")}</Button>}
        </div>

        <SearchFilters value={filters} onChange={setFilters} show={{ date: true, owner: true, vehicle: true }} />
        <MiniDashboard tripCount={fareRows.length} totalAmount={totalFare} lang={lang} />

        {hasFilter ? (
          <>
            <p className="text-xs text-muted-foreground">
              {filters.dateFrom && `${fmtDate(filters.dateFrom, lang)} — ${fmtDate(filters.dateTo || filters.dateFrom, lang)}`}
            </p>
            <DataTable<FareRow>
              rows={fareRows}
              columns={[
                { key: "owner_name", header: t("name") },
                { key: "vehicle_no", header: t("vehicleNo") },
                { key: "fare", header: t("vehicleFare"), render: (r) => fmtNum(r.fare, lang) },
              ]}
              emptyText={t("noData")}
            />
          </>
        ) : (
          <DataTable<Owner>
            rows={isLoading ? [] : owners}
            columns={[
              { key: "name", header: t("name") },
              { key: "id", header: t("vehicles"), render: (r) => vehicles.filter((v) => v.owner_id === r.id).map((v) => v.vehicle_no).join(", ") || "—" },
            ]}
            onEdit={canWrite ? (r) => { setEditing(r); setOpen(true); } : undefined}
            onDelete={canWrite ? (r) => { if (confirm(t("confirmDelete"))) del.mutate(r.id); } : undefined}
            emptyText={isLoading ? t("loading") : t("noData")}
          />
        )}
      </div>
      <OwnerDialog open={open} onOpenChange={setOpen} editing={editing} />
    </AppLayout>
  );
}

function OwnerDialog({ open, onOpenChange, editing }: { open: boolean; onOpenChange: (v: boolean) => void; editing: Owner | null }) {
  const { t } = useT();
  const qc = useQueryClient();
  const [name, setName] = useState("");

  useEffect(() => {
    if (open) setName(editing?.name ?? "");
  }, [open, editing]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = { name };
      if (editing) {
        const { error } = await supabase.from("owners").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("owners").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["owners"] }); toast.success(t("saved")); onOpenChange(false); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{t("owners")}</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-3">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("name")} required className="h-10" />
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>{t("cancel")}</Button>
            <Button type="submit" disabled={save.isPending}>{editing ? t("update") : t("submit")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
