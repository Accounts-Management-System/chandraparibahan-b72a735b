import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { useT } from "@/lib/i18n";

export type LookupKind = "category" | "head" | "description" | "supervisor" | "vendor";

export function LookupSelect({
  kind,
  name,
  value,
  onChange,
  required,
  placeholder,
}: {
  kind: LookupKind;
  name?: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  placeholder?: string;
}) {
  const { t } = useT();
  const qc = useQueryClient();
  const listId = `lookup-${kind}`;

  const { data: options = [] } = useQuery({
    queryKey: ["entry_lookups", kind],
    queryFn: async () => {
      const { data } = await supabase
        .from("entry_lookups")
        .select("value")
        .eq("kind", kind)
        .order("value");
      return ((data ?? []) as { value: string }[]).map((r) => r.value);
    },
  });

  const upsert = useMutation({
    mutationFn: async (v: string) => {
      if (!v || options.includes(v)) return;
      await supabase.from("entry_lookups").insert({ kind, value: v });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["entry_lookups", kind] }),
  });

  return (
    <>
      <Input
        name={name}
        list={listId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => upsert.mutate(e.target.value.trim())}
        required={required}
        placeholder={placeholder ?? t("selectOrType")}
        className="h-10"
        autoComplete="off"
      />
      <datalist id={listId}>
        {options.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
    </>
  );
}
