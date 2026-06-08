import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useT, fmtNum, fmtDate } from "@/lib/i18n";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { Download, Printer, FileDown } from "lucide-react";
import { exportPdf, exportPdfHtml } from "@/lib/exportPdf";
import { fetchOfficeDeposits, OFFICE_DEPOSIT_CATEGORY } from "@/lib/officeDeposits";

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
      const [trips, exp, oth, office] = await Promise.all([tQ, eQ, oQ, fetchOfficeDeposits({ from, to })]);
      return { trips: (trips as any).data ?? [], exp: (exp as any).data ?? [], oth: (oth as any).data ?? [], office: office ?? [] };
    },
  });

  const data = q.data ?? { trips: [], exp: [], oth: [], office: [] };

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
    if (!ownerId) return [];
    return data.oth.filter((r: any) => r.owner_id === ownerId && r.category !== OFFICE_DEPOSIT_CATEGORY);
  }, [data.oth, ownerId]);
  const othTotal = othRows.reduce((s: number, r: any) => s + Number(r.amount || 0), 0);

  // === দৈনিক খরচ: একই নিয়ম ===
  const expRows = useMemo(() => {
    if (!ownerId) return data.exp.filter((r: any) => !r.owner_id);
    return data.exp.filter((r: any) => r.owner_id === ownerId);
  }, [data.exp, ownerId]);
  const expTotal = expRows.reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
  const officeRows = useMemo(() => ownerId || car ? [] : data.office, [data.office, ownerId, car]);
  const officeTotal = officeRows.reduce((s: number, r: any) => s + Number(r.amount || 0), 0);

  // === ওনার হিসাব (জমা-খরচ) — journal style; কোনো বিয়োগ নয় ===
  const ownerTrips = useMemo(() => data.trips.filter((r: any) => {
    const oid = ownerVehNos.get(r.vehicle_no);
    if (!oid) return false;
    return ownerId ? oid === ownerId : true;
  }), [data.trips, ownerId, ownerVehNos]);
  const ownerOth = useMemo(() => data.oth.filter((r: any) => r.owner_id && r.category !== OFFICE_DEPOSIT_CATEGORY && (ownerId ? r.owner_id === ownerId : true)), [data.oth, ownerId]);
  const ownerExp = useMemo(() => data.exp.filter((r: any) => r.owner_id && (ownerId ? r.owner_id === ownerId : true)), [data.exp, ownerId]);
  const ownerFares = ownerTrips.reduce((s: number, r: any) => s + Number(r.fare_1 || 0) + Number(r.fare_2 || 0), 0);
  const ownerJama = ownerOth.reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
  const ownerKhoroch = ownerExp.reduce((s: number, r: any) => s + Number(r.amount || 0), 0);

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
    const m = new Map<string, { trips: number; jama: number; dena: number; fare: number; oth: number; exp: number }>();
    tripRows.forEach((r: any) => {
      const k = r.trip_date;
      const cur = m.get(k) ?? { trips: 0, jama: 0, dena: 0, fare: 0, oth: 0, exp: 0 };
      cur.trips += 1;
      cur.jama += Number(r.jama_1 || 0) + Number(r.jama_2 || 0);
      cur.dena += Number(r.dena_1 || 0) + Number(r.dena_2 || 0);
      cur.fare += Number(r.fare_1 || 0) + Number(r.fare_2 || 0);
      m.set(k, cur);
    });
    othRows.forEach((r: any) => {
      const k = r.income_date;
      const cur = m.get(k) ?? { trips: 0, jama: 0, dena: 0, fare: 0, oth: 0, exp: 0 };
      cur.oth += Number(r.amount || 0);
      m.set(k, cur);
    });
    officeRows.forEach((r: any) => {
      const k = r.deposit_date;
      const cur = m.get(k) ?? { trips: 0, jama: 0, dena: 0, fare: 0, oth: 0, exp: 0 };
      cur.oth += Number(r.amount || 0);
      m.set(k, cur);
    });
    expRows.forEach((r: any) => {
      const k = r.expense_date;
      const cur = m.get(k) ?? { trips: 0, jama: 0, dena: 0, fare: 0, oth: 0, exp: 0 };
      cur.exp += Number(r.amount || 0);
      m.set(k, cur);
    });
    return Array.from(m.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [tripRows, othRows, officeRows, expRows]);

  const balance = ownerId ? ownerFares + ownerJama - ownerKhoroch : (dailyJama - dena) + officeTotal - expTotal;

  const exportCsv = () => {
    const lines: string[] = [];
    lines.push("Chandra Paribahan Report");
    lines.push(`From,${from},To,${to},Owner,${ownerId ? ownerName(ownerId) : "MAIN"}`);
    lines.push("");
    lines.push("দৈনিক জমা");
    lines.push("Serial,Date,Vehicle,Owner,Jama,Dena,Balance,Fare,Route,Supervisor");
    tripRows.forEach((r: any) => {
      const j = Number(r.jama_1 || 0) + Number(r.jama_2 || 0);
      const d = Number(r.dena_1 || 0) + Number(r.dena_2 || 0);
      const f = Number(r.fare_1 || 0) + Number(r.fare_2 || 0);
      const rt = [r.route_1, r.route_2].filter(Boolean).join(" / ");
      lines.push([r.serial_no ?? "", r.trip_date, r.vehicle_no, ownerName(ownerVehNos.get(r.vehicle_no)), j, d, j - d, f, rt, r.supervisor ?? ""].join(","));
    });
    lines.push("");
    lines.push("অন্যান্য জমা");
    lines.push("Date,Owner,Vehicle,Category,Head,Description,Amount");
    othRows.forEach((r: any) => lines.push([r.income_date, ownerName(rowOwnerId(r)), r.vehicle_no ?? "", r.category ?? "", r.head ?? "", r.description ?? "", r.amount].join(",")));
    lines.push("");
    lines.push("অফিস কতৃক জমা");
    lines.push("Date,Category,Head,Description,Amount");
    officeRows.forEach((r: any) => lines.push([r.deposit_date, r.category ?? "", r.head ?? "", r.description ?? "", r.amount].join(",")));
    lines.push("");
    lines.push("দৈনিক খরচ");
    lines.push("Date,Owner,Vehicle,Category,Head,Description,Amount");
    expRows.forEach((r: any) => lines.push([r.expense_date, ownerName(rowOwnerId(r)), r.vehicle_no ?? "", r.category ?? "", r.head ?? "", r.description ?? "", r.amount].join(",")));
    lines.push("");
    lines.push("ওনার হিসাব — গাড়ি অনুযায়ী ভাড়া");
    lines.push("Vehicle,Owner,Trips,Fare");
    ownerByVehicle.forEach((v) => lines.push([v.vno, v.owner, v.trips, v.fare].join(",")));

    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chandra-report-${from}_to_${to}.csv`;
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
    const mainBalance = incomeLoss + officeTotal - expTotal;
    if (ownerId) {
      const ownerBal = ownerFares + ownerJama - ownerKhoroch;
      return `
        <div style="border:2px solid #111;padding:10px;margin:0 0 14px;background:#f8fafc">
          <h2 style="margin:0 0 8px;text-align:center;background:#fde68a;padding:6px;border:1px solid #525252">ওনার হিসাব — ${esc(ownerName(ownerId))} — ব্যালেন্স</h2>
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <tr><td style="padding:4px 8px;border:1px solid #d0d5dd">গাড়ি ভাড়া (দৈনিক জমা)</td><td style="padding:4px 8px;border:1px solid #d0d5dd;text-align:right;font-weight:700;color:#047857">${esc(fmtNum(ownerFares, lang))}</td></tr>
            <tr><td style="padding:4px 8px;border:1px solid #d0d5dd">+ জমা-খরচের জমা</td><td style="padding:4px 8px;border:1px solid #d0d5dd;text-align:right;font-weight:700;color:#047857">${esc(fmtNum(ownerJama, lang))}</td></tr>
            <tr><td style="padding:4px 8px;border:1px solid #d0d5dd">− জমা-খরচের খরচ</td><td style="padding:4px 8px;border:1px solid #d0d5dd;text-align:right;font-weight:700;color:#b91c1c">${esc(fmtNum(ownerKhoroch, lang))}</td></tr>
            <tr><td style="padding:6px 8px;border:2px solid #111;background:#fde68a"><b>ব্যালেন্স</b></td><td style="padding:6px 8px;border:2px solid #111;background:#fde68a;text-align:right;font-weight:800;font-size:16px;color:${ownerBal>=0?"#0369a1":"#b91c1c"}">${esc(fmtNum(ownerBal, lang))}</td></tr>
          </table>
          <p style="font-size:11px;color:#555;margin:6px 0 0">সূত্র: গাড়ি ভাড়া + জমা-খরচ (জমা) − জমা-খরচ (খরচ) = ব্যালেন্স</p>
        </div>`;
    }
    return `
      <div style="border:2px solid #111;padding:10px;margin:0 0 14px;background:#f8fafc">
        <h2 style="margin:0 0 8px;text-align:center;background:#fde68a;padding:6px;border:1px solid #525252">মূল পরিবহন হিসাব — ব্যালেন্স</h2>
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <tr><td style="padding:4px 8px;border:1px solid #d0d5dd">দৈনিক জমা</td><td style="padding:4px 8px;border:1px solid #d0d5dd;text-align:right;font-weight:700;color:#047857">${esc(fmtNum(dailyJama, lang))}</td></tr>
          <tr><td style="padding:4px 8px;border:1px solid #d0d5dd">দেনা</td><td style="padding:4px 8px;border:1px solid #d0d5dd;text-align:right;font-weight:700;color:#b91c1c">${esc(fmtNum(dena, lang))}</td></tr>
          <tr><td style="padding:4px 8px;border:1px solid #d0d5dd"><b>আয়/লস (জমা − দেনা)</b></td><td style="padding:4px 8px;border:1px solid #d0d5dd;text-align:right;font-weight:700;color:${incomeLoss>=0?"#047857":"#b91c1c"}">${esc(fmtNum(incomeLoss, lang))}</td></tr>
          <tr><td style="padding:4px 8px;border:1px solid #d0d5dd">+ অফিস কতৃক জমা</td><td style="padding:4px 8px;border:1px solid #d0d5dd;text-align:right;font-weight:700;color:#047857">${esc(fmtNum(officeTotal, lang))}</td></tr>
          <tr><td style="padding:4px 8px;border:1px solid #d0d5dd">− দৈনিক খরচ</td><td style="padding:4px 8px;border:1px solid #d0d5dd;text-align:right;font-weight:700;color:#b91c1c">${esc(fmtNum(expTotal, lang))}</td></tr>
          <tr><td style="padding:6px 8px;border:2px solid #111;background:#fde68a"><b>মূল ব্যালেন্স</b></td><td style="padding:6px 8px;border:2px solid #111;background:#fde68a;text-align:right;font-weight:800;font-size:16px;color:${mainBalance>=0?"#0369a1":"#b91c1c"}">${esc(fmtNum(mainBalance, lang))}</td></tr>
        </table>
        <p style="font-size:11px;color:#555;margin:6px 0 0">সূত্র: (দৈনিক জমা − দেনা) + অফিস কতৃক জমা − দৈনিক খরচ = মূল ব্যালেন্স</p>
      </div>`;
  };

  const exportFullPdf = () => {
    const tripBody = tbl(
      "দৈনিক জমা",
      [t("serial"), t("date"), t("vehicleNo"), t("owner"), t("jamaTotal"), t("denaTotal"), "আয়/লস", t("fareTotal"), t("route"), t("supervisor")],
      tripRows.map((r: any) => {
        const j = Number(r.jama_1 || 0) + Number(r.jama_2 || 0);
        const d = Number(r.dena_1 || 0) + Number(r.dena_2 || 0);
        const f = Number(r.fare_1 || 0) + Number(r.fare_2 || 0);
        return [fmtNum(r.serial_no, lang), fmtDate(r.trip_date, lang), r.vehicle_no, ownerName(ownerVehNos.get(r.vehicle_no)), fmtNum(j, lang), fmtNum(d, lang), fmtNum(j - d, lang), fmtNum(f, lang), [r.route_1, r.route_2].filter(Boolean).join(" / ") || "-", r.supervisor ?? "-"];
      }),
      [t("grandTotal"), "", "", "", fmtNum(dailyJama, lang), fmtNum(dena, lang), fmtNum(dailyJama - dena, lang), fmtNum(fares, lang), "", ""],
    );
    const othBody = tbl(
      "অন্যান্য জমা",
      [t("date"), t("owner"), t("vehicleNo"), t("category"), t("head"), t("description"), t("amount")],
      othRows.map((r: any) => [fmtDate(r.income_date, lang), ownerName(rowOwnerId(r)), r.vehicle_no ?? "-", r.category ?? "-", r.head ?? "-", r.description ?? "-", fmtNum(r.amount, lang)]),
      [t("grandTotal"), "", "", "", "", "", fmtNum(othTotal, lang)],
    );
    const expBody = tbl(
      "দৈনিক খরচ",
      [t("date"), t("owner"), t("vehicleNo"), t("category"), t("head"), t("description"), t("amount")],
      expRows.map((r: any) => [fmtDate(r.expense_date, lang), ownerName(rowOwnerId(r)), r.vehicle_no ?? "-", r.category ?? "-", r.head ?? "-", r.description ?? "-", fmtNum(r.amount, lang)]),
      [t("grandTotal"), "", "", "", "", "", fmtNum(expTotal, lang)],
    );
    const officeBody = tbl(
      "অফিস কতৃক জমা",
      [t("date"), t("category"), t("head"), t("description"), t("amount")],
      officeRows.map((r: any) => [fmtDate(r.deposit_date, lang), r.category ?? "-", r.head ?? "-", r.description ?? "-", fmtNum(r.amount, lang)]),
      [t("grandTotal"), "", "", "", fmtNum(officeTotal, lang)],
    );
    const sub = `${fmtDate(from, lang)} → ${fmtDate(to, lang)}${ownerId ? " · ওনার: " + ownerName(ownerId) : ""}`;
    exportPdfHtml({ title: `${t("brand")} — ${t("reports")}`, subtitle: sub, body: summaryBlock() + tripBody + othBody + officeBody + expBody, orientation: "landscape" });
  };

  const exportOwnerPdf = () => {
    const vehRows = ownerByVehicle.map((v) => [v.vno, v.owner, fmtNum(v.trips, lang), fmtNum(v.fare, lang)]);
    const tripRowsArr = ownerTrips.map((r: any) => [fmtDate(r.trip_date, lang), ownerName(ownerVehNos.get(r.vehicle_no)), r.vehicle_no, fmtNum(Number(r.fare_1 || 0) + Number(r.fare_2 || 0), lang)]);
    const jamaRows = ownerOth.map((r: any) => [fmtDate(r.income_date, lang), ownerName(rowOwnerId(r)), r.vehicle_no ?? "-", r.category ?? "-", r.head ?? "-", r.description ?? "-", fmtNum(r.amount, lang)]);
    const khorochRows = ownerExp.map((r: any) => [fmtDate(r.expense_date, lang), ownerName(rowOwnerId(r)), r.vehicle_no ?? "-", r.category ?? "-", r.head ?? "-", r.description ?? "-", fmtNum(r.amount, lang)]);
    const ownerBal = ownerFares + ownerJama - ownerKhoroch;
    const balBlock = `
      <div style="border:2px solid #111;padding:10px;margin:0 0 12px;background:#f8fafc">
        <h2 style="margin:0 0 8px;text-align:center;background:#fde68a;padding:6px;border:1px solid #525252">ওনার হিসাব — ${esc(ownerId ? ownerName(ownerId) : "সকল ওনার")} — ব্যালেন্স</h2>
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <tr><td style="padding:4px 8px;border:1px solid #d0d5dd">গাড়ি ভাড়া (দৈনিক জমা)</td><td style="padding:4px 8px;border:1px solid #d0d5dd;text-align:right;font-weight:700;color:#047857">${esc(fmtNum(ownerFares, lang))}</td></tr>
          <tr><td style="padding:4px 8px;border:1px solid #d0d5dd">+ জমা-খরচের জমা</td><td style="padding:4px 8px;border:1px solid #d0d5dd;text-align:right;font-weight:700;color:#047857">${esc(fmtNum(ownerJama, lang))}</td></tr>
          <tr><td style="padding:4px 8px;border:1px solid #d0d5dd">− জমা-খরচের খরচ</td><td style="padding:4px 8px;border:1px solid #d0d5dd;text-align:right;font-weight:700;color:#b91c1c">${esc(fmtNum(ownerKhoroch, lang))}</td></tr>
          <tr><td style="padding:6px 8px;border:2px solid #111;background:#fde68a"><b>ব্যালেন্স</b></td><td style="padding:6px 8px;border:2px solid #111;background:#fde68a;text-align:right;font-weight:800;font-size:16px;color:${ownerBal>=0?"#0369a1":"#b91c1c"}">${esc(fmtNum(ownerBal, lang))}</td></tr>
        </table>
        <p style="font-size:11px;color:#555;margin:6px 0 0">সূত্র: গাড়ি ভাড়া + জমা-খরচ (জমা) − জমা-খরচ (খরচ) = ব্যালেন্স</p>
      </div>`;
    const body = balBlock +
      tbl("গাড়ি অনুযায়ী ভাড়া", [t("vehicleNo"), t("owner"), t("tripCount"), t("fareTotal")], vehRows, [t("grandTotal"), "", fmtNum(ownerTrips.length, lang), fmtNum(ownerFares, lang)]) +
      tbl("ট্রিপ বিবরণ", [t("date"), t("owner"), t("vehicleNo"), t("fareTotal")], tripRowsArr, [t("grandTotal"), "", "", fmtNum(ownerFares, lang)]) +
      tbl("জমা-খরচের জমা", [t("date"), t("owner"), t("vehicleNo"), t("category"), t("head"), t("description"), t("amount")], jamaRows, [t("grandTotal"), "", "", "", "", "", fmtNum(ownerJama, lang)]) +
      tbl("জমা-খরচের খরচ", [t("date"), t("owner"), t("vehicleNo"), t("category"), t("head"), t("description"), t("amount")], khorochRows, [t("grandTotal"), "", "", "", "", "", fmtNum(ownerKhoroch, lang)]);
    const subt = `${fmtDate(from, lang)} → ${fmtDate(to, lang)} · ওনার: ${ownerId ? ownerName(ownerId) : "সকল"}`;
    exportPdfHtml({ title: `${t("brand")} — ওনার হিসাব`, subtitle: subt, body, orientation: "landscape" });
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
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-2" />{t("exportCsv")}</Button>
            <Button variant="outline" onClick={exportFullPdf}><FileDown className="h-4 w-4 mr-2" />{t("exportPdf")}</Button>
            <Button variant="outline" onClick={exportOwnerPdf}><FileDown className="h-4 w-4 mr-2" />ওনার PDF</Button>
            <Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4 mr-2" />{t("print")}</Button>
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

        <Tabs defaultValue="dashboard">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="dashboard">ড্যাশবোর্ড</TabsTrigger>
            <TabsTrigger value="jama">দৈনিক জমা ({fmtNum(tripRows.length, lang)})</TabsTrigger>
              <TabsTrigger value="other">অন্যান্য জমা ({fmtNum(othTotal, lang)})</TabsTrigger>
              <TabsTrigger value="office">অফিস জমা ({fmtNum(officeTotal, lang)})</TabsTrigger>
            <TabsTrigger value="exp">দৈনিক খরচ ({fmtNum(expTotal, lang)})</TabsTrigger>
            <TabsTrigger value="owner">ওনার হিসাব</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
              <Stat label="দৈনিক জমা" value={fmtNum(dailyJama, lang)} color="text-emerald-400" />
              <Stat label="দেনা" value={fmtNum(dena, lang)} color="text-rose-400" />
              <Stat label="অফিস কতৃক জমা" value={fmtNum(officeTotal, lang)} color="text-emerald-400" />
              <Stat label="দৈনিক খরচ" value={fmtNum(expTotal, lang)} color="text-rose-400" />
              <Stat label="ব্যালেন্স" value={fmtNum(balance, lang)} color={balance >= 0 ? "text-sky-400" : "text-rose-500"} />
            </div>
            <Section
              headers={[t("date"), "ট্রিপ", "দৈনিক জমা", "দেনা", "গাড়ী ভাড়া", "অফিস জমা", "দৈনিক খরচ"]}
              rows={byDate.map(([d, v]) => ({ id: d, d, v }))}
              cells={(x: any) => [fmtDate(x.d, lang), fmtNum(x.v.trips, lang), fmtNum(x.v.jama, lang), fmtNum(x.v.dena, lang), fmtNum(x.v.fare, lang), fmtNum(x.v.oth, lang), fmtNum(x.v.exp, lang)]}
              footer={[t("grandTotal"), fmtNum(tripRows.length, lang), fmtNum(dailyJama, lang), fmtNum(dena, lang), fmtNum(fares, lang), fmtNum(othTotal, lang), fmtNum(expTotal, lang)]}
            />
          </TabsContent>

          <TabsContent value="jama">
            <Section
              headers={[t("serial"), t("date"), t("vehicleNo"), t("owner"), t("jamaTotal"), t("denaTotal"), "আয়/লস", t("fareTotal"), t("supervisor")]}
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

          <TabsContent value="office">
            <Section
              headers={[t("serial"), t("date"), t("category"), t("head"), t("description"), t("amount")]}
              rows={officeRows}
              cells={(r: any) => [fmtNum(officeRows.indexOf(r) + 1, lang), fmtDate(r.deposit_date, lang), r.category ?? "-", r.head ?? "-", r.description ?? "-", fmtNum(r.amount, lang)]}
              footer={[t("grandTotal"), "", "", "", "", fmtNum(officeTotal, lang)]}
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
                <Stat label="গাড়ি ভাড়া" value={fmtNum(ownerFares, lang)} color="text-amber-400" />
                <Stat label="জমা-খরচের জমা" value={fmtNum(ownerJama, lang)} color="text-emerald-400" />
                <Stat label="জমা-খরচের খরচ" value={fmtNum(ownerKhoroch, lang)} color="text-rose-400" />
                <Stat label={t("totalTrips")} value={fmtNum(ownerTrips.length, lang)} color="text-sky-400" />
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-2">গাড়ি অনুযায়ী ভাড়া</h3>
                <Section
                  headers={[t("vehicleNo"), t("owner"), t("tripCount"), t("fareTotal")]}
                  rows={ownerByVehicle}
                  cells={(v: any) => [v.vno, v.owner, fmtNum(v.trips, lang), fmtNum(v.fare, lang)]}
                  footer={[t("grandTotal"), "", fmtNum(ownerTrips.length, lang), fmtNum(ownerFares, lang)]}
                />
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-2">ট্রিপ বিবরণ (গাড়ি ভাড়া)</h3>
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
                <h3 className="text-sm font-semibold mb-2">জমা-খরচের জমা</h3>
                <Section
                  headers={[t("date"), t("owner"), t("vehicleNo"), t("category"), t("head"), t("description"), t("amount")]}
                  rows={ownerOth}
                  cells={(r: any) => [fmtDate(r.income_date, lang), ownerName(rowOwnerId(r)), r.vehicle_no ?? "-", r.category ?? "-", r.head ?? "-", r.description ?? "-", fmtNum(r.amount, lang)]}
                  footer={[t("grandTotal"), "", "", "", "", "", fmtNum(ownerJama, lang)]}
                />
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-2">জমা-খরচের খরচ</h3>
                <Section
                  headers={[t("date"), t("owner"), t("vehicleNo"), t("category"), t("head"), t("description"), t("amount")]}
                  rows={ownerExp}
                  cells={(r: any) => [fmtDate(r.expense_date, lang), ownerName(rowOwnerId(r)), r.vehicle_no ?? "-", r.category ?? "-", r.head ?? "-", r.description ?? "-", fmtNum(r.amount, lang)]}
                  footer={[t("grandTotal"), "", "", "", "", "", fmtNum(ownerKhoroch, lang)]}
                />
              </div>
            </div>
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
