import { requireRole } from "@/lib/auth";
import { logout } from "@/app/(auth)/actions";
import { SubmitButton } from "@/components/SubmitButton";
export default async function PortalPage() {
  const user = await requireRole(["customer"]);
  return (
    <main className="mx-auto max-w-3xl px-6 py-14">
      <h1 className="text-3xl font-semibold tracking-tight">
        Welcome, {user.fullName || user.email}
      </h1>
      <p className="mt-3 mb-8 text-muted-foreground">
        Your Brightloop customer portal. Subscription and invoice access will be
        available in a later phase.
      </p>
      <form action={logout}>
        <SubmitButton variant="outline">Log out</SubmitButton>
      </form>
    </main>
  );
}
