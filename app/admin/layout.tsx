import { requireRole } from "@/lib/auth";
import { Sidebar } from "@/components/Sidebar";
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole(["admin", "staff"]);
  return (
    <div className="min-h-screen lg:flex">
      <Sidebar user={user} />
      <main className="min-w-0 flex-1 p-5 md:p-10 lg:px-12">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
