import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { DataTable } from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useT } from "@/lib/i18n";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { z } from "zod";

export const Route = createFileRoute("/contacts")({
  component: Page,
  validateSearch: (s: Record<string, unknown>) => z.object({ type: z.string().optional() }).parse(s),
});

const TYPES = ["individual","company","rental","vendor","owner","helper","partner","dada_bhai","mejho_bhai","choto_bhai","bordidi","mejhdidi"] as const;

type Row = { id: string; name: string; type: string; phone: string | null; address: string | null; notes: string | null };

function Page() {
  const { t } = useT();
  const qc = useQueryClient();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const filterType = search.type || "all";
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["contacts", filterType],
    queryFn: async () => {
      let q = supabase.from("contacts").select("*").order("name");
      if (filterType !== "all") q = q.eq("type", filterType as any);
      const { data, error } = await q;
      if (error) throw error;
      return data as Row[];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("contacts").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["contacts"] }); toast.success(t("deleted")); },
  });
  const save = useMutation({
    mutationFn: async (form: any) => {
      if (editing) { const { error } = await supabase.from("contacts").update(form).eq("id", editing.id); if (error) throw error; }
      else { const { error } = await supabase.from("contacts").insert(form); if (error) throw error; }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["contacts"] }); toast.success(t("saved")); setOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{t("contacts")}</h1>
            {filterType !== "all" && <p className="text-sm text-muted-foreground">{t(filterType as any)}</p>}
          </div>
          <div className="flex gap-2">
            <Select value={filterType} onValueChange={(v) => navigate({ search: { type: v === "all" ? undefined : v } })}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("all")}</SelectItem>
                {TYPES.map((tp) => <SelectItem key={tp} value={tp}>{t(tp as any)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="h-4 w-4 mr-2" />{t("add")}</Button>
          </div>
        </div>
        <DataTable<Row>
          rows={isLoading ? [] : rows}
          columns={[
            { key: "name", header: t("name") },
            { key: "type", header: t("type"), render: (r) => t(r.type as any) },
            { key: "phone", header: t("phone") },
            { key: "address", header: t("address") },
          ]}
          onEdit={(r) => { setEditing(r); setOpen(true); }}
          onDelete={(r) => { if (confirm(t("confirmDelete"))) del.mutate(r.id); }}
          emptyText={isLoading ? t("loading") : t("noData")}
        />
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("contacts")}</DialogTitle></DialogHeader>
          <form className="grid grid-cols-2 gap-3" onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            save.mutate({
              name: f.get("name"),
              type: f.get("type"),
              phone: f.get("phone") || null,
              address: f.get("address") || null,
              notes: f.get("notes") || null,
            });
          }}>
            <div><Label>{t("name")}</Label><Input name="name" defaultValue={editing?.name} required /></div>
            <div>
              <Label>{t("type")}</Label>
              <select name="type" defaultValue={editing?.type ?? (filterType !== "all" ? filterType : "individual")} required className="w-full border rounded-md h-9 px-2 bg-background">
                {TYPES.map((tp) => <option key={tp} value={tp}>{t(tp as any)}</option>)}
              </select>
            </div>
            <div><Label>{t("phone")}</Label><Input name="phone" defaultValue={editing?.phone ?? ""} /></div>
            <div><Label>{t("address")}</Label><Input name="address" defaultValue={editing?.address ?? ""} /></div>
            <div className="col-span-2"><Label>{t("notes")}</Label><Textarea name="notes" defaultValue={editing?.notes ?? ""} rows={2} /></div>
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
