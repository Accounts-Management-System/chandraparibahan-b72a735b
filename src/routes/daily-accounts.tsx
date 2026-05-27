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

export const Route = createFileRoute("/daily-accounts")({
  component: DailyAccountsPage,
});

type Trip = {
  id: string;
  trip_date: string;
  vehicle_no: string;
  jama_1: number; jama_2: number;
  dena_1: number; dena_2: number;
  fare_1: number; fare_2: number;
  supervisor: string | null;
  notes: string | null;
};

function DailyAccountsPage() {
  const { t, lang } = useT();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Trip | null>(null);
  const [search, setSearch] = useState("");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["trips"],
    queryFn: async () => {
      const { data, error } = await supabase.from("trips").select("*").order("trip_date", { ascending: false }).limit(500);
      if (error) throw error;
      return data as Trip[];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("trips").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["trips"] }); toast.success(t("deleted")); },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = rows.filter((r) =>
    !search || r.vehicle_no.toLowerCase().includes(search.toLowerCase()) || r.supervisor?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{t("dailyAccounts")}</h1>
            <p className="text-sm text-muted-foreground">{t("brand")} — {t("dailyAccounts")}</p>
          </div>
          <Button onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />{t("add")}
          </Button>
        </div>

        <Input placeholder={t("search")} value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />

        <DataTable<Trip>
          rows={isLoading ? [] : filtered}
          columns={[
            { key: "trip_date", header: t("date"), render: (r) => fmtDate(r.trip_date, lang) },
            { key: "vehicle_no", header: t("vehicleNo") },
            { key: "jama_1", header: t("jama1"), render: (r) => fmtNum(r.jama_1, lang) },
            { key: "jama_2", header: t("jama2"), render: (r) => fmtNum(r.jama_2, lang) },
            { key: "dena_1", header: t("dena1"), render: (r) => fmtNum(r.dena_1, lang) },
            { key: "dena_2", header: t("dena2"), render: (r) => fmtNum(r.dena_2, lang) },
            { key: "fare_1", header: t("fare1"), render: (r) => fmtNum(r.fare_1, lang) },
            { key: "supervisor", header: t("supervisor") },
          ]}
          onEdit={(r) => { setEditing(r); setOpen(true); }}
          onDelete={(r) => del.mutate(r.id)}
          emptyText={isLoading ? t("loading") : t("noData")}
        />
      </div>

      <TripDialog open={open} onOpenChange={setOpen} editing={editing} />
    </AppLayout>
  );
}

function TripDialog({ open, onOpenChange, editing }: { open: boolean; onOpenChange: (v: boolean) => void; editing: Trip | null }) {
  const { t } = useT();
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: async (form: any) => {
      if (editing) {
        const { error } = await supabase.from("trips").update(form).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("trips").insert(form);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["trips"] }); toast.success(t("saved")); onOpenChange(false); },
    onError: (e: any) => toast.error(e.message),
  });

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    save.mutate({
      trip_date: f.get("trip_date"),
      vehicle_no: f.get("vehicle_no"),
      jama_1: Number(f.get("jama_1") || 0),
      jama_2: Number(f.get("jama_2") || 0),
      dena_1: Number(f.get("dena_1") || 0),
      dena_2: Number(f.get("dena_2") || 0),
      fare_1: Number(f.get("fare_1") || 0),
      fare_2: Number(f.get("fare_2") || 0),
      supervisor: f.get("supervisor") || null,
      notes: f.get("notes") || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{t("dailyAccounts")}</DialogTitle></DialogHeader>
        <form onSubmit={onSubmit} className="grid grid-cols-2 gap-3">
          <Field name="trip_date" label={t("date")} type="date" defaultValue={editing?.trip_date ?? new Date().toISOString().slice(0,10)} required />
          <Field name="vehicle_no" label={t("vehicleNo")} defaultValue={editing?.vehicle_no} required />
          <Field name="jama_1" label={t("jama1")} type="number" step="any" defaultValue={editing?.jama_1 ?? 0} />
          <Field name="jama_2" label={t("jama2")} type="number" step="any" defaultValue={editing?.jama_2 ?? 0} />
          <Field name="dena_1" label={t("dena1")} type="number" step="any" defaultValue={editing?.dena_1 ?? 0} />
          <Field name="dena_2" label={t("dena2")} type="number" step="any" defaultValue={editing?.dena_2 ?? 0} />
          <Field name="fare_1" label={t("fare1")} type="number" step="any" defaultValue={editing?.fare_1 ?? 0} />
          <Field name="fare_2" label={t("fare2")} type="number" step="any" defaultValue={editing?.fare_2 ?? 0} />
          <Field name="supervisor" label={t("supervisor")} defaultValue={editing?.supervisor ?? ""} />
          <div className="col-span-2">
            <Label>{t("notes")}</Label>
            <Textarea name="notes" defaultValue={editing?.notes ?? ""} rows={2} />
          </div>
          <DialogFooter className="col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("cancel")}</Button>
            <Button type="submit" disabled={save.isPending}>{t("save")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, ...props }: any) {
  return (
    <div>
      <Label>{label}</Label>
      <Input {...props} />
    </div>
  );
}
