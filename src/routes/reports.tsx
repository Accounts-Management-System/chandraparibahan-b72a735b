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

export const Route = createFileRoute("/reports")({ component: Page });

const CHANDRA_ID = "674def72-609b-434c-8186-15aa3d351d28";
const isMainOwner = (oid: string | null | undefined) => !oid || oid === CHANDRA_ID;

function Page() {
  const { t, lang } = useT();
  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = today.slice(0, 8) + "01";
  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(today);
  const [car, setCar] = useState("");
  const [ownerId, setOwnerId] = useState(""); // for জমা-খরচ tab

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
      const [trips, exp, oth] = await Promise.all([tQ, eQ, oQ]);
      return { trips: (trips as any).data ?? [], exp: (exp as any).data ?? [], oth: (oth as any).data ?? [] };
    },
  });

  const data = q.data ?? { trips: [], exp: [], oth: [] };

  const ownerVehNos = useMemo(() => {
    const m = new Map<string, string | null>(); // vehicle_no -> owner_id
    (vehiclesAll as any[]).forEach((v) => m.set(v.vehicle_no, v.owner_id ?? null));
    return m;
  }, [vehiclesAll]);

  const matchedOwnerId = (r: any) => r.owner_id ?? ownerVehNos.get(r.vehicle_no) ?? null;

  // মূল হিসাব: owner_id/owner vehicle ছাড়া শুধু main transportation
  const mainTrips = useMemo(() => data.trips.filter((r: any) => isMainOwner(ownerVehNos.get(r.vehicle_no))), [data.trips, ownerVehNos]);
  const mainExp = useMemo(() => data.exp.filter((r: any) => isMainOwner(matchedOwnerId(r))), [data.exp, ownerVehNos]);
  const mainOth = useMemo(() => data.oth.filter((r: any) => isMainOwner(matchedOwnerId(r))), [data.oth, ownerVehNos]);

  const dailyJama = mainTrips.reduce((s: number, r: any) => s + Number(r.jama_1 || 0) + Number(r.jama_2 || 0), 0);
  const dena = mainTrips.reduce((s: number, r: any) => s + Number(r.dena_1 || 0) + Number(r.dena_2 || 0), 0);
  const fares = mainTrips.reduce((s: number, r: any) => s + Number(r.fare_1 || 0) + Number(r.fare_2 || 0), 0);
  const mainExpense = mainExp.reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
  const mainOtherInc = mainOth.reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
  const balance = (dailyJama - dena) + mainOtherInc - mainExpense;
  const totalTripCount = mainTrips.length;
  const tripCountByDate = (() => {
    const m = new Map<string, number>();
    mainTrips.forEach((r: any) => m.set(r.trip_date, (m.get(r.trip_date) ?? 0) + 1));
    return Array.from(m.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  })();

  // ওনার হিসাব: শুধু গাড়ি ভাড়া (পরিবহন/মূল হিসাব আসবে না)
  const jkTrips = useMemo(() => data.trips.filter((r: any) => {
    const oid = ownerVehNos.get(r.vehicle_no);
    if (!oid || oid === CHANDRA_ID) return false;
    return ownerId ? oid === ownerId : true;
  }), [data.trips, ownerVehNos, ownerId]);
  const jkFares = jkTrips.reduce((s: number, r: any) => s + Number(r.fare_1 || 0) + Number(r.fare_2 || 0), 0);
  const jkBalance = jkFares;
  const jkByVehicle = (() => {
    const m = new Map<string, { vno: string; owner: string; trips: number; fare: number }>();
    jkTrips.forEach((r: any) => {
      const f = Number(r.fare_1 || 0) + Number(r.fare_2 || 0);
      const oid = ownerVehNos.get(r.vehicle_no) ?? null;
      const ownerNm = (owners as any[]).find((o: any) => o.id === oid)?.name ?? "—";
      const cur = m.get(r.vehicle_no) ?? { vno: r.vehicle_no, owner: ownerNm, trips: 0, fare: 0 };
      cur.trips += 1; cur.fare += f;
      m.set(r.vehicle_no, cur);
    });
    return Array.from(m.values()).sort((a, b) => a.vno.localeCompare(b.vno));
  })();

  const ownerName = (oid: string | null | undefined) => (owners as any[]).find((o) => o.id === oid)?.name ?? "—";

  const exportCsv = () => {
    const lines: string[] = [];
    lines.push("Chandra Paribahan Report");
    lines.push(`From,${from},To,${to}`);
    lines.push("");
    lines.push("দৈনিক জমা (Trips)");
    lines.push("Serial,Date,Vehicle,Jama,Dena,Balance,Fare,Route,Supervisor");
    data.trips.forEach((r: any) => {
      const j = Number(r.jama_1 || 0) + Number(r.jama_2 || 0);
      const d = Number(r.dena_1 || 0) + Number(r.dena_2 || 0);
      const f = Number(r.fare_1 || 0) + Number(r.fare_2 || 0);
      const rt = [r.route_1, r.route_2].filter(Boolean).join(" / ");
      lines.push([r.serial_no ?? "", r.trip_date, r.vehicle_no, j, d, j - d, f, rt, r.supervisor ?? ""].join(","));
    });
    lines.push("");
    lines.push("অন্যান্য জমা (Main)");
    lines.push("Date,Category,Amount");
    mainOth.forEach((r: any) => lines.push([r.income_date, r.category, r.amount].join(",")));
    lines.push("");
    lines.push("দৈনিক খরচ (Main)");
    lines.push("Date,Category,Vehicle,Amount");
    mainExp.forEach((r: any) => lines.push([r.expense_date, r.category, r.vehicle_no ?? "", r.amount].join(",")));
    lines.push("");
    lines.push("ওনার হিসাব (গাড়ির ভাড়া)");
    lines.push("Vehicle,Owner,Trips,Total Fare");
    jkByVehicle.forEach((v) => lines.push([v.vno, v.owner, v.trips, v.fare].join(",")));

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

  const exportMainTAccount = () => {
    const credits: [string, number][] = [["দৈনিক জমা", dailyJama], ["অন্যান্য জমা", mainOtherInc]];
    const debits: [string, number][] = [["দেনা", dena], ["দৈনিক খরচ", mainExpense]];
    const totalCr = credits.reduce((s, [, v]) => s + v, 0);
    const totalDr = debits.reduce((s, [, v]) => s + v, 0);
    const left = `<table><thead><tr><th>বিবরণ (ক্রেডিট / জমা)</th><th style="text-align:right">টাকা</th></tr></thead><tbody>${credits.map(([k, v]) => `<tr><td>${esc(k)}</td><td style="text-align:right">${esc(fmtNum(v, lang))}</td></tr>`).join("")}</tbody><tfoot><tr><td>মোট ক্রেডিট</td><td style="text-align:right">${esc(fmtNum(totalCr, lang))}</td></tr></tfoot></table>`;
    const right = `<table><thead><tr><th>বিবরণ (ডেবিট / খরচ)</th><th style="text-align:right">টাকা</th></tr></thead><tbody>${debits.map(([k, v]) => `<tr><td>${esc(k)}</td><td style="text-align:right">${esc(fmtNum(v, lang))}</td></tr>`).join("")}</tbody><tfoot><tr><td>মোট ডেবিট</td><td style="text-align:right">${esc(fmtNum(totalDr, lang))}</td></tr></tfoot></table>`;
    const body = `<div class="t-grid"><div><h3>ক্রেডিট (জমা)</h3>${left}</div><div><h3>ডেবিট (খরচ)</h3>${right}</div></div><div class="totals"><span>ব্যালেন্স (ক্রেডিট − ডেবিট)</span><span>${esc(fmtNum(balance, lang))}</span></div>`;
    exportPdfHtml({ title: `${t("brand")} — মূল পরিবহন হিসাব`, subtitle: `${fmtDate(from, lang)} → ${fmtDate(to, lang)}`, body, orientation: "landscape" });
  };

  const exportOwnerPdf = () => {
    const vehRows = jkByVehicle.map((v) => [v.vno, v.owner, fmtNum(v.trips, lang), fmtNum(v.fare, lang)]);
    const tripRows = jkTrips.map((r: any) => [fmtDate(r.trip_date, lang), ownerName(ownerVehNos.get(r.vehicle_no)), r.vehicle_no, fmtNum(Number(r.fare_1 || 0) + Number(r.fare_2 || 0), lang)]);
    const body =
      `<div class="totals" style="border:0;margin:0 0 10px"><span>মোট গাড়ি ভাড়া: ${esc(fmtNum(jkFares, lang))}</span><span>মোট ট্রিপ: ${esc(fmtNum(jkTrips.length, lang))}</span></div>` +
      tbl("গাড়ি অনুযায়ী ভাড়া", [t("vehicleNo"), "ওনার", "ট্রিপ সংখ্যা", t("fareTotal")], vehRows, [t("grandTotal"), "", fmtNum(jkTrips.length, lang), fmtNum(jkFares, lang)]) +
      tbl("ট্রিপ বিবরণ", [t("date"), "ওনার", t("vehicleNo"), t("fareTotal")], tripRows, [t("grandTotal"), "", "", fmtNum(jkFares, lang)]);
    const subt = `${fmtDate(from, lang)} → ${fmtDate(to, lang)} · ওনার: ${ownerId ? ownerName(ownerId) : "সকল"}`;
    exportPdfHtml({ title: `${t("brand")} — ওনার হিসাব (গাড়ির ভাড়া)`, subtitle: subt, body, orientation: "landscape" });
  };

  const clear = () => { setCar(""); setOwnerId(""); setFrom(firstOfMonth); setTo(today); };

  return (
    <AppLayout>
      <div className="space-y-4 print:space-y-2">
        <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
          <div>
            <h1 className="text-2xl font-bold">{t("reports")}</h1>
            <p className="text-sm text-muted-foreground">{fmtDate(from, lang)} → {fmtDate(to, lang)}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-2" />{t("exportCsv")}</Button>
            <Button variant="outline" onClick={() => {
              const sub = `${fmtDate(from, lang)} → ${fmtDate(to, lang)} · দৈনিক জমা: ${fmtNum(dailyJama, lang)} · অন্যান্য জমা: ${fmtNum(mainOtherInc, lang)} · দৈনিক খরচ: ${fmtNum(mainExpense, lang)} · ব্যালেন্স: ${fmtNum(balance, lang)}`;
              exportPdf({
                title: `${t("brand")} — ${t("reports")}`,
                subtitle: sub,
                headers: [t("serial"), t("date"), t("vehicleNo"), t("jamaTotal"), t("denaTotal"), t("balance"), t("fareTotal"), t("route"), t("supervisor")],
                rows: data.trips.map((r: any) => {
                  const j = Number(r.jama_1 || 0) + Number(r.jama_2 || 0);
                  const d = Number(r.dena_1 || 0) + Number(r.dena_2 || 0);
                  const f = Number(r.fare_1 || 0) + Number(r.fare_2 || 0);
                  return [fmtNum(r.serial_no, lang), fmtDate(r.trip_date, lang), r.vehicle_no, fmtNum(j, lang), fmtNum(d, lang), fmtNum(j - d, lang), fmtNum(f, lang), [r.route_1, r.route_2].filter(Boolean).join(" / ") || "-", r.supervisor ?? "-"];
                }),
              });
            }}><FileDown className="h-4 w-4 mr-2" />{t("exportPdf")}</Button>
            <Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4 mr-2" />{t("print")}</Button>
          </div>
        </div>

        {/* Filters */}
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
            <label className="text-[10px] uppercase text-muted-foreground">ওনার (জমা-খরচ)</label>
            <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className="w-full h-9 rounded-md border border-input bg-input px-2 text-sm">
              <option value="">{t("all")}</option>
              {(owners as any[]).filter((o) => o.id !== CHANDRA_ID).map((s) => <option key={s.id} value={s.id} className="bg-card">{s.name}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <Button size="sm" variant="outline" onClick={clear}>{t("clearForm")}</Button>
          </div>
        </div>

        <div className="hidden print:block mb-4">
          <h1 className="text-xl font-bold text-center">{t("brand")} — {t("reports")}</h1>
          <p className="text-sm text-center">{fmtDate(from, lang)} → {fmtDate(to, lang)}</p>
        </div>

        <Tabs defaultValue="dashboard">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="dashboard">ড্যাশবোর্ড</TabsTrigger>
            <TabsTrigger value="jama">দৈনিক জমা ({fmtNum(data.trips.length, lang)})</TabsTrigger>
            <TabsTrigger value="other">অন্যান্য জমা ({fmtNum(mainOtherInc, lang)})</TabsTrigger>
            <TabsTrigger value="exp">দৈনিক খরচ ({fmtNum(mainExpense, lang)})</TabsTrigger>
            <TabsTrigger value="jk">জমা-খরচ (ওনার)</TabsTrigger>
          </TabsList>

          {/* Dashboard: মূল হিসাব T-account */}
          <TabsContent value="dashboard">
            <div className="flex justify-end mb-2">
              <Button size="sm" variant="outline" onClick={exportMainTAccount}>
                <FileDown className="h-4 w-4 mr-2" />T-হিসাব PDF (Landscape)
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-lg border bg-card/70 overflow-hidden">
                <div className="bg-emerald-500/10 text-emerald-300 text-center text-sm font-semibold py-2 border-b">ক্রেডিট (জমা) — বাম</div>
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-b"><td className="px-3 py-2">দৈনিক জমা</td><td className="px-3 py-2 text-right text-emerald-400">{fmtNum(dailyJama, lang)}</td></tr>
                    <tr className="border-b"><td className="px-3 py-2">অন্যান্য জমা</td><td className="px-3 py-2 text-right text-emerald-400">{fmtNum(mainOtherInc, lang)}</td></tr>
                  </tbody>
                  <tfoot className="bg-muted/40 font-bold">
                    <tr><td className="px-3 py-2">মোট ক্রেডিট</td><td className="px-3 py-2 text-right">{fmtNum(dailyJama + mainOtherInc, lang)}</td></tr>
                  </tfoot>
                </table>
              </div>
              <div className="rounded-lg border bg-card/70 overflow-hidden">
                <div className="bg-rose-500/10 text-rose-300 text-center text-sm font-semibold py-2 border-b">ডেবিট (খরচ) — ডান</div>
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-b"><td className="px-3 py-2">দেনা</td><td className="px-3 py-2 text-right text-rose-400">{fmtNum(dena, lang)}</td></tr>
                    <tr className="border-b"><td className="px-3 py-2">দৈনিক খরচ</td><td className="px-3 py-2 text-right text-rose-400">{fmtNum(mainExpense, lang)}</td></tr>
                  </tbody>
                  <tfoot className="bg-muted/40 font-bold">
                    <tr><td className="px-3 py-2">মোট ডেবিট</td><td className="px-3 py-2 text-right">{fmtNum(dena + mainExpense, lang)}</td></tr>
                  </tfoot>
                </table>
              </div>
            </div>
            <div className="mt-3 rounded-lg border bg-card/70 p-3 flex items-center justify-between font-bold">
              <span>ব্যালেন্স (ক্রেডিট − ডেবিট)</span>
              <span className={balance >= 0 ? "text-sky-400" : "text-rose-500"}>{fmtNum(balance, lang)}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">মূল হিসাব = (দৈনিক জমা − দেনা) + অন্যান্য জমা − দৈনিক খরচ</p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
              <Stat label="গাড়ি ভাড়া (ওনার)" value={fmtNum(jkFares, lang)} color="text-amber-400" />
              <Stat label="জমা-খরচ জমা (ওনার)" value={fmtNum(jkOthSum, lang)} color="text-emerald-400" />
              <Stat label="জমা-খরচ খরচ (ওনার)" value={fmtNum(jkExpSum, lang)} color="text-rose-400" />
              <Stat label="ওনার ব্যালেন্স" value={fmtNum(jkBalance, lang)} color={jkBalance >= 0 ? "text-sky-400" : "text-rose-500"} />
            </div>
            <p className="text-xs text-muted-foreground mt-2">ওনার হিসাব = (গাড়ি ভাড়া + জমা-খরচ জমা) − জমা-খরচ খরচ</p>
          </TabsContent>

          <TabsContent value="jama">
            <Section
              headers={[t("serial"), t("date"), t("vehicleNo"), t("jamaTotal"), t("denaTotal"), t("balance"), t("fareTotal"), t("route"), t("supervisor")]}
              rows={data.trips}
              cells={(r: any) => {
                const j = Number(r.jama_1 || 0) + Number(r.jama_2 || 0);
                const d = Number(r.dena_1 || 0) + Number(r.dena_2 || 0);
                const f = Number(r.fare_1 || 0) + Number(r.fare_2 || 0);
                return [fmtNum(r.serial_no, lang), fmtDate(r.trip_date, lang), r.vehicle_no, fmtNum(j, lang), fmtNum(d, lang), fmtNum(j - d, lang), fmtNum(f, lang), [r.route_1, r.route_2].filter(Boolean).join(" / ") || "-", r.supervisor ?? "-"];
              }}
              footer={[t("grandTotal"), "", "", fmtNum(dailyJama, lang), fmtNum(dena, lang), fmtNum(dailyJama - dena, lang), fmtNum(fares, lang), "", ""]}
            />
          </TabsContent>

          <TabsContent value="other">
            <Section
              headers={[t("date"), t("category"), t("amount")]}
              rows={mainOth}
              cells={(r: any) => [fmtDate(r.income_date, lang), r.category, fmtNum(r.amount, lang)]}
              footer={[t("grandTotal"), "", fmtNum(mainOtherInc, lang)]}
            />
          </TabsContent>

          <TabsContent value="exp">
            <Section
              headers={[t("date"), t("category"), t("vehicleNo"), t("amount")]}
              rows={mainExp}
              cells={(r: any) => [fmtDate(r.expense_date, lang), r.category, r.vehicle_no ?? "-", fmtNum(r.amount, lang)]}
              footer={[t("grandTotal"), "", "", fmtNum(mainExpense, lang)]}
            />
          </TabsContent>

          <TabsContent value="jk">
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button size="sm" variant="outline" onClick={exportOwnerPdf}>
                  <FileDown className="h-4 w-4 mr-2" />ওনার হিসাব PDF (Landscape)
                </Button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Stat label="গাড়ি ভাড়া" value={fmtNum(jkFares, lang)} color="text-amber-400" />
                <Stat label="জমা" value={fmtNum(jkOthSum, lang)} color="text-emerald-400" />
                <Stat label="খরচ" value={fmtNum(jkExpSum, lang)} color="text-rose-400" />
                <Stat label="ব্যালেন্স" value={fmtNum(jkBalance, lang)} color={jkBalance >= 0 ? "text-sky-400" : "text-rose-500"} />
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-2">গাড়ি ভাড়া (দৈনিক জমা থেকে)</h3>
                <Section
                  headers={[t("date"), "ওনার", t("vehicleNo"), t("fareTotal")]}
                  rows={jkTrips}
                  cells={(r: any) => {
                    const f = Number(r.fare_1 || 0) + Number(r.fare_2 || 0);
                    return [fmtDate(r.trip_date, lang), ownerName(ownerVehNos.get(r.vehicle_no)), r.vehicle_no, fmtNum(f, lang)];
                  }}
                  footer={[t("grandTotal"), "", "", fmtNum(jkFares, lang)]}
                />
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-2">জমা-খরচ জমা</h3>
                <Section
                  headers={[t("date"), "ওনার", t("vendors"), t("vehicleNo"), t("category"), t("amount")]}
                  rows={jkOth}
                  cells={(r: any) => [fmtDate(r.income_date, lang), ownerName(matchedOwnerId(r)), r.vendor ?? "—", r.vehicle_no ?? "—", r.category, fmtNum(r.amount, lang)]}
                  footer={[t("grandTotal"), "", "", "", "", fmtNum(jkOthSum, lang)]}
                />
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-2">জমা-খরচ খরচ</h3>
                <Section
                  headers={[t("date"), "ওনার", t("vendors"), t("vehicleNo"), t("category"), t("amount")]}
                  rows={jkExp}
                  cells={(r: any) => [fmtDate(r.expense_date, lang), ownerName(matchedOwnerId(r)), r.vendor ?? "—", r.vehicle_no ?? "—", r.category, fmtNum(r.amount, lang)]}
                  footer={[t("grandTotal"), "", "", "", "", fmtNum(jkExpSum, lang)]}
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
          {rows.map((r) => (
            <tr key={r.id} className="border-t">
              {cells(r).map((c, i) => <td key={i} className="px-3 py-2">{c}</td>)}
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
