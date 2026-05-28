import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { DataTable } from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useT } from "@/lib/i18n";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { useRole } from "@/lib/useRole";

export const Route = createFileRoute("/owners")({ component: Page });

type Owner = { id: string; name: string; phone: string | null; notes: string | null };
type Veh = { id: string; vehicle_no: string; owner_id: string | null };

function Page() {
  const { t } = useT();
  const { canWrite } = useRole();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Owner | null>(null);

  const { data: owners = [], isLoading } = useQuery({
    queryKey: ["owners"],
    queryFn: async () => ((await supabase.from("owners").select("*").order("name")).data ?? []) as Owner[],
  });
  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles-with-owner"],
    queryFn: async () => ((await supabase.from("vehicles").select("id,vehicle_no,owner_id").order("vehicle_no")).data ?? []) as Veh[],
  });

  const vehiclesByOwner = (oid: string) => vehicles.filter((v) => v.owner_id === oid).map((v) => v.vehicle_no).join(", ") || "—";

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("owners").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["owners"] }); qc.invalidateQueries({ queryKey: ["vehicles-with-owner"] }); toast.success(t("deleted")); },
  });

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{t("owners")}</h1>
          {canWrite && <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="h-4 w-4 mr-2" />{t("add")}</Button>}
        </div>
        <DataTable<Owner>
          rows={isLoading ? [] : owners}
          columns={[
            { key: "name", header: t("name") },
            { key: "phone", header: t("phone") },
            { key: "id", header: t("vehicles"), render: (r) => vehiclesByOwner(r.id) },
            { key: "notes", header: t("description") },
          ]}
          onEdit={canWrite ? (r) => { setEditing(r); setOpen(true); } : undefined}
          onDelete={canWrite ? (r) => { if (confirm(t("confirmDelete"))) del.mutate(r.id); } : undefined}
          emptyText={isLoading ? t("loading") : t("noData")}
        />
      </div>
      <OwnerDialog open={open} onOpenChange={setOpen} editing={editing} />
    </AppLayout>
  );
}

function OwnerDialog({ open, onOpenChange, editing }: { open: boolean; onOpenChange: (v: boolean) => void; editing: Owner | null }) {
  const { t } = useT();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) {
      setName(editing?.name ?? "");
      setPhone(editing?.phone ?? "");
      setNotes(editing?.notes ?? "");
    }
  }, [open, editing]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = { name, phone: phone || null, notes: notes || null };
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
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t("phone")} className="h-10" />
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("description")} rows={2} />
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>{t("cancel")}</Button>
            <Button type="submit" disabled={save.isPending}>{editing ? t("update") : t("submit")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
