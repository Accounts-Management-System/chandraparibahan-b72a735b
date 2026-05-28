import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { DataTable } from "@/components/DataTable";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useT, fmtNum } from "@/lib/i18n";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { createModerator, listManagedUsers, deleteManagedUser } from "@/lib/admin.functions";
import { useRole } from "@/lib/useRole";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/admin")({ component: Page });

function Page() {
  const { t } = useT();
  const { isAdmin, loading } = useRole();

  if (loading) {
    return <AppLayout><p className="text-muted-foreground">{t("loading")}</p></AppLayout>;
  }
  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="rounded-lg border bg-card p-6 text-center">
          <h1 className="text-xl font-bold mb-2">{t("admin")}</h1>
          <p className="text-muted-foreground">⛔ Admin only</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">{t("admin")}</h1>
        <Tabs defaultValue="calc">
          <TabsList>
            <TabsTrigger value="calc">{t("calculation")}</TabsTrigger>
            <TabsTrigger value="mods">{t("moderator")}</TabsTrigger>
            <TabsTrigger value="diary">{t("myDiary")}</TabsTrigger>
          </TabsList>
          <TabsContent value="calc"><CalcPanel /></TabsContent>
          <TabsContent value="mods"><ModeratorPanel /></TabsContent>
          <TabsContent value="diary"><DiaryPanel /></TabsContent>
        </Tabs>
    </AppLayout>
  );
}

function ModeratorPanel() {
  const { t } = useT();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const doCreate = useServerFn(createModerator);
  const doList = useServerFn(listManagedUsers);
  const doDelete = useServerFn(deleteManagedUser);

  const { data: users = [] } = useQuery({
    queryKey: ["managed-users"],
    queryFn: () => doList({}),
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />{t("createModerator")}
        </Button>
      </div>
      <div className="overflow-x-auto rounded-md border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted"><tr>
            <th className="text-left px-3 py-2">{t("email")}</th>
            <th className="text-left px-3 py-2">{t("role" as any)}</th>
            <th className="text-right px-3 py-2">{t("actions")}</th>
          </tr></thead>
          <tbody>
            {users.length === 0 && <tr><td colSpan={3} className="text-center py-6 text-muted-foreground">{t("noData")}</td></tr>}
            {users.map((u: any) => (
              <tr key={u.user_id} className="border-t">
                <td className="px-3 py-2">{u.email ?? u.user_id.slice(0, 8)}</td>
                <td className="px-3 py-2">{u.role}</td>
                <td className="px-3 py-2 text-right">
                  <Button size="icon" variant="ghost" onClick={async () => {
                    if (!confirm(t("confirmDelete"))) return;
                    try {
                      await doDelete({ data: { userId: u.user_id } });
                      toast.success(t("deleted"));
                      qc.invalidateQueries({ queryKey: ["managed-users"] });
                    } catch (e: any) { toast.error(e.message); }
                  }}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("createModerator")}</DialogTitle></DialogHeader>
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              try {
                await doCreate({
                  data: {
                    email: String(f.get("email") || ""),
                    password: String(f.get("password") || ""),
                    name: String(f.get("name") || ""),
                  },
                });
                toast.success(t("saved"));
                setOpen(false);
                qc.invalidateQueries({ queryKey: ["managed-users"] });
              } catch (err: any) { toast.error(err.message); }
            }}
          >
            <Input name="name" placeholder={t("name")} className="h-11" />
            <Input name="email" type="email" placeholder={t("email")} required className="h-11" />
            <Input name="password" type="password" placeholder={t("password")} required minLength={6} className="h-11" />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
              <Button type="submit">{t("submit")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type Diary = { id: string; entry_date: string; title: string; content: string | null };

function DiaryPanel() {
  const { t } = useT();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Diary | null>(null);

  const { data: rows = [] } = useQuery({
    queryKey: ["diary"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_diary")
        .select("id,entry_date,title,content")
        .order("entry_date", { ascending: false });
      if (error) throw error;
      return data as Diary[];
    },
  });

  const save = useMutation({
    mutationFn: async (form: any) => {
      if (editing) {
        const { error } = await supabase.from("admin_diary").update(form).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("admin_diary").insert({ ...form, user_id: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["diary"] });
      toast.success(t("saved"));
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("admin_diary").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["diary"] });
      toast.success(t("deleted"));
    },
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />{t("add")}
        </Button>
      </div>
      <DataTable<Diary>
        rows={rows}
        columns={[
          { key: "entry_date", header: t("date") },
          { key: "title", header: t("title") },
          { key: "content", header: t("content") },
        ]}
        onEdit={(r) => { setEditing(r); setOpen(true); }}
        onDelete={(r) => del.mutate(r.id)}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("myDiary")}</DialogTitle></DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              save.mutate({
                entry_date: f.get("entry_date"),
                title: f.get("title"),
                content: f.get("content") || null,
              });
            }}
          >
            <Input type="date" name="entry_date" defaultValue={editing?.entry_date ?? new Date().toISOString().slice(0, 10)} required className="h-11" />
            <Input name="title" placeholder={t("title")} defaultValue={editing?.title} required className="h-11" />
            <textarea name="content" placeholder={t("content")} defaultValue={editing?.content ?? ""} className="w-full min-h-[120px] rounded-md border border-input bg-input p-3 text-sm" />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
              <Button type="submit">{editing ? t("update") : t("submit")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
