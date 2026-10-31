# 00 — PROJECT CONTEXT (Brightloop Subscription Management System)

> Upload this file FIRST, and upload it again together with every phase file if the agent does not keep earlier messages.
> Then upload the phase files in order: 01 → 02 → 03 → 04 → 05. Do not skip ahead. Each phase ends by updating `docs/STATE.md`; if the agent cannot read your repo, paste that file into the next phase's chat.

Total budget: 8 hours (about 15 min setup + 5 phases + buffer). Speed and a working demo path beat completeness. Where a rule here conflicts with a "nice" idea, follow the rule.

---

## 1. What is being built

One web platform that runs the full life of a subscription business (company: Brightloop Software):
products and plans → quotation templates → subscriptions → automatic invoices (with tax and discounts) → payments → revenue reporting, with a customer portal.

Replaces: spreadsheets for subscriptions, hand-typed invoices, bank-statement matching, manual quarterly reports.

## 2. Roles

- **admin**: everything. Only role that can create staff, products, plans, taxes, payment terms, discounts, quotation templates.
- **staff**: day-to-day work only: customers, subscriptions, invoices (confirm, cancel, send, print), payments, billing run, dashboard. No catalogue/tax/discount/template/staff management.
- **customer**: portal only (`/portal`). Sees ONLY their own subscriptions, invoices, payments.

## 3. Stack (fixed; do not substitute)

- Next.js (App Router) + TypeScript + Tailwind + shadcn/ui
- Supabase: Postgres + Auth (email/password, password-reset email). Use `@supabase/ssr` for cookie sessions.
- Data access: server-side only (Server Actions / Route Handlers) using the Supabase **service-role** client AFTER checking the session user and role in our own code. RLS is enabled on every table with NO policies (so the browser/anon key cannot read tables directly). Never expose the service-role key to the browser.
- Heavy logic (invoice generation, billing run, discount claim, payment recording) lives in **Postgres functions** called through `supabase.rpc(...)` so each runs in one transaction.
- Deployment: Vercel + Supabase cloud.
- Currency: INR (₹), one constant in `lib/money.ts`.

Env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL`, optional `RESEND_API_KEY`, `MAIL_FROM`.

## 4. Folder layout (stick to it so later phases find things)

```
app/
  (auth)/login, signup, forgot-password, reset-password
  admin/            dashboard, customers, staff, products, plans, taxes, payment-terms,
                    discounts, quotation-templates, subscriptions, invoices, payments
  portal/           subscriptions, invoices
  api/billing/run/route.ts
lib/
  supabase/server.ts  (cookie client)   supabase/admin.ts (service-role client)
  auth.ts           getSessionUser(), requireRole()
  validation.ts     validatePassword(), zod schemas
  money.ts          toCents(), fromCents(), formatMoney()
  pagination.ts     parsePage(), pagedResult()
  subscriptions/    transitions.ts, pricing.ts
components/         ui/ (shadcn), DataTable, StatusBadge, PageHeader
supabase/migrations/  0001_schema.sql, 0002_billing.sql, 0003_dashboard.sql
scripts/            create-admin.ts, seed-demo.ts, seed-perf.sql
docs/STATE.md
```

## 5. Conventions

- Money: `numeric(12,2)` in the database. In TypeScript do arithmetic in integer cents via `lib/money.ts`; never use floating-point sums for money.
- Every list is server-paginated (default 20, max 100) with filters in the URL query string. No unbounded queries.
- Every server action/route starts with `requireRole([...])`. Customers' queries always filter by the logged-in customer's id, derived on the server, never taken from the request.
- Status changes go through ONE function per entity (`transitions.ts` for subscriptions; SQL functions for invoices). Never write `status` directly elsewhere.
- Validate inputs with zod; show errors in the UI as toasts or inline.
- Do not add libraries beyond: zod, date-fns, resend (optional), shadcn components, lucide-react, recharts (dashboard only).
- No tests framework setup beyond what a phase asks. Keep code simple and readable.

## 6. Database schema (create exactly this in Phase 1 as `supabase/migrations/0001_schema.sql`)

```sql
create type user_role as enum ('admin','staff','customer');
create type billing_period as enum ('daily','weekly','monthly','yearly');
create type discount_kind as enum ('fixed','percentage');
create type discount_scope as enum ('product','subscription');
create type subscription_status as enum ('draft','quotation','confirmed','active','paused','closed');
create type invoice_status as enum ('draft','confirmed','paid','cancelled');
create type payment_method as enum ('bank_transfer','card','upi','cash','cheque','other');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null default '',
  role user_role not null default 'customer',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table customers (
  id bigserial primary key,
  profile_id uuid unique references profiles(id) on delete set null,
  company_name text,
  contact_name text not null,
  email text not null,
  phone text,
  address text,
  created_at timestamptz not null default now()
);
create index customers_email_idx on customers (lower(email));

