import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { DataTable } from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useT, fmtNum, fmtDate } from "@/lib/i18n";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Download, FileDown, Printer } from "lucide-react";
import { useRole } from "@/lib/useRole";
import { exportPdf } from "@/lib/exportPdf";

export const Route = createFileRoute("/routes")({ component: Page });

type RouteRow = { id: string; name: string; fare: number; vehicle_id: string | null };
type TripLite = {
  id: string;
  trip_date: string;
  vehicle_no: string;
  jama_1: number; jama_2: number;
  dena_1: number; dena_2: number;
  fare_1: number; fare_2: number;
  route_1: string | null;
  route_2: string | null;
};
type DetailRow = {
  id: string;
  trip_date: string;
  vehicle_no: string;
  balance: number;
  fare: number;
  route: string;
};

function Page() {
  const { t, lang } = useT();
  const qc = useQueryClient();
  const { canWrite } = useRole();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RouteRow | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [routeFilter, setRouteFilter] = useState("");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["routes-global"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicle_routes")
        .select("id,name,fare,vehicle_id")
        .order("fare");
      if (error) throw error;
      return (data ?? []) as RouteRow[];
    },
  });

  const { data: trips = [] } = useQuery({
    queryKey: ["trips-route-details"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trips")
        .select("id,trip_date,vehicle_no,jama_1,jama_2,dena_1,dena_2,fare_1,fare_2,route_1,route_2")
        .order("trip_date", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as TripLite[];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vehicle_routes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["routes-global"] });
      qc.invalidateQueries({ queryKey: ["all-routes"] });
      toast.success(t("deleted"));
    },
  });

  const detailRows = useMemo<DetailRow[]>(() => {
    const out: DetailRow[] = [];
    for (const tr of trips) {
      const bal = Number(tr.jama_1 || 0) + Number(tr.jama_2 || 0) - Number(tr.dena_1 || 0) - Number(tr.dena_2 || 0);
      const entries: { route: string | null; fare: number }[] = [
        { route: tr.route_1, fare: Number(tr.fare_1 || 0) },
        { route: tr.route_2, fare: Number(tr.fare_2 || 0) },
      ].filter((e) => (e.route && e.route.trim()) || e.fare);
      entries.forEach((e, idx) => {
        out.push({
          id: `${tr.id}-${idx}`,
          trip_date: tr.trip_date,
          vehicle_no: tr.vehicle_no,
          balance: idx === 0 ? bal : 0,
          fare: e.fare,
          route: e.route ?? "—",
        });
      });
    }
    return out;
  }, [trips]);

  const filteredDetails = useMemo(() => {
    return detailRows.filter((r) => {
      if (dateFrom && r.trip_date < dateFrom) return false;
      if (dateTo && r.trip_date > dateTo) return false;
      if (routeFilter && r.route !== routeFilter) return false;
      return true;
    });
  }, [detailRows, dateFrom, dateTo, routeFilter]);

  const totalBalance = filteredDetails.reduce((s, r) => s + r.balance, 0);
  const totalFare = filteredDetails.reduce((s, r) => s + r.fare, 0);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{t("routes")}</h1>
          {canWrite && (
            <Button onClick={() => { setEditing(null); setOpen(true); }} className="bg-cyan-500 hover:bg-cyan-600 text-white">
              <Plus className="h-4 w-4 mr-2" />{t("add")}
            </Button>
          )}
        </div>
        <DataTable<RouteRow>
          rows={isLoading ? [] : rows}
          columns={[
            { key: "fare", header: t("fare"), render: (r) => fmtNum(r.fare, lang) },
            { key: "name", header: t("routeName") },
          ]}
          onEdit={canWrite ? (r) => { setEditing(r); setOpen(true); } : undefined}
          onDelete={canWrite ? (r) => { if (confirm(t("confirmDelete"))) del.mutate(r.id); } : undefined}
          emptyText={isLoading ? t("loading") : t("noData")}
        />

        <div className="space-y-3 pt-4 border-t">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-bold">
              {lang === "bn" ? "রুটের বিস্তারিত" : "Route Details"}
            </h2>
            <div className="flex gap-2 flex-wrap print:hidden">
              <Button variant="outline" size="sm" onClick={() => {
                const escq = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
                const headers = [t("date"), t("vehicleNo"), t("balance"), t("fare"), t("routeName")];
                const dataRows = filteredDetails.map((r) => [fmtDate(r.trip_date, lang), r.vehicle_no, r.balance, r.fare, r.route]);
                const footer = [t("grandTotal"), "", totalBalance, totalFare, ""];
                const csv = "\uFEFF" + [headers, ...dataRows, footer].map((row) => row.map(escq).join(",")).join("\n");
                const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url; a.download = `route-details-${dateFrom || "all"}_${dateTo || "all"}.csv`; a.click();
                URL.revokeObjectURL(url);
              }}><Download className="h-4 w-4 mr-2" />{t("exportCsv")}</Button>
              <Button variant="outline" size="sm" onClick={() => {
                exportPdf({
                  title: `${t("brand") ?? "চন্দ্রা পরিবহন"} — ${lang === "bn" ? "রুটের বিস্তারিত" : "Route Details"}`,
                  subtitle: `${dateFrom ? fmtDate(dateFrom, lang) : "—"} → ${dateTo ? fmtDate(dateTo, lang) : "—"}${routeFilter ? " · " + routeFilter : ""}`,
                  headers: [t("date"), t("vehicleNo"), t("balance"), t("fare"), t("routeName")],
                  rows: filteredDetails.map((r) => [fmtDate(r.trip_date, lang), r.vehicle_no, r.balance ? fmtNum(r.balance, lang) : "—", fmtNum(r.fare, lang), r.route]),
                  footer: `${t("grandTotal")} — ${t("balance")}: ${fmtNum(totalBalance, lang)} | ${t("fare")}: ${fmtNum(totalFare, lang)}`,
                  orientation: "landscape",
                });
              }}><FileDown className="h-4 w-4 mr-2" />{t("exportPdf")}</Button>
              <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-4 w-4 mr-2" />{t("print")}</Button>
            </div>
          </div>
          <Card className="p-3 border-border/50 bg-card/60">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("from")}</span>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("to")}</span>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9" />
              </label>
              <label className="flex flex-col gap-1 md:col-span-2">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("routeName")}</span>
                <select value={routeFilter} onChange={(e) => setRouteFilter(e.target.value)} className="h-9 rounded-md border border-input bg-input px-2 text-sm">
                  <option value="">{lang === "bn" ? "সব" : "All"}</option>
                  {rows.map((r) => (
                    <option key={r.id} value={r.name} className="bg-card">{r.name}</option>
                  ))}
                </select>
              </label>
            </div>
          </Card>

          <div className="rounded-md border bg-card w-full max-w-full overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold">{t("date")}</th>
                  <th className="text-left px-3 py-2 font-semibold">{t("vehicleNo")}</th>
                  <th className="text-right px-3 py-2 font-semibold">{t("balance")}</th>
                  <th className="text-right px-3 py-2 font-semibold">{t("fare")}</th>
                  <th className="text-left px-3 py-2 font-semibold">{t("routeName")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredDetails.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">{t("noData")}</td></tr>
                ) : filteredDetails.map((r) => (
                  <tr key={r.id} className="border-t hover:bg-muted/30">
                    <td className="px-3 py-2">{fmtDate(r.trip_date, lang)}</td>
                    <td className="px-3 py-2">{r.vehicle_no}</td>
                    <td className="px-3 py-2 text-right">{r.balance ? fmtNum(r.balance, lang) : "—"}</td>
                    <td className="px-3 py-2 text-right">{fmtNum(r.fare, lang)}</td>
                    <td className="px-3 py-2">{r.route}</td>
                  </tr>
                ))}
              </tbody>
              {filteredDetails.length > 0 && (
                <tfoot className="bg-muted/50 font-semibold">
                  <tr>
                    <td className="px-3 py-2" colSpan={2}>{t("grandTotal")}</td>
                    <td className="px-3 py-2 text-right">{fmtNum(totalBalance, lang)}</td>
                    <td className="px-3 py-2 text-right">{fmtNum(totalFare, lang)}</td>
                    <td className="px-3 py-2"></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
      <RouteDialog open={open} onOpenChange={setOpen} editing={editing} />
    </AppLayout>
  );
}

