import { toCents } from "@/lib/money";
import { today } from "@/lib/dates";
import type { Plan } from "./types";

export function lineAmount(qty: number, unitPriceCents: number): number {
  if (
    !Number.isInteger(qty) ||
    qty < 1 ||
    !Number.isSafeInteger(unitPriceCents) ||
    unitPriceCents < 0
  )
    throw new Error(
      "Quantity and unit price must be valid non-negative integers (quantity at least 1).",
    );
  const amount = qty * unitPriceCents;
  if (!Number.isSafeInteger(amount) || amount > 999999999999)
    throw new Error("Line amount exceeds the supported money range.");
  return amount;
}
export function lineTaxCents(amountCents: number, taxPct: string | number) {
  const [whole, decimal = ""] = String(taxPct).split(".");
  if (!/^\d+$/.test(whole) || !/^\d{0,3}$/.test(decimal))
    throw new Error("Invalid tax rate.");
  const rate = BigInt(whole) * BigInt(1000) + BigInt(decimal.padEnd(3, "0"));
  return Number((BigInt(amountCents) * rate + BigInt(50000)) / BigInt(100000));
}
export function periodTotals(
  lines: { amount: string | number; tax_pct: string | number }[],
) {
  const subtotal = lines.reduce((sum, line) => sum + toCents(line.amount), 0);
  const tax = lines.reduce(
    (sum, line) => sum + lineTaxCents(toCents(line.amount), line.tax_pct),
    0,
  );
  return { subtotal, tax, total: subtotal + tax };
}
export function validatePlanAvailability(
  plan: Plan,
  startDate: string,
  asOf = today(),
) {
  if (!plan.is_active)
    throw new Error("This plan is inactive. Choose an active plan.");
  if (
    [asOf, startDate].some(
      (date) =>
        date < plan.available_from ||
        (plan.available_to && date > plan.available_to),
    )
  )
    throw new Error(
      "Today and the subscription start date must both fall inside the plan availability window.",
    );
}
export type DiscountState =
  "active" | "scheduled" | "expired" | "used up" | "inactive";
export function discountStatus(
  discount: {
    is_active: boolean;
    starts_on: string;
    ends_on: string | null;
    usage_limit: number | null;
    used_count: number;
  },
  asOf = today(),
): DiscountState {
  if (!discount.is_active) return "inactive";
  if (
    discount.usage_limit !== null &&
    discount.used_count >= discount.usage_limit
  )
    return "used up";
  if (discount.ends_on && discount.ends_on < asOf) return "expired";
  if (discount.starts_on > asOf) return "scheduled";
  return "active";
}