-- Every new auth user becomes a CUSTOMER. Role is never taken from client metadata.
create function handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles(id, email, full_name, role)
  values (new.id, lower(new.email), coalesce(new.raw_user_meta_data->>'full_name',''), 'customer');
  insert into customers(profile_id, contact_name, email)
  values (new.id, coalesce(nullif(new.raw_user_meta_data->>'full_name',''), new.email), lower(new.email));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

create table taxes (
  id bigserial primary key,
  name text not null,
  rate_pct numeric(6,3) not null check (rate_pct >= 0),
  is_active boolean not null default true
);

create table payment_terms (
  id bigserial primary key,
  name text not null,
  due_days int not null check (due_days >= 0)
);

create table products (
  id bigserial primary key,
  name text not null,
  type text not null,
  sales_price numeric(12,2) not null check (sales_price >= 0),
  cost_price numeric(12,2) not null check (cost_price >= 0),
  notes text,
  tax_id bigint references taxes(id),
  is_active boolean not null default true
);

create table product_variants (
  id bigserial primary key,
  product_id bigint not null references products(id) on delete cascade,
  attribute text not null,
  value text not null,
  price_adjustment numeric(12,2) not null default 0,
  unique (product_id, attribute, value)
);

create table plans (
  id bigserial primary key,
  name text not null,
  price numeric(12,2) not null check (price >= 0),
  billing_period billing_period not null,
  min_quantity int not null default 1 check (min_quantity >= 1),
  available_from date not null,
  available_to date,
  auto_close boolean not null default false,
  allow_early_close boolean not null default false,
  allow_pause boolean not null default false,
  allow_renewal boolean not null default false,
  is_active boolean not null default true,
  check (available_to is null or available_to >= available_from)
);

create table discounts (
  id bigserial primary key,
  name text not null,
  kind discount_kind not null,
  value numeric(12,2) not null check (value > 0),
  scope discount_scope not null,
  product_id bigint references products(id),      -- required when scope = 'product'
  min_purchase numeric(12,2),
  min_quantity int,
  starts_on date not null,
  ends_on date,
  usage_limit int,                                 -- null = unlimited
  used_count int not null default 0,
  is_active boolean not null default true,
  created_by uuid references profiles(id),
  check (kind <> 'percentage' or value <= 100),
  check (usage_limit is null or used_count <= usage_limit),
  check (scope <> 'product' or product_id is not null)
);

create table quotation_templates (
  id bigserial primary key,
  name text not null,
  plan_id bigint not null references plans(id),
  validity_days int not null check (validity_days > 0),
  created_by uuid references profiles(id)
);
create table quotation_template_lines (
  id bigserial primary key,
  template_id bigint not null references quotation_templates(id) on delete cascade,
  product_id bigint not null references products(id),
  variant_id bigint references product_variants(id),
  quantity int not null check (quantity > 0)
);

create sequence subscription_number_seq;
create sequence invoice_number_seq;

create table subscriptions (
  id bigserial primary key,
  number text not null unique
    default ('SUB-' || to_char(now(),'YYYY') || '-' || lpad(nextval('subscription_number_seq')::text, 6, '0')),
  customer_id bigint not null references customers(id),
  plan_id bigint not null references plans(id),
  template_id bigint references quotation_templates(id),
  payment_terms_id bigint not null references payment_terms(id),
  status subscription_status not null default 'draft',
  start_date date not null,
  expiry_date date not null,
  quote_valid_until date,
  next_billing_date date,
  periods_billed int not null default 0,
  closed_at timestamptz,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  check (expiry_date >= start_date)
);

create table subscription_lines (
  id bigserial primary key,
  subscription_id bigint not null references subscriptions(id) on delete cascade,
  product_id bigint references products(id),      -- null for the plan-fee line
  variant_id bigint references product_variants(id),
  description text not null,
  quantity int not null check (quantity > 0),
  unit_price numeric(12,2) not null,               -- snapshot
  tax_pct numeric(6,3) not null default 0,         -- snapshot
  amount numeric(12,2) not null,                   -- quantity * unit_price
  is_plan_fee boolean not null default false
);

