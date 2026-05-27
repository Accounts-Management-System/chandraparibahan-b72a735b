import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { DataTable } from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/lib/i18n";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/vehicles")({ component: Page });

type Row = { id: string; vehicle_no: string; owner_name: string | null; notes: string | null };

function Page() {
  const { t } = useT();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["vehicles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vehicles").select("*").order("vehicle_no");
      if (error) throw error;
      return data as Row[];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("vehicles").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vehicles"] }); toast.success(t("deleted")); },
  });
  const save = useMutation({
    mutationFn: async (form: any) => {
      if (editing) { const { error } = await supabase.from("vehicles").update(form).eq("id", editing.id); if (error) throw error; }
      else { const { error } = await supabase.from("vehicles").insert(form); if (error) throw error; }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vehicles"] }); toast.success(t("saved")); setOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{t("vehicles")}</h1>
          <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="h-4 w-4 mr-2" />{t("add")}</Button>
        </div>
        <DataTable<Row>
          rows={isLoading ? [] : rows}
          columns={[
            { key: "vehicle_no", header: t("vehicleNo") },
            { key: "owner_name", header: t("owner") },
            { key: "notes", header: t("notes") },
          ]}
          onEdit={(r) => { setEditing(r); setOpen(true); }}
          onDelete={(r) => { if (confirm(t("confirmDelete"))) del.mutate(r.id); }}
          emptyText={isLoading ? t("loading") : t("noData")}
        />
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("vehicles")}</DialogTitle></DialogHeader>
          <form className="space-y-3" onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            save.mutate({
              vehicle_no: f.get("vehicle_no"),
              owner_name: f.get("owner_name") || null,
              notes: f.get("notes") || null,
            });
          }}>
            <Input name="vehicle_no" placeholder={t("vehicleNo")} defaultValue={editing?.vehicle_no} required className="h-11" />
            <Input name="owner_name" placeholder={t("owner")} defaultValue={editing?.owner_name ?? ""} className="h-11" />
            <Textarea name="notes" placeholder={t("notes")} defaultValue={editing?.notes ?? ""} rows={2} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
              <Button type="submit" disabled={save.isPending}>{t("save")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
