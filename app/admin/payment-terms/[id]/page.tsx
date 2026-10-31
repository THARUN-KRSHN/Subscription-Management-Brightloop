import { EntityEditor } from "@/components/EntityPages";
import type { SearchParams } from "@/lib/pagination";
export default async function PaymentTermPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  return (
    <EntityEditor
      entity="payment-terms"
      id={(await params).id}
      searchParams={searchParams}
    />
  );
}
