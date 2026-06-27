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
import { Plus, Trash2, Camera, Sparkles, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { createModerator, listManagedUsers, deleteManagedUser } from "@/lib/admin.functions";
import { extractRowsFromImage, extractColumnFromImage } from "@/lib/ai-extract.functions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="calc">{t("calculation")}</TabsTrigger>
            <TabsTrigger value="mods">{t("moderator")}</TabsTrigger>
            <TabsTrigger value="diary">{t("myDiary")}</TabsTrigger>
            <TabsTrigger value="ai"><Sparkles className="h-3.5 w-3.5 mr-1" />AI এন্ট্রি</TabsTrigger>
          </TabsList>
          <TabsContent value="calc"><CalcPanel /></TabsContent>
          <TabsContent value="mods"><ModeratorPanel /></TabsContent>
          <TabsContent value="diary"><DiaryPanel /></TabsContent>
          <TabsContent value="ai"><AiEntryPanel /></TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

function CalcPanel() {
  const { t } = useT();
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 8) + "01";
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  // scope: "main" = ownerless, "all" = everything, or owner id
  const [scope, setScope] = useState<string>("main");

  const { data: owners = [] } = useQuery({
    queryKey: ["calc-owners"],
    queryFn: async () => (await supabase.from("owners").select("id,name").order("name")).data ?? [],
  });

  // vehicles with owner mapping (for trip filtering)
  const { data: vehiclesAll = [] } = useQuery({
    queryKey: ["calc-vehicles"],
    queryFn: async () => (await supabase.from("vehicles").select("vehicle_no,owner_id")).data ?? [],
  });

  const { data: trips = [] } = useQuery({
    queryKey: ["calc-trips", from, to],
    queryFn: async () => {
      const { data } = await supabase
        .from("trips")
        .select("vehicle_no,jama_1,jama_2,dena_1,dena_2")
        .gte("trip_date", from)
        .lte("trip_date", to);
      return data ?? [];
    },
  });
  const { data: others = [] } = useQuery({
    queryKey: ["calc-others", from, to],
    queryFn: async () => {
      const { data } = await supabase.from("other_incomes").select("amount,owner_id").gte("income_date", from).lte("income_date", to);
      return data ?? [];
    },
  });
  const { data: exps = [] } = useQuery({
    queryKey: ["calc-exps", from, to],
    queryFn: async () => {
      const { data } = await supabase.from("expenses").select("amount,owner_id").gte("expense_date", from).lte("expense_date", to);
      return data ?? [];
    },
  });

  // build vehicle_no -> owner_id map
  const vehOwner = new Map<string, string | null>();
  (vehiclesAll as any[]).forEach((v) => vehOwner.set(v.vehicle_no, v.owner_id));

  const tripMatches = (vehNo: string) => {
    if (scope === "all") return true;
    const owner = vehOwner.get(vehNo) ?? null;
    if (scope === "main") return !owner;
    return owner === scope;
  };
  const rowMatches = (ownerId: string | null) => {
    if (scope === "all") return true;
    if (scope === "main") return !ownerId;
    return ownerId === scope;
  };

  const tripsF = (trips as any[]).filter((r) => tripMatches(r.vehicle_no));
  const othersF = (others as any[]).filter((r) => rowMatches(r.owner_id));
  const expsF = (exps as any[]).filter((r) => rowMatches(r.owner_id));

  const deposit = tripsF.reduce((s, r) => s + Number(r.jama_1 || 0) + Number(r.jama_2 || 0), 0);
  const debit = tripsF.reduce((s, r) => s + Number(r.dena_1 || 0) + Number(r.dena_2 || 0), 0);
  const income = deposit - debit;
  const other = othersF.reduce((s, r) => s + Number(r.amount || 0), 0);
  const expense = expsF.reduce((s, r) => s + Number(r.amount || 0), 0);
  const net = income + other - expense;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setScope("main")}
          className={`px-3 py-2 rounded-md text-sm border ${scope === "main" ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border/60"}`}
        >
          মূল হিসাব (ওনার বাদে)
        </button>
        <button
          onClick={() => setScope("all")}
          className={`px-3 py-2 rounded-md text-sm border ${scope === "all" ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border/60"}`}
        >
          সব (একত্রে)
        </button>
        {(owners as { id: string; name: string }[]).map((o) => (
          <button
            key={o.id}
            onClick={() => setScope(o.id)}
            className={`px-3 py-2 rounded-md text-sm border ${scope === o.id ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border/60"}`}
          >
            {o.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground">From</label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-11" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">To</label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-11" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <CalcRow label={t("totalDeposit")} value={deposit} />
        <CalcRow label={t("totalDebit")} value={debit} />
        <CalcRow label={`${t("income")} (${t("totalDeposit")} − ${t("totalDebit")})`} value={income} highlight />
        <CalcRow label={t("totalOtherIncome")} value={other} />
        <CalcRow label={t("totalExpense")} value={expense} />
        <CalcRow label={t("netIncome")} value={net} highlight />
      </div>
    </div>
  );
}

function CalcRow({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  const { lang } = useT();
  return (
    <div className={`rounded-lg border p-4 ${highlight ? "border-primary/60 bg-primary/10" : "border-border/60 bg-card/60"}`}>
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className={`text-2xl font-bold ${highlight ? "text-primary" : ""}`}>{fmtNum(value, lang)}</div>
    </div>
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

type AiTarget = "trips" | "expenses";
type ColMeta = { name: string; type: string; desc: string };

const TARGET_COLUMNS: Record<AiTarget, ColMeta[]> = {
  trips: [
    { name: "trip_date", type: "date", desc: "তারিখ" },
    { name: "vehicle_no", type: "string", desc: "গাড়ীর নম্বর" },
    { name: "route_1", type: "string", desc: "১ম রুট" },
    { name: "jama_1", type: "number", desc: "১ম জমা" },
    { name: "dena_1", type: "number", desc: "১ম দেনা" },
    { name: "fare_1", type: "number", desc: "১ম ভাড়া" },
    { name: "route_2", type: "string", desc: "২য় রুট" },
    { name: "jama_2", type: "number", desc: "২য় জমা" },
    { name: "dena_2", type: "number", desc: "২য় দেনা" },
    { name: "fare_2", type: "number", desc: "২য় ভাড়া" },
    { name: "supervisor", type: "string", desc: "সুপারভাইজার" },
  ],
  expenses: [
    { name: "expense_date", type: "date", desc: "তারিখ" },
    { name: "vehicle_no", type: "string", desc: "গাড়ীর নম্বর" },
    { name: "category", type: "string", desc: "ক্যাটাগরি" },
    { name: "head", type: "string", desc: "হেড" },
    { name: "description", type: "string", desc: "বিবরণ" },
    { name: "vendor", type: "string", desc: "ভেন্ডর" },
    { name: "amount", type: "number", desc: "টাকা" },
  ],
};

function AiEntryPanel() {
  const qc = useQueryClient();
  const doExtract = useServerFn(extractRowsFromImage);
  const [target, setTarget] = useState<AiTarget>("trips");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [columns, setColumns] = useState<{ name: string; type: string; desc: string }[]>([]);

  async function onFile(f: File | null) {
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setImageUrl(String(reader.result));
    reader.readAsDataURL(f);
    setRows([]);
  }

  async function extract() {
    if (!imageUrl) { toast.error("আগে ছবি দিন"); return; }
    setLoading(true);
    try {
      const r: any = await doExtract({ data: { imageDataUrl: imageUrl, target } });
      setColumns(r.columns);
      setRows(r.rows.length ? r.rows : [Object.fromEntries(r.columns.map((c: any) => [c.name, c.type === "number" ? 0 : ""]))]);
      toast.success(`${r.rows.length}টি row পাওয়া গেছে`);
    } catch (e: any) {
      toast.error(e.message || "Extract ব্যর্থ");
    } finally {
      setLoading(false);
    }
  }

  function updateCell(rowIdx: number, key: string, value: string) {
    setRows((prev) => prev.map((r, i) => (i === rowIdx ? { ...r, [key]: value } : r)));
  }
  function addRow() {
    setRows((prev) => [...prev, Object.fromEntries(columns.map((c) => [c.name, c.type === "number" ? 0 : ""]))]);
  }
  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function save() {
    if (!rows.length) { toast.error("সেভ করার মত row নেই"); return; }
    setSaving(true);
    try {
      const payload = rows.map((r) => {
        const o: Record<string, any> = {};
        for (const c of columns) {
          const v = r[c.name];
          if (c.type === "number") {
            const n = Number(String(v ?? "").replace(/[^\d.-]/g, ""));
            o[c.name] = isNaN(n) ? 0 : n;
          } else if (c.type === "date") {
            o[c.name] = v || new Date().toISOString().slice(0, 10);
          } else {
            o[c.name] = v === "" ? null : v;
          }
        }
        return o;
      });
      // ensure required fields
      if (target === "trips") {
        payload.forEach((p) => { if (!p.vehicle_no) p.vehicle_no = "অজানা"; });
      } else {
        payload.forEach((p) => { if (!p.category) p.category = "অন্যান্য"; });
      }
      const { error } = await supabase.from(target).insert(payload as any);
      if (error) throw error;
      toast.success(`${payload.length}টি row সংরক্ষিত`);
      setRows([]);
      setImageUrl(null);
      qc.invalidateQueries();
    } catch (e: any) {
      toast.error(e.message || "সেভ ব্যর্থ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => { setTarget("trips"); setRows([]); }}
            className={`px-3 py-2 rounded-md text-sm border ${target === "trips" ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border/60"}`}
          >দৈনিক জমা (trips)</button>
          <button
            onClick={() => { setTarget("expenses"); setRows([]); }}
            className={`px-3 py-2 rounded-md text-sm border ${target === "expenses" ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border/60"}`}
          >খরচ (expenses)</button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border/60 p-4 cursor-pointer hover:bg-muted/50">
            <Camera className="h-5 w-5" />
            <span className="text-xs">ক্যামেরা</span>
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
          </label>
          <label className="flex flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border/60 p-4 cursor-pointer hover:bg-muted/50">
            <Plus className="h-5 w-5" />
            <span className="text-xs">গ্যালারী</span>
            <input type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
          </label>
        </div>

        {imageUrl && (
          <div className="space-y-2">
            <img src={imageUrl} alt="preview" className="max-h-64 mx-auto rounded-md border" />
            <Button onClick={extract} disabled={loading} className="w-full">
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
              {loading ? "পড়া হচ্ছে..." : "লেখা বের কর"}
            </Button>
          </div>
        )}
      </div>

      {rows.length > 0 && (
        <div className="space-y-3">
          <div className="overflow-x-auto rounded-md border bg-card">
            <table className="w-full text-xs">
              <thead className="bg-muted">
                <tr>
                  {columns.map((c) => (
                    <th key={c.name} className="text-left px-2 py-2 whitespace-nowrap">{c.name}</th>
                  ))}
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t">
                    {columns.map((c) => (
                      <td key={c.name} className="px-1 py-1">
                        <Input
                          type={c.type === "date" ? "date" : c.type === "number" ? "number" : "text"}
                          value={r[c.name] ?? ""}
                          onChange={(e) => updateCell(i, c.name, e.target.value)}
                          className="h-9 min-w-[110px]"
                        />
                      </td>
                    ))}
                    <td className="px-1 py-1">
                      <Button size="icon" variant="ghost" onClick={() => removeRow(i)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={addRow}><Plus className="h-4 w-4 mr-1" />Row</Button>
            <Button onClick={save} disabled={saving} className="flex-1">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              OK — সেভ কর ({rows.length})
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
