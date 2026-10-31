"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Infinity as Loop,
  LayoutDashboard,
  Users,
  UserCog,
  Package,
  CalendarRange,
  Percent,
  Clock,
  LogOut,
  TicketPercent,
  FileText,
  Repeat2,
} from "lucide-react";
import { logout } from "@/app/(auth)/actions";
import type { SessionUser } from "@/lib/auth";
import { ThemeToggle } from "@/components/ThemeToggle";
const items = [
  {
    href: "/admin/dashboard",
    label: "Workspace",
    icon: LayoutDashboard,
    admin: false,
  },
  { href: "/admin/customers", label: "Customers", icon: Users, admin: false },
  {
    href: "/admin/subscriptions",
    label: "Subscriptions",
    icon: Repeat2,
    admin: false,
  },
  {
    href: "/admin/quotation-templates",
    label: "Quotation templates",
    icon: FileText,
    admin: false,
  },
  {
    href: "/portal",
    label: "Portal (customer)",
    icon: FileText,
    admin: false,
  },
  {
    href: "/admin/invoices",
    label: "Invoices",
    icon: FileText,
    admin: false,
  },
  {
    href: "/admin/payments",
    label: "Payments",
    icon: Clock,
    admin: false,
  },
  {
    href: "/admin/discounts",
    label: "Discounts",
    icon: TicketPercent,
    admin: true,
  },
  { href: "/admin/products", label: "Products", icon: Package, admin: true },
  { href: "/admin/plans", label: "Plans", icon: CalendarRange, admin: true },
  { href: "/admin/taxes", label: "Taxes", icon: Percent, admin: true },
  {
    href: "/admin/payment-terms",
    label: "Payment terms",
    icon: Clock,
    admin: true,
  },
  { href: "/admin/staff", label: "Team", icon: UserCog, admin: true },
];
export function Sidebar({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    const saved = localStorage.getItem("sidebar_collapsed");
    if (saved) setCollapsed(saved === "1");
  }, []);
  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("sidebar_collapsed", next ? "1" : "0");
  }
  return (
    <aside className={`flex flex-col border-b bg-[var(--background)] p-3 lg:sticky lg:top-0 lg:h-screen lg:shrink-0 lg:border-r lg:border-b-0 ${collapsed ? "lg:w-16" : "lg:w-60"}`}>
      <Link
        href="/admin"
        className="mb-7 flex items-center gap-2 text-xl font-semibold tracking-tight text-[var(--foreground)]"
      >
        <Loop size={30} aria-hidden="true" />
        {!collapsed && <span>Brightloop</span>}
      </Link>
      <button onClick={toggle} className="mb-4 self-end rounded-[10px] border px-2 py-1 text-xs" aria-label="Toggle sidebar">
        {collapsed ? ">>" : "<<"}
      </button>
      <nav
        aria-label="Main navigation"
        className="flex flex-wrap gap-1 lg:flex-col"
      >
        {items
          .filter((item) => !item.admin || user.role === "admin")
          .map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                title={collapsed ? item.label : undefined}
                className={`flex items-center gap-3 rounded-[12px] px-3 py-2.5 text-sm font-medium transition-colors relative ${active ? "bg-[var(--teal-50,#E9FBF6)] text-[var(--foreground)]" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
              >
                {active && (
                  <span aria-hidden className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r bg-[var(--primary)]" />
                )}
                <item.icon size={18} aria-hidden="true" />
                {!collapsed && item.label}
              </Link>
            );
          })}
      </nav>
      <div className="mt-6 border-t pt-5 lg:mt-auto">
        {!collapsed && (
          <>
            <p className="truncate text-sm font-medium">
              {user.fullName || user.email}
            </p>
            <p className="mt-1 text-xs text-muted-foreground capitalize">
              {user.role} workspace
            </p>
          </>
        )}
        <div className="mt-3">
          <ThemeToggle />
        </div>
        <form action={logout}>
          <button className="mt-4 flex min-h-10 items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <LogOut size={16} aria-hidden="true" />
            {!collapsed && "Log out"}
          </button>
        </form>
      </div>
    </aside>
  );
}
