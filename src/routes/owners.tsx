import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { DataTable } from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useT, fmtNum, fmtDate } from "@/lib/i18n";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { offlineFrom } from "@/lib/offline/supabaseWrite";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, KeyRound } from "lucide-react";
import { useRole } from "@/lib/useRole";
import { useServerFn } from "@tanstack/react-start";
import { createOwnerLogin, resetUserPin, updateOwnerLoginId } from "@/lib/admin.functions";
import { SearchFilters, MiniDashboard, emptyFilters, type FilterState } from "@/components/SearchFilters";

export const Route = createFileRoute("/owners")({ component: Page });

type Owner = { id: string; name: string; login_id: string | null; auth_user_id: string | null };
type Veh = { id: string; vehicle_no: string; owner_id: string | null };
type Trip = { trip_date: string; vehicle_no: string; fare_1: number; fare_2: number };

type FareRow = {
  id: string;
  owner_name: string;
  vehicle_no: string;
  fare: number;
  owner_id: string;
};

function Page() {
  const { t, lang } = useT();
  const { canWrite, isAdmin } = useRole();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Owner | null>(null);
  const [loginFor, setLoginFor] = useState<Owner | null>(null);
  const [resetFor, setResetFor] = useState<Owner | null>(null);
  const [editLoginFor, setEditLoginFor] = useState<Owner | null>(null);
  const [filters, setFilters] = useState<FilterState>(emptyFilters);

  const doCreateLogin = useServerFn(createOwnerLogin);
  const doResetPin = useServerFn(resetUserPin);
  const doUpdateLoginId = useServerFn(updateOwnerLoginId);

  const { data: owners = [], isLoading } = useQuery({
    queryKey: ["owners"],
    queryFn: async () => ((await supabase.from("owners").select("id,name,login_id,auth_user_id").order("name")).data ?? []) as Owner[],
  });
  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles-with-owner"],
    queryFn: async () => ((await supabase.from("vehicles").select("id,vehicle_no,owner_id").order("vehicle_no")).data ?? []) as Veh[],
  });
  const { data: trips = [] } = useQuery({
    queryKey: ["trips-all-for-owners"],
    queryFn: async () => ((await supabase.from("trips").select("trip_date,vehicle_no,fare_1,fare_2").limit(5000)).data ?? []) as Trip[],
  });
  const { data: ownerIncomes = [] } = useQuery({
    queryKey: ["other_incomes-owner"],
    queryFn: async () =>
      ((await supabase.from("other_incomes").select("owner_id,amount").not("owner_id", "is", null).limit(5000)).data ?? []) as { owner_id: string | null; amount: number }[],
  });
  const { data: ownerExpenses = [] } = useQuery({
    queryKey: ["expenses-owner"],
    queryFn: async () =>
      ((await supabase.from("expenses").select("owner_id,amount").not("owner_id", "is", null).limit(5000)).data ?? []) as { owner_id: string | null; amount: number }[],
  });

  const ownerBalances = useMemo(() => {
    const m = new Map<string, { income: number; expense: number }>();
    for (const r of ownerIncomes) {
      if (!r.owner_id) continue;
      const c = m.get(r.owner_id) ?? { income: 0, expense: 0 };
      c.income += Number(r.amount || 0);
      m.set(r.owner_id, c);
    }
    for (const r of ownerExpenses) {
      if (!r.owner_id) continue;
      const c = m.get(r.owner_id) ?? { income: 0, expense: 0 };
      c.expense += Number(r.amount || 0);
      m.set(r.owner_id, c);
    }
    return m;
  }, [ownerIncomes, ownerExpenses]);

  const fareRows: FareRow[] = useMemo(() => {
    const veh = vehicles.filter((v) => {
      if (filters.ownerId && v.owner_id !== filters.ownerId) return false;
      if (filters.vehicleNo && v.vehicle_no !== filters.vehicleNo) return false;
      return !!v.owner_id;
    });
    const ownerName = (id: string | null) => owners.find((o) => o.id === id)?.name ?? "—";
    return veh.map((v) => {
      const fare = trips
        .filter((tr) => tr.vehicle_no === v.vehicle_no)
        .filter((tr) => !filters.dateFrom || tr.trip_date >= filters.dateFrom)
        .filter((tr) => !filters.dateTo || tr.trip_date <= filters.dateTo)
        .reduce((s, tr) => s + Number(tr.fare_1 || 0) + Number(tr.fare_2 || 0), 0);
      return { id: v.id, owner_name: ownerName(v.owner_id), vehicle_no: v.vehicle_no, fare, owner_id: v.owner_id! };
    });
  }, [vehicles, trips, owners, filters]);

  const totalFare = fareRows.reduce((s, r) => s + r.fare, 0);

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await offlineFrom("owners").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["owners"] }); qc.invalidateQueries({ queryKey: ["vehicles-with-owner"] }); toast.success(t("deleted")); },
  });

  const hasFilter = filters.dateFrom || filters.dateTo || filters.ownerId || filters.vehicleNo;

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{t("owners")}</h1>
          {isAdmin && <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="h-4 w-4 mr-2" />{t("add")}</Button>}
        </div>

        <SearchFilters value={filters} onChange={setFilters} show={{ date: true, owner: true, vehicle: true }} />
        <MiniDashboard tripCount={fareRows.length} totalAmount={totalFare} lang={lang} />

        {hasFilter ? (
          <>
            <p className="text-xs text-muted-foreground">
              {filters.dateFrom && `${fmtDate(filters.dateFrom, lang)} — ${fmtDate(filters.dateTo || filters.dateFrom, lang)}`}
            </p>
            <DataTable<FareRow>
              rows={fareRows}
              columns={[
                { key: "owner_name", header: t("name") },
                { key: "vehicle_no", header: t("vehicleNo") },
                { key: "fare", header: t("vehicleFare"), render: (r) => fmtNum(r.fare, lang) },
              ]}
              emptyText={t("noData")}
            />
          </>
        ) : (
          <DataTable<Owner>
            rows={isLoading ? [] : owners}
            columns={[
              { key: "name", header: t("name") },
              { key: "id", header: t("vehicles"), render: (r) => vehicles.filter((v) => v.owner_id === r.id).map((v) => v.vehicle_no).join(", ") || "—" },
              { key: "login_id", header: t("loginId"), render: (r) => r.login_id ?? "—" },
              { key: "inc", header: t("totalIncome"), render: (r) => <span className="text-emerald-400">{fmtNum(ownerBalances.get(r.id)?.income ?? 0, lang)}</span> },
              { key: "exp", header: t("totalExpense"), render: (r) => <span className="text-rose-400">{fmtNum(ownerBalances.get(r.id)?.expense ?? 0, lang)}</span> },
              { key: "bal", header: t("balance"), render: (r) => {
                const b = ownerBalances.get(r.id); const v = (b?.income ?? 0) - (b?.expense ?? 0);
                return <span className={`font-semibold ${v >= 0 ? "text-emerald-500" : "text-rose-500"}`}>{fmtNum(v, lang)}</span>;
              } },
              {
                key: "actions2",
                header: t("actions"),
                render: (r) => isAdmin ? (
                  <div className="flex gap-1">
                    {r.auth_user_id ? (
                      <Button size="sm" variant="ghost" onClick={() => setResetFor(r)}>
                        <KeyRound className="h-3 w-3 mr-1" />{t("resetPin")}
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => setLoginFor(r)}>
                        {t("createLogin")}
                      </Button>
                    )}
                  </div>
                ) : null,
              },
            ]}
            onEdit={isAdmin ? (r) => { setEditing(r); setOpen(true); } : undefined}
            onDelete={isAdmin ? (r) => { if (confirm(t("confirmDelete"))) del.mutate(r.id); } : undefined}
            emptyText={isLoading ? t("loading") : t("noData")}
          />
        )}
      </div>

      <OwnerDialog open={open} onOpenChange={setOpen} editing={editing} />

      {/* Create Login */}
      <Dialog open={!!loginFor} onOpenChange={(v) => !v && setLoginFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("createLogin")} — {loginFor?.name}</DialogTitle></DialogHeader>
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              try {
                await doCreateLogin({
                  data: {
                    ownerId: loginFor!.id,
                    loginId: String(f.get("loginId") || ""),
                    pin: String(f.get("pin") || ""),
                  },
                });
                toast.success(t("saved"));
                setLoginFor(null);
                qc.invalidateQueries({ queryKey: ["owners"] });
              } catch (err: any) {
                toast.error(err.message);
              }
            }}
          >
            <Input name="loginId" placeholder={t("loginId")} required minLength={3} className="h-11" />
            <Input name="pin" placeholder={t("pin" as any)} required minLength={4} className="h-11" />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setLoginFor(null)}>{t("cancel")}</Button>
              <Button type="submit">{t("submit")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reset PIN */}
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

function OwnerDialog({ open, onOpenChange, editing }: { open: boolean; onOpenChange: (v: boolean) => void; editing: Owner | null }) {
  const { t } = useT();
  const qc = useQueryClient();
  const [name, setName] = useState("");

  useEffect(() => {
    if (open) setName(editing?.name ?? "");
  }, [open, editing]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = { name };
      if (editing) {
        const { error } = await offlineFrom("owners").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await offlineFrom("owners").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["owners"] }); toast.success(t("saved")); onOpenChange(false); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{t("owners")}</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-3">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("name")} required className="h-10" />
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>{t("cancel")}</Button>
            <Button type="submit" disabled={save.isPending}>{editing ? t("update") : t("submit")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
