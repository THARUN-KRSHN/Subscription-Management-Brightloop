export type SearchParams = Record<string, string | string[] | undefined>;
export function single(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}
export function parsePage(params: SearchParams) {
  const integer = (value: string, fallback: number) =>
    /^\d+$/.test(value) &&
    Number.isSafeInteger(Number(value)) &&
    Number(value) > 0
      ? Number(value)
      : fallback;
  const page = Math.min(integer(single(params.page), 1), 1_000_000);
  const pageSize = Math.min(integer(single(params.pageSize), 20), 100);
  return {
    page,
    pageSize,
    from: (page - 1) * pageSize,
    to: page * pageSize - 1,
  };
}
export function pagedResult<T>(
  rows: T[],
  total: number,
  page: number,
  pageSize: number,
) {
  return { rows, total, page, pageSize };
}
