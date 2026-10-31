import Link from "next/link";
import { cn } from "@/lib/utils";

export function Chip({ children, active = false, className, onClick }: { children: React.ReactNode; active?: boolean; className?: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium",
        active ? "bg-[var(--teal-50,#E9FBF6)] border-transparent text-[var(--foreground)]" : "bg-card hover:bg-muted",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function ChipLink({ href, label, active }: { href: string; label: string; active?: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium",
        active ? "bg-[var(--teal-50,#E9FBF6)] border-transparent text-[var(--foreground)]" : "bg-card hover:bg-muted",
      )}
    >
      {label}
    </Link>
  );
}
