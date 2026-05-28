import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DataTable } from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useT, fmtNum, fmtDate } from "@/lib/i18n";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { useRole } from "@/lib/useRole";
import { LookupSelect } from "@/components/LookupSelect";
import { CategorySelect, HeadSelect } from "@/components/CategoryHeadSelect";

export const Route = createFileRoute("/jama-khoroch")({ component: Page });

type JRow = { id: string; income_date: string; vehicle_no: string | null; category: string | null; head: string | null; description: string | null; amount: number };
type ERow = { id: string; expense_date: string; vehicle_no: string | null; category: string | null; head: string | null; description: string | null; amount: number };

function Page() {
  const { t, lang } = useT();
  const qc = useQueryClient();
  const { canWrite } = useRole();
  const [tab, setTab] = useState("jama");
  const [editJ, setEditJ] = useState<JRow | null>(null);
  const [editE, setEditE] = useState<ERow | null>(null);
  const [openJ, setOpenJ] = useState(false);
  const [openE, setOpenE] = useState(false);

  const { data: jama = [] } = useQuery({
    queryKey: ["jk-jama"],
    queryFn: async () => {
      const { data } = await supabase.from("other_incomes").select("*").order("income_date", { ascending: false }).limit(300);
      return (data ?? []) as JRow[];
    },
  });
  const { data: khoroch = [] } = useQuery({
    queryKey: ["jk-khoroch"],
    queryFn: async () => {
      const { data } = await supabase.from("expenses").select("*").order("expense_date", { ascending: false }).limit(300);
      return (data ?? []) as ERow[];
    },
  });

  const totalJ = jama.reduce((s, r) => s + Number(r.amount || 0), 0);
  const totalE = khoroch.reduce((s, r) => s + Number(r.amount || 0), 0);

  const delJ = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("other_incomes").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["jk-jama"] }); toast.success(t("deleted")); },
  });
  const delE = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("expenses").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["jk-khoroch"] }); toast.success(t("deleted")); },
  });

  return (
    <AppLayout>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">{t("jamaKhoroch")}</h1>

        <div className="grid grid-cols-3 gap-3">
          <Stat label={t("jama")} value={fmtNum(totalJ, lang)} color="text-emerald-400" />
          <Stat label={t("khoroch")} value={fmtNum(totalE, lang)} color="text-rose-400" />
          <Stat label={t("balance")} value={fmtNum(totalJ - totalE, lang)} color="text-primary" />
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="jama">{t("jama")}</TabsTrigger>
            <TabsTrigger value="khoroch">{t("khoroch")}</TabsTrigger>
          </TabsList>

          <TabsContent value="jama">
            {canWrite && (
              <div className="flex justify-end mb-2">
                <Button onClick={() => { setEditJ(null); setOpenJ(true); }}>
                  <Plus className="h-4 w-4 mr-2" />{t("addJama")}
                </Button>
              </div>
            )}
            <DataTable<JRow>
              rows={jama}
              columns={[
                { key: "income_date", header: t("date"), render: (r) => fmtDate(r.income_date, lang) },
                { key: "category", header: t("category"), render: (r) => r.category ?? "—" },
                { key: "head", header: t("head"), render: (r) => r.head ?? "—" },
                { key: "vehicle_no", header: t("vehicleNo"), render: (r) => r.vehicle_no ?? "—" },
                { key: "description", header: t("description"), render: (r) => r.description ?? "—" },
                { key: "amount", header: t("amount"), render: (r) => fmtNum(r.amount, lang) },
              ]}
              onEdit={canWrite ? (r) => { setEditJ(r); setOpenJ(true); } : undefined}
              onDelete={canWrite ? (r) => delJ.mutate(r.id) : undefined}
            />
          </TabsContent>

          <TabsContent value="khoroch">
            {canWrite && (
              <div className="flex justify-end mb-2">
                <Button onClick={() => { setEditE(null); setOpenE(true); }}>
                  <Plus className="h-4 w-4 mr-2" />{t("addExpense")}
                </Button>
              </div>
            )}
            <DataTable<ERow>
              rows={khoroch}
              columns={[
                { key: "expense_date", header: t("date"), render: (r) => fmtDate(r.expense_date, lang) },
                { key: "category", header: t("category"), render: (r) => r.category ?? "—" },
                { key: "head", header: t("head"), render: (r) => r.head ?? "—" },
                { key: "description", header: t("description"), render: (r) => r.description ?? "—" },
                { key: "amount", header: t("amount"), render: (r) => fmtNum(r.amount, lang) },
              ]}
              onEdit={canWrite ? (r) => { setEditE(r); setOpenE(true); } : undefined}
              onDelete={canWrite ? (r) => delE.mutate(r.id) : undefined}
            />
          </TabsContent>
        </Tabs>
      </div>

      <JamaDialog open={openJ} onOpenChange={setOpenJ} editing={editJ} />
      <ExpenseDialog open={openE} onOpenChange={setOpenE} editing={editE} />
    </AppLayout>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg border bg-card/70 p-4">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className={`text-xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

function JamaDialog({ open, onOpenChange, editing }: { open: boolean; onOpenChange: (v: boolean) => void; editing: JRow | null }) {
  const { t } = useT();
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: vehicles = [] } = useQuery({
    queryKey: ["veh-list"],
    queryFn: async () => (await supabase.from("vehicles").select("vehicle_no").order("vehicle_no")).data ?? [],
  });

  const save = useMutation({
    mutationFn: async (form: any) => {
      if (editing) {
        const { error } = await supabase.from("other_incomes").update(form).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("other_incomes").insert(form);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["jk-jama"] }); toast.success(t("saved")); onOpenChange(false); },
    onError: (e: any) => toast.error(e.message),
  });

  const [vehicleNo, setVehicleNo] = useState(editing?.vehicle_no ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [category, setCategory] = useState(editing?.category ?? "");
  const [head, setHead] = useState(editing?.head ?? "");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("addJama")}</DialogTitle></DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            save.mutate({
              income_date: f.get("d"),
              vehicle_no: vehicleNo || null,
              category: category || "জমা",
              head: head || null,
              description: description || null,
              amount: Number(f.get("a") || 0),
            });
          }}
        >
          <Input type="date" name="d" defaultValue={editing?.income_date ?? today} required className="h-11" />
          <CategorySelect value={category} onChange={(v) => { setCategory(v); setHead(""); }} />
          <HeadSelect category={category} value={head} onChange={setHead} />
          <select value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value)} className="w-full h-11 rounded-md border border-input bg-input px-3 text-sm">
            <option value="">— {t("vehicleNo")} —</option>
            {(vehicles as { vehicle_no: string }[]).map((v) => (
              <option key={v.vehicle_no} value={v.vehicle_no} className="bg-card">{v.vehicle_no}</option>
            ))}
          </select>
          <LookupSelect kind="description" value={description} onChange={setDescription} placeholder={t("description")} />
          <Input type="number" step="any" name="a" defaultValue={editing?.amount ?? ""} placeholder={t("amount")} required className="h-11" />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("cancel")}</Button>
            <Button type="submit">{editing ? t("update") : t("submit")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ExpenseDialog({ open, onOpenChange, editing }: { open: boolean; onOpenChange: (v: boolean) => void; editing: ERow | null }) {
  const { t } = useT();
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);

  const [head, setHead] = useState(editing?.head ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");

  const [category, setCategory] = useState(editing?.category ?? "");
  const [head, setHead] = useState(editing?.head ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");

  const save = useMutation({
    mutationFn: async (form: any) => {
      if (editing) {
        const { error } = await supabase.from("expenses").update(form).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("expenses").insert(form);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["jk-khoroch"] }); toast.success(t("saved")); onOpenChange(false); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("addExpense")}</DialogTitle></DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            save.mutate({
              expense_date: f.get("d"),
              category: category || "খরচ",
              head: head || null,
              description: description || null,
              amount: Number(f.get("a") || 0),
            });
          }}
        >
          <Input type="date" name="d" defaultValue={editing?.expense_date ?? today} required className="h-11" />
          <CategorySelect value={category} onChange={(v) => { setCategory(v); setHead(""); }} required />
          <HeadSelect category={category} value={head} onChange={setHead} />
          <LookupSelect kind="description" value={description} onChange={setDescription} placeholder={t("description")} />
          <Input type="number" step="any" name="a" defaultValue={editing?.amount ?? ""} placeholder={t("amount")} required className="h-11" />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("cancel")}</Button>
            <Button type="submit">{editing ? t("update") : t("submit")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}