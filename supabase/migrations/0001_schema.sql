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
