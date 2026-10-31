-- Phase 4 — Dashboard aggregate functions and performance indexes
set search_path = public;

create or replace function dashboard_summary(p_from date, p_to date, p_customer bigint, p_plan bigint)
returns table(
  active_subscriptions int,
  paused_subscriptions int,
  revenue_received numeric,
  outstanding_amount numeric,
  overdue_count int,
  overdue_amount numeric,
  invoiced_in_range numeric,
  mrr numeric
)
language sql as $$
  with subs as (
    select s.id, s.status, pl.billing_period,
           coalesce(sum(sl.amount) filter (where not sl.is_plan_fee), 0) + coalesce(max(sl.amount) filter (where sl.is_plan_fee), 0) as per_period
    from subscriptions s
    join plans pl on pl.id = s.plan_id
    left join subscription_lines sl on sl.subscription_id = s.id
    where (p_customer is null or s.customer_id = p_customer)
      and (p_plan is null or s.plan_id = p_plan)
    group by s.id, s.status, pl.billing_period
  ), inv_in_range as (
    select coalesce(sum(i.total),0) as total
    from invoices i
    where i.invoice_date between p_from and p_to
      and (p_customer is null or i.customer_id = p_customer)
  ), pay_in_range as (
    select coalesce(sum(p.amount),0) as total from payments p
    where p.paid_on between p_from and p_to
      and exists (select 1 from invoices i where i.id = p.invoice_id and (p_customer is null or i.customer_id = p_customer))
  ), outstanding as (
    select coalesce(sum(i.total - i.amount_paid),0) as balance
    from invoices i
    where i.status = 'confirmed'
      and (p_customer is null or i.customer_id = p_customer)
  ), overdue as (
    select count(*)::int as c, coalesce(sum(i.total - i.amount_paid),0) as amt
    from invoices i
    where i.status = 'confirmed' and i.due_date < current_date and i.amount_paid < i.total
      and (p_customer is null or i.customer_id = p_customer)
  )
  select
    (select count(*) from subs where status = 'active')::int as active_subscriptions,
    (select count(*) from subs where status = 'paused')::int as paused_subscriptions,
    (select total from pay_in_range) as revenue_received,
    (select balance from outstanding) as outstanding_amount,
    (select c from overdue) as overdue_count,
    (select amt from overdue) as overdue_amount,
    (select total from inv_in_range) as invoiced_in_range,
    coalesce(sum(case billing_period when 'daily' then per_period*30 when 'weekly' then per_period*52/12.0 when 'monthly' then per_period when 'yearly' then per_period/12.0 end),0) as mrr
  from subs
$$;

create or replace function dashboard_revenue_by_month(p_from date, p_to date, p_customer bigint, p_plan bigint)
returns table(month text, invoiced numeric, received numeric)
language sql as $$
  with months as (
    select to_char(d, 'YYYY-MM') as ym, date_trunc('month', d)::date as mstart, (date_trunc('month', d) + interval '1 month - 1 day')::date as mend
    from generate_series(p_from, p_to, interval '1 month') as g(d)
  )
  select ym as month,
    coalesce((select sum(total) from invoices i where i.invoice_date between m.mstart and m.mend and (p_customer is null or i.customer_id = p_customer)),0) as invoiced,
    coalesce((select sum(p.amount) from payments p join invoices i on i.id = p.invoice_id where p.paid_on between m.mstart and m.mend and (p_customer is null or i.customer_id = p_customer)),0) as received
  from months m
  order by ym
$$;

create or replace function subscriptions_by_status()
returns table(status subscription_status, count int)
language sql as $$
  select status, count(*)::int from subscriptions group by status
$$;

-- Helpful composite indexes for filters
do $$ begin
  create index if not exists idx_inv_status_due_date on invoices(status, due_date);
  create index if not exists idx_pay_paid_on_invoice on payments(paid_on, invoice_id);
  create index if not exists idx_sub_status_plan on subscriptions(status, plan_id);
exception when others then null; end $$;
