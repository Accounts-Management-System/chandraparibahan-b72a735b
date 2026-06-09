import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT, fmtNum, fmtDate } from "@/lib/i18n";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { FileDown, Pencil, Plus, Trash2 } from "lucide-react";
import { exportPdf } from "@/lib/exportPdf";
import { toast } from "sonner";

export const Route = createFileRoute("/vendors")({ component: Page });

const CHANDRA_ID = "674def72-609b-434c-8186-15aa3d351d28";

type Row = { name: string; previous: number; collection: number; current: number; payment: number; remaining: number };

function Page() {
  const { t, lang } = useT();
  const qc = useQueryClient();
  const [ownerId, setOwnerId] = useState<string>(CHANDRA_ID);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ entry_date: new Date().toISOString().slice(0, 10), vendor: "", amount: "", note: "" });

  const { data: owners = [] } = useQuery({
    queryKey: ["vendors-owners"],
    queryFn: async () => ((await supabase.from("owners").select("id,name").order("name")).data ?? []) as { id: string; name: string }[],
  });
  const { data: vendorList = [] } = useQuery({
    queryKey: ["vendors-lookup"],
    queryFn: async () =>
      ((await supabase.from("entry_lookups").select("id,value").eq("kind", "vendor").order("value")).data ?? []) as { id: string; value: string }[],
  });
  const { data: receivables = [] } = useQuery({
    queryKey: ["vendor-receivables", ownerId],
    queryFn: async () =>
      ((await supabase.from("vendor_receivables").select("*").eq("owner_id", ownerId).order("entry_date", { ascending: false }).limit(5000)).data ?? []) as any[],
  });
  const { data: collections = [] } = useQuery({
    queryKey: ["vendor-collections", ownerId],
    queryFn: async () =>
      ((await supabase.from("other_incomes").select("vendor,amount,owner_id").not("vendor", "is", null).eq("owner_id", ownerId).limit(5000)).data ?? []) as any[],
  });
  const { data: payments = [] } = useQuery({
    queryKey: ["vendor-payments", ownerId],
    queryFn: async () =>
      ((await supabase.from("expenses").select("vendor,amount,owner_id").not("vendor", "is", null).eq("owner_id", ownerId).limit(5000)).data ?? []) as any[],
  });

  const rows: Row[] = useMemo(() => {
    const map = new Map<string, Row>();
    const ensure = (n: string) => {
      const k = n.trim();
      if (!k) return null;
      if (!map.has(k)) map.set(k, { name: k, previous: 0, collection: 0, current: 0, payment: 0, remaining: 0 });
      return map.get(k)!;
    };
    for (const v of vendorList) ensure(v.value);
    for (const r of receivables) { const x = ensure(r.vendor); if (x) x.previous += Number(r.amount || 0); }
    for (const r of collections) { const x = ensure(r.vendor ?? ""); if (x) x.collection += Number(r.amount || 0); }
    for (const r of payments) { const x = ensure(r.vendor ?? ""); if (x) x.payment += Number(r.amount || 0); }
    const arr = Array.from(map.values()).map((r) => {
      const current = r.previous + r.collection;
      return { ...r, current, remaining: current - r.payment };
    });
    return arr.filter((r) => r.previous || r.collection || r.payment).sort((a, b) => b.remaining - a.remaining);
  }, [vendorList, receivables, collections, payments]);

  const totals = rows.reduce(
    (s, r) => ({ previous: s.previous + r.previous, collection: s.collection + r.collection, current: s.current + r.current, payment: s.payment + r.payment, remaining: s.remaining + r.remaining }),
    { previous: 0, collection: 0, current: 0, payment: 0, remaining: 0 },
  );

  const addReceivable = useMutation({
    mutationFn: async () => {
      if (!form.vendor.trim()) throw new Error(t("vendorReq"));
      const amt = Number(form.amount);
      if (!amt) throw new Error(t("amountReq"));
      const { error } = await supabase.from("vendor_receivables").insert({
        entry_date: form.entry_date,
        vendor: form.vendor.trim(),
        owner_id: ownerId,
        amount: amt,
        note: form.note || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("save"));
      setForm({ entry_date: new Date().toISOString().slice(0, 10), vendor: "", amount: "", note: "" });
      setShowForm(false);
      qc.invalidateQueries({ queryKey: ["vendor-receivables"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Error"),
  });

  const updateRec = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const { error } = await supabase.from("vendor_receivables").update({
        entry_date: editing.entry_date,
        vendor: editing.vendor,
        amount: Number(editing.amount) || 0,
        note: editing.note || null,
      }).eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("save"));
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["vendor-receivables"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Error"),
  });

  const delRec = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vendor_receivables").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vendor-receivables"] }),
  });

  const ownerName = (owners.find((o) => o.id === ownerId)?.name) ?? "—";

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">{t("vendors")} — {ownerName}</h1>
          <div className="flex gap-2">
            <Button onClick={() => setShowForm((v) => !v)}><Plus className="h-4 w-4 mr-1" /> {t("addReceivable")}</Button>
            <Button
              variant="outline"
              onClick={() =>
                exportPdf({
                  title: `${t("vendors")} — ${ownerName}`,
                  subtitle: `${t("remaining")}: ${fmtNum(totals.remaining, lang)}`,
                  headers: [t("vendorName"), t("receivable"), t("collection"), t("currentReceivable"), t("payment"), t("remaining")],
                  rows: rows.map((r) => [r.name, fmtNum(r.previous, lang), fmtNum(r.collection, lang), fmtNum(r.current, lang), fmtNum(r.payment, lang), fmtNum(r.remaining, lang)]),
                })
              }
            >
              <FileDown className="h-4 w-4 mr-1" /> {t("exportPdf")}
            </Button>
          </div>
        </div>

        {/* Owner buttons */}
        <div className="flex flex-wrap gap-2">
          {owners.map((o) => (
            <Button
              key={o.id}
              size="sm"
              variant={ownerId === o.id ? "default" : "outline"}
              onClick={() => setOwnerId(o.id)}
            >
              {o.name}
            </Button>
          ))}
        </div>

        {showForm && (
          <div className="rounded-lg border bg-card/70 p-3 grid grid-cols-2 md:grid-cols-5 gap-2">
            <div>
              <label className="text-[10px] uppercase text-muted-foreground">{t("date")}</label>
              <Input type="date" value={form.entry_date} onChange={(e) => setForm({ ...form, entry_date: e.target.value })} className="h-9" />
            </div>
            <div>
              <label className="text-[10px] uppercase text-muted-foreground">{t("vendorName")}</label>
              <input
                list="vendor-options"
                value={form.vendor}
                onChange={(e) => setForm({ ...form, vendor: e.target.value })}
                className="w-full h-9 rounded-md border border-input bg-input px-2 text-sm"
              />
              <datalist id="vendor-options">
                {vendorList.map((v) => <option key={v.id} value={v.value} />)}
              </datalist>
            </div>
            <div>
              <label className="text-[10px] uppercase text-muted-foreground">{t("amount")}</label>
              <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="h-9" />
            </div>
            <div>
              <label className="text-[10px] uppercase text-muted-foreground">{t("note")}</label>
              <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="h-9" />
            </div>
            <div className="flex items-end gap-2">
              <Button size="sm" onClick={() => addReceivable.mutate()} disabled={addReceivable.isPending}>{t("save")}</Button>
              <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>{t("cancel")}</Button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Stat label={t("receivable")} value={fmtNum(totals.previous, lang)} color="text-amber-400" />
          <Stat label={t("collection")} value={fmtNum(totals.collection, lang)} color="text-emerald-400" />
          <Stat label={t("currentReceivable")} value={fmtNum(totals.current, lang)} color="text-sky-400" />
          <Stat label={t("payment")} value={fmtNum(totals.payment, lang)} color="text-rose-400" />
          <Stat label={t("remaining")} value={fmtNum(totals.remaining, lang)} color={totals.remaining >= 0 ? "text-emerald-500" : "text-rose-500"} />
        </div>

        <div className="overflow-x-auto rounded-md border bg-card/70">
          <table className="w-full text-sm">
            <thead className="bg-muted/60">
              <tr>
                <th className="text-left px-3 py-2">{t("vendorName")}</th>
                <th className="text-right px-3 py-2">{t("receivable")}</th>
                <th className="text-right px-3 py-2">{t("collection")}</th>
                <th className="text-right px-3 py-2">{t("currentReceivable")}</th>
                <th className="text-right px-3 py-2">{t("payment")}</th>
                <th className="text-right px-3 py-2">{t("remaining")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">{t("noData")}</td></tr>}
              {rows.map((r) => (
                <tr key={r.name} className="border-t">
                  <td className="px-3 py-2 font-medium">{r.name}</td>
                  <td className="px-3 py-2 text-right text-amber-400">{fmtNum(r.previous, lang)}</td>
                  <td className="px-3 py-2 text-right text-emerald-400">{fmtNum(r.collection, lang)}</td>
                  <td className="px-3 py-2 text-right text-sky-400 font-semibold">{fmtNum(r.current, lang)}</td>
                  <td className="px-3 py-2 text-right text-rose-400">{fmtNum(r.payment, lang)}</td>
                  <td className={`px-3 py-2 text-right font-semibold ${r.remaining >= 0 ? "text-emerald-500" : "text-rose-500"}`}>{fmtNum(r.remaining, lang)}</td>
                </tr>
              ))}
            </tbody>
            {rows.length > 0 && (
              <tfoot className="bg-muted/40 font-bold">
                <tr>
                  <td className="px-3 py-2">{t("grandTotal")}</td>
                  <td className="px-3 py-2 text-right text-amber-500">{fmtNum(totals.previous, lang)}</td>
                  <td className="px-3 py-2 text-right text-emerald-500">{fmtNum(totals.collection, lang)}</td>
                  <td className="px-3 py-2 text-right text-sky-500">{fmtNum(totals.current, lang)}</td>
                  <td className="px-3 py-2 text-right text-rose-500">{fmtNum(totals.payment, lang)}</td>
                  <td className={`px-3 py-2 text-right ${totals.remaining >= 0 ? "text-emerald-500" : "text-rose-500"}`}>{fmtNum(totals.remaining, lang)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Receivable entries list */}
        {receivables.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">{t("receivable")} — {t("dailyAccounts")}</h2>
            <div className="overflow-x-auto rounded-md border bg-card/70">
              <table className="w-full text-sm">
                <thead className="bg-muted/60">
                  <tr>
                    <th className="text-left px-3 py-2">{t("date")}</th>
                    <th className="text-left px-3 py-2">{t("vendorName")}</th>
                    <th className="text-right px-3 py-2">{t("amount")}</th>
                    <th className="text-left px-3 py-2">{t("note")}</th>
                    <th className="text-right px-3 py-2">{t("actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {(receivables as any[]).map((r) => (
                    <tr key={r.id} className="border-t">
                      <td className="px-3 py-2">{fmtDate(r.entry_date, lang)}</td>
                      <td className="px-3 py-2">{r.vendor}</td>
                      <td className="px-3 py-2 text-right text-amber-400">{fmtNum(r.amount, lang)}</td>
                      <td className="px-3 py-2 text-muted-foreground">{r.note ?? "—"}</td>
                      <td className="px-3 py-2 text-right">
                        <Button size="sm" variant="ghost" onClick={() => setEditing({ ...r })}><Pencil className="h-4 w-4 text-sky-400" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => delRec.mutate(r.id)}><Trash2 className="h-4 w-4 text-rose-400" /></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {editing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setEditing(null)}>
            <div className="bg-card border rounded-lg p-4 w-full max-w-md space-y-3" onClick={(e) => e.stopPropagation()}>
              <h3 className="font-semibold">{t("edit")} — {t("receivable")}</h3>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] uppercase text-muted-foreground">{t("date")}</label>
                  <Input type="date" value={editing.entry_date} onChange={(e) => setEditing({ ...editing, entry_date: e.target.value })} className="h-9" />
                </div>
                <div>
                  <label className="text-[10px] uppercase text-muted-foreground">{t("amount")}</label>
                  <Input type="number" value={editing.amount} onChange={(e) => setEditing({ ...editing, amount: e.target.value })} className="h-9" />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] uppercase text-muted-foreground">{t("vendorName")}</label>
                  <input list="vendor-options" value={editing.vendor} onChange={(e) => setEditing({ ...editing, vendor: e.target.value })} className="w-full h-9 rounded-md border border-input bg-input px-2 text-sm" />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] uppercase text-muted-foreground">{t("note")}</label>
                  <Input value={editing.note ?? ""} onChange={(e) => setEditing({ ...editing, note: e.target.value })} className="h-9" />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditing(null)}>{t("cancel")}</Button>
                <Button size="sm" onClick={() => updateRec.mutate()} disabled={updateRec.isPending}>{t("save")}</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="border bg-card/70 backdrop-blur rounded-lg p-4">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className={`text-xl font-bold ${color}`}>{value}</div>
    </div>
  );
}
