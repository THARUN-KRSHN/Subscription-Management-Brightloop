-- Seed performance dataset (approximate sizes)
begin;

-- Customers
insert into customers (contact_name, email)
select 'Perf User ' || g, 'perf+' || g || '@example.test'
from generate_series(1,300) g;

-- Plans (if none exist)
insert into plans (name, price, billing_period, min_quantity, available_from, is_active, allow_pause, allow_early_close)
select 'Perf Plan ' || g, (500 + (g%5)*100), (array['daily','weekly','monthly','yearly'])[(g%4)+1]::billing_period, 1, current_date - 365, true, true, true
from generate_series(1,6) g
on conflict do nothing;

-- Payment terms
insert into payment_terms (name, due_days)
values ('Immediate',0)
on conflict (name) do nothing;

-- Subscriptions
with c as (
  select id from customers order by id desc limit 300
), p as (
  select id from plans limit 6
)
insert into subscriptions (number, customer_id, plan_id, payment_terms_id, status, start_date, expiry_date, next_billing_date, periods_billed)
select 'SUB-PERF-' || lpad(nextval('subscription_number_seq')::text,6,'0'),
       (select id from c offset (g%300) limit 1),
       (select id from p offset (g%6) limit 1),
       (select id from payment_terms limit 1),
       (array['active','paused','closed'])[(g%3)+1]::subscription_status,
       current_date - ((g%720))::int,
       current_date + 365,
       current_date - ((g%30))::int,
       (g%12)
from generate_series(1,3000) g;

-- Lines: 2–3 per subscription (includes one plan fee)
insert into subscription_lines (subscription_id, product_id, description, quantity, unit_price, tax_pct, amount, is_plan_fee)
select s.id, null, 'Plan fee', 1, 1000, 0, 1000, true from subscriptions s where s.number like 'SUB-PERF-%';
insert into subscription_lines (subscription_id, product_id, description, quantity, unit_price, tax_pct, amount, is_plan_fee)
select s.id, null, 'Product A', 2, 200, 18, 400, false from subscriptions s where s.number like 'SUB-PERF-%';
insert into subscription_lines (subscription_id, product_id, description, quantity, unit_price, tax_pct, amount, is_plan_fee)
select s.id, null, 'Product B', 1, 350, 5, 350, false from subscriptions s where s.number like 'SUB-PERF-%' and (s.id % 2) = 0;

-- Invoices: ~15k across statuses
insert into invoices (subscription_id, customer_id, period_start, period_end, invoice_date, due_date, status, subtotal, discount_total, tax_total, total, amount_paid)
select s.id, s.customer_id,
       current_date - ((g%360)+60), current_date - ((g%360)+30),
       current_date - ((g%360)+30), current_date - ((g%360)+20),
       (array['draft','confirmed','paid','cancelled'])[(g%4)+1]::invoice_status,
       1750, 0, 125, 1875, case when (g%4)=2 then 0 when (g%4)=3 then 1875 else 0 end
from subscriptions s
join generate_series(1,5) g on true
where s.number like 'SUB-PERF-%';

-- Payments for paid invoices
insert into payments (invoice_id, method, amount, paid_on, note)
select i.id, 'upi'::payment_method, i.total, i.invoice_date + 5, 'perf seed'
from invoices i where i.status = 'paid' and i.number is not null on conflict do nothing;

commit;
