import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { useT, fmtNum } from "@/lib/i18n";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FileDown } from "lucide-react";
import { exportPdf } from "@/lib/exportPdf";

export const Route = createFileRoute("/owner-accounts")({ component: Page });

function Page() {
  const { t, lang } = useT();
  const [ownerId, setOwnerId] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const { data: owners = [] } = useQuery({
    queryKey: ["oa-owners"],
    queryFn: async () => ((await supabase.from("owners").select("id,name").order("name")).data ?? []) as any[],
  });
  const { data: vehiclesAll = [] } = useQuery({
    queryKey: ["oa-vehicles"],
    queryFn: async () => ((await supabase.from("vehicles").select("id,vehicle_no,owner_id").order("vehicle_no")).data ?? []) as any[],
  });
  const { data: trips = [] } = useQuery({
    queryKey: ["oa-trips"],
    queryFn: async () => ((await supabase.from("trips").select("trip_date,vehicle_no,fare_1,fare_2").limit(10000)).data ?? []) as any[],
  });
  const { data: expenses = [] } = useQuery({
    queryKey: ["oa-expenses"],
    queryFn: async () => ((await supabase.from("expenses").select("expense_date,vehicle_no,amount").limit(10000)).data ?? []) as any[],
  });
  const { data: otherIncomes = [] } = useQuery({
    queryKey: ["oa-oth"],
    queryFn: async () => ((await supabase.from("other_incomes").select("income_date,vehicle_no,amount").limit(10000)).data ?? []) as any[],
  });

  const ownerVehicles = useMemo(
    () => vehiclesAll.filter((v: any) => !ownerId || v.owner_id === ownerId),
    [vehiclesAll, ownerId],
  );

  const inRange = (d: string) => {
    if (dateFrom && d < dateFrom) return false;
    if (dateTo && d > dateTo) return false;
    return true;
  };

  const perVehicle = useMemo(() => {
    return ownerVehicles.map((v: any) => {
      const fare = trips
        .filter((r: any) => r.vehicle_no === v.vehicle_no && inRange(r.trip_date))
        .reduce((s: number, r: any) => s + Number(r.fare_1 || 0) + Number(r.fare_2 || 0), 0);
      const other = otherIncomes
        .filter((r: any) => r.vehicle_no === v.vehicle_no && inRange(r.income_date))
        .reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
      const exp = expenses
        .filter((r: any) => r.vehicle_no === v.vehicle_no && inRange(r.expense_date))
        .reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
      const income = fare + other;
      return { id: v.id, vehicle_no: v.vehicle_no, income, expense: exp, balance: income - exp };
    });
  }, [ownerVehicles, trips, otherIncomes, expenses, dateFrom, dateTo]);

  const totals = perVehicle.reduce(
    