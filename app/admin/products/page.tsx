import { EntityList } from "@/components/EntityPages";
import type { SearchParams } from "@/lib/pagination";
export default function ProductsPage(props: {
  searchParams: Promise<SearchParams>;
}) {
  return <EntityList entity="products" {...props} />;
}
