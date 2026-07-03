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
import { Plus, Trash2, Loader2, Table as TableIcon } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { createModerator, listManagedUsers, deleteManagedUser, assignModeratorRole } from "@/lib/admin.functions";
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
        <Tabs defaultValue="bulk">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="bulk"><TableIcon className="h-3.5 w-3.5 mr-1" />বাল্ক এন্ট্রি</TabsTrigger>
            <TabsTrigger value="calc">{t("calculation")}</TabsTrigger>
            <TabsTrigger value="mods">{t("moderator")}</TabsTrigger>
            <TabsTrigger value="diary">{t("myDiary")}</TabsTrigger>
          </TabsList>
          <TabsContent value="bulk"><BulkEntryPanel /></TabsContent>
          <TabsContent value="calc"><CalcPanel /></TabsContent>
          <TabsContent value="mods"><ModeratorPanel /></TabsContent>
          <TabsContent value="diary"><DiaryPanel /></TabsContent>
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
  const [repairEmail, setRepairEmail] = useState("");
  const [repairing, setRepairing] = useState(false);
  const doCreate = useServerFn(createModerator);
  const doList = useServerFn(listManagedUsers);
  const doDelete = useServerFn(deleteManagedUser);
  const doAssign = useServerFn(assignModeratorRole);

  const { data: users = [] } = useQuery({
    queryKey: ["managed-users"],
    queryFn: () => doList({}),
  });

  const handleRepair = async () => {
    const email = repairEmail.trim();
    if (!email) return;
    setRepairing(true);
    try {
      const res: any = await doAssign({ data: { email } });
      toast.success(res.alreadyAssigned ? "রোল আগেই সেট আছে" : "মডারেটর রোল যুক্ত হয়েছে");
      setRepairEmail("");
      qc.invalidateQueries({ queryKey: ["managed-users"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setRepairing(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />{t("createModerator")}
        </Button>
      </div>
      <div className="rounded-md border bg-card/60 p-3 space-y-2">
        <div className="text-sm font-semibold">ডাটা শো না করলে রোল মেরামত করুন</div>
        <div className="text-xs text-muted-foreground">
          যদি কোনো মডারেটর লগইন করে কিন্তু কোনো ডাটা দেখতে না পায়, নিচে তার ইমেইল লিখে "মডারেটর রোল দিন" ক্লিক করুন।
        </div>
        <div className="flex gap-2">
          <Input
            type="email"
            placeholder="moderator@gmail.com"
            value={repairEmail}
            onChange={(e) => setRepairEmail(e.target.value)}
            className="h-10"
          />
          <Button onClick={handleRepair} disabled={repairing || !repairEmail}>
            {repairing ? "..." : "মডারেটর রোল দিন"}
          </Button>
        </div>
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

type BulkRow = {
  trip_date: string;
  vehicle_no: string;
  jama_1: string;
  jama_2: string;
  dena_1: string;
  dena_2: string;
  supervisor: string;
};

function emptyBulkRow(defaultDate: string): BulkRow {
  return { trip_date: defaultDate, vehicle_no: "", jama_1: "", jama_2: "", dena_1: "", dena_2: "", supervisor: "" };
}

function BulkEntryPanel() {
  const { t, lang } = useT();
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [rows, setRows] = useState<BulkRow[]>(() =>
    Array.from({ length: 5 }, () => emptyBulkRow(today)),
  );
  const [saving, setSaving] = useState(false);

  const { data: vehicles = [] } = useQuery({
    queryKey: ["bulk-vehicles"],
    queryFn: async () =>
      ((await supabase.from("vehicles").select("vehicle_no").order("vehicle_no")).data ?? []) as { vehicle_no: string }[],
  });
  const { data: supervisors = [] } = useQuery({
    queryKey: ["entry_lookups", "supervisor"],
    queryFn: async () => {
      const { data } = await supabase.from("entry_lookups").select("value").eq("kind", "supervisor").order("value");
      return ((data ?? []) as { value: string }[]).map((r) => r.value);
    },
  });

  const update = (i: number, key: keyof BulkRow, value: string) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)));

  const addRow = () => setRows((prev) => [...prev, emptyBulkRow(prev[prev.length - 1]?.trip_date || today)]);
  const removeRow = (i: number) => setRows((prev) => prev.filter((_, idx) => idx !== i));
  const clearAll = () => setRows(Array.from({ length: 5 }, () => emptyBulkRow(today)));

  const num = (v: string) => Number(String(v || "").replace(/[^\d.-]/g, "")) || 0;
  const rowBalance = (r: BulkRow) => num(r.jama_1) + num(r.jama_2) - num(r.dena_1) - num(r.dena_2);

  const validRows = rows.filter((r) => r.vehicle_no.trim());
  const totalJama = validRows.reduce((s, r) => s + num(r.jama_1) + num(r.jama_2), 0);
  const totalDena = validRows.reduce((s, r) => s + num(r.dena_1) + num(r.dena_2), 0);
  const totalBal = totalJama - totalDena;

  async function saveAll() {
    if (!validRows.length) { toast.error("অন্তত একটি গাড়ীর নম্বর দিন"); return; }
    setSaving(true);
    try {
      const payload = validRows.map((r) => ({
        trip_date: r.trip_date || today,
        vehicle_no: r.vehicle_no.trim(),
        jama_1: num(r.jama_1),
        jama_2: num(r.jama_2),
        dena_1: num(r.dena_1),
        dena_2: num(r.dena_2),
        fare_1: 0,
        fare_2: 0,
        route_1: null,
        route_2: null,
        supervisor: r.supervisor.trim() || null,
      }));
      const { error } = await supabase.from("trips").insert(payload);
      if (error) throw error;
      toast.success(`${payload.length}টি এন্ট্রি সেভ হয়েছে`);
      clearAll();
      qc.invalidateQueries();
    } catch (e: any) {
      toast.error(e.message || "সেভ ব্যর্থ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-md border bg-card/60 p-3 text-xs text-muted-foreground">
        এক্সেলের মত সেলে ডাটা লিখে "OK — সব সেভ কর" ক্লিক করুন। ব্যালেন্স ও যোগফল স্বয়ংক্রিয়ভাবে হিসাব হবে এবং দৈনিক জমা হিসাবে যুক্ত হয়ে দৈনিক রিপোর্টে দেখাবে।
      </div>

      <div className="overflow-x-auto rounded-md border bg-card">
        <table className="w-full text-xs">
          <thead className="bg-muted">
            <tr>
              <th className="px-2 py-2 text-center w-10">SL</th>
              <th className="px-2 py-2 text-left min-w-[140px]">{t("date")}</th>
              <th className="px-2 py-2 text-left min-w-[130px]">{t("vehicleNo")}</th>
              <th className="px-2 py-2 text-right min-w-[100px] text-emerald-500">জমা ১</th>
              <th className="px-2 py-2 text-right min-w-[100px] text-emerald-500">জমা ২</th>
              <th className="px-2 py-2 text-right min-w-[100px] text-rose-500">দেনা ১</th>
              <th className="px-2 py-2 text-right min-w-[100px] text-rose-500">দেনা ২</th>
              <th className="px-2 py-2 text-right min-w-[100px] text-primary">{t("balance")}</th>
              <th className="px-2 py-2 text-left min-w-[140px]">{t("supervisor")}</th>
              <th className="px-2 py-2 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t">
                <td className="px-2 py-1 text-center text-muted-foreground">{fmtNum(i + 1, lang)}</td>
                <td className="px-1 py-1">
                  <Input type="date" value={r.trip_date} onChange={(e) => update(i, "trip_date", e.target.value)} className="h-9" />
                </td>
                <td className="px-1 py-1">
                  <input
                    list="bulk-vehicles-list"
                    value={r.vehicle_no}
                    onChange={(e) => update(i, "vehicle_no", e.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                    placeholder="গাড়ী…"
                  />
                </td>
                <td className="px-1 py-1"><Input type="number" step="any" value={r.jama_1} onChange={(e) => update(i, "jama_1", e.target.value)} className="h-9 text-right text-emerald-600 dark:text-emerald-400" /></td>
                <td className="px-1 py-1"><Input type="number" step="any" value={r.jama_2} onChange={(e) => update(i, "jama_2", e.target.value)} className="h-9 text-right text-emerald-600 dark:text-emerald-400" /></td>
                <td className="px-1 py-1"><Input type="number" step="any" value={r.dena_1} onChange={(e) => update(i, "dena_1", e.target.value)} className="h-9 text-right text-rose-600 dark:text-rose-400" /></td>
                <td className="px-1 py-1"><Input type="number" step="any" value={r.dena_2} onChange={(e) => update(i, "dena_2", e.target.value)} className="h-9 text-right text-rose-600 dark:text-rose-400" /></td>
                <td className={`px-2 py-1 text-right font-semibold ${rowBalance(r) >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                  {fmtNum(rowBalance(r), lang)}
                </td>
                <td className="px-1 py-1">
                  <input
                    list="bulk-supervisors-list"
                    value={r.supervisor}
                    onChange={(e) => update(i, "supervisor", e.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                    placeholder="সুপারভাইজার…"
                  />
                </td>
                <td className="px-1 py-1 text-center">
                  <Button size="icon" variant="ghost" onClick={() => removeRow(i)} disabled={rows.length <= 1}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-muted/50 font-semibold">
            <tr className="border-t">
              <td colSpan={3} className="px-2 py-2 text-right">মোট</td>
              <td colSpan={2} className="px-2 py-2 text-right text-emerald-500">{fmtNum(totalJama, lang)}</td>
              <td colSpan={2} className="px-2 py-2 text-right text-rose-500">{fmtNum(totalDena, lang)}</td>
              <td className={`px-2 py-2 text-right ${totalBal >= 0 ? "text-emerald-500" : "text-rose-500"}`}>{fmtNum(totalBal, lang)}</td>
              <td colSpan={2}></td>
            </tr>
          </tfoot>
        </table>
        <datalist id="bulk-vehicles-list">
          {vehicles.map((v) => <option key={v.vehicle_no} value={v.vehicle_no} />)}
        </datalist>
        <datalist id="bulk-supervisors-list">
          {supervisors.map((s) => <option key={s} value={s} />)}
        </datalist>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={addRow}><Plus className="h-4 w-4 mr-1" />রো যোগ</Button>
        <Button variant="ghost" onClick={clearAll}>ক্লিয়ার</Button>
        <Button onClick={saveAll} disabled={saving} className="flex-1 min-w-[160px]">
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          OK — সব সেভ কর ({validRows.length})
        </Button>
      </div>
    </div>
  );
}

