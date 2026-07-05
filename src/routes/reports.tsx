import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useT, fmtNum, fmtDate, trBn } from "@/lib/i18n";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { Download, Printer, FileDown } from "lucide-react";
import { exportPdf, exportPdfHtml } from "@/lib/exportPdf";

export const Route = createFileRoute("/reports")({ component: Page });

function Page() {
  const { t, lang } = useT();
  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = today.slice(0, 8) + "01";
  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(today);
  const [car, setCar] = useState("");
  const [ownerId, setOwnerId] = useState("");

  const { data: owners = [] } = useQuery({
    queryKey: ["rp-owners"],
    queryFn: async () => ((await supabase.from("owners").select("id,name").order("name")).data ?? []) as any[],
  });
  const { data: vehiclesAll = [] } = useQuery({
    queryKey: ["rp-vehicles"],
    queryFn: async () => ((await supabase.from("vehicles").select("id,vehicle_no,owner_id").order("vehicle_no")).data ?? []) as any[],
  });

  const q = useQuery({
    queryKey: ["report-all", from, to, car],
    queryFn: async () => {
      let tQ = supabase.from("trips").select("*").gte("trip_date", from).lte("trip_date", to).order("trip_date").order("serial_no");
      if (car) tQ = tQ.eq("vehicle_no", car);
      let eQ = supabase.from("expenses").select("*").gte("expense_date", from).lte("expense_date", to).order("expense_date");
      if (car) eQ = eQ.eq("vehicle_no", car);
      let oQ = supabase.from("other_incomes").select("*").gte("income_date", from).lte("income_date", to).order("income_date");
      if (car) oQ = oQ.eq("vehicle_no", car);
      const [trips, exp, oth] = await Promise.all([tQ, eQ, oQ]);
      return { trips: (trips as any).data ?? [], exp: (exp as any).data ?? [], oth: (oth as any).data ?? [] };
    },
  });

  const data = q.data ?? { trips: [], exp: [], oth: [] };

  const ownerVehNos = useMemo(() => {
    const m = new Map<string, string | null>();
    (vehiclesAll as any[]).forEach((v) => m.set(v.vehicle_no, v.owner_id ?? null));
    return m;
  }, [vehiclesAll]);

  const ownerName = (oid: string | null | undefined) => (owners as any[]).find((o) => o.id === oid)?.name ?? "—";
  const rowOwnerId = (r: any) => r.owner_id ?? ownerVehNos.get(r.vehicle_no) ?? null;

  // === দৈনিক জমা (সব ট্রিপ — owner column সহ) ===
  const tripRows = useMemo(() => {
    if (!ownerId) return data.trips;
    return data.trips.filter((r: any) => (ownerVehNos.get(r.vehicle_no) ?? null) === ownerId);
  }, [data.trips, ownerId, ownerVehNos]);

  const dailyJama = tripRows.reduce((s: number, r: any) => s + Number(r.jama_1 || 0) + Number(r.jama_2 || 0), 0);
  const dena = tripRows.reduce((s: number, r: any) => s + Number(r.dena_1 || 0) + Number(r.dena_2 || 0), 0);
  const fares = tripRows.reduce((s: number, r: any) => s + Number(r.fare_1 || 0) + Number(r.fare_2 || 0), 0);

  // === অন্যান্য জমা: owner_id IS NULL → মূল হিসাব; owner_id সেট → ওনার হিসাব ===
  // ownerId খালি = মূল (owner_id null); সেট = সেই ওনারের
  const othRows = useMemo(() => {
    if (!ownerId) return data.oth.filter((r: any) => !r.owner_id);
    return data.oth.filter((r: any) => r.owner_id === ownerId);
  }, [data.oth, ownerId]);
  const othTotal = othRows.reduce((s: number, r: any) => s + Number(r.amount || 0), 0);

  // === দৈনিক খরচ: একই নিয়ম ===
  const expRows = useMemo(() => {
    if (!ownerId) return data.exp.filter((r: any) => !r.owner_id);
    return data.exp.filter((r: any) => r.owner_id === ownerId);
  }, [data.exp, ownerId]);
  const expTotal = expRows.reduce((s: number, r: any) => s + Number(r.amount || 0), 0);

  // === ওনার হিসাব (জমা-খরচ) — journal style; কোনো বিয়োগ নয় ===
  const ownerTrips = useMemo(() => data.trips.filter((r: any) => {
    const oid = ownerVehNos.get(r.vehicle_no);
    if (!oid) return false;
    return ownerId ? oid === ownerId : true;
  }), [data.trips, ownerId, ownerVehNos]);
  const ownerOth = useMemo(() => data.oth.filter((r: any) => r.owner_id && (ownerId ? r.owner_id === ownerId : true)), [data.oth, ownerId]);
  const ownerExp = useMemo(() => data.exp.filter((r: any) => r.owner_id && (ownerId ? r.owner_id === ownerId : true)), [data.exp, ownerId]);
  const ownerFares = ownerTrips.reduce((s: number, r: any) => s + Number(r.fare_1 || 0) + Number(r.fare_2 || 0), 0);
  const ownerJama = ownerOth.reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
  const ownerKhoroch = ownerExp.reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
  const mainJamaKhorochJama = 0; // মূল হিসাবে জমা-খরচের জমা যোগ হবে না

  // === সুপারভাইজার অনুযায়ী সারাংশ ===
  const supervisorRows = useMemo(() => {
    const m = new Map<string, { name: string; trips: number; jama: number; dena: number }>();
    tripRows.forEach((r: any) => {
      const name = (r.supervisor ?? "").trim() || "—";
      const j = Number(r.jama_1 || 0) + Number(r.jama_2 || 0);
      const d = Number(r.dena_1 || 0) + Number(r.dena_2 || 0);
      const cur = m.get(name) ?? { name, trips: 0, jama: 0, dena: 0 };
      cur.trips += 1; cur.jama += j; cur.dena += d;
      m.set(name, cur);
    });
    return Array.from(m.values())
      .map((s) => {
        const balance = s.jama - s.dena;
        const successRate = s.jama > 0 ? (balance / s.jama) * 100 : 0;
        return { id: s.name, ...s, balance, successRate };
      })
      .sort((a, b) => b.balance - a.balance);
  }, [tripRows]);

  const [supSearch, setSupSearch] = useState("");
  const supervisorRowsFiltered = useMemo(() => {
    if (!supSearch || supSearch === "__all__") return supervisorRows;
    return supervisorRows.filter((s) => s.name === supSearch);
  }, [supervisorRows, supSearch]);

  const ownerByVehicle = useMemo(() => {
    const m = new Map<string, { vno: string; owner: string; trips: number; fare: number }>();
    ownerTrips.forEach((r: any) => {
      const f = Number(r.fare_1 || 0) + Number(r.fare_2 || 0);
      const oid = ownerVehNos.get(r.vehicle_no) ?? null;
      const cur = m.get(r.vehicle_no) ?? { vno: r.vehicle_no, owner: ownerName(oid), trips: 0, fare: 0 };
      cur.trips += 1; cur.fare += f;
      m.set(r.vehicle_no, cur);
    });
    return Array.from(m.values()).sort((a, b) => a.vno.localeCompare(b.vno));
  }, [ownerTrips, ownerVehNos, owners]);

  // === তারিখ অনুযায়ী Dashboard summary ===
  const byDate = useMemo(() => {
    const m = new Map<string, { trips: number; jama: number; dena: number; fare: number; oth: number; jamaKhoroch: number; exp: number }>();
    tripRows.forEach((r: any) => {
      const k = r.trip_date;
      const cur = m.get(k) ?? { trips: 0, jama: 0, dena: 0, fare: 0, oth: 0, jamaKhoroch: 0, exp: 0 };
      cur.trips += 1;
      cur.jama += Number(r.jama_1 || 0) + Number(r.jama_2 || 0);
      cur.dena += Number(r.dena_1 || 0) + Number(r.dena_2 || 0);
      cur.fare += Number(r.fare_1 || 0) + Number(r.fare_2 || 0);
      m.set(k, cur);
    });
    othRows.forEach((r: any) => {
      const k = r.income_date;
      const cur = m.get(k) ?? { trips: 0, jama: 0, dena: 0, fare: 0, oth: 0, jamaKhoroch: 0, exp: 0 };
      cur.oth += Number(r.amount || 0);
      m.set(k, cur);
    });
    ownerOth.forEach((r: any) => {
      const k = r.income_date;
      const cur = m.get(k) ?? { trips: 0, jama: 0, dena: 0, fare: 0, oth: 0, jamaKhoroch: 0, exp: 0 };
      cur.jamaKhoroch += Number(r.amount || 0);
      m.set(k, cur);
    });
    expRows.forEach((r: any) => {
      const k = r.expense_date;
      const cur = m.get(k) ?? { trips: 0, jama: 0, dena: 0, fare: 0, oth: 0, jamaKhoroch: 0, exp: 0 };
      cur.exp += Number(r.amount || 0);
      m.set(k, cur);
    });
    return Array.from(m.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [tripRows, othRows, ownerOth, expRows]);

  const balance = ownerId ? ownerFares + ownerJama - ownerKhoroch : (dailyJama - dena) + othTotal + mainJamaKhorochJama - expTotal;

  const [tab, setTab] = useState("dashboard");

  const csvDownload = (name: string, headers: string[], rows: any[][]) => {
    const escq = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const data = [headers, ...rows].map((r) => r.map(escq).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + data], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name}-${from}_to_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const esc = (v: any) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const tbl = (title: string, headers: string[], rows: any[][], footer?: (string | number)[]) =>
    `<h2>${esc(title)}</h2><table><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>` +
    `<tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody>` +
    (footer ? `<tfoot><tr>${footer.map((c) => `<td>${esc(c)}</td>`).join("")}</tr></tfoot>` : "") +
    `</table>`;

  const summaryBlock = () => {
    const incomeLoss = dailyJama - dena;
    const mainBalance = incomeLoss + othTotal + mainJamaKhorochJama - expTotal;
    if (ownerId) {
      const ownerBal = ownerFares + ownerJama - ownerKhoroch;
      return `
        <div style="border:2px solid #111;padding:10px;margin:0 0 14px;background:#f8fafc">
          <h2 style="margin:0 0 8px;text-align:center;background:#fde68a;padding:6px;border:1px solid #525252">ওনার হিসাব — ${esc(ownerName(ownerId))} — ব্যালেন্স</h2>
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <tr><td style="padding:4px 8px;border:1px solid #d0d5dd">${trBn("গাড়ি ভাড়া (দৈনিক জমা)", lang)}</td><td style="padding:4px 8px;border:1px solid #d0d5dd;text-align:right;font-weight:700;color:#047857">${esc(fmtNum(ownerFares, lang))}</td></tr>
            <tr><td style="padding:4px 8px;border:1px solid #d0d5dd">${trBn("+ জমা-খরচের জমা", lang)}</td><td style="padding:4px 8px;border:1px solid #d0d5dd;text-align:right;font-weight:700;color:#047857">${esc(fmtNum(ownerJama, lang))}</td></tr>
            <tr><td style="padding:4px 8px;border:1px solid #d0d5dd">${trBn("− জমা-খরচের খরচ", lang)}</td><td style="padding:4px 8px;border:1px solid #d0d5dd;text-align:right;font-weight:700;color:#b91c1c">${esc(fmtNum(ownerKhoroch, lang))}</td></tr>
            <tr><td style="padding:6px 8px;border:2px solid #111;background:#fde68a"><b>${trBn("ব্যালেন্স", lang)}</b></td><td style="padding:6px 8px;border:2px solid #111;background:#fde68a;text-align:right;font-weight:800;font-size:16px;color:${ownerBal>=0?"#0369a1":"#b91c1c"}">${esc(fmtNum(ownerBal, lang))}</td></tr>
          </table>
        </div>`;
    }
    return `
      <div style="border:2px solid #111;padding:10px;margin:0 0 14px;background:#f8fafc">
        <h2 style="margin:0 0 8px;text-align:center;background:#fde68a;padding:6px;border:1px solid #525252">মূল পরিবহন হিসাব — ব্যালেন্স</h2>
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <tr><td style="padding:4px 8px;border:1px solid #d0d5dd">${trBn("দৈনিক জমা", lang)}</td><td style="padding:4px 8px;border:1px solid #d0d5dd;text-align:right;font-weight:700;color:#047857">${esc(fmtNum(dailyJama, lang))}</td></tr>
          <tr><td style="padding:4px 8px;border:1px solid #d0d5dd">${trBn("দেনা", lang)}</td><td style="padding:4px 8px;border:1px solid #d0d5dd;text-align:right;font-weight:700;color:#b91c1c">${esc(fmtNum(dena, lang))}</td></tr>
          <tr><td style="padding:4px 8px;border:1px solid #d0d5dd"><b>${trBn("আয়/লস (জমা − দেনা)", lang)}</b></td><td style="padding:4px 8px;border:1px solid #d0d5dd;text-align:right;font-weight:700;color:${incomeLoss>=0?"#047857":"#b91c1c"}">${esc(fmtNum(incomeLoss, lang))}</td></tr>
          <tr><td style="padding:4px 8px;border:1px solid #d0d5dd">${trBn("+ অন্যান্য জমা", lang)}</td><td style="padding:4px 8px;border:1px solid #d0d5dd;text-align:right;font-weight:700;color:#047857">${esc(fmtNum(othTotal, lang))}</td></tr>
          <tr><td style="padding:4px 8px;border:1px solid #d0d5dd">${trBn("− দৈনিক খরচ", lang)}</td><td style="padding:4px 8px;border:1px solid #d0d5dd;text-align:right;font-weight:700;color:#b91c1c">${esc(fmtNum(expTotal, lang))}</td></tr>
          <tr><td style="padding:6px 8px;border:2px solid #111;background:#fde68a"><b>${trBn("মূল ব্যালেন্স", lang)}</b></td><td style="padding:6px 8px;border:2px solid #111;background:#fde68a;text-align:right;font-weight:800;font-size:16px;color:${mainBalance>=0?"#0369a1":"#b91c1c"}">${esc(fmtNum(mainBalance, lang))}</td></tr>
        </table>
      </div>`;
  };

  const sub = () => `${fmtDate(from, lang)} → ${fmtDate(to, lang)}${ownerId ? " · " + trBn("ওনার:", lang) + " " + ownerName(ownerId) : ""}`;

  // === tab-specific dataset builders ===
  const tabData = (): { name: string; headers: string[]; rows: any[][]; footer?: (string | number)[]; orientation?: "portrait" | "portrait"; extraHtml?: string } => {
    switch (tab) {
      case "jama": {
        const headers = [t("serial"), t("date"), t("vehicleNo"), t("owner"), t("jamaTotal"), t("denaTotal"), trBn("আয়/লস", lang), t("fareTotal"), t("route"), t("supervisor")];
        const rows = tripRows.map((r: any) => {
          const j = Number(r.jama_1 || 0) + Number(r.jama_2 || 0);
          const d = Number(r.dena_1 || 0) + Number(r.dena_2 || 0);
          const f = Number(r.fare_1 || 0) + Number(r.fare_2 || 0);
          return [fmtNum(r.serial_no, lang), fmtDate(r.trip_date, lang), r.vehicle_no, ownerName(ownerVehNos.get(r.vehicle_no)), fmtNum(j, lang), fmtNum(d, lang), fmtNum(j - d, lang), fmtNum(f, lang), [r.route_1, r.route_2].filter(Boolean).join(" / ") || "-", r.supervisor ?? "-"];
        });
        return { name: "daily-jama", headers, rows, footer: [t("grandTotal"), "", "", "", fmtNum(dailyJama, lang), fmtNum(dena, lang), fmtNum(dailyJama - dena, lang), fmtNum(fares, lang), "", ""], orientation: "portrait" };
      }
      case "other": {
        const headers = [t("date"), t("owner"), t("vehicleNo"), t("category"), t("head"), t("description"), t("amount")];
        const rows = othRows.map((r: any) => [fmtDate(r.income_date, lang), ownerName(rowOwnerId(r)), r.vehicle_no ?? "-", r.category ?? "-", r.head ?? "-", r.description ?? "-", fmtNum(r.amount, lang)]);
        return { name: "other-income", headers, rows, footer: [t("grandTotal"), "", "", "", "", "", fmtNum(othTotal, lang)] };
      }
      case "exp": {
        const headers = [t("date"), t("owner"), t("vehicleNo"), t("category"), t("head"), t("description"), t("amount")];
        const rows = expRows.map((r: any) => [fmtDate(r.expense_date, lang), ownerName(rowOwnerId(r)), r.vehicle_no ?? "-", r.category ?? "-", r.head ?? "-", r.description ?? "-", fmtNum(r.amount, lang)]);
        return { name: "daily-expense", headers, rows, footer: [t("grandTotal"), "", "", "", "", "", fmtNum(expTotal, lang)] };
      }
      case "supervisor": {
        const headers = [t("serial"), trBn("সুপারভাইজার", lang), trBn("মোট ট্রিপ", lang), trBn("মোট জমা", lang), trBn("মোট দেনা", lang), trBn("মোট ব্যালেন্স", lang), trBn("সফলতার হার (%)", lang)];
        const rows = supervisorRowsFiltered.map((s, i) => [fmtNum(i + 1, lang), s.name, fmtNum(s.trips, lang), fmtNum(s.jama, lang), fmtNum(s.dena, lang), fmtNum(s.balance, lang), `${fmtNum(Number(s.successRate.toFixed(2)), lang)}%`]);
        const sumJama = supervisorRowsFiltered.reduce((a, s) => a + s.jama, 0);
        const sumDena = supervisorRowsFiltered.reduce((a, s) => a + s.dena, 0);
        const sumBal = supervisorRowsFiltered.reduce((a, s) => a + s.balance, 0);
        const sumTrips = supervisorRowsFiltered.reduce((a, s) => a + s.trips, 0);
        const overallRate = sumJama > 0 ? ((sumBal / sumJama) * 100).toFixed(2) : "0";
        
        return { name: "supervisor-report", headers, rows, footer: [t("grandTotal"), "", fmtNum(sumTrips, lang), fmtNum(sumJama, lang), fmtNum(sumDena, lang), fmtNum(sumBal, lang), `${fmtNum(Number(overallRate), lang)}%`], orientation: "portrait" };
      }
      case "owner": {
        // multi-table — handled via extraHtml; csv uses combined headers fallback
        const vehRows = ownerByVehicle.map((v) => [v.vno, v.owner, fmtNum(v.trips, lang), fmtNum(v.fare, lang)]);
        const tripArr = ownerTrips.map((r: any) => [fmtDate(r.trip_date, lang), ownerName(ownerVehNos.get(r.vehicle_no)), r.vehicle_no, fmtNum(Number(r.fare_1 || 0) + Number(r.fare_2 || 0), lang)]);
        const jamaRows = ownerOth.map((r: any) => [fmtDate(r.income_date, lang), ownerName(rowOwnerId(r)), r.vehicle_no ?? "-", r.category ?? "-", r.head ?? "-", r.description ?? "-", fmtNum(r.amount, lang)]);
        const khorochRows = ownerExp.map((r: any) => [fmtDate(r.expense_date, lang), ownerName(rowOwnerId(r)), r.vehicle_no ?? "-", r.category ?? "-", r.head ?? "-", r.description ?? "-", fmtNum(r.amount, lang)]);
        const ownerBal = ownerFares + ownerJama - ownerKhoroch;
        const balBlock = `
          <div style="border:2px solid #111;padding:10px;margin:0 0 12px;background:#f8fafc">
            <h2 style="margin:0 0 8px;text-align:center;background:#fde68a;padding:6px;border:1px solid #525252">ওনার হিসাব — ${esc(ownerId ? ownerName(ownerId) : trBn("সকল ওনার", lang))} — ব্যালেন্স</h2>
            <table style="width:100%;border-collapse:collapse;font-size:13px">
              <tr><td style="padding:4px 8px;border:1px solid #d0d5dd">${trBn("গাড়ি ভাড়া", lang)}</td><td style="padding:4px 8px;border:1px solid #d0d5dd;text-align:right;color:#047857">${esc(fmtNum(ownerFares, lang))}</td></tr>
              <tr><td style="padding:4px 8px;border:1px solid #d0d5dd">${trBn("+ জমা-খরচের জমা", lang)}</td><td style="padding:4px 8px;border:1px solid #d0d5dd;text-align:right;color:#047857">${esc(fmtNum(ownerJama, lang))}</td></tr>
              <tr><td style="padding:4px 8px;border:1px solid #d0d5dd">${trBn("− জমা-খরচের খরচ", lang)}</td><td style="padding:4px 8px;border:1px solid #d0d5dd;text-align:right;color:#b91c1c">${esc(fmtNum(ownerKhoroch, lang))}</td></tr>
              <tr><td style="padding:6px 8px;border:2px solid #111;background:#fde68a"><b>${trBn("ব্যালেন্স", lang)}</b></td><td style="padding:6px 8px;border:2px solid #111;background:#fde68a;text-align:right;font-weight:800;color:${ownerBal>=0?"#0369a1":"#b91c1c"}">${esc(fmtNum(ownerBal, lang))}</td></tr>
            </table>
          </div>`;
        const extraHtml = balBlock +
          tbl(trBn("গাড়ি অনুযায়ী ভাড়া", lang), [t("vehicleNo"), t("owner"), t("tripCount"), t("fareTotal")], vehRows, [t("grandTotal"), "", fmtNum(ownerTrips.length, lang), fmtNum(ownerFares, lang)]) +
          tbl(trBn("ট্রিপ বিবরণ", lang), [t("date"), t("owner"), t("vehicleNo"), t("fareTotal")], tripArr, [t("grandTotal"), "", "", fmtNum(ownerFares, lang)]) +
          tbl(trBn("জমা-খরচের জমা", lang), [t("date"), t("owner"), t("vehicleNo"), t("category"), t("head"), t("description"), t("amount")], jamaRows, [t("grandTotal"), "", "", "", "", "", fmtNum(ownerJama, lang)]) +
          tbl(trBn("জমা-খরচের খরচ", lang), [t("date"), t("owner"), t("vehicleNo"), t("category"), t("head"), t("description"), t("amount")], khorochRows, [t("grandTotal"), "", "", "", "", "", fmtNum(ownerKhoroch, lang)]);
        const csvHeaders = [t("vehicleNo"), t("owner"), t("tripCount"), t("fareTotal")];
        return { name: "owner-report", headers: csvHeaders, rows: vehRows, footer: [t("grandTotal"), "", fmtNum(ownerTrips.length, lang), fmtNum(ownerFares, lang)], orientation: "portrait", extraHtml };
      }
      default: {
        // dashboard — full combined PDF
        const tripBody = tbl(
          trBn("দৈনিক জমা", lang),
          [t("serial"), t("date"), t("vehicleNo"), t("owner"), t("jamaTotal"), t("denaTotal"), trBn("আয়/লস", lang), t("fareTotal"), t("route"), t("supervisor")],
          tripRows.map((r: any) => {
            const j = Number(r.jama_1 || 0) + Number(r.jama_2 || 0);
            const d = Number(r.dena_1 || 0) + Number(r.dena_2 || 0);
            const f = Number(r.fare_1 || 0) + Number(r.fare_2 || 0);
            return [fmtNum(r.serial_no, lang), fmtDate(r.trip_date, lang), r.vehicle_no, ownerName(ownerVehNos.get(r.vehicle_no)), fmtNum(j, lang), fmtNum(d, lang), fmtNum(j - d, lang), fmtNum(f, lang), [r.route_1, r.route_2].filter(Boolean).join(" / ") || "-", r.supervisor ?? "-"];
          }),
          [t("grandTotal"), "", "", "", fmtNum(dailyJama, lang), fmtNum(dena, lang), fmtNum(dailyJama - dena, lang), fmtNum(fares, lang), "", ""],
        );
        const othBody = tbl(trBn("অন্যান্য জমা", lang), [t("date"), t("owner"), t("vehicleNo"), t("category"), t("head"), t("description"), t("amount")],
          othRows.map((r: any) => [fmtDate(r.income_date, lang), ownerName(rowOwnerId(r)), r.vehicle_no ?? "-", r.category ?? "-", r.head ?? "-", r.description ?? "-", fmtNum(r.amount, lang)]),
          [t("grandTotal"), "", "", "", "", "", fmtNum(othTotal, lang)]);
        const expBody = tbl(trBn("দৈনিক খরচ", lang), [t("date"), t("owner"), t("vehicleNo"), t("category"), t("head"), t("description"), t("amount")],
          expRows.map((r: any) => [fmtDate(r.expense_date, lang), ownerName(rowOwnerId(r)), r.vehicle_no ?? "-", r.category ?? "-", r.head ?? "-", r.description ?? "-", fmtNum(r.amount, lang)]),
          [t("grandTotal"), "", "", "", "", "", fmtNum(expTotal, lang)]);
        const extraHtml = summaryBlock() + tripBody + othBody + expBody;
        const csvHeaders = [t("date"), trBn("ট্রিপ", lang), trBn("দৈনিক জমা", lang), trBn("দেনা", lang), trBn("অন্যান্য জমা", lang), trBn("দৈনিক খরচ", lang)];
        const csvRows = byDate.map(([d, v]) => [fmtDate(d, lang), fmtNum(v.trips, lang), fmtNum(v.jama, lang), fmtNum(v.dena, lang), fmtNum(v.oth, lang), fmtNum(v.exp, lang)]);
        return { name: "dashboard", headers: csvHeaders, rows: csvRows, footer: [t("grandTotal"), fmtNum(tripRows.length, lang), fmtNum(dailyJama, lang), fmtNum(dena, lang), fmtNum(othTotal, lang), fmtNum(expTotal, lang)], orientation: "portrait", extraHtml };
      }
    }
  };

  const tabTitles: Record<string, string> = {
    dashboard: trBn("ড্যাশবোর্ড", lang),
    jama: trBn("দৈনিক জমা", lang),
    other: trBn("অন্যান্য জমা", lang),
    exp: trBn("দৈনিক খরচ", lang),
    owner: trBn("ওনার হিসাব", lang),
    supervisor: trBn("সুপারভাইজার রিপোর্ট", lang),
  };

  const exportOwnerLandscapePdf = () => {
    const ownerLabel = ownerId ? ownerName(ownerId) : trBn("সকল ওনার", lang);
    const ownerBal = ownerFares + ownerJama - ownerKhoroch;

    const vehRowsHtml = ownerByVehicle.map((v) => `
      <tr>
        <td>${esc(v.vno)}</td>
        <td class="wrap">${esc(v.owner)}</td>
        <td>${esc(fmtNum(v.trips, lang))}</td>
        <td class="c-jama">${esc(fmtNum(v.fare, lang))}</td>
      </tr>`).join("");

    const trips = ownerTrips;
    const exps = ownerExp;
    const maxLen = Math.max(trips.length, exps.length);
    const mainRows: string[] = [];
    for (let i = 0; i < maxLen; i++) {
      const tr = trips[i];
      const ex = exps[i];
      const f = tr ? Number(tr.fare_1 || 0) + Number(tr.fare_2 || 0) : 0;
      const route = tr ? [tr.route_1, tr.route_2].filter(Boolean).join(" / ") : "";
      mainRows.push(`<tr>
        <td>${tr ? esc(fmtNum(i + 1, lang)) : ""}</td>
        <td>${tr ? esc(fmtDate(tr.trip_date, lang)) : ""}</td>
        <td>${tr ? esc(tr.vehicle_no ?? "") : ""}</td>
        <td class="wrap">${tr ? esc(ownerName(ownerVehNos.get(tr.vehicle_no))) : ""}</td>
        <td class="wrap">${tr ? esc(route) : ""}</td>
        <td class="c-jama">${tr ? esc(fmtNum(f, lang)) : ""}</td>
        <td class="sep"></td>
        <td>${ex ? esc(fmtDate(ex.expense_date, lang)) : ""}</td>
        <td>${ex ? esc(ex.category ?? "") : ""}</td>
        <td>${ex ? esc(ex.head ?? "") : ""}</td>
        <td class="wrap">${ex ? esc(ex.description ?? "") : ""}</td>
        <td class="c-exp">${ex ? esc(fmtNum(ex.amount, lang)) : ""}</td>
      </tr>`);
    }

    const officeRows = ownerOth.map((r: any) => `<tr>
      <td>${esc(fmtDate(r.income_date, lang))}</td>
      <td>${esc(r.vehicle_no ?? "-")}</td>
      <td>${esc(r.category ?? "")}</td>
      <td>${esc(r.head ?? "")}</td>
      <td class="wrap">${esc(r.description ?? "")}</td>
      <td class="c-jama">${esc(fmtNum(r.amount, lang))}</td>
    </tr>`).join("");

    const subtitle = `${fmtDate(from, lang)} → ${fmtDate(to, lang)} &nbsp;|&nbsp; ${trBn("ওনার:", lang)} ${esc(ownerLabel)}`;

    const body = `
      <div class="banner green-banner">চন্দ্রা পরিবহন — ওনার হিসাব</div>
      <div class="meta">${subtitle}</div>

      <table class="summary">
        <thead>
          <tr><th colspan="4" class="head-left">ওনার সারাংশ — ${esc(ownerLabel)}</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>${trBn("গাড়ি ভাড়া (জমা)", lang)}<br/><b class="c-jama">${esc(fmtNum(ownerFares, lang))}</b></td>
            <td>${trBn("জমা-খরচের জমা", lang)}<br/><b class="c-jama">${esc(fmtNum(ownerJama, lang))}</b></td>
            <td>${trBn("জমা-খরচের খরচ", lang)}<br/><b class="c-exp">${esc(fmtNum(ownerKhoroch, lang))}</b></td>
            <td>${trBn("ব্যালেন্স", lang)}<br/><b class="${ownerBal < 0 ? 'c-neg' : 'c-pos'}">${esc(fmtNum(ownerBal, lang))}</b></td>
          </tr>
          <tr><td colspan="4" class="formula">গাড়ি ভাড়া + জমা-খরচের জমা − জমা-খরচের খরচ = ব্যালেন্স</td></tr>
        </tbody>
      </table>

      <h3 style="margin:6px 0 4px;font-size:13px;text-align:center">${esc(trBn("গাড়ি অনুযায়ী ভাড়া", lang))}</h3>
      <table class="other">
        <thead>
          <tr><th>গাড়ী নাম্বার</th><th>ওনার</th><th>${trBn("মোট ট্রিপ", lang)}</th><th>${trBn("মোট ভাড়া", lang)}</th></tr>
        </thead>
        <tbody>${vehRowsHtml || `<tr><td colspan="4">${esc(t("noData"))}</td></tr>`}</tbody>
        <tfoot><tr><td colspan="2">${esc(t("grandTotal"))}</td><td>${esc(fmtNum(ownerTrips.length, lang))}</td><td class="c-jama">${esc(fmtNum(ownerFares, lang))}</td></tr></tfoot>
      </table>

      <table class="main" style="margin-top:6px">
        <thead>
          <tr class="group">
            <th colspan="6">জমা হিসাব (ট্রিপ অনুযায়ী গাড়ী ভাড়া)</th>
            <th class="sep"></th>
            <th colspan="5">খরচ হিসাব (জমা-খরচের খরচ)</th>
          </tr>
          <tr>
            <th>SL</th>
            <th>তারিখ</th>
            <th>গাড়ী নাম্বার</th>
            <th>ওনার</th>
            <th>রুট</th>
            <th>${trBn("গাড়ী ভাড়া", lang)}</th>
            <th class="sep"></th>
            <th>তারিখ</th>
            <th>ক্যাটাগরী</th>
            <th>খাত</th>
            <th>বিবরন</th>
            <th>পরিমান</th>
          </tr>
        </thead>
        <tbody>${mainRows.join("") || `<tr><td colspan="12">${esc(t("noData"))}</td></tr>`}</tbody>
        <tfoot>
          <tr>
            <td colspan="5">${esc(trBn("মোট ভাড়া", lang))}</td>
            <td class="c-jama">${esc(fmtNum(ownerFares, lang))}</td>
            <td class="sep"></td>
            <td colspan="4">${esc(trBn("মোট খরচ", lang))}</td>
            <td class="c-exp">${esc(fmtNum(ownerKhoroch, lang))}</td>
          </tr>
        </tfoot>
      </table>

      ${ownerOth.length ? `
      <div class="office-note">⚠ অফিস কতৃক জমা</div>
      <h3 style="margin:6px 0 4px;font-size:14px;text-align:center">${esc(trBn("জমা-খরচের জমা", lang))}</h3>
      <table class="other">
        <thead>
          <tr><th>তারিখ</th><th>গাড়ী নাম্বার</th><th>ক্যাটাগরী</th><th>খাত</th><th>বিবরন</th><th>পরিমান</th></tr>
        </thead>
        <tbody>${officeRows}</tbody>
        <tfoot><tr><td colspan="5">${esc(trBn("মোট", lang))}</td><td class="c-jama">${esc(fmtNum(ownerJama, lang))}</td></tr></tfoot>
      </table>` : ""}
    `;

    const extraStyle = `<style>
      .banner{background:#dbeafe;border:2px solid #525252;padding:4px;text-align:center;font-weight:700;font-size:13px;margin:2px 0}
      .green-banner{background:#c6e0b4;border:2px solid #525252;font-size:15px;color:#111}
      .meta{text-align:center;font-size:10px;margin-bottom:4px}
      table{table-layout:auto;width:100%}
      table.summary{margin-bottom:4px;border:2px solid #525252}
      table.summary th,table.summary td{text-align:center;padding:3px 4px;border:1px solid #525252}
      table.summary th{background:#e5e7eb}
      table.summary .head-left{background:#cbd5e1;font-size:12px}
      table.summary td{font-size:11px}
      .formula{font-style:italic;background:#f9fafb;font-size:9px}
      table.main{table-layout:auto;border:2px solid #525252}
      table.main th,table.main td{text-align:center;vertical-align:middle;white-space:nowrap;padding:2px 3px;border:1px solid #525252;font-size:10px}
      table.main th{background:#e5e7eb;font-size:11px}
      table.main tr.group th{background:#cbd5e1;font-size:12px}
      table.main td.wrap,table.main th.wrap{white-space:normal;word-break:break-word;min-width:80px}
      table.main .sep{border-top:0;border-bottom:0;border-left:2px solid #525252;border-right:2px solid #525252;background:#f1f5f9;width:8px;padding:0}
      table.other{border:2px solid #525252;margin-bottom:4px}
      table.other th,table.other td{text-align:center;padding:2px 4px;border:1px solid #525252;font-size:10px}
      table.other th{background:#e5e7eb}
      table.other td.wrap{white-space:normal;word-break:break-word;min-width:100px}
      tfoot td{font-weight:700;background:#f3f4f6}
      .c-jama{color:#1d4ed8;font-weight:700}
      .c-exp{color:#b91c1c;font-weight:700}
      .c-pos{color:#15803d;font-weight:700}
      .c-neg{color:#b91c1c;font-weight:700}
      .office-note{margin-top:6px;background:#fef3c7;border:1px solid #d97706;color:#78350f;font-weight:700;text-align:center;padding:3px;font-size:11px;border-radius:3px}
    </style>`;

    exportPdfHtml({
      title: `${trBn("চন্দ্রা পরিবহন — ওনার হিসাব", lang)} — ${ownerLabel}`,
      body: extraStyle + body,
      orientation: "landscape",
    });
  };

  const handlePdf = () => {
    if (tab === "owner") { exportOwnerLandscapePdf(); return; }
    const d = tabData();
    const title = `${t("brand")} — ${tabTitles[tab] ?? t("reports")}`;
    if (d.extraHtml) {
      exportPdfHtml({ title, subtitle: sub(), body: d.extraHtml, orientation: d.orientation });
    } else {
      exportPdf({ title, subtitle: sub(), headers: d.headers, rows: d.rows, footer: d.footer ? d.footer.join(" | ") : undefined, orientation: d.orientation });
    }
  };
  const handlePrint = () => {
    if (tab === "owner") { exportOwnerLandscapePdf(); return; }
    window.print();
  };
  const handleCsv = () => {
    const d = tabData();
    const rows = d.footer ? [...d.rows, d.footer as any[]] : d.rows;
    csvDownload(d.name, d.headers, rows);
  };

  const clear = () => { setCar(""); setOwnerId(""); setFrom(firstOfMonth); setTo(today); };

  return (
    <AppLayout>
      <div className="space-y-4 print:space-y-2">
        <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
          <div>
            <h1 className="text-2xl font-bold">{t("reports")}</h1>
            <p className="text-sm text-muted-foreground">{fmtDate(from, lang)} → {fmtDate(to, lang)}{ownerId ? ` · ${ownerName(ownerId)}` : ""}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={handleCsv}><Download className="h-4 w-4 mr-2" />{t("exportCsv")}</Button>
            <Button variant="outline" onClick={handlePdf}><FileDown className="h-4 w-4 mr-2" />{t("exportPdf")}</Button>
            <Button variant="outline" onClick={handlePrint}><Printer className="h-4 w-4 mr-2" />{t("print")}</Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 rounded-lg border bg-card/60 p-3 print:hidden">
          <div>
            <label className="text-[10px] uppercase text-muted-foreground">{t("from")}</label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9" />
          </div>
          <div>
            <label className="text-[10px] uppercase text-muted-foreground">{t("to")}</label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9" />
          </div>
          <div>
            <label className="text-[10px] uppercase text-muted-foreground">{t("searchByCar")}</label>
            <select value={car} onChange={(e) => setCar(e.target.value)} className="w-full h-9 rounded-md border border-input bg-input px-2 text-sm">
              <option value="">{t("all")}</option>
              {(vehiclesAll as any[]).map((v) => <option key={v.id} value={v.vehicle_no} className="bg-card">{v.vehicle_no}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase text-muted-foreground">{t("searchByOwner")}</label>
            <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className="w-full h-9 rounded-md border border-input bg-input px-2 text-sm">
              <option value="">{t("all")} (মূল)</option>
              {(owners as any[]).map((s) => <option key={s.id} value={s.id} className="bg-card">{s.name}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <Button size="sm" variant="outline" onClick={clear}>{t("clearForm")}</Button>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="dashboard">ড্যাশবোর্ড</TabsTrigger>
            <TabsTrigger value="jama">দৈনিক জমা ({fmtNum(tripRows.length, lang)})</TabsTrigger>
            <TabsTrigger value="other">অন্যান্য জমা ({fmtNum(othTotal, lang)})</TabsTrigger>
            <TabsTrigger value="exp">দৈনিক খরচ ({fmtNum(expTotal, lang)})</TabsTrigger>
            <TabsTrigger value="owner">{trBn("ওনার হিসাব", lang)}</TabsTrigger>
            <TabsTrigger value="supervisor">{trBn("সুপারভাইজার", lang)} ({fmtNum(supervisorRows.length, lang)})</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            {ownerId ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <Stat label={trBn("গাড়ী ভাড়া", lang)} value={fmtNum(ownerFares, lang)} color="text-amber-400" />
                <Stat label={trBn("জমা-খরচের জমা", lang)} value={fmtNum(ownerJama, lang)} color="text-emerald-400" />
                <Stat label={trBn("জমা-খরচের খরচ", lang)} value={fmtNum(ownerKhoroch, lang)} color="text-rose-400" />
                <Stat label={trBn("ব্যালেন্স", lang)} value={fmtNum(balance, lang)} color={balance >= 0 ? "text-sky-400" : "text-rose-500"} />
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-4">
                <Stat label={trBn("দৈনিক জমা", lang)} value={fmtNum(dailyJama, lang)} color="text-emerald-400" />
                <Stat label={trBn("দেনা", lang)} value={fmtNum(dena, lang)} color="text-rose-400" />
                <Stat label={trBn("আয়/লস", lang)} value={fmtNum(dailyJama - dena, lang)} color={(dailyJama - dena) >= 0 ? "text-sky-400" : "text-rose-500"} />
                <Stat label={trBn("অন্যান্য জমা", lang)} value={fmtNum(othTotal, lang)} color="text-emerald-400" />
                <Stat label={trBn("দৈনিক খরচ", lang)} value={fmtNum(expTotal, lang)} color="text-rose-400" />
                <Stat label={trBn("ব্যালেন্স", lang)} value={fmtNum(balance, lang)} color={balance >= 0 ? "text-sky-400" : "text-rose-500"} />
              </div>
            )}
            <Section
              headers={ownerId
                ? [t("date"), trBn("ট্রিপ", lang), trBn("গাড়ী ভাড়া", lang), trBn("জমা-খরচের জমা", lang), trBn("জমা-খরচের খরচ", lang)]
                : [t("date"), trBn("ট্রিপ", lang), trBn("দৈনিক জমা", lang), trBn("দেনা", lang), trBn("অন্যান্য জমা", lang), trBn("দৈনিক খরচ", lang)]}
              rows={byDate.map(([d, v]) => ({ id: d, d, v }))}
              cells={(x: any) => ownerId
                ? [fmtDate(x.d, lang), fmtNum(x.v.trips, lang), fmtNum(x.v.fare, lang), fmtNum(x.v.jamaKhoroch, lang), fmtNum(x.v.exp, lang)]
                : [fmtDate(x.d, lang), fmtNum(x.v.trips, lang), fmtNum(x.v.jama, lang), fmtNum(x.v.dena, lang), fmtNum(x.v.oth, lang), fmtNum(x.v.exp, lang)]}
              footer={ownerId
                ? [t("grandTotal"), fmtNum(tripRows.length, lang), fmtNum(ownerFares, lang), fmtNum(ownerJama, lang), fmtNum(ownerKhoroch, lang)]
                : [t("grandTotal"), fmtNum(tripRows.length, lang), fmtNum(dailyJama, lang), fmtNum(dena, lang), fmtNum(othTotal, lang), fmtNum(expTotal, lang)]}
            />
          </TabsContent>

          <TabsContent value="jama">
            <Section
              headers={[t("serial"), t("date"), t("vehicleNo"), t("owner"), t("jamaTotal"), t("denaTotal"), trBn("আয়/লস", lang), t("fareTotal"), t("supervisor")]}
              rows={tripRows}
              cells={(r: any) => {
                const j = Number(r.jama_1 || 0) + Number(r.jama_2 || 0);
                const d = Number(r.dena_1 || 0) + Number(r.dena_2 || 0);
                const f = Number(r.fare_1 || 0) + Number(r.fare_2 || 0);
                return [fmtNum(r.serial_no, lang), fmtDate(r.trip_date, lang), r.vehicle_no, ownerName(ownerVehNos.get(r.vehicle_no)), fmtNum(j, lang), fmtNum(d, lang), fmtNum(j - d, lang), fmtNum(f, lang), r.supervisor ?? "-"];
              }}
              footer={[t("grandTotal"), "", "", "", fmtNum(dailyJama, lang), fmtNum(dena, lang), fmtNum(dailyJama - dena, lang), fmtNum(fares, lang), ""]}
            />
          </TabsContent>

          <TabsContent value="other">
            <Section
              headers={[t("date"), t("owner"), t("vehicleNo"), t("category"), t("head"), t("description"), t("amount")]}
              rows={othRows}
              cells={(r: any) => [fmtDate(r.income_date, lang), ownerName(rowOwnerId(r)), r.vehicle_no ?? "-", r.category ?? "-", r.head ?? "-", r.description ?? "-", fmtNum(r.amount, lang)]}
              footer={[t("grandTotal"), "", "", "", "", "", fmtNum(othTotal, lang)]}
            />
          </TabsContent>

          <TabsContent value="exp">
            <Section
              headers={[t("date"), t("owner"), t("vehicleNo"), t("category"), t("head"), t("description"), t("amount")]}
              rows={expRows}
              cells={(r: any) => [fmtDate(r.expense_date, lang), ownerName(rowOwnerId(r)), r.vehicle_no ?? "-", r.category ?? "-", r.head ?? "-", r.description ?? "-", fmtNum(r.amount, lang)]}
              footer={[t("grandTotal"), "", "", "", "", "", fmtNum(expTotal, lang)]}
            />
          </TabsContent>

          <TabsContent value="owner">
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Stat label={trBn("গাড়ি ভাড়া", lang)} value={fmtNum(ownerFares, lang)} color="text-amber-400" />
                <Stat label={trBn("জমা-খরচের জমা", lang)} value={fmtNum(ownerJama, lang)} color="text-emerald-400" />
                <Stat label={trBn("জমা-খরচের খরচ", lang)} value={fmtNum(ownerKhoroch, lang)} color="text-rose-400" />
                <Stat label={t("totalTrips")} value={fmtNum(ownerTrips.length, lang)} color="text-sky-400" />
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-2">${trBn("গাড়ি অনুযায়ী ভাড়া", lang)}</h3>
                <Section
                  headers={[t("vehicleNo"), t("owner"), t("tripCount"), t("fareTotal")]}
                  rows={ownerByVehicle}
                  cells={(v: any) => [v.vno, v.owner, fmtNum(v.trips, lang), fmtNum(v.fare, lang)]}
                  footer={[t("grandTotal"), "", fmtNum(ownerTrips.length, lang), fmtNum(ownerFares, lang)]}
                />
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-2">${trBn("ট্রিপ বিবরণ (গাড়ি ভাড়া)", lang)}</h3>
                <Section
                  headers={[t("date"), t("owner"), t("vehicleNo"), t("fareTotal")]}
                  rows={ownerTrips}
                  cells={(r: any) => {
                    const f = Number(r.fare_1 || 0) + Number(r.fare_2 || 0);
                    return [fmtDate(r.trip_date, lang), ownerName(ownerVehNos.get(r.vehicle_no)), r.vehicle_no, fmtNum(f, lang)];
                  }}
                  footer={[t("grandTotal"), "", "", fmtNum(ownerFares, lang)]}
                />
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-2">${trBn("জমা-খরচের জমা", lang)}</h3>
                <Section
                  headers={[t("date"), t("owner"), t("vehicleNo"), t("category"), t("head"), t("description"), t("amount")]}
                  rows={ownerOth}
                  cells={(r: any) => [fmtDate(r.income_date, lang), ownerName(rowOwnerId(r)), r.vehicle_no ?? "-", r.category ?? "-", r.head ?? "-", r.description ?? "-", fmtNum(r.amount, lang)]}
                  footer={[t("grandTotal"), "", "", "", "", "", fmtNum(ownerJama, lang)]}
                />
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-2">${trBn("জমা-খরচের খরচ", lang)}</h3>
                <Section
                  headers={[t("date"), t("owner"), t("vehicleNo"), t("category"), t("head"), t("description"), t("amount")]}
                  rows={ownerExp}
                  cells={(r: any) => [fmtDate(r.expense_date, lang), ownerName(rowOwnerId(r)), r.vehicle_no ?? "-", r.category ?? "-", r.head ?? "-", r.description ?? "-", fmtNum(r.amount, lang)]}
                  footer={[t("grandTotal"), "", "", "", "", "", fmtNum(ownerKhoroch, lang)]}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="supervisor">
            <div className="mb-3 text-xs text-muted-foreground">
              {trBn("তারিখঃ", lang)} {fmtDate(from, lang)} → {fmtDate(to, lang)}
              {" · "}{trBn("সফলতার হার = (মোট ব্যালেন্স ÷ মোট জমা) × ১০০", lang)}
            </div>
            <div className="mb-3 max-w-xs">
              <Select value={supSearch || "__all__"} onValueChange={(v) => setSupSearch(v)}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder={trBn("সুপারভাইজার নির্বাচন করুন", lang)} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">{trBn("সকল সুপারভাইজার", lang)}</SelectItem>
                  {supervisorRows.map((s) => (
                    <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Section
              headers={[t("serial"), trBn("সুপারভাইজার", lang), trBn("মোট ট্রিপ", lang), trBn("মোট জমা", lang), trBn("মোট দেনা", lang), trBn("মোট ব্যালেন্স", lang), trBn("সফলতার হার (%)", lang)]}
              rows={supervisorRowsFiltered.map((s, i) => ({ ...s, serial: i + 1 }))}
              cells={(s: any) => [
                fmtNum(s.serial, lang),
                s.name,
                fmtNum(s.trips, lang),
                fmtNum(s.jama, lang),
                fmtNum(s.dena, lang),
                fmtNum(s.balance, lang),
                `${fmtNum(Number(s.successRate.toFixed(2)), lang)}%`,
              ]}
              footer={[
                t("grandTotal"),
                "",
                fmtNum(supervisorRowsFiltered.reduce((a, s) => a + s.trips, 0), lang),
                fmtNum(supervisorRowsFiltered.reduce((a, s) => a + s.jama, 0), lang),
                fmtNum(supervisorRowsFiltered.reduce((a, s) => a + s.dena, 0), lang),
                fmtNum(supervisorRowsFiltered.reduce((a, s) => a + s.balance, 0), lang),
                "",
              ]}
            />
          </TabsContent>
        </Tabs>
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

function Section({ headers, rows, cells, footer }: { headers: string[]; rows: any[]; cells: (r: any) => any[]; footer?: (string | number)[] }) {
  const { t } = useT();
  return (
    <div className="overflow-x-auto rounded-md border bg-card/70 backdrop-blur">
      <table className="w-full text-sm">
        <thead className="bg-muted/60"><tr>{headers.map((h) => <th key={h} className="text-left px-3 py-2 font-semibold">{h}</th>)}</tr></thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={headers.length} className="text-center py-6 text-muted-foreground">{t("noData")}</td></tr>}
          {rows.map((r, i) => (
            <tr key={r.id ?? i} className="border-t">
              {cells(r).map((c, j) => <td key={j} className="px-3 py-2">{c}</td>)}
            </tr>
          ))}
        </tbody>
        {footer && rows.length > 0 && (
          <tfoot className="bg-muted/40 font-bold border-t"><tr>{footer.map((c, i) => <td key={i} className="px-3 py-2">{c}</td>)}</tr></tfoot>
        )}
      </table>
    </div>
  );
}
