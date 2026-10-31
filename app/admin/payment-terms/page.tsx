import { EntityList } from "@/components/EntityPages";
import type { SearchParams } from "@/lib/pagination";
export default function PaymentTermsPage(props: {
  searchParams: Promise<SearchParams>;
}) {
  return <EntityList entity="payment-terms" {...props} />;
}
