import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { DataTable } from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import { useT, fmtNum } from "@/lib/i18n";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import { FileDown } from "lucide-react";
import { exportPdf } from "@/lib/exportPdf";

export const Route = createFileRoute("/vendors")({ component: Page });

type VendorRow = {
  name: string;
  income: number;
  expense: number;
  payable: number;
};

function Page() {
  const { t, lang } = useT();

  const { data: vendors = [] } = useQuery({
    queryKey: ["entry_lookups", "vendor"],
    queryFn: async () =>
      ((await supabase.from("entry_lookups").select("id,value").eq("kind", "vendor").order("value")).data ?? []) as { id: string; value: string }[],
  });
  const { data: incomes = [] } = useQuery({
    queryKey: ["other_incomes-vendor"],
    queryFn: async () =>
      ((await supabase.from("other_incomes").select("vendor,amount").not("vendor", "is", null).limit(5000)).data ?? []) as { vendor: string | null; amount: number }[],
  });
  const { data: expenses = [] } = useQuery({
    queryKey: ["expenses-vendor"],
    queryFn: async () =>
      ((await supabase.from("expenses").select("vendor,amount").not("vendor", "is", null).limit(5000)).data ?? []) as { vendor: string | null; amount: number }[],
  });

  const rows: VendorRow[] = useMemo(() => {
    const map = new Map<string, VendorRow>();
    for (const v of vendors) map.set(v.value, { name: v.value, income: 0, expense: 0, payable: 0 });
    for (const r of incomes) {
      const k = (r.vendor ?? "").trim();
      if (!k) continue;
      const cur = map.get(k) ?? { name: k, income: 0, expense: 0, payable: 0 };
      cur.income += Number(r.amount || 0);
      map.set(k, cur);
    }
    for (const r of expenses) {
      const k = (r.vendor ?? "").trim();
      if (!k) continue;
      const cur = map.get(k) ?? { name: k, income: 0, expense: 0, payable: 0 };
      cur.expense += Number(r.amount || 0);
      map.set(k, cur);
    }
    const arr = Array.from(map.values()).map((r) => ({ ...r, payable: r.income - r.expense }));
    arr.sort((a, b) => b.payable - a.payable);
    return arr;
  }, [vendors, incomes, expenses]);

  const totals = rows.reduce(
    (s, r) => ({ income: s.income + r.income, expense: s.expense + r.expense, payable: s.payable + r.payable }),
    { income: 0, expense: 0, payable: 0 },
  );

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{t("vendors")}</h1>
            <p className="text-sm text-muted-foreground">
              {t("totalIncome")}: <span className="font-semibold text-emerald-400">{fmtNum(totals.income, lang)}</span>
              {" · "}
              {t("totalExpense")}: <span className="font-semibold text-rose-400">{fmtNum(totals.expense, lang)}</span>
              {" · "}
              {t("payable")}: <span className="font-semibold text-primary">{fmtNum(totals.payable, lang)}</span>
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() =>
              exportPdf({
                title: t("vendors"),
                subtitle: `${t("payable")}: ${fmtNum(totals.payable, lang)}`,
                headers: [t("vendorName"), t("totalIncome"), t("totalExpense"), t("payable")],
                rows: rows.map((r) => [r.name, fmtNum(r.income, lang), fmtNum(r.expense, lang), fmtNum(r.payable, lang)]),
              })
            }
          >
            <FileDown className="h-4 w-4 mr-2" />
            {t("exportPdf")}
          </Button>
        </div>

        <DataTable<VendorRow>
          rows={rows}
          columns={[
            { key: "name", header: t("vendorName") },
            { key: "income", header: t("totalIncome"), render: (r) => <span className="text-emerald-400">{fmtNum(r.income, lang)}</span> },
            { key: "expense", header: t("totalExpense"), render: (r) => <span className="text-rose-400">{fmtNum(r.expense, lang)}</span> },
            { key: "payable", header: t("payable"), render: (r) => <span className={`font-semibold ${r.payable >= 0 ? "text-emerald-500" : "text-rose-500"}`}>{fmtNum(r.payable, lang)}</span> },
          ]}
          emptyText={t("noData")}
        />
      </div>
    </AppLayout>
  );
}
