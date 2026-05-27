import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT } from "@/lib/i18n";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/data-manufacturer")({ component: Page });

type Row = { id: string; kind: "category" | "head" | "description"; value: string };

const KINDS: { kind: Row["kind"]; key: "category" | "head" | "description" }[] = [
  { kind: "category", key: "category" },
  { kind: "head", key: "head" },
  { kind: "description", key: "description" },
];

function Page() {
  const { t } = useT();
  return (
    <AppLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">{t("dataManufacturer")}</h1>
          <p className="text-sm text-muted-foreground">{t("manage")} — {t("category")} / {t("head")} / {t("description")}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {KINDS.map((k) => (
            <KindCard key={k.kind} kind={k.kind} title={t(k.key)} />
          ))}
        </div>
      </div>
    </AppLayout>
  );
}

function KindCard({ kind, title }: { kind: Row["kind"]; title: string }) {
  const { t } = useT();
  const qc = useQueryClient();
  const [val, setVal] = useState("");

  const { data: rows = [] } = useQuery({
    queryKey: ["entry_lookups", kind],
    queryFn: async () => {
      const { data } = await supabase.from("entry_lookups").select("*").eq("kind", kind).order("value");
      return (data ?? []) as Row[];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const v = val.trim();
      if (!v) return;
      const { error } = await supabase.from("entry_lookups").insert({ kind, value: v });
      if (error) throw error;
    },
    onSuccess: () => { setVal(""); qc.invalidateQueries({ queryKey: ["entry_lookups", kind] }); toast.success(t("saved")); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("entry_lookups").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["entry_lookups", kind] }); },
  });

  return (
    <div className="rounded-lg border border-border/60 bg-card/70 backdrop-blur p-4 space-y-3">
      <h2 className="font-semibold">{title}</h2>
      <form onSubmit={(e) => { e.preventDefault(); add.mutate(); }} className="flex gap-2">
        <Input value={val} onChange={(e) => setVal(e.target.value)} placeholder={t("value")} className="h-10" />
        <Button type="submit" size="icon" disabled={add.isPending}><Plus className="h-4 w-4" /></Button>
      </form>
      <ul className="space-y-1 max-h-72 overflow-y-auto">
        {rows.length === 0 && <li className="text-xs text-muted-foreground py-2">{t("noData")}</li>}
        {rows.map((r) => (
          <li key={r.id} className="flex items-center justify-between text-sm rounded-md border border-border/40 px-3 py-2">
            <span>{r.value}</span>
            <Button variant="ghost" size="icon" onClick={() => del.mutate(r.id)}>
              <Trash2 className="h-4 w-4 text-rose-400" />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
