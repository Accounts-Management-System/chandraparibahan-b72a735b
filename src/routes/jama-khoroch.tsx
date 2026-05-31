import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DataTable } from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useT, fmtNum, fmtDate } from "@/lib/i18n";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, FileDown } from "lucide-react";
import { useRole } from "@/lib/useRole";
import { exportPdf } from "@/lib/exportPdf";
import { LookupSelect } from "@/components/LookupSelect";
import { CategorySelect, HeadSelect } from "@/components/CategoryHeadSelect";
import { OwnerSelect } from "@/components/OwnerSelect";
import { SearchFilters, MiniDashboard, matchesFilters, emptyFilters, type FilterState } from "@/components/SearchFilters";

export const Route = createFileRoute("/jama-khoroch")({ component: Page });

type TripRow = {
  id: string;
  trip_date: string;
  vehicle_no: string;
  fare_1: number; fare_2: number;
};
type ERow = { id: string; expense_date: string; vehicle_no: string | null; category: string | null; head: string | null; description: string | null; amount: number; owner_id: string | null };
type OIRow = { id: string; income_date: string; vehicle_no: string | null; category: string | null; head: string | null; description: string | null; amount: number; owner_id: string | null };
type JRow = {
  id: string;
  source: "trip" | "other";
  date: string;
  owner_id: string | null;
  owner_label: string;
  vehicle_no: string | null;
  category: string | null;
  head: string | null;
  description: string | null;
  amount: number;
};

