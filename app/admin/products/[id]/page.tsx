import { EntityEditor } from "@/components/EntityPages";
import type { SearchParams } from "@/lib/pagination";
export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  return (
    <EntityEditor
      entity="products"
      id={(await params).id}
      searchParams={searchParams}
    />
  );
}
