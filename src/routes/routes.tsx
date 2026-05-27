import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { DataTable } from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useT, fmtNum } from "@/lib/i18n";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/routes")({ component: Page });

type RouteRow = { id: string; name: string; fare: number; vehicle_id: string | null };

function Page() {
  const { t, lang } = useT();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RouteRow | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["routes-global"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicle_routes")
        .select("id,name,fare,vehicle_id")
        .order("fare");
      if (error) throw error;
      return (data ?? []) as RouteRow[];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vehicle_routes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["routes-global"] });
      qc.invalidateQueries({ queryKey: ["all-routes"] });
      toast.success(t("deleted"));
    },
  });

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{t("routes")}</h1>
          <Button onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />{t("add")}
          </Button>
        </div>
        <DataTable<RouteRow>
          rows={isLoading ? [] : rows}
          columns={[
            { key: "fare", header: t("fare"), render: (r) => fmtNum(r.fare, lang) },
            { key: "name", header: t("routeName") },
          ]}
          onEdit={(r) => { setEditing(r); setOpen(true); }}
          onDelete={(r) => { if (confirm(t("confirmDelete"))) del.mutate(r.id); }}
          emptyText={isLoading ? t("loading") : t("noData")}
        />
      </div>
      <RouteDialog open={open} onOpenChange={setOpen} editing={editing} />
    </AppLayout>
  );
}

function RouteDialog({
  open, onOpenChange, editing,
}: { open: boolean; onOpenChange: (v: boolean) => void; editing: RouteRow | null }) {
  const { t } = useT();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [fare, setFare] = useState<number | "">("");

  useEffect(() => {
    if (open) {
      setName(editing?.name ?? "");
      setFare(editing?.fare ?? "");
    }
  }, [open, editing]);

  const clearForm = () => { setName(""); setFare(""); };

  const save = useMutation({
    mutationFn: async () => {
      const payload = { name: name.trim(), fare: Number(fare || 0), vehicle_id: null as string | null };
      if (editing) {
        const { error } = await supabase.from("vehicle_routes").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("vehicle_routes").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["routes-global"] });
      qc.invalidateQueries({ queryKey: ["all-routes"] });
      toast.success(t("saved"));
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{t("routes")}</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-3">
          <div className="grid grid-cols-[120px_1fr] gap-2">
            <Input
              type="number" step="any"
              value={fare}
              onChange={(e) => setFare(e.target.value === "" ? "" : Number(e.target.value))}
              placeholder={t("fare")} required className="h-10"
            />
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("routeName")} required className="h-10" />
          </div>
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