function Page() {
  const { t, lang } = useT();
  const qc = useQueryClient();
  const { isAdmin, loading } = useRole();
  const [tab, setTab] = useState("jama");
  const [editE, setEditE] = useState<ERow | null>(null);
  const [openE, setOpenE] = useState(false);
  const [openJ, setOpenJ] = useState(false);
  const [editJ, setEditJ] = useState<OIRow | null>(null);
  const [ownerScope, setOwnerScope] = useState<string>("main"); // "main" | "all" | owner.id

  const { data: owners = [] } = useQuery({
    queryKey: ["jk-owners"],
    queryFn: async () => (await supabase.from("owners").select("id,name").order("name")).data ?? [],
    enabled: isAdmin,
  });

  const { data: vehiclesAll = [] } = useQuery({
    queryKey: ["jk-vehicles"],
    queryFn: async () => (await supabase.from("vehicles").select("vehicle_no,owner_id")).data ?? [],
    enabled: isAdmin,
  });
  const vehOwner = useMemo(() => {
    const m = new Map<string, string | null>();
    (vehiclesAll as any[]).forEach((v) => m.set(v.vehicle_no, v.owner_id));
    return m;
  }, [vehiclesAll]);
  const ownerName = useMemo(() => {
    const m = new Map<string, string>();
    (owners as { id: string; name: string }[]).forEach((o) => m.set(o.id, o.name));
    return m;
  }, [owners]);

  const { data: trips = [] } = useQuery({
    queryKey: ["jk-trips"],
    queryFn: async () => {
      const { data } = await supabase
        .from("trips")
        .select("id,trip_date,vehicle_no,fare_1,fare_2")
        .order("trip_date", { ascending: false })
        .limit(1000);
      return (data ?? []) as TripRow[];
    },
    enabled: isAdmin,
  });
  const { data: khoroch = [] } = useQuery({
    queryKey: ["jk-khoroch"],
    queryFn: async () => {
      const { data } = await supabase
        .from("expenses").select("*")
        .not("owner_id", "is", null)
        .order("expense_date", { ascending: false }).limit(500);
      return (data ?? []) as ERow[];
    },
    enabled: isAdmin,
  });
  const { data: otherIncomes = [] } = useQuery({
    queryKey: ["jk-other-incomes"],
    queryFn: async () => {
      const { data } = await supabase
        .from("other_incomes").select("*")
        .order("income_date", { ascending: false }).limit(500);
      return (data ?? []) as OIRow[];
    },
    enabled: isAdmin,
  });

  const tripsWithOwner = useMemo(() => trips.map((t) => {
    const oid = vehOwner.get(t.vehicle_no) ?? null;
    return {
      ...t,
      owner_id: oid,
      owner_label: oid ? (ownerName.get(oid) ?? "—") : "মূল",
      fare: Number(t.fare_1 || 0) + Number(t.fare_2 || 0),
    };
  }), [trips, vehOwner, ownerName]);

  const jamaRows: JRow[] = useMemo(() => {
    const fromTrips: JRow[] = tripsWithOwner.map((t) => ({
      id: `t:${t.id}`,
      source: "trip",
      date: t.trip_date,
      owner_id: t.owner_id,
      owner_label: t.owner_label,
      vehicle_no: t.vehicle_no,
      category: "ভাড়া",
      head: null,
      description: null,
      amount: t.fare,
    }));
    const fromOther: JRow[] = (otherIncomes as OIRow[]).map((o) => ({
      id: `o:${o.id}`,
      source: "other",
      date: o.income_date,
      owner_id: o.owner_id,
      owner_label: o.owner_id ? (ownerName.get(o.owner_id) ?? "—") : "মূল",
      vehicle_no: o.vehicle_no,
      category: o.category,
      head: o.head,
      description: o.description,
      amount: Number(o.amount || 0),
    }));
    return [...fromTrips, ...fromOther].sort((a, b) => b.date.localeCompare(a.date));
  }, [tripsWithOwner, otherIncomes, ownerName]);

  const jamaScoped = useMemo(() => jamaRows.filter((r) => {
    if (ownerScope === "all") return true;
    if (ownerScope === "main") return !r.owner_id;
    return r.owner_id === ownerScope;
  }), [jamaRows, ownerScope]);

  const khorochScoped = useMemo(() => khoroch.filter((r) => {
    if (ownerScope === "all") return true;
    if (ownerScope === "main") return false; // main has no owner-tagged expenses
    return r.owner_id === ownerScope;
  }), [khoroch, ownerScope]);

  const [jFilters, setJFilters] = useState<FilterState>(emptyFilters);
  const [eFilters, setEFilters] = useState<FilterState>(emptyFilters);

  const jamaFiltered = jamaScoped.filter((r) => matchesFilters({ date: r.date, vehicle_no: r.vehicle_no, category: r.category, head: r.head }, jFilters));
  const khorochFiltered = khorochScoped.filter((r) => matchesFilters({ date: r.expense_date, vehicle_no: r.vehicle_no, category: r.category, head: r.head }, eFilters));

  const totalJ = jamaFiltered.reduce((s, r) => s + r.amount, 0);
  const totalE = khorochFiltered.reduce((s, r) => s + Number(r.amount || 0), 0);

  const delE = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("expenses").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["jk-khoroch"] }); toast.success(t("deleted")); },
  });

  if (loading) {
    return <AppLayout><p className="text-muted-foreground">{t("loading")}</p></AppLayout>;
  }
  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="rounded-lg border bg-card p-6 text-center">
          <h1 className="text-xl font-bold mb-2">{t("jamaKhoroch")}</h1>
          <p className="text-muted-foreground">⛔ শুধু এডমিন</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">{t("jamaKhoroch")} <span className="text-xs text-muted-foreground font-normal">(প্রাইভেট)</span></h1>

        <div className="flex flex-wrap gap-2">
          <ScopeBtn active={ownerScope === "main"} onClick={() => setOwnerScope("main")} label="মূল হিসাব" />
          <ScopeBtn active={ownerScope === "all"} onClick={() => setOwnerScope("all")} label="সব" />
          {(owners as { id: string; name: string }[]).map((o) => (
            <ScopeBtn key={o.id} active={ownerScope === o.id} onClick={() => setOwnerScope(o.id)} label={o.name} />
          ))}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Stat label={t("jama")} value={fmtNum(totalJ, lang)} color="text-emerald-400" />
          <Stat label={t("khoroch")} value={fmtNum(totalE, lang)} color="text-rose-400" />
          <Stat label={t("balance")} value={fmtNum(totalJ - totalE, lang)} color="text-primary" />
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="jama">{t("jama")}</TabsTrigger>
            <TabsTrigger value="khoroch">{t("khoroch")}</TabsTrigger>
          </TabsList>

          <TabsContent value="jama" className="space-y-3">
            <SearchFilters value={jFilters} onChange={setJFilters} show={{ date: true, vehicle: true, category: true, head: true }} />
            <MiniDashboard lang={lang} totalAmount={totalJ} showTrips={false} showCount tripCount={jamaFiltered.length} countLabel={t("total")} />
            <div className="flex justify-end mb-2">
              <Button onClick={() => setOpenJ(true)}>
                <Plus className="h-4 w-4 mr-2" />{t("addJama")}
              </Button>
            </div>
            <DataTable<JRow>
              rows={jamaFiltered}
              columns={[
                { key: "date", header: t("date"), render: (r) => fmtDate(r.date, lang) },
                { key: "owner_label", header: t("owner") },
                { key: "category", header: t("category"), render: (r) => r.category ?? "—" },
                { key: "head", header: t("head"), render: (r) => r.head ?? "—" },
                { key: "vehicle_no", header: t("vehicleNo"), render: (r) => r.vehicle_no ?? "—" },
                { key: "description", header: t("description"), render: (r) => r.description ?? "—" },
                { key: "amount", header: t("amount"), render: (r) => fmtNum(r.amount, lang) },
              ]}
            />
          </TabsContent>

          <TabsContent value="khoroch" className="space-y-3">
            <SearchFilters value={eFilters} onChange={setEFilters} show={{ date: true, vehicle: true, category: true, head: true }} />
            <MiniDashboard lang={lang} totalAmount={totalE} showTrips={false} showCount tripCount={khorochFiltered.length} countLabel={t("total")} />
            <div className="flex justify-end mb-2">
              <Button onClick={() => { setEditE(null); setOpenE(true); }}>
                <Plus className="h-4 w-4 mr-2" />{t("addExpense")}
              </Button>
            </div>
            <DataTable<ERow>
              rows={khorochFiltered}
              columns={[
                { key: "expense_date", header: t("date"), render: (r) => fmtDate(r.expense_date, lang) },
                { key: "owner_id", header: t("owner"), render: (r) => r.owner_id ? (ownerName.get(r.owner_id) ?? "—") : "—" },
                { key: "category", header: t("category"), render: (r) => r.category ?? "—" },
                { key: "head", header: t("head"), render: (r) => r.head ?? "—" },
                { key: "vehicle_no", header: t("vehicleNo"), render: (r) => r.vehicle_no ?? "—" },
                { key: "description", header: t("description"), render: (r) => r.description ?? "—" },
                { key: "amount", header: t("amount"), render: (r) => fmtNum(r.amount, lang) },
              ]}
              onEdit={(r) => { setEditE(r); setOpenE(true); }}
              onDelete={(r) => delE.mutate(r.id)}
            />
          </TabsContent>
        </Tabs>
      </div>

      <ExpenseDialog open={openE} onOpenChange={setOpenE} editing={editE} defaultOwnerId={ownerScope !== "main" && ownerScope !== "all" ? ownerScope : ""} />
      <IncomeDialog open={openJ} onOpenChange={setOpenJ} defaultOwnerId={ownerScope !== "main" && ownerScope !== "all" ? ownerScope : ""} />
    </AppLayout>
  );
}

function ScopeBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 rounded-md text-sm border ${active ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border/60"}`}
    >{label}</button>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg border bg-card/70 p-4">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className={`text-xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

function ExpenseDialog({ open, onOpenChange, editing, defaultOwnerId }: { open: boolean; onOpenChange: (v: boolean) => void; editing: ERow | null; defaultOwnerId: string }) {
  const { t } = useT();
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);

  const [category, setCategory] = useState(editing?.category ?? "");
  const [head, setHead] = useState(editing?.head ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [ownerId, setOwnerId] = useState(editing?.owner_id ?? defaultOwnerId);

  const save = useMutation({
    mutationFn: async (form: any) => {
      if (!form.owner_id) throw new Error("ওনার নির্বাচন করুন");
      if (editing) {
        const { error } = await supabase.from("expenses").update(form).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("expenses").insert(form);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["jk-khoroch"] }); toast.success(t("saved")); onOpenChange(false); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("addExpense")} <span className="text-xs text-muted-foreground">(ওনার বাধ্যতামূলক)</span></DialogTitle></DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            save.mutate({
              expense_date: f.get("d"),
              category: category || "খরচ",
              head: head || null,
              description: description || null,
              amount: Number(f.get("a") || 0),
              owner_id: ownerId || null,
            });
          }}
        >
          <Input type="date" name="d" defaultValue={editing?.expense_date ?? today} required className="h-11" />
          <OwnerSelect value={ownerId} onChange={setOwnerId} />
          <CategorySelect value={category} onChange={(v) => { setCategory(v); setHead(""); }} required />
          <HeadSelect category={category} value={head} onChange={setHead} />
          <LookupSelect kind="description" value={description} onChange={setDescription} placeholder={t("description")} />
          <Input type="number" step="any" name="a" defaultValue={editing?.amount ?? ""} placeholder={t("amount")} required className="h-11" />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("cancel")}</Button>
            <Button type="submit">{editing ? t("update") : t("submit")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function IncomeDialog({ open, onOpenChange, defaultOwnerId }: { open: boolean; onOpenChange: (v: boolean) => void; defaultOwnerId: string }) {
  const { t } = useT();
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);

  const [category, setCategory] = useState("");
  const [head, setHead] = useState("");
  const [description, setDescription] = useState("");
  const [ownerId, setOwnerId] = useState(defaultOwnerId);

  const { data: vehicles = [] } = useQuery({
    queryKey: ["income-vehicles", ownerId],
    queryFn: async () => {
      const q = supabase.from("vehicles").select("vehicle_no,owner_id").order("vehicle_no");
      const { data } = await q;
      return (data ?? []) as { vehicle_no: string; owner_id: string | null }[];
    },
  });
  const filteredVehicles = useMemo(
    () => (ownerId ? vehicles.filter((v) => v.owner_id === ownerId) : vehicles),
    [vehicles, ownerId],
  );

  const save = useMutation({
    mutationFn: async (form: any) => {
      if (!form.owner_id) throw new Error("ওনার নির্বাচন করুন");
      const { error } = await supabase.from("other_incomes").insert(form);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["jk-other-incomes"] });
      toast.success(t("saved"));
      onOpenChange(false);
      setCategory(""); setHead(""); setDescription("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("addJama")} <span className="text-xs text-muted-foreground">(ওনার বাধ্যতামূলক)</span></DialogTitle></DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            save.mutate({
              income_date: f.get("d"),
              category: category || "জমা",
              head: head || null,
              description: description || null,
              vehicle_no: (f.get("v") as string) || null,
              amount: Number(f.get("a") || 0),
              owner_id: ownerId || null,
            });
          }}
        >
          <Input type="date" name="d" defaultValue={today} required className="h-11" />
          <OwnerSelect value={ownerId} onChange={(v) => setOwnerId(v)} />
          <CategorySelect value={category} onChange={(v) => { setCategory(v); setHead(""); }} required />
          <HeadSelect category={category} value={head} onChange={setHead} />
          <LookupSelect kind="description" value={description} onChange={setDescription} placeholder={t("description")} />
          <select name="v" className="h-11 w-full rounded-md border border-input bg-input px-3 text-sm">
            <option value="">— {t("vehicleNo")} —</option>
            {filteredVehicles.map((v) => (
              <option key={v.vehicle_no} value={v.vehicle_no} className="bg-card">{v.vehicle_no}</option>
            ))}
          </select>
          <Input type="number" step="any" name="a" placeholder={t("amount")} required className="h-11" />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("cancel")}</Button>
            <Button type="submit" disabled={save.isPending}>{t("submit")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
