import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { single, type SearchParams } from "@/lib/pagination";

export type Column<T> = {
  label: string;
  render: (row: T) => React.ReactNode;
  align?: "left" | "right" | "center";
};
export function DataTable<T extends { id: string | number }>({
  rows,
  columns,
  total,
  page,
  pageSize,
  params,
  pathname,
  emptyMessage = "No records yet. Add your first record to get started.",
}: {
  rows: T[];
  columns: Column<T>[];
  total: number;
  page: number;
  pageSize: number;
  params: SearchParams;
  pathname: string;
  emptyMessage?: string;
}) {
  function href(next: number) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      const text = single(value);
      if (text && key !== "page" && key !== "message" && key !== "error")
        query.set(key, text);
    });
    query.set("page", String(next));
    query.set("pageSize", String(pageSize));
    return `${pathname}?${query}`;
  }
  function hrefWithDensity(nextDensity: string) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      const text = single(value);
      if (text && key !== "message" && key !== "error") query.set(key, text);
    });
    query.set("density", nextDensity);
    query.set("page", String(page));
    query.set("pageSize", String(pageSize));
    return `${pathname}?${query}`;
  }
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const density = single(params["density" as keyof SearchParams]) === "compact" ? "compact" : "comfortable";
  const cellPad = density === "compact" ? "px-4 py-2" : "px-5 py-4";
  return (
    <div className="overflow-hidden rounded-[14px] border bg-card card-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted text-muted-foreground sticky top-0 z-10">
            <tr>
              {columns.map((column, idx) => (
                <th
                  key={column.label}
                  scope="col"
                  className={`whitespace-nowrap ${cellPad} font-medium ${column.align === "right" ? "text-right" : column.align === "center" ? "text-center" : "text-left"} ${idx === 0 ? "sticky left-0 z-10 bg-muted" : ""}`}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="[&>tr:nth-child(odd)]:bg-muted/40">
            {rows.map((row) => (
              <tr key={row.id} className="group border-t hover:bg-muted/50 transition-colors">
                {columns.map((column, idx) => (
                  <td
                    key={column.label}
                    className={`max-w-sm ${cellPad} wrap-break-word ${column.align === "right" ? "text-right" : column.align === "center" ? "text-center" : "text-left"} ${idx === 0 ? "sticky left-0 z-[5] bg-card group-hover:bg-muted/50" : ""}`}
                  >
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-5 py-14 text-center text-muted-foreground"
                >
                  <div className="mx-auto max-w-sm">
                    <div className="mb-3 text-4xl">🗂️</div>
                    <p>{emptyMessage}</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-4 text-sm">
        <p className="text-muted-foreground">
          {total} records · Page {page} of {pages}
        </p>
        <nav aria-label="Pagination and density" className="flex items-center gap-3">
          <Link
            className={buttonVariants({ variant: "outline", size: "sm" })}
            href={hrefWithDensity(density === "compact" ? "comfortable" : "compact")}
            aria-label="Toggle density"
            title={`Switch to ${density === "compact" ? "comfortable" : "compact"} density`}
          >
            {density === "compact" ? "Compact" : "Comfortable"}
          </Link>
          <div className="h-5 w-px bg-border" />
          {page > 1 ? (
            <Link
              className={buttonVariants({ variant: "outline", size: "sm" })}
              href={href(page - 1)}
            >
              Previous
            </Link>
          ) : (
            <span
              aria-disabled="true"
              className={buttonVariants({
                variant: "outline",
                size: "sm",
                className: "opacity-50",
              })}
            >
              Previous
            </span>
          )}
          {page < pages ? (
            <Link
              className={buttonVariants({ variant: "outline", size: "sm" })}
              href={href(page + 1)}
            >
              Next
            </Link>
          ) : (
            <span
              aria-disabled="true"
              className={buttonVariants({
                variant: "outline",
                size: "sm",
                className: "opacity-50",
              })}
            >
              Next
            </span>
          )}
        </nav>
      </footer>
    </div>
  );
}
