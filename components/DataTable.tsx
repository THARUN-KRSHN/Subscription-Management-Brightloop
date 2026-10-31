import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { single, type SearchParams } from "@/lib/pagination";

export type Column<T> = { label: string; render: (row: T) => React.ReactNode };
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
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="overflow-hidden rounded-[14px] border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted text-muted-foreground">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.label}
                  scope="col"
                  className="whitespace-nowrap px-5 py-3 font-medium"
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="[&>tr:nth-child(odd)]:bg-muted/40">
            {rows.map((row) => (
              <tr key={row.id} className="border-t hover:bg-muted/50 transition-colors">
                {columns.map((column) => (
                  <td
                    key={column.label}
                    className="max-w-sm px-5 py-4 wrap-break-word"
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
                  {emptyMessage}
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
        <nav aria-label="Pagination" className="flex gap-2">
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