create table invoices (
  id bigserial primary key,
  number text unique,                              -- assigned on confirm
  subscription_id bigint not null references subscriptions(id),
  customer_id bigint not null references customers(id),
  period_start date not null,
  period_end date not null,
  invoice_date date not null,
  due_date date not null,
  status invoice_status not null default 'draft',
  subtotal numeric(12,2) not null,
  discount_total numeric(12,2) not null default 0,
  tax_total numeric(12,2) not null,
  total numeric(12,2) not null,
  amount_paid numeric(12,2) not null default 0,
  discount_id bigint references discounts(id),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (subscription_id, period_start)           -- "never billed twice"
);

create table invoice_lines (
  id bigserial primary key,
  invoice_id bigint not null references invoices(id) on delete cascade,
  product_id bigint references products(id),
  description text not null,
  quantity int not null,
  unit_price numeric(12,2) not null,
  amount numeric(12,2) not null,                   -- quantity * unit_price (gross)
  discount_amount numeric(12,2) not null default 0,
  tax_pct numeric(6,3) not null default 0,
  tax_amount numeric(12,2) not null default 0      -- on (amount - discount_amount)
);

create table payments (
  id bigserial primary key,
  invoice_id bigint not null references invoices(id),
  method payment_method not null,
  amount numeric(12,2) not null check (amount > 0),
  paid_on date not null,
  note text,
  recorded_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table discount_redemptions (
  id bigserial primary key,
  discount_id bigint not null references discounts(id),
  invoice_id bigint not null references invoices(id),
  amount numeric(12,2) not null,
  unique (discount_id, invoice_id)
);

-- Lock the tables from direct browser access; the server uses the service role.
alter table profiles enable row level security;
alter table customers enable row level security;
alter table taxes enable row level security;
alter table payment_terms enable row level security;
alter table products enable row level security;
alter table product_variants enable row level security;
alter table plans enable row level security;
alter table discounts enable row level security;
alter table quotation_templates enable row level security;
alter table quotation_template_lines enable row level security;
alter table subscriptions enable row level security;
alter table subscription_lines enable row level security;
alter table invoices enable row level security;
alter table invoice_lines enable row level security;
alter table payments enable row level security;
alter table discount_redemptions enable row level security;

-- Indexes for the 2-second page budget
create index idx_sub_customer on subscriptions (customer_id);
create index idx_sub_status on subscriptions (status);
create index idx_sub_due on subscriptions (next_billing_date) where status = 'active';
create index idx_sub_plan on subscriptions (plan_id);
create index idx_subline_sub on subscription_lines (subscription_id);
create index idx_inv_customer on invoices (customer_id, invoice_date desc);
create index idx_inv_status_due on invoices (status, due_date);
create index idx_inv_sub on invoices (subscription_id);
create index idx_invline_inv on invoice_lines (invoice_id);
create index idx_pay_invoice on payments (invoice_id);
create index idx_pay_paid_on on payments (paid_on);
create index idx_disc_active on discounts (starts_on, ends_on) where is_active;
```

## 7. Business rules (decisions already made; do not re-ask)

**R1 Password** (client AND server, one shared `validatePassword`): length > 8 (at least 9), at least one uppercase, one lowercase, one special character (any non-alphanumeric). Email unique (show a friendly error). Forgot password sends the reset link through Supabase Auth to the registered email; show the same message whether or not the email exists.

**R2 Permissions**: as in section 2. Staff accounts are created ONLY by an admin (server action using the service-role client: create auth user, then set `profiles.role='staff'` and delete the auto-created customer row for that profile). Public signup always yields a customer.

**R3 Line pricing**: product line `unit_price = product.sales_price + variant.price_adjustment` (e.g. Odoo brand adds 560). `tax_pct` = product's tax rate (0 if none). Both are snapshotted on the subscription line, so later catalogue edits don't change existing subscriptions. Each subscription also gets one **plan-fee line**: description "Plan fee: <plan name>", quantity 1, unit_price = `plan.price`, tax_pct 0, `is_plan_fee = true`. Product line quantity must be ≥ `plan.min_quantity`. A plan can only be chosen for a new subscription when today (and start_date) falls inside its availability window and `is_active`.

**R4 Subscription status flow** (only via `transitions.ts`):
`draft → quotation` (needs ≥1 product line; sets `quote_valid_until` = today + template validity, default 30 days) ·
`quotation → confirmed` (fails if quote expired) ·
`confirmed → active` (sets `next_billing_date = start_date`, `periods_billed = 0`) ·
`active → paused` and `paused → active` (only if `plan.allow_pause`; paused subscriptions are never billed) ·
`active|paused → closed` early (only if `plan.allow_early_close`; admin/staff may always close) ·
`draft|quotation → closed` (cancel) ·
auto-close: if `plan.auto_close` and `expiry_date < today`, the billing run closes it.
Renewal (only if `plan.allow_renewal`, tier 2): extends `expiry_date` by one billing period and reactivates a closed subscription.

**R5 Billing periods** use the subscription's `start_date` as the anchor to avoid month-end drift: period k (0-based) starts at `start_date + k*step` and ends the day before period k+1 starts, where step is 1 day / 7 days / 1 month / 1 year. `next_billing_date` = start of the next unbilled period. A subscription is billable when status = active, `next_billing_date <= run date` and `next_billing_date <= expiry_date`. Catch-up: if several periods are overdue, bill them all (cap 24 per subscription per run).

**R6 Invoices**: created as **draft** from a subscription. `invoice_date` = run date, `due_date = invoice_date + payment_terms.due_days`. Totals: `subtotal = Σ amount`; `discount_total = Σ discount_amount`; `tax_total = Σ round((amount - discount_amount) * tax_pct / 100, 2)`; `total = subtotal - discount_total + tax_total`. Flow: draft → confirmed (assigns number `INV-YYYY-000001` from sequence) → paid (automatic when `amount_paid >= total`). Cancel allowed from draft, or from confirmed when `amount_paid = 0`. Send is allowed only on confirmed (sets `sent_at`). Confirmed/paid invoices are never edited.

**R7 Discounts** (admin creates; applied automatically at invoice generation, never manually). A discount is eligible when: `is_active`, `starts_on <= invoice_date <= coalesce(ends_on, infinity)`, `usage_limit is null or used_count < usage_limit`, and minimums met (scope `product`: matching lines' total amount ≥ `min_purchase` and their total quantity ≥ `min_quantity`; scope `subscription`: invoice subtotal ≥ `min_purchase` and total product quantity ≥ `min_quantity`). Scope `product` discounts apply only to lines with that `product_id`; scope `subscription` applies to the whole subtotal, spread across lines in proportion to amount (remainder on the last line). Percentage = value% of the eligible amount; fixed = value (capped at the eligible amount). **Only the single best eligible discount is applied per invoice.** Claim it atomically (`update discounts set used_count = used_count + 1 where id = X and (usage_limit is null or used_count < usage_limit)`); if the claim fails, try the next best. Record in `discount_redemptions` and `invoices.discount_id`. Expired or exhausted discounts are simply never eligible again.

**R8 Payments**: recorded against a confirmed invoice only; `0 < amount <= total - amount_paid`; method, date, note required/optional as in schema. Recording updates `amount_paid` and flips the invoice to paid when fully covered, inside one SQL function. Payments are never edited or deleted.

**R9 Overdue** is derived, not stored: `status = 'confirmed' and due_date < current_date and amount_paid < total`.

**R10 Dashboard definitions**: active subscriptions = status 'active'; revenue received = Σ payments.amount with `paid_on` in the filter range; outstanding = Σ (total − amount_paid) over confirmed invoices; overdue = count and Σ of overdue invoices; payments list; filters by date range, customer, plan, status.

## 8. Phase map

| File | Phase | Time box | Contents |
|---|---|---|---|
| 01_PHASE_FOUNDATION_AUTH_CATALOGUE.md | 1 | ~1h45 | Setup, schema, auth, roles, customers, staff, catalogue |
| 02_PHASE_DISCOUNTS_SUBSCRIPTIONS.md | 2 | ~1h30 | Discounts, quotation templates, subscriptions + status flow |
| 03_PHASE_BILLING_INVOICES_PAYMENTS.md | 3 | ~2h | Billing engine, invoices, discount application, payments |
| 04_PHASE_PORTAL_DASHBOARD_PERFORMANCE.md | 4 | ~1h30 | Customer portal, finance dashboard, performance |
| 05_PHASE_HARDENING_DEMO_DEPLOY.md | 5 | ~1h | Tests, demo data, polish, deploy |

## 9. `docs/STATE.md` template (the agent creates it in Phase 1 and updates it at the end of every phase)

```
# STATE
## Done so far (by phase)
## Routes and pages (path → who can access → what it does)
## SQL functions (name, arguments, what it returns)
## Helper functions (file, name, signature)
## Demo accounts (email / password / role)
## Known gaps and shortcuts taken
## Decisions that differ from 00_CONTEXT.md (if any)
```

## 10. Rules for the agent in every phase

1. Read this file and the current phase file fully before writing code.
2. Build ONLY the current phase. Do not start later phases; do not refactor earlier phases unless a listed acceptance check fails.
3. Make reasonable assumptions instead of asking questions; record any deviation in `docs/STATE.md`.
4. Keep the app runnable at all times (`npm run build` must pass at the end of the phase).
5. Finish by running the phase's acceptance checks and reporting each as PASS or FAIL with what was fixed.
