import type { z } from "zod";
import {
  customerSchema,
  taxSchema,
  paymentTermsSchema,
  productSchema,
  planSchema,
} from "@/lib/validation";

export type Field = {
  name: string;
  label: string;
  type?:
    "text" | "email" | "number" | "date" | "textarea" | "checkbox" | "select";
  step?: string;
  min?: string;
  max?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  help?: string;
};
export type EntityRow = {
  id: number;
  [key: string]: string | number | boolean | null;
};
type EntityConfig = {
  table: string;
  title: string;
  singular: string;
  description: string;
  schema: z.ZodType;
  fields: Field[];
  columns: { key: string; label: string; money?: boolean }[];
  defaults?: Record<string, string | boolean>;
  searchFields: string[];
  select: string;
  deletable?: boolean;
};
const name: Field = { name: "name", label: "Name", required: true };
const active: Field = { name: "is_active", label: "Active", type: "checkbox" };
const moneyField = (key: string, label: string): Field => ({
  name: key,
  label,
  type: "number",
  step: "0.01",
  min: "0",
  max: "9999999999.99",
  required: true,
});
export const catalogue = {
  customers: {
    table: "customers",
    title: "Customers",
    singular: "customer",
    description:
      "Company and contact details for every customer. Manually added customers do not receive a login.",
    schema: customerSchema,
    searchFields: ["contact_name", "company_name", "email"],
    select: "id,company_name,contact_name,email,phone,address,profile_id",
    fields: [
      { name: "company_name", label: "Company" },
      { name: "contact_name", label: "Contact name", required: true },
      { name: "email", label: "Email", type: "email", required: true },
      { name: "phone", label: "Phone" },
      { name: "address", label: "Address", type: "textarea" },
    ],
    columns: [
      { key: "contact_name", label: "Contact" },
      { key: "company_name", label: "Company" },
      { key: "email", label: "Email" },
      { key: "phone", label: "Phone" },
    ],
  },
  taxes: {
    table: "taxes",
    title: "Taxes",
    singular: "tax",
    description: "Tax rates available for your product catalogue.",
    schema: taxSchema,
    searchFields: ["name"],
    select: "id,name,rate_pct,is_active",
    fields: [
      name,
      {
        name: "rate_pct",
        label: "Rate (%)",
        type: "number",
        min: "0",
        max: "999.999",
        step: "0.001",
        required: true,
      },
      active,
    ],
    defaults: { is_active: true, rate_pct: "0" },
    columns: [
      { key: "name", label: "Name" },
      { key: "rate_pct", label: "Rate (%)" },
      { key: "is_active", label: "Status" },
    ],
    deletable: true,
  },
  "payment-terms": {
    table: "payment_terms",
    title: "Payment terms",
    singular: "payment term",
    description: "Define how many days customers have to pay an invoice.",
    schema: paymentTermsSchema,
    searchFields: ["name"],
    select: "id,name,due_days",
    fields: [
      name,
      {
        name: "due_days",
        label: "Due days",
        type: "number",
        min: "0",
        max: "2147483647",
        step: "1",
        required: true,
      },
    ],
    defaults: { due_days: "0" },
    columns: [
      { key: "name", label: "Name" },
      { key: "due_days", label: "Due days" },
    ],
    deletable: true,
  },
  products: {
    table: "products",
    title: "Products",
    singular: "product",
    description:
      "Set prices, tax rates, and variants. Archive products to keep historical records intact.",
    schema: productSchema,
    searchFields: ["name", "type"],
    select: "id,name,type,sales_price,cost_price,notes,tax_id,is_active",
    fields: [
      name,
      {
        name: "type",
        label: "Type",
        required: true,
        help: "For example: Software or Service.",
      },
      moneyField("sales_price", "Sales price (₹)"),
      moneyField("cost_price", "Cost price (₹)"),
      {
        name: "tax_id",
        label: "Tax",
        type: "select",
        options: [{ value: "", label: "No tax" }],
      },
      { name: "notes", label: "Notes", type: "textarea" },
      active,
    ],
    defaults: {
      is_active: true,
      sales_price: "0.00",
      cost_price: "0.00",
      tax_id: "",
    },
    columns: [
      { key: "name", label: "Product" },
      { key: "type", label: "Type" },
      { key: "sales_price", label: "Sales price", money: true },
      { key: "cost_price", label: "Cost price", money: true },
      { key: "is_active", label: "Status" },
    ],
  },
  plans: {
    table: "plans",
    title: "Plans",
    singular: "plan",
    description:
      "Set recurring fees, availability windows, and lifecycle permissions.",
    schema: planSchema,
    searchFields: ["name"],
    select:
      "id,name,price,billing_period,min_quantity,available_from,available_to,auto_close,allow_early_close,allow_pause,allow_renewal,is_active",
    fields: [
      name,
      moneyField("price", "Plan fee (₹)"),
      {
        name: "billing_period",
        label: "Billing period",
        type: "select",
        required: true,
        options: ["daily", "weekly", "monthly", "yearly"].map((value) => ({
          value,
          label: value[0].toUpperCase() + value.slice(1),
        })),
      },
      {
        name: "min_quantity",
        label: "Minimum product quantity",
        type: "number",
        min: "1",
        max: "2147483647",
        step: "1",
        required: true,
      },
      {
        name: "available_from",
        label: "Available from",
        type: "date",
        required: true,
      },
      {
        name: "available_to",
        label: "Available to",
        type: "date",
        help: "Leave blank for no end date.",
      },
      {
        name: "auto_close",
        label: "Automatically close expired subscriptions",
        type: "checkbox",
      },
      {
        name: "allow_early_close",
        label: "Allow early close",
        type: "checkbox",
      },
      { name: "allow_pause", label: "Allow pause", type: "checkbox" },
      { name: "allow_renewal", label: "Allow renewal", type: "checkbox" },
      active,
    ],
    defaults: {
      is_active: true,
      price: "0.00",
      billing_period: "monthly",
      min_quantity: "1",
    },
    columns: [
      { key: "name", label: "Plan" },
      { key: "price", label: "Fee", money: true },
      { key: "billing_period", label: "Period" },
      { key: "min_quantity", label: "Min. quantity" },
      { key: "available_from", label: "Available from" },
      { key: "is_active", label: "Status" },
    ],
  },
} satisfies Record<string, EntityConfig>;
export type Entity = keyof typeof catalogue;
export function entityConfig(entity: Entity): EntityConfig {
  return catalogue[entity];
}
