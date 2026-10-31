export function today() {
  return new Date().toISOString().slice(0, 10);
}
export function addDateDays(date: string, days: number) {
  const result = new Date(`${date}T00:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}
export function oneYearAfter(date: string) {
  const result = new Date(`${date}T00:00:00Z`);
  const month = result.getUTCMonth();
  result.setUTCFullYear(result.getUTCFullYear() + 1);
  if (result.getUTCMonth() !== month) result.setUTCDate(0);
  return result.toISOString().slice(0, 10);
}
