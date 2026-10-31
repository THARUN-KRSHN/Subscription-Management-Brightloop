export const CURRENCY = "INR";

/** Parse a decimal amount without binary floating-point arithmetic. Reject excess precision. */
export function toCents(value: string | number): number {
  const match = String(value)
    .trim()
    .match(/^(-?)(\d+)(?:\.(\d{1,2}))?$/);
  if (!match)
    throw new Error("Enter a money amount with at most two decimal places.");
  const cents =
    Number(match[2]) * 100 + Number((match[3] ?? "").padEnd(2, "0"));
  if (!Number.isSafeInteger(cents)) throw new Error("Amount is too large.");
  return match[1] ? -cents : cents;
}
export function fromCents(cents: number): string {
  if (!Number.isSafeInteger(cents))
    throw new Error("Cents must be a safe integer.");
  const absolute = Math.abs(cents);
  return `${cents < 0 ? "-" : ""}${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, "0")}`;
}
export function formatMoney(value: string | number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: CURRENCY,
  }).format(toCents(value) / 100);
}
