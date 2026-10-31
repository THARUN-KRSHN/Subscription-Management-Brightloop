export function TableSkeleton({ rows = 8, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="rounded-[14px] border bg-card shadow-sm overflow-hidden">
      <div className="h-10 bg-muted" />
      <ul className="divide-y">
        {Array.from({ length: rows }).map((_, i) => (
          <li key={i} className="animate-pulse grid gap-4 px-5 py-4" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
            {Array.from({ length: cols }).map((__, j) => (
              <div key={j} className="h-3.5 rounded-full bg-muted" />
            ))}
          </li>
        ))}
      </ul>
    </div>
  );
}
