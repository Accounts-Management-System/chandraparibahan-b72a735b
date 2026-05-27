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

export const Route = createFileRoute("/other-income")({ component: Page });

type Row = { id: string; income_date: string; category: string; description: string | null; vehicle_no: string | null; amount: number };

function Page() {
  const { t, lang } = useT();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["other_incomes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("other_incomes").select("*").order("income_date", { ascending: false }).limit(1000);
      if (error) throw error;
      return data as Row[];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("other_incomes").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["other_incomes"] }); toast.success(t("deleted")); },
  });
  const save = useMutation({
    mutationFn: async (form: any) => {
      if (editing) { const { error } = await supabase.from("other_incomes").update(form).eq("id", editing.id); if (error) throw error; }
      else { const { error } = await supabase.from("other_incomes").insert(form); if (error) throw error; }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["other_incomes"] }); toast.success(t("saved")); setOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });

  const total = rows.reduce((s, r) => s + Number(r.amount || 0), 0);

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{t("otherIncome")}</h1>
            <p className="text-sm text-muted-foreground">{t("total")}: <span className="font-semibold text-emerald-600">{fmtNum(total, lang)}</span></p>
          </div>
          <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="h-4 w-4 mr-2" />{t("add")}</Button>
        </div>
        <DataTable<Row>
          rows={isLoading ? [] : rows}
          columns={[
            { key: "income_date", header: t("date"), render: (r) => fmtDate(r.income_date, lang) },
            { key: "category", header: t("category") },
            { key: "description", header: t("description") },
            { key: "vehicle_no", header: t("vehicleNo") },
            { key: "amount", header: t("amount"), render: (r) => fmtNum(r.amount, lang) },
          ]}
          onEdit={(r) => { setEditing(r); setOpen(true); }}
          onDelete={(r) => { if (confirm(t("confirmDelete"))) del.mutate(r.id); }}
          emptyText={isLoading ? t("loading") : t("noData")}
        />
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("otherIncome")}</DialogTitle></DialogHeader>
          <form className="grid grid-cols-2 gap-3" onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            save.mutate({
              income_date: f.get("income_date"),
              category: f.get("category"),
              description: f.get("description") || null,
              vehicle_no: f.get("vehicle_no") || null,
              amount: Number(f.get("amount") || 0),
            });
          }}>
            <Input name="income_date" type="date" placeholder={t("date")} defaultValue={editing?.income_date ?? new Date().toISOString().slice(0,10)} required className="h-11" />
            <Input name="category" placeholder={t("enterCategory")} defaultValue={editing?.category} required className="h-11" />
            <Textarea name="description" placeholder={t("enterDescription")} defaultValue={editing?.description ?? ""} rows={2} className="col-span-2" />
            <Input name="vehicle_no" placeholder={t("vehicleNo")} defaultValue={editing?.vehicle_no ?? ""} className="h-11" />
            <Input name="amount" type="number" step="any" placeholder={t("enterAmount")} defaultValue={editing?.amount ?? ""} required className="h-11" />
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
