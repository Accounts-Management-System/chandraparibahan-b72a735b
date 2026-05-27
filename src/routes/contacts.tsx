import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { DataTable } from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/lib/i18n";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { z } from "zod";

export const Route = createFileRoute("/contacts")({
  component: Page,
  validateSearch: (s: Record<string, unknown>) =>
    z.object({ type: z.string().optional() }).parse(s),
});

const TYPES = [
  "individual",
  "company",
  "rental",
  "vendor",
  "owner",
  "helper",
  "partner",
] as const;

type Row = {
  id: string;
  name: string;
  type: string;
  phone: string | null;
  address: string | null;
  notes: string | null;
};

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
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contacts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contacts"] });
      toast.success(t("deleted"));
    },
  });
  const save = useMutation({
    mutationFn: async (form: any) => {
      if (editing) {
        const { error } = await supabase
          .from("contacts")
          .update(form)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("contacts").insert(form);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contacts"] });
      toast.success(t("saved"));
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const setFilter = (v: string) =>
    navigate({ search: { type: v === "all" ? undefined : v } });

  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{t("contacts")}</h1>
            {filterType !== "all" && (
              <p className="text-sm text-muted-foreground">{t(filterType as any)}</p>
            )}
          </div>
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            {t("add")}
          </Button>
        </div>

        {/* Filter buttons */}
        <div className="flex flex-wrap gap-2">
          <FilterBtn active={filterType === "all"} onClick={() => setFilter("all")}>
            {t("all")}
          </FilterBtn>
          {TYPES.map((tp) => (
            <FilterBtn
              key={tp}
              active={filterType === tp}
              onClick={() => setFilter(tp)}
            >
              {t(tp as any)}
            </FilterBtn>
          ))}
        </div>

        <DataTable<Row>
          rows={isLoading ? [] : rows}
          columns={[
            { key: "name", header: t("name") },
            { key: "type", header: t("type"), render: (r) => t(r.type as any) },
            { key: "phone", header: t("phone") },
            { key: "address", header: t("address") },
          ]}
          onEdit={(r) => {
            setEditing(r);
            setOpen(true);
          }}
          onDelete={(r) => {
            if (confirm(t("confirmDelete"))) del.mutate(r.id);
          }}
          emptyText={isLoading ? t("loading") : t("noData")}
        />
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("contacts")}</DialogTitle>
          </DialogHeader>
          <form
            className="grid grid-cols-2 gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              save.mutate({
                name: f.get("name"),
                type: f.get("type"),
                phone: f.get("phone") || null,
                address: f.get("address") || null,
                notes: f.get("notes") || null,
              });
            }}
          >
            <Input
              name="name"
              placeholder={t("name")}
              defaultValue={editing?.name}
              required
              className="col-span-2 h-11"
            />
            <select
              name="type"
              defaultValue={
                editing?.type ?? (filterType !== "all" ? filterType : "individual")
              }
              required
              className="col-span-2 w-full border border-input rounded-md h-11 px-3 bg-input text-foreground"
            >
              {TYPES.map((tp) => (
                <option key={tp} value={tp} className="bg-card">
                  {t(tp as any)}
                </option>
              ))}
            </select>
            <Input
              name="phone"
              placeholder={t("phone")}
              defaultValue={editing?.phone ?? ""}
              className="h-11"
            />
            <Input
              name="address"
              placeholder={t("address")}
              defaultValue={editing?.address ?? ""}
              className="h-11"
            />
            <Textarea
              name="notes"
              placeholder={t("notes")}
              defaultValue={editing?.notes ?? ""}
              rows={2}
              className="col-span-2"
            />
            <DialogFooter className="col-span-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={save.isPending}>
                {t("save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

function FilterBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${
        active
          ? "bg-gradient-to-r from-primary to-primary-glow text-primary-foreground border-transparent shadow-[0_4px_20px_-4px] shadow-primary/50"
          : "bg-card/60 border-border/60 text-muted-foreground hover:text-foreground hover:border-primary/40"
      }`}
    >
      {children}
    </button>
  );
}
