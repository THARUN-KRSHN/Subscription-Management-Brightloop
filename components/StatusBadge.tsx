import { Badge } from "@/components/ui/badge";
export function StatusBadge({
  active,
  status,
}: {
  active?: boolean;
  status?: string;
}) {
  return (
    <Badge className={active === true ? "bg-emerald-50 text-emerald-800" : ""}>
      {status ?? (active ? "Active" : "Archived")}
    </Badge>
  );
}
