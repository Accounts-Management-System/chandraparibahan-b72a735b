import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";
import { useT } from "@/lib/i18n";

export type Column<T> = {
  key: keyof T | string;
  header: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
};

export function DataTable<T extends { id: string }>({
  rows,
  columns,
  onEdit,
  onDelete,
  emptyText,
}: {
  rows: T[];
  columns: Column<T>[];
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
  emptyText?: string;
}) {
  const { t } = useT();
  return (
    <div className="rounded-md border bg-card" style={{ overflowX: "auto" }}>
      <table className="w-full text-sm">
        <thead className="bg-muted">
          <tr>
            {columns.map((c) => (
              <th key={String(c.key)} className={`text-left px-3 py-2 font-semibold ${c.className ?? ""}`}>
                {c.header}
              </th>
            ))}
            {(onEdit || onDelete) && <th className="text-right px-3 py-2 w-24">{t("actions")}</th>}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length + 1} className="text-center py-8 text-muted-foreground">
                {emptyText ?? t("noData")}
              </td>
            </tr>
          )}
          {rows.map((row) => (
            <tr key={row.id} className="border-t hover:bg-muted/30">
              {columns.map((c) => (
                <td key={String(c.key)} className={`px-3 py-2 ${c.className ?? ""}`}>
                  {c.render ? c.render(row) : String((row as any)[c.key] ?? "-")}
                </td>
              ))}
              {(onEdit || onDelete) && (
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  {onEdit && (
                    <Button size="icon" variant="ghost" onClick={() => onEdit(row)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                  {onDelete && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        if (confirm(t("confirmDelete"))) onDelete(row);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
