import { EntityList } from "@/components/EntityPages";
import type { SearchParams } from "@/lib/pagination";
export default function PlansPage(props: {
  searchParams: Promise<SearchParams>;
}) {
  return <EntityList entity="plans" {...props} />;
}
