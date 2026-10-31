import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { idSchema } from "@/lib/validation";
import { single, type SearchParams } from "@/lib/pagination";
import { PageHeader } from "@/components/PageHeader";
import { NewSubscriptionForm } from "@/components/NewSubscriptionForm";
import { templatePreview } from "../actions";
export default async function NewSubscriptionPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireRole(["admin", "staff"]);
  const query = await searchParams;
  const template = idSchema.safeParse(single(query.template));
  const preview = template.success
    ? await templatePreview(template.data)
    : undefined;
  return (
    <>
      <Link
        href="/admin/subscriptions"
        className="mb-6 inline-flex min-h-10 items-center text-sm text-primary underline"
      >
        Back to subscriptions
      </Link>
      <PageHeader
        title="New subscription"
        description="Choose a customer, then start from a template or select an available plan."
      />
      <NewSubscriptionForm
        initialTemplate={template.success ? String(template.data) : ""}
        initialPreview={preview}
      />
    </>
  );
}
