import { EntityEditor } from "@/components/EntityPages";
import type { SearchParams } from "@/lib/pagination";
export default async function PlanPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  return (
    <EntityEditor
      entity="plans"
      id={(await params).id}
      searchParams={searchParams}
    />
  );
}
