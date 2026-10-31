import { cn } from "@/lib/utils";
export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("rounded-[14px] border bg-card p-4 shadow-sm", className)}>{children}</div>
  );
}
export function CardHeader({ title, subtitle, action }: { title?: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div>
        {title && <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>}
        {subtitle && <p className="text-xs text-muted-foreground/80">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
export function StatNumber({ value, suffix }: { value: React.ReactNode; suffix?: string }) {
  return (
    <p className="mt-1 text-2xl font-semibold tracking-tight">
      {value}
      {suffix ? <span className="ml-1 text-base font-normal text-muted-foreground">{suffix}</span> : null}
    </p>
  );
}
