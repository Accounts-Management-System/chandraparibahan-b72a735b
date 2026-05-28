import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/lib/i18n";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/data-manufacturer")({ component: Page });

type Cat = { id: string; name: string };
type Head = { id: string; name: string; category_id: string };

function Page() {
  const { t } = useT();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [newCat, setNewCat] = useState("");
  const [headsText, setHeadsText] = useState("");

  const { data: cats = [] } = useQuery({
    queryKey: ["expense_categories"],
    queryFn: async () =>
      ((await supabase.from("expense_categories").select("*").order("name")).data ?? []) as Cat[],
  });

  const { data: heads = [] } = useQuery({
    queryKey: ["expense_heads", selected],
    enabled: !!selected,
    queryFn: async () =>
      ((await supabase.from("expense_heads").select("*").eq("category_id", selected!).order("name")).data ?? []) as Head[],
  });

  const addCat = useMutation({
    mutationFn: async () => {
      const v = newCat.trim();
      if (!v) return;
      const { error } = await supabase.from("expense_categories").insert({ name: v });
      if (error) throw error;
    },
    onSuccess: () => { setNewCat(""); qc.invalidateQueries({ queryKey: ["expense_categories"] }); toast.success(t("saved")); },
    onError: (e: any) => toast.error(e.message),
  });

  const delCat = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("expense_categories").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { setSelected(null); qc.invalidateQueries({ queryKey: ["expense_categories"] }); },
  });

  const addHeads = useMutation({
    mutationFn: async () => {
      if (!selected) return;
      const lines = headsText.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
      if (!lines.length) return;
      const rows = lines.map((name) => ({ category_id: selected, name }));
      const { error } = await supabase.from("expense_heads").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => { setHeadsText(""); qc.invalidateQueries({ queryKey: ["expense_heads", selected] }); toast.success(t("saved")); },
    onError: (e: any) => toast.error(e.message),
  });

  const delHead = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("expense_heads").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["expense_heads", selected] }),
  });

  return (
    <AppLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">{t("dataManufacturer")}</h1>
          <p className="text-sm text-muted-foreground">{t("category")} → {t("head")} ({t("dynamicDropdown")})</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Categories */}
          <div className="rounded-lg border border-border/60 bg-card/70 backdrop-blur p-4 space-y-3">
            <h2 className="font-semibold">{t("category")}</h2>
            <form onSubmit={(e) => { e.preventDefault(); addCat.mutate(); }} className="flex gap-2">
              <Input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder={t("category")} className="h-10" />
              <Button type="submit" size="icon" disabled={addCat.isPending}><Plus className="h-4 w-4" /></Button>
            </form>
            <ul className="space-y-1 max-h-96 overflow-y-auto">
              {cats.length === 0 && <li className="text-xs text-muted-foreground py-2">{t("noData")}</li>}
              {cats.map((c) => (
                <li
                  key={c.id}
                  onClick={() => setSelected(c.id)}
                  className={`flex items-center justify-between text-sm rounded-md border px-3 py-2 cursor-pointer ${selected === c.id ? "border-primary bg-primary/10" : "border-border/40"}`}
                >
                  <span>{c.name}</span>
                  <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); if (confirm(t("confirmDelete"))) delCat.mutate(c.id); }}>
                    <Trash2 className="h-4 w-4 text-rose-400" />
                  </Button>
                </li>
              ))}
            </ul>
          </div>

          {/* Heads */}
          <div className="rounded-lg border border-border/60 bg-card/70 backdrop-blur p-4 space-y-3">
            <h2 className="font-semibold">{t("head")} {selected && <span className="text-xs text-muted-foreground">({cats.find((c) => c.id === selected)?.name})</span>}</h2>
            {!selected ? (
              <p className="text-sm text-muted-foreground py-6 text-center">← {t("category")} {t("selectOrType")}</p>
            ) : (
              <>
                <form onSubmit={(e) => { e.preventDefault(); addHeads.mutate(); }} className="space-y-2">
                  <Textarea value={headsText} onChange={(e) => setHeadsText(e.target.value)} placeholder={t("headsHint")} rows={3} />
                  <Button type="submit" size="sm" disabled={addHeads.isPending}><Plus className="h-4 w-4 mr-2" />{t("add")}</Button>
                </form>
                <ul className="space-y-1 max-h-72 overflow-y-auto">
                  {heads.length === 0 && <li className="text-xs text-muted-foreground py-2">{t("noData")}</li>}
                  {heads.map((h) => (
                    <li key={h.id} className="flex items-center justify-between text-sm rounded-md border border-border/40 px-3 py-2">
                      <span>{h.name}</span>
                      <Button variant="ghost" size="icon" onClick={() => delHead.mutate(h.id)}>
                        <Trash2 className="h-4 w-4 text-rose-400" />
                      </Button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
