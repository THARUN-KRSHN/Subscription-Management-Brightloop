import { z } from "zod";
import { fromCents, toCents } from "./money.ts";

export function validatePassword(password: string) {
  const rules = {
    length: password.length >= 9,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    special: /[^a-zA-Z0-9]/.test(password),
  };
  return { valid: Object.values(rules).every(Boolean), rules };
}
export const emailSchema = z
  .email("Enter a valid email address.")
  .transform((value) => value.toLowerCase());
export const passwordSchema = z
  .string()
  .refine(
    (value) => validatePassword(value).valid,
    "Use at least 9 characters, an uppercase letter, a lowercase letter, and a special character.",
  );
export const signupSchema = z.object({
  full_name: z.string().trim().min(1, "Enter your full name.").max(200),
  email: emailSchema,
  password: passwordSchema,
});
export const idSchema = z.coerce
  .number()
  .int()
  .positive()
  .max(Number.MAX_SAFE_INTEGER);
const text = z.string().trim().min(1, "This field is required.").max(200);
const optionalText = z
  .string()
  .trim()
  .max(2000)
  .transform((value) => value || null);
const money = (signed = false) =>
  z
    .string()
    .trim()
    .refine(
      (value) =>
        /^-?\d+(\.\d{1,2})?$/.test(value) &&
        Math.abs(Number(value)) <= 9999999999.99 &&
        (signed || Number(value) >= 0),
      "Enter a valid amount (at most 2 decimal places).",
    )
    .transform((value) => fromCents(toCents(value)));
const date = z.iso.date("Enter a valid date.");
export const customerSchema = z.object({
  company_name: optionalText,
  contact_name: text,
  email: emailSchema,
  phone: z
    .string()
    .trim()
    .max(50)
    .transform((value) => value || null),
  address: optionalText,
});
export const taxSchema = z.object({
  name: text,
  rate_pct: z
    .string()
    .regex(/^\d+(\.\d{1,3})?$/, "Use at most 3 decimal places.")
    .refine((value) => Number(value) <= 999.999, "Maximum rate is 999.999%.")
    .transform(Number),
  is_active: z.boolean(),
});
export const paymentTermsSchema = z.object({
  name: text,
  due_days: z.coerce.number().int().min(0).max(2147483647),
});
export const productSchema = z.object({
  name: text,
  type: text,
  sales_price: money(),
  cost_price: money(),
  notes: optionalText,
  tax_id: z.union([z.literal("").transform(() => null), idSchema]),
  is_active: z.boolean(),
});
export const variantSchema = z.object({
  product_id: idSchema,
  attribute: text,
  value: text,
  price_adjustment: money(true),
});
export const planSchema = z
  .object({
    name: text,
    price: money(),
    billing_period: z.enum(["daily", "weekly", "monthly", "yearly"]),
    min_quantity: z.coerce.number().int().min(1).max(2147483647),
    available_from: date,
    available_to: z.union([z.literal("").transform(() => null), date]),
    auto_close: z.boolean(),
    allow_early_close: z.boolean(),
    allow_pause: z.boolean(),
    allow_renewal: z.boolean(),
    is_active: z.boolean(),
  })
  .refine(
    (value) =>
      !value.available_to || value.available_to >= value.available_from,
    {
      message: "Available to must be on or after available from.",
      path: ["available_to"],
    },
  );

const optionalId = z
  .union([z.literal(""), z.null()])
  .transform(() => null)
  .or(idSchema);
const optionalInteger = z.union([
  z.literal("").transform(() => null),
  z.coerce.number().int().min(1).max(2147483647),
]);
export const discountSchema = z
  .object({
    name: text,
    kind: z.enum(["fixed", "percentage"]),
    value: money().refine(
      (value) => toCents(value) > 0,
      "Value must be greater than zero.",
    ),
    scope: z.enum(["product", "subscription"]),
    product_id: optionalId,
    min_purchase: z.union([z.literal("").transform(() => null), money()]),
    min_quantity: optionalInteger,
    starts_on: date,
    ends_on: z.union([z.literal("").transform(() => null), date]),
    usage_limit: optionalInteger,
    is_active: z.boolean(),
  })
  .superRefine((value, context) => {
    if (value.kind === "percentage" && toCents(value.value) > 10000)
      context.addIssue({
        code: "custom",
        message: "Percentage cannot exceed 100%.",
        path: ["value"],
      });
    if (value.scope === "product" && !value.product_id)
      context.addIssue({
        code: "custom",
        message: "Choose a product for this discount.",
        path: ["product_id"],
      });
    if (value.ends_on && value.ends_on < value.starts_on)
      context.addIssue({
        code: "custom",
        message: "End date must be on or after start date.",
        path: ["ends_on"],
      });
  })
  .transform((value) => ({
    ...value,
    product_id: value.scope === "product" ? value.product_id : null,
  }));
export const quotationTemplateSchema = z.object({
  name: text,
  plan_id: idSchema,
  validity_days: z.coerce.number().int().min(1).max(36500),
});
export const productLineSchema = z.object({
  product_id: idSchema,
  variant_id: optionalId,
  quantity: z.coerce.number().int().min(1).max(2147483647),
});
export const subscriptionDatesSchema = z
  .object({ payment_terms_id: idSchema, start_date: date, expiry_date: date })
  .refine((value) => value.expiry_date >= value.start_date, {
    path: ["expiry_date"],
    message: "Expiry date must be on or after start date.",
  });
export const newSubscriptionSchema = subscriptionDatesSchema.safeExtend({
  customer_id: idSchema,
  plan_id: idSchema,
  template_id: optionalId,
});
