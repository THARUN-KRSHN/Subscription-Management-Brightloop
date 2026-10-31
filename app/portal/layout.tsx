import { requireRole } from "@/lib/auth";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  await requireRole(["customer"]);
  return (
    <div className="mx-auto max-w-5xl p-6">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Customer portal</h1>
        <nav className="flex gap-3 text-sm">
          <a className="underline" href="/portal">Home</a>
          <a className="underline" href="/portal/subscriptions">Subscriptions</a>
          <a className="underline" href="/portal/invoices">Invoices</a>
        </nav>
      </header>
      {children}
    </div>
  );
}
