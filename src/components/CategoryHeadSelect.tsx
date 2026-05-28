import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/lib/i18n";

type Cat = { id: string; name: string };
type Head = { id: string; name: string; category_id: string };

export function CategorySelect({
  value,
  onChange,
  required,
}: {
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  const { t } = useT();
  const { data: cats = [] } = useQuery({
    queryKey: ["expense_categories"],
    queryFn: async () => {
      const { data } = await supabase
        .from("expense_categories")
        .select("id,name")
        .order("name");
      return (data ?? []) as Cat[];
    },
  });
  return (
    <select
      required={required}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full h-10 rounded-md border border-input bg-input px-3 text-sm"
    >
      <option value="">{t("selectOrType")}</option>
      {cats.map((c) => (
        <option key={c.id} value={c.name} className="bg-card">
          {c.name}
        </option>
      ))}
    </select>
  );
}

export function HeadSelect({
  category,
  value,
  onChange,
}: {
  category: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const { t } = useT();
  const { data: heads = [] } = useQuery({
    queryKey: ["expense_heads", category],
    enabled: !!category,
    queryFn: async () => {
      const { data: cats } = await supabase
        .from("expense_categories")
        .select("id")
        .eq("name", category)
        .maybeSingle();
      if (!cats) return [];
      const { data } = await supabase
        .from("expense_heads")
        .select("id,name,category_id")
        .eq("category_id", cats.id)
        .order("name");
      return (data ?? []) as Head[];
    },
  });
  return (
    <select
      value={value}
      disabled={!category}
      onChange={(e) => onChange(e.target.value)}
      className="w-full h-10 rounded-md border border-input bg-input px-3 text-sm disabled:opacity-50"
    >
      <option value="">{t("selectOrType")}</option>
      {heads.map((h) => (
        <option key={h.id} value={h.name} className="bg-card">
          {h.name}
        </option>
      ))}
    </select>
  );
}
