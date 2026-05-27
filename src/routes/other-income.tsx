import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { DataTable } from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { LookupSelect } from "@/components/LookupSelect";
import { useT, fmtNum, fmtDate } from "@/lib/i18n";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/other-income")({ component: Page });

type Row = {
  id: string;
  income_date: string;
  category: string;
  head: string | null;
  description: string | null;
  amount: number;
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function Page() {
  const { t, lang } = useT();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [category, setCategory] = useState("");
  const [head, setHead] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState<number | "">("");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["other_incomes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("other_incomes").select("*").order("income_date", { ascending: false }).limit(1000);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const last = rows[0];

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setDate(editing.income_date);
      setCategory(editing.category ?? "");
      setHead(editing.head ?? "");
      setDescription(editing.description ?? "");
      setAmount(editing.amount ?? "");
    } else {
      setDate(last?.income_date ?? today);
      setCategory(last?.category ?? "");
      setHead(last?.head ?? "");
      setDescription(last?.description ?? "");
      setAmount("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing, last?.id]);

  const clearForm = () => {
    setDate(today); setCategory(""); setHead(""); setDescription(""); setAmount("");
  };

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("other_incomes").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["other_incomes"] }); toast.success(t("deleted")); },
  });
  const save = useMutation({
    mutationFn: async () => {
      const form = {
        income_date: date,
        category,
        head: head || null,
        description: description || null,
        amount: Number(amount || 0),
      };
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
            <p className="text-sm text-muted-foreground">{t("total")}: <span className="font-semibold text-emerald-400">{fmtNum(total, lang)}</span></p>
          </div>
          <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="h-4 w-4 mr-2" />{t("add")}</Button>
        </div>
        <DataTable<Row>
          rows={isLoading ? [] : rows}
          columns={[
            { key: "income_date", header: t("date"), render: (r) => fmtDate(r.income_date, lang) },
            { key: "category", header: t("category") },
            { key: "head", header: t("head") },
            { key: "description", header: t("description") },
            { key: "amount", header: t("amount"), render: (r) => fmtNum(r.amount, lang) },
          ]}
          onEdit={(r) => { setEditing(r); setOpen(true); }}
          onDelete={(r) => { if (confirm(t("confirmDelete"))) del.mutate(r.id); }}
          emptyText={isLoading ? t("loading") : t("noData")}
        />
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t("otherIncome")}</DialogTitle></DialogHeader>
          <form className="grid grid-cols-2 gap-3" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
            <Field label={t("date")}>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="h-10" />
            </Field>
            <Field label={t("category")}>
              <LookupSelect kind="category" value={category} onChange={setCategory} required />
            </Field>
            <Field label={t("head")}>
              <LookupSelect kind="head" value={head} onChange={setHead} />
            </Field>
            <Field label={t("description")}>
              <LookupSelect kind="description" value={description} onChange={setDescription} />
            </Field>
            <Field label={t("amount")}>
              <Input type="number" step="any" value={amount} onChange={(e) => setAmount(e.target.value === "" ? "" : Number(e.target.value))} required className="h-10" />
            </Field>
            <DialogFooter className="col-span-2 gap-2 sm:gap-2">
              <Button type="button" variant="outline" onClick={clearForm}>{t("clearForm")}</Button>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>{t("cancel")}</Button>
              <Button type="submit" disabled={save.isPending}>{editing ? t("update") : t("submit")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
