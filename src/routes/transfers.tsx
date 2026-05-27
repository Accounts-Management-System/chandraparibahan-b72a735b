import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { DataTable } from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useT, fmtNum, fmtDate } from "@/lib/i18n";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/transfers")({ component: Page });

type Row = { id: string; transfer_date: string; from_party: string; to_party: string; amount: number; notes: string | null };

function Page() {
  const { t, lang } = useT();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["transfers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("transfers").select("*").order("transfer_date", { ascending: false }).limit(1000);
      if (error) throw error;
      return data as Row[];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("transfers").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["transfers"] }); toast.success(t("deleted")); },
  });
  const save = useMutation({
    mutationFn: async (form: any) => {
      if (editing) { const { error } = await supabase.from("transfers").update(form).eq("id", editing.id); if (error) throw error; }
      else { const { error } = await supabase.from("transfers").insert(form); if (error) throw error; }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["transfers"] }); toast.success(t("saved")); setOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{t("transfers")}</h1>
          <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="h-4 w-4 mr-2" />{t("add")}</Button>
        </div>
        <DataTable<Row>
          rows={isLoading ? [] : rows}
          columns={[
            { key: "transfer_date", header: t("date"), render: (r) => fmtDate(r.transfer_date, lang) },
            { key: "from_party", header: t("fromParty") },
            { key: "to_party", header: t("toParty") },
            { key: "amount", header: t("amount"), render: (r) => fmtNum(r.amount, lang) },
            { key: "notes", header: t("notes") },
          ]}
          onEdit={(r) => { setEditing(r); setOpen(true); }}
          onDelete={(r) => { if (confirm(t("confirmDelete"))) del.mutate(r.id); }}
          emptyText={isLoading ? t("loading") : t("noData")}
        />
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("transfers")}</DialogTitle></DialogHeader>
          <form className="grid grid-cols-2 gap-3" onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            save.mutate({
              transfer_date: f.get("transfer_date"),
              from_party: f.get("from_party"),
              to_party: f.get("to_party"),
              amount: Number(f.get("amount") || 0),
              notes: f.get("notes") || null,
            });
          }}>
            <Input name="transfer_date" type="date" placeholder={t("date")} defaultValue={editing?.transfer_date ?? new Date().toISOString().slice(0,10)} required className="h-11" />
            <Input name="amount" type="number" step="any" placeholder={t("enterAmount")} defaultValue={editing?.amount ?? ""} required className="h-11" />
            <Input name="from_party" placeholder={t("fromParty")} defaultValue={editing?.from_party} required className="h-11" />
            <Input name="to_party" placeholder={t("toParty")} defaultValue={editing?.to_party} required className="h-11" />
            <Textarea name="notes" placeholder={t("notes")} defaultValue={editing?.notes ?? ""} rows={2} className="col-span-2" />
            <DialogFooter className="col-span-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
              <Button type="submit" disabled={save.isPending}>{t("save")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
