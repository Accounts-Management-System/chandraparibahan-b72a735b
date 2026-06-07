import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useT, fmtNum, fmtDate } from "@/lib/i18n";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { FileDown, Plus, Search, X } from "lucide-react";
import { useRole } from "@/lib/useRole";
import { exportPdfHtml } from "@/lib/exportPdf";

export const Route = createFileRoute("/office-deposits")({ component: Page });

const DEFAULT_CATEGORIES = ["অফিস কতৃক জমা", "ব্যাংক জমা", "মালিক জমা", "অন্যান্য"];
const DEFAULT_HEADS: Record<string, string[]> = {
  "অফিস কতৃক জমা": ["নগদ", "চেক", "বিকাশ", "নগদ ডিপোজিট"],
  "ব্যাংক জমা": ["সঞ্চয়", "চলতি"],
  "মালিক জমা": ["অগ্রিম", "সমন্বয়"],
};

type Row = {
  id: string;
  deposit_date: string;
  category: string;
  head: string | null;
  description: string | null;
  amount: number;
};

function Page() {
  const { t, lang } = useT();
  const { canWrite } = useRole();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [category, setCategory] = useState("");
  const [head, setHead] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState<number | "">("");

  // Search filters
  const [fFrom, setFFrom] = useState("");
  const [fTo, setFTo] = useState("");
  const [fCategory, setFCategory] = useState("all");
  const [fHead, setFHead] = useState("all");
  const [fText, setFText] = useState("");

  const { data: dbCats = [] } = useQuery({
    queryKey: ["expense_categories"],
    queryFn: async () => (await supabase.from("expense_categories").select("name").order("name")).data ?? [],
  });
  const { data: dbHeads = [] } = useQuery({
    queryKey: ["expense_heads_all"],
    queryFn: async () => (await supabase.from("expense_heads").select("name").order("name")).data ?? [],
  });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["office_deposits"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("office_deposits")
        .select("id,deposit_date,category,head,description,amount")
        .order("deposit_date", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const catOptions = useMemo(() => {
    const set = new Set<string>(DEFAULT_CATEGORIES);
    (dbCats as { name: string }[]).forEach((c) => set.add(c.name));
    rows.forEach((r) => r.category && set.add(r.category));
    return Array.from(set);
  }, [dbCats, rows]);

  const headOptions = useMemo(() => {
    const set = new Set<string>();
    (DEFAULT_HEADS[category] ?? []).forEach((h) => set.add(h));
    (dbHeads as { name: string }[]).forEach((h) => set.add(h.name));
    rows.forEach((r) => r.head && set.add(r.head));
    return Array.from(set);
  }, [dbHeads, category, rows]);

  const allHeadFilterOptions = useMemo(() => {
    const set = new Set<string>();
    Object.values(DEFAULT_HEADS).forEach((arr) => arr.forEach((h) => set.add(h)));
    (dbHeads as { name: string }[]).forEach((h) => set.add(h.name));
    rows.forEach((r) => r.head && set.add(r.head));
    return Array.from(set);
  }, [dbHeads, rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (fFrom && r.deposit_date < fFrom) return false;
      if (fTo && r.deposit_date > fTo) return false;
      if (fCategory !== "all" && r.category !== fCategory) return false;
      if (fHead !== "all" && (r.head ?? "") !== fHead) return false;
      if (fText) {
        const q = fText.toLowerCase();
        const hay = `${r.category} ${r.head ?? ""} ${r.description ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, fFrom, fTo, fCategory, fHead, fText]);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setDate(editing.deposit_date);
      setCategory(editing.category ?? "");
      setHead(editing.head ?? "");
      setDescription(editing.description ?? "");
      setAmount(editing.amount ?? "");
    } else {
      setDate(today);
      setCategory("");
      setHead("");
      setDescription("");
      setAmount("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("office_deposits").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["office_deposits"] });
      toast.success(t("deleted"));
    },
    onError: (e: any) => toast.error(e.message),
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!category) throw new Error(t("category") + " required");
      if (amount === "" || isNaN(Number(amount))) throw new Error(t("amount") + " required");
      const form = {
        deposit_date: date,
        category,
        head: head || null,
        description: description || null,
        amount: Number(amount || 0),
      };
      if (editing) {
        const { error } = await (supabase as any).from("office_deposits").update(form).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("office_deposits").insert(form);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["office_deposits"] });
      toast.success(t("saved"));
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Save failed"),
  });

  const total = filtered.reduce((s, r) => s + Number(r.amount || 0), 0);

  const exportOfficePdf = () => {
    const esc = (v: any) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const body = `
      <style>
        .office-title{background:#fde68a;border:3px solid #525252;text-align:center;font-size:26px;font-weight:800;padding:4px;margin-bottom:0}
        .office-total{border-left:2px solid #525252;border-right:2px solid #525252;text-align:right;font-size:18px;font-weight:700;color:#6b3f8c;padding:8px 14px}
        table.office{font-size:15px;margin:0;border:2px solid #525252}
        table.office th,table.office td{border:2px solid #525252;text-align:center;padding:3px 6px}
        table.office th{background:#f8fafc;font-size:16px}
        table.office td.amount{text-align:right;font-weight:700}
      </style>
      <div class="office-title">অফিস কতৃক জমা</div>
      <div class="office-total">অফিস কতৃক জমা মোট&nbsp;&nbsp;&nbsp; ${esc(fmtNum(total, lang))}</div>
      <table class="office">
        <thead><tr><th>সিরিয়াল</th><th>তারিখ</th><th>ক্যাটাগরী</th><th>খাত</th><th>বিবরন</th><th>পরিমান</th></tr></thead>
        <tbody>${filtered.map((r, i) => `<tr><td>${esc(fmtNum(i + 1, lang))}</td><td>${esc(fmtDate(r.deposit_date, lang))}</td><td>${esc(r.category)}</td><td>${esc(r.head ?? "")}</td><td>${esc(r.description ?? "")}</td><td class="amount">${esc(fmtNum(r.amount, lang))}</td></tr>`).join("")}</tbody>
      </table>`;
    exportPdfHtml({ title: "অফিস কতৃক জমা", body, orientation: "landscape" });
  };

  const clearFilters = () => {
    setFFrom(""); setFTo(""); setFCategory("all"); setFHead("all"); setFText("");
  };

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{t("officeDeposits")}</h1>
            <p className="text-sm text-muted-foreground">
              {t("total")}: <span className="font-semibold text-emerald-500">{fmtNum(total, lang)}</span>
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportOfficePdf}>
              <FileDown className="h-4 w-4 mr-2" /> {t("exportPdf")}
            </Button>
            {canWrite && (
              <Button onClick={() => { setEditing(null); setOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" /> {t("add")}
              </Button>
            )}
          </div>
        </div>

        {/* Search/Filter bar */}
        <div className="rounded-md border bg-card p-3">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2 items-end">
            <div>
              <label className="text-xs text-muted-foreground">{t("from")}</label>
              <Input type="date" value={fFrom} onChange={(e) => setFFrom(e.target.value)} className="h-9" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">{t("to")}</label>
              <Input type="date" value={fTo} onChange={(e) => setFTo(e.target.value)} className="h-9" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">{t("category")}</label>
              <Select value={fCategory} onValueChange={setFCategory}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("all")}</SelectItem>
                  {catOptions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">{t("head")}</label>
              <Select value={fHead} onValueChange={setFHead}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("all")}</SelectItem>
                  {allHeadFilterOptions.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-1">
              <label className="text-xs text-muted-foreground">{t("search")}</label>
              <div className="relative">
                <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input value={fText} onChange={(e) => setFText(e.target.value)} placeholder={t("description")} className="h-9 pl-8" />
              </div>
            </div>
            <div>
              <Button variant="outline" className="h-9 w-full" onClick={clearFilters}>
                <X className="h-4 w-4 mr-1" /> {t("cancel")}
              </Button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-md border bg-card">
          <div className="border-b bg-primary/20 px-3 py-3 text-center text-2xl font-bold">{t("officeDeposits")}</div>
          <div className="border-b px-3 py-2 text-right font-semibold text-primary">{t("officeDeposits")} {t("total")}&nbsp;&nbsp; {fmtNum(total, lang)}</div>
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-3 py-2 text-center">{t("serial")}</th>
                <th className="px-3 py-2 text-center">{t("date")}</th>
                <th className="px-3 py-2 text-center">{t("category")}</th>
                <th className="px-3 py-2 text-center">{t("head")}</th>
                <th className="px-3 py-2 text-center">{t("description")}</th>
                <th className="px-3 py-2 text-right">{t("amount")}</th>
                {canWrite && <th className="px-3 py-2 text-right">{t("actions")}</th>}
              </tr>
            </thead>
            <tbody>
              {(isLoading ? [] : filtered).length === 0 && <tr><td colSpan={canWrite ? 7 : 6} className="py-8 text-center text-muted-foreground">{isLoading ? t("loading") : t("noData")}</td></tr>}
              {(isLoading ? [] : filtered).map((r, i) => (
                <tr key={r.id} className="border-t hover:bg-muted/30">
                  <td className="px-3 py-2 text-center">{fmtNum(i + 1, lang)}</td>
                  <td className="px-3 py-2 text-center">{fmtDate(r.deposit_date, lang)}</td>
                  <td className="px-3 py-2 text-center">{r.category}</td>
                  <td className="px-3 py-2 text-center">{r.head ?? "—"}</td>
                  <td className="px-3 py-2 text-center">{r.description ?? "—"}</td>
                  <td className="px-3 py-2 text-right font-semibold">{fmtNum(r.amount, lang)}</td>
                  {canWrite && (
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <Button size="sm" variant="ghost" onClick={() => { setEditing(r); setOpen(true); }}>{t("edit")}</Button>
                      <Button size="sm" variant="ghost" onClick={() => { if (confirm(t("confirmDelete"))) del.mutate(r.id); }}>{t("delete")}</Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("officeDeposits")}</DialogTitle></DialogHeader>
          <form className="grid grid-cols-1 sm:grid-cols-2 gap-3" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
            <div>
              <label className="text-xs font-semibold uppercase text-muted-foreground">{t("date")}</label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="h-10" />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-muted-foreground">{t("category")}</label>
              <Select value={category} onValueChange={(v) => { setCategory(v); setHead(""); }}>
                <SelectTrigger className="h-10"><SelectValue placeholder={t("selectOrType")} /></SelectTrigger>
                <SelectContent>
                  {catOptions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-muted-foreground">{t("head")}</label>
              <Select value={head || "__none__"} onValueChange={(v) => setHead(v === "__none__" ? "" : v)} disabled={!category}>
                <SelectTrigger className="h-10"><SelectValue placeholder={t("selectOrType")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">—</SelectItem>
                  {headOptions.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-muted-foreground">{t("amount")}</label>
              <Input type="number" step="any" value={amount} onChange={(e) => setAmount(e.target.value === "" ? "" : Number(e.target.value))} required className="h-10" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold uppercase text-muted-foreground">{t("description")}</label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} className="h-10" />
            </div>
            <DialogFooter className="sm:col-span-2 gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>{t("cancel")}</Button>
              <Button type="submit" disabled={save.isPending}>{editing ? t("update") : t("submit")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
