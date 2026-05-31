import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { DataTable } from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CategorySelect, HeadSelect } from "@/components/CategoryHeadSelect";
import { useT, fmtNum, fmtDate } from "@/lib/i18n";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, FileDown } from "lucide-react";
import { useRole } from "@/lib/useRole";
import { SearchFilters, MiniDashboard, emptyFilters, matchesFilters, type FilterState } from "@/components/SearchFilters";
import { exportPdf } from "@/lib/exportPdf";

export const Route = createFileRoute("/expenses")({ component: Page });

type Row = {
  id: string;
  expense_date: string;
  category: string;
  head: string | null;
  description: string | null;
  vehicle_no: string | null;
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
  const { canWrite } = useRole();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [category, setCategory] = useState("");
  const [head, setHead] = useState("");
  const [description, setDescription] = useState("");
  const [vehicleNo, setVehicleNo] = useState("");
  const [amount, setAmount] = useState<number | "">("");
  const [ownerId, setOwnerId] = useState("");

  const { data: owners = [] } = useQuery({
    queryKey: ["owners-list"],
    queryFn: async () => (await supabase.from("owners").select("id,name").order("name")).data ?? [],
  });
  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles-list-expenses"],
    queryFn: async () => (await supabase.from("vehicles").select("id,vehicle_no,owner_id").order("vehicle_no")).data ?? [],
  });
  const filteredVehicles = useMemo(() => {
    const all = vehicles as { vehicle_no: string; owner_id: string | null }[];
    return ownerId ? all.filter((v) => v.owner_id === ownerId) : all;
  }, [vehicles, ownerId]);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("expenses").select("*").order("expense_date", { ascending: false }).limit(1000);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const last = rows[0];

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setDate(editing.expense_date);
      setCategory(editing.category ?? "");
      setHead(editing.head ?? "");
      setDescription(editing.description ?? "");
      setVehicleNo(editing.vehicle_no ?? "");
      setAmount(editing.amount ?? "");
    } else {
      setDate(last?.expense_date ?? today);
      setCategory(last?.category ?? "");
      setHead(last?.head ?? "");
      setDescription(last?.description ?? "");
      setVehicleNo(last?.vehicle_no ?? "");
      setAmount("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing, last?.id]);

  const clearForm = () => {
    setDate(today); setCategory(""); setHead(""); setDescription(""); setVehicleNo(""); setAmount("");
  };

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("expenses").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["expenses"] }); toast.success(t("deleted")); },
  });

  const save = useMutation({
    mutationFn: async () => {
      const form = {
        expense_date: date,
        category,
        head: head || null,
        description: description || null,
        vehicle_no: vehicleNo || null,
        amount: Number(amount || 0),
      };
      if (editing) { const { error } = await supabase.from("expenses").update(form).eq("id", editing.id); if (error) throw error; }
      else { const { error } = await supabase.from("expenses").insert(form); if (error) throw error; }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["expenses"] }); toast.success(t("saved")); setOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });

  const [filters, setFilters] = useState<FilterState>(emptyFilters);
  const filtered = useMemo(
    () => rows.filter((r) => matchesFilters({ date: r.expense_date, vehicle_no: r.vehicle_no, category: r.category, head: r.head }, filters)),
    [rows, filters],
  );
  const total = filtered.reduce((s, r) => s + Number(r.amount || 0), 0);

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{t("expenses")}</h1>
            <p className="text-sm text-muted-foreground">{t("total")}: <span className="font-semibold text-rose-400">{fmtNum(total, lang)}</span></p>
          </div>
          {canWrite && <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="h-4 w-4 mr-2" />{t("add")}</Button>}
        </div>
        <SearchFilters value={filters} onChange={setFilters} show={{ date: true, vehicle: true, category: true, head: true }} />
        <MiniDashboard tripCount={filtered.length} totalAmount={total} lang={lang} showTrips={false} showCount countLabel={t("total")} />
        <DataTable<Row>
          rows={isLoading ? [] : filtered}
          columns={[
            { key: "expense_date", header: t("date"), render: (r) => fmtDate(r.expense_date, lang) },
            { key: "category", header: t("category") },
            { key: "head", header: t("head") },
            { key: "description", header: t("description") },
            { key: "amount", header: t("amount"), render: (r) => fmtNum(r.amount, lang) },
          ]}
          onEdit={canWrite ? (r) => { setEditing(r); setOpen(true); } : undefined}
          onDelete={canWrite ? (r) => del.mutate(r.id) : undefined}
          emptyText={isLoading ? t("loading") : t("noData")}
        />
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t("expenses")}</DialogTitle></DialogHeader>
          <form
            className="grid grid-cols-2 gap-3"
            onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
          >
            <Field label={t("date")}>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="h-10" />
            </Field>
            <Field label={t("category")}>
              <CategorySelect value={category} onChange={(v) => { setCategory(v); setHead(""); }} required />
            </Field>
            <Field label={t("head")}>
              <HeadSelect category={category} value={head} onChange={setHead} />
            </Field>
            <Field label={t("description")}>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} className="h-10" />
            </Field>
            <Field label={t("owner")}>
              <select value={ownerId} onChange={(e) => { setOwnerId(e.target.value); setVehicleNo(""); }} className="w-full h-10 rounded-md border border-input bg-input px-3 text-sm">
                <option value="">{t("all")}</option>
                {(owners as { id: string; name: string }[]).map((o) => <option key={o.id} value={o.id} className="bg-card">{o.name}</option>)}
              </select>
            </Field>
            <Field label={t("vehicleNo")}>
              <select value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value)} className="w-full h-10 rounded-md border border-input bg-input px-3 text-sm">
                <option value="">{t("all")}</option>
                {filteredVehicles.map((v) => <option key={v.vehicle_no} value={v.vehicle_no} className="bg-card">{v.vehicle_no}</option>)}
              </select>
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
