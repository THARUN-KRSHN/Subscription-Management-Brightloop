import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
export default async function DashboardPage() {
  const user = await requireRole(["admin", "staff"]);
  return (
    <>
      <PageHeader
        title={`Welcome, ${user.fullName || "team"}`}
        description="Your Brightloop workspace is ready. Start with customers and your catalogue."
      />
      <div className="max-w-2xl border-t">
        <Link
          href="/admin/customers"
          className="flex items-center justify-between gap-4 border-b py-6"
        >
          <div>
            <h2 className="font-semibold">Manage customers</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Keep company and contact details up to date.
            </p>
          </div>
          <ArrowRight size={20} aria-hidden="true" />
        </Link>
        {user.role === "admin" && (
          <Link
            href="/admin/products"
            className="flex items-center justify-between gap-4 border-b py-6"
          >
            <div>
              <h2 className="font-semibold">Set up your catalogue</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Add products, variants, taxes, and billing plans.
              </p>
            </div>
            <ArrowRight size={20} aria-hidden="true" />
          </Link>
        )}
        <p className="mt-8 text-sm text-muted-foreground">
          Finance reporting will be available in Phase 4.
        </p>
      </div>
    </>
  );
}
