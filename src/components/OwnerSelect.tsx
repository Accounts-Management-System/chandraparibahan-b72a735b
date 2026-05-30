import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/lib/i18n";

export function OwnerSelect({
  value,
  onChange,
  className = "w-full h-11 rounded-md border border-input bg-input px-3 text-sm",
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  const { t } = useT();
  const { data: owners = [] } = useQuery({
    queryKey: ["owners-select"],
    queryFn: async () => (await supabase.from("owners").select("id,name").order("name")).data ?? [],
  });
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={className}>
      <option value="">— {t("owner")} ({t("all")}) —</option>
      {(owners as { id: string; name: string }[]).map((o) => (
        <option key={o.id} value={o.id} className="bg-card">{o.name}</option>
      ))}
    </select>
  );
}
