import { EntityEditor } from "@/components/EntityPages";
import type { SearchParams } from "@/lib/pagination";
export default async function TaxPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  return (
    <EntityEditor
      entity="taxes"
      id={(await params).id}
      searchParams={searchParams}
    />
  );
}
