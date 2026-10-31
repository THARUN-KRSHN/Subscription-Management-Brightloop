import { EntityList } from "@/components/EntityPages";
import type { SearchParams } from "@/lib/pagination";
export default function TaxesPage(props: {
  searchParams: Promise<SearchParams>;
}) {
  return <EntityList entity="taxes" {...props} />;
}
