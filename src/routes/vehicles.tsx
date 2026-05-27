import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { DataTable } from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useT } from "@/lib/i18n";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/vehicles")({ component: Page });

type Vehicle = { id: string; vehicle_no: string; owner_name: string | null };

function Page() {
  const { t } = useT();
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

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vehicles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vehicles"] }); toast.success(t("deleted")); },
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
  const { t } = useT();
  const qc = useQueryClient();
  const [vehicleNo, setVehicleNo] = useState("");
  const [ownerName, setOwnerName] = useState("");

  useEffect(() => {
    if (open) {
      setVehicleNo(editing?.vehicle_no ?? "");
      setOwnerName(editing?.owner_name ?? "");
    }
  }, [open, editing]);

  const clearForm = () => { setVehicleNo(""); setOwnerName(""); };

  const save = useMutation({
    mutationFn: async () => {
      const payload = { vehicle_no: vehicleNo, owner_name: ownerName || null };
      if (editing) {
        const { error } = await supabase.from("vehicles").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("vehicles").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vehicles"] });
      toast.success(t("saved"));
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{t("vehicles")}</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-3">
          <Input value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value)} placeholder={t("vehicleNo")} required className="h-10" />
          <Input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder={t("owner")} className="h-10" />
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={clearForm}>{t("clearForm")}</Button>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>{t("cancel")}</Button>
            <Button type="submit" disabled={save.isPending}>{editing ? t("update") : t("submit")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
