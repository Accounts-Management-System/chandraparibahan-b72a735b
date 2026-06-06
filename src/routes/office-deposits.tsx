import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { DataTable } from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useT, fmtNum, fmtDate } from "@/lib/i18n";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { useRole } from "@/lib/useRole";

export const Route = createFileRoute("/office-deposits")({ component: Page });

const OFFICE_CATEGORY = "অফিস কতৃক জমা";

type Row = {
  id: string;
  income_date: string;
  description: string | null;
  amount: number;
};

function Page() {
  const { t, lang } = useT();
  const { canWrite } = useRole();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState<number | "">("");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["office_deposits"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("other_incomes")
        .select("id,income_date,description,amount")
        .eq("category", OFFICE_CATEGORY)
        .order("income_date", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setDate(editing.income_date);
      setDescription(editing.description ?? "");
      setAmount(editing.amount ?? "");
    } else {
      setDate(today);
      setDescription("");
      setAmount("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("other_incomes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["office_deposits"] });
      qc.invalidateQueries({ queryKey: ["other_incomes"] });
      toast.success(t("deleted"));
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const form = {
        income_date: date,
        category: OFFICE_CATEGORY,
        head: null,
        description: description || null,
        vehicle_no: null,
        amount: Number(amount || 0),
        owner_id: null,
        vendor: null,
      };
      if (editing) {
        const { error } = await supabase.from("other_incomes").update(form).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("other_incomes").insert(form);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["office_deposits"] });
      qc.invalidateQueries({ queryKey: ["other_incomes"] });
      toast.success(t("saved"));
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const total = rows.reduce((s, r) => s + Number(r.amount || 0), 0);

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">অফিস কতৃক জমা</h1>
            <p className="text-sm text-muted-foreground">
              {t("total")}: <span className="font-semibold text-emerald-400">{fmtNum(total, lang)}</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              এই জমা মূল পরিবহন হিসাবের দৈনিক জমার সাথে যোগ হবে। ওনার হিসাবে যুক্ত হবে না।
            </p>
          </div>
          {canWrite && (
            <Button onClick={() => { setEditing(null); setOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" /> {t("add")}
            </Button>
          )}
        </div>

        <DataTable<Row>
          rows={isLoading ? [] : rows}
          columns={[
            { key: "income_date", header: t("date"), render: (r) => fmtDate(r.income_date, lang) },
            { key: "description", header: t("description"), render: (r) => r.description ?? "—" },
            { key: "amount", header: t("amount"), render: (r) => fmtNum(r.amount, lang) },
          ]}
          onEdit={canWrite ? (r) => { setEditing(r); setOpen(true); } : undefined}
          onDelete={canWrite ? (r) => del.mutate(r.id) : undefined}
          emptyText={isLoading ? t("loading") : t("noData")}
        />
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>অফিস কতৃক জমা</DialogTitle></DialogHeader>
          <form className="grid grid-cols-1 gap-3" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
            <div>
              <label className="text-xs font-semibold uppercase text-muted-foreground">{t("date")}</label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="h-10" />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-muted-foreground">{t("amount")}</label>
              <Input type="number" step="any" value={amount} onChange={(e) => setAmount(e.target.value === "" ? "" : Number(e.target.value))} required className="h-10" />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-muted-foreground">{t("description")}</label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} className="h-10" />
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>{t("cancel")}</Button>
              <Button type="submit" disabled={save.isPending}>{editing ? t("update") : t("submit")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
