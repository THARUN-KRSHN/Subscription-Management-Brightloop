import { EntityList } from "@/components/EntityPages";
import type { SearchParams } from "@/lib/pagination";
export default function CustomersPage(props: {
  searchParams: Promise<SearchParams>;
}) {
  return <EntityList entity="customers" {...props} />;
}
