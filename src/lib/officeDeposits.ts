import { supabase } from "@/integrations/supabase/client";

export const OFFICE_DEPOSIT_CATEGORY = "অফিস কতৃক জমা";

export type OfficeDepositRow = {
  id: string;
  deposit_date: string;
  category: string;
  head: string | null;
  description: string | null;
  amount: number;
};

export type OfficeDepositForm = {
  deposit_date: string;
  category: string;
  head: string | null;
  description: string | null;
  amount: number;
};

const tableMissing = (error: any) => error?.code === "PGRST205" || String(error?.message ?? "").includes("office_deposits");
const normalize = (r: any): OfficeDepositRow => ({
  id: r.id,
  deposit_date: r.deposit_date ?? r.income_date,
  category: r.category ?? OFFICE_DEPOSIT_CATEGORY,
  head: r.head ?? null,
  description: r.description ?? null,
  amount: Number(r.amount || 0),
});

export async function fetchOfficeDeposits({ from, to, limit = 100000 }: { from?: string; to?: string; limit?: number } = {}) {
  let q: any = (supabase as any)
    .from("office_deposits")
    .select("id,deposit_date,category,head,description,amount")
    .order("deposit_date", { ascending: false })
    .limit(limit);
  if (from) q = q.gte("deposit_date", from);
  if (to) q = q.lte("deposit_date", to);
  const res = await q;
  if (!res.error) return ((res.data ?? []) as any[]).map(normalize);
  if (!tableMissing(res.error)) throw res.error;

  let fallback: any = supabase
    .from("other_incomes")
    .select("id,income_date,category,head,description,amount")
    .eq("category", OFFICE_DEPOSIT_CATEGORY)
    .is("owner_id", null)
    .order("income_date", { ascending: false })
    .limit(limit);
  if (from) fallback = fallback.gte("income_date", from);
  if (to) fallback = fallback.lte("income_date", to);
  const fb = await fallback;
  if (fb.error) throw fb.error;
  return ((fb.data ?? []) as any[]).map(normalize);
}

export async function saveOfficeDeposit(form: OfficeDepositForm, id?: string) {
  const payload = { ...form, category: form.category || OFFICE_DEPOSIT_CATEGORY };
  const res = id
    ? await (supabase as any).from("office_deposits").update(payload).eq("id", id)
    : await (supabase as any).from("office_deposits").insert(payload);
  if (!res.error) return;
  if (!tableMissing(res.error)) throw res.error;

  const fallbackPayload = {
    income_date: payload.deposit_date,
    category: OFFICE_DEPOSIT_CATEGORY,
    head: payload.head,
    description: payload.description,
    amount: payload.amount,
    owner_id: null,
    vehicle_no: null,
  };
  const fb = id
    ? await supabase.from("other_incomes").update(fallbackPayload).eq("id", id)
    : await supabase.from("other_incomes").insert(fallbackPayload);
  if (fb.error) throw fb.error;
}

export async function deleteOfficeDeposit(id: string) {
  const res = await (supabase as any).from("office_deposits").delete().eq("id", id);
  if (!res.error) return;
  if (!tableMissing(res.error)) throw res.error;
  const fb = await supabase.from("other_incomes").delete().eq("id", id).eq("category", OFFICE_DEPOSIT_CATEGORY).is("owner_id", null);
  if (fb.error) throw fb.error;
}