function RouteDialog({
  open, onOpenChange, editing,
}: { open: boolean; onOpenChange: (v: boolean) => void; editing: RouteRow | null }) {
  const { t } = useT();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [fare, setFare] = useState<number | "">("");

  useEffect(() => {
    if (open) {
      setName(editing?.name ?? "");
      setFare(editing?.fare ?? "");
    }
  }, [open, editing]);

  const clearForm = () => { setName(""); setFare(""); };

  const save = useMutation({
    mutationFn: async () => {
      const payload = { name: name.trim(), fare: Number(fare || 0), vehicle_id: null as string | null };
      if (editing) {
        const { error } = await supabase.from("vehicle_routes").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("vehicle_routes").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["routes-global"] });
      qc.invalidateQueries({ queryKey: ["all-routes"] });
      toast.success(t("saved"));
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{t("routes")}</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-3">
          <div className="grid grid-cols-[120px_1fr] gap-2">
            <Input
              type="number" step="any"
              value={fare}
              onChange={(e) => setFare(e.target.value === "" ? "" : Number(e.target.value))}
              placeholder={t("fare")} required className="h-10"
            />
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("routeName")} required className="h-10" />
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={clearForm}>{t("clearForm")}</Button>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>{t("cancel")}</Button>
            <Button type="submit" disabled={save.isPending}>{editing ? t("update") : t("submit")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
