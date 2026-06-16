import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { DataTable } from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useT } from "@/lib/i18n";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { offlineFrom } from "@/lib/offline/supabaseWrite";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, KeyRound, Eye } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import {
  createShareholderLogin,
  resetUserPin,
} from "@/lib/admin.functions";
import { useRole } from "@/lib/useRole";

export const Route = createFileRoute("/contacts")({ component: Page });

type Row = {
  id: string;
  name: string;
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
  login_id: string | null;
  auth_user_id: string | null;
  is_active: boolean;
};

function Page() {
  const { t } = useT();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { canWrite, isAdmin } = useRole();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [loginFor, setLoginFor] = useState<Row | null>(null);
  const [resetFor, setResetFor] = useState<Row | null>(null);

  const createLogin = useServerFn(createShareholderLogin);
  const doResetPin = useServerFn(resetUserPin);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["shareholders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("id,name,phone,whatsapp,address,login_id,auth_user_id,is_active")
        .order("name");
      if (error) throw error;
      return data as Row[];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await offlineFrom("contacts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shareholders"] });
      toast.success(t("deleted"));
    },
  });

  const save = useMutation({
    mutationFn: async (form: any) => {
      if (editing) {
        const { error } = await offlineFrom("contacts").update(form).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("contacts")
          .insert({ ...form, type: "partner" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shareholders"] });
      toast.success(t("saved"));
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{t("shareholders")}</h1>
            <p className="text-sm text-muted-foreground">{t("brand")}</p>
          </div>
          {isAdmin && (
            <Button onClick={() => { setEditing(null); setOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />{t("add")}
            </Button>
          )}
        </div>

        <DataTable<Row>
          rows={isLoading ? [] : rows}
          columns={[
            { key: "name", header: t("name") },
            { key: "phone", header: t("phone") },
            { key: "whatsapp", header: t("whatsapp") },
            { key: "login_id", header: t("loginId"), render: (r) => r.login_id ?? "—" },
            {
              key: "is_active",
              header: t("active"),
              render: (r) => (
                <span className={r.is_active ? "text-emerald-400" : "text-rose-400"}>
                  {r.is_active ? "✓" : "✗"}
                </span>
              ),
            },
            {
              key: "actions2",
              header: t("actions"),
              render: (r) => (
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate({ to: "/data-bank", search: { shareholder: r.id } as any })}
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    {t("viewData")}
                  </Button>
                  {isAdmin && (
                    r.auth_user_id ? (
                      <Button size="sm" variant="ghost" onClick={() => setResetFor(r)}>
                        <KeyRound className="h-3 w-3 mr-1" />
                        {t("resetPin")}
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => setLoginFor(r)}>
                        {t("createLogin")}
                      </Button>
                    )
                  )}
                </div>
              ),
            },
          ]}
          onEdit={isAdmin ? (r) => { setEditing(r); setOpen(true); } : undefined}
          onDelete={isAdmin ? (r) => del.mutate(r.id) : undefined}
          emptyText={isLoading ? t("loading") : t("noData")}
        />
        {!canWrite && (
          <p className="text-xs text-muted-foreground">{t("guestReadOnly")}</p>
        )}
      </div>

      {/* Add / Edit Shareholder Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("shareholders")}</DialogTitle></DialogHeader>
          <form
            className="grid grid-cols-2 gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              save.mutate({
                name: f.get("name"),
                phone: f.get("phone") || null,
                whatsapp: f.get("whatsapp") || null,
                address: f.get("address") || null,
                is_active: f.get("is_active") === "on",
              });
            }}
          >
            <Input name="name" placeholder={t("name")} defaultValue={editing?.name} required className="col-span-2 h-11" />
            <Input name="phone" placeholder={t("phone")} defaultValue={editing?.phone ?? ""} className="h-11" />
            <Input name="whatsapp" placeholder={t("whatsapp")} defaultValue={editing?.whatsapp ?? ""} className="h-11" />
            <Input name="address" placeholder={t("address")} defaultValue={editing?.address ?? ""} className="col-span-2 h-11" />
            <label className="col-span-2 flex items-center gap-2 text-sm">
              <input type="checkbox" name="is_active" defaultChecked={editing?.is_active ?? true} />
              {t("active")}
            </label>
            <DialogFooter className="col-span-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
              <Button type="submit" disabled={save.isPending}>{editing ? t("update") : t("submit")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create Login dialog */}
      <Dialog open={!!loginFor} onOpenChange={(v) => !v && setLoginFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("createLogin")} — {loginFor?.name}</DialogTitle></DialogHeader>
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              try {
                await createLogin({
                  data: {
                    contactId: loginFor!.id,
                    loginId: String(f.get("loginId") || ""),
                    pin: String(f.get("pin") || ""),
                  },
                });
                toast.success(t("saved"));
                setLoginFor(null);
                qc.invalidateQueries({ queryKey: ["shareholders"] });
              } catch (err: any) {
                toast.error(err.message);
              }
            }}
          >
            <Input name="loginId" placeholder={t("loginId")} required minLength={3} className="h-11" />
            <Input name="pin" placeholder={t("pin")} required minLength={4} className="h-11" />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setLoginFor(null)}>{t("cancel")}</Button>
              <Button type="submit">{t("submit")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reset PIN dialog */}
      <Dialog open={!!resetFor} onOpenChange={(v) => !v && setResetFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("resetPin")} — {resetFor?.name}</DialogTitle></DialogHeader>
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              try {
                await doResetPin({
                  data: {
                    authUserId: resetFor!.auth_user_id!,
                    pin: String(f.get("pin") || ""),
                  },
                });
                toast.success(t("pinSet"));
                setResetFor(null);
              } catch (err: any) {
                toast.error(err.message);
              }
            }}
          >
            <Input name="pin" placeholder={t("newPin")} required minLength={4} className="h-11" />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setResetFor(null)}>{t("cancel")}</Button>
              <Button type="submit">{t("submit")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
