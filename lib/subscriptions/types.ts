export const subscriptionStatuses = [
  "draft",
  "quotation",
  "confirmed",
  "active",
  "paused",
  "closed",
] as const;
export type SubscriptionStatus = (typeof subscriptionStatuses)[number];
export type Plan = {
  id: number;
  name: string;
  price: string | number;
  min_quantity: number;
  is_active: boolean;
  available_from: string;
  available_to: string | null;
  allow_pause: boolean;
  allow_early_close: boolean;
  allow_renewal: boolean;
  auto_close: boolean;
  billing_period: string;
};
export type Subscription = {
  id: number;
  number: string;
  customer_id: number;
  plan_id: number;
  template_id: number | null;
  payment_terms_id: number;
  status: SubscriptionStatus;
  start_date: string;
  expiry_date: string;
  quote_valid_until: string | null;
  next_billing_date: string | null;
  periods_billed: number;
  closed_at: string | null;
};
export type SubscriptionLine = {
  id: number;
  subscription_id: number;
  product_id: number | null;
  variant_id: number | null;
  description: string;
  quantity: number;
  unit_price: string | number;
  tax_pct: string | number;
  amount: string | number;
  is_plan_fee: boolean;
};
export const MAX_PRODUCT_LINES = 99;
