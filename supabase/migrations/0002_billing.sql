-- Phase 3 — Billing engine, invoices, discounts, payments
set search_path = public;

-- Helper: period start/end based on anchored start_date and billing period
create or replace function period_start_for(p_start date, p_period billing_period, p_k int)
returns date language sql immutable as $$
  select case p_period
    when 'daily' then p_start + (p_k || ' days')::interval
    when 'weekly' then p_start + (p_k * 7 || ' days')::interval
    when 'monthly' then p_start + (p_k || ' months')::interval
    when 'yearly' then p_start + (p_k || ' years')::interval
  end::date
$$;

create or replace function period_end_for(p_start date, p_period billing_period, p_k int)
returns date language sql immutable as $$
  select (period_start_for(p_start, p_period, p_k + 1) - interval '1 day')::date
$$;

-- Generate one invoice for the next due period of a subscription
create or replace function generate_invoice(p_subscription_id bigint, p_run_date date)
returns bigint
language plpgsql
as $$
declare
  v_sub subscriptions%rowtype;
  v_plan plans%rowtype;
  v_terms payment_terms%rowtype;
  v_period_start date;
  v_period_end date;
  v_invoice_id bigint;
  v_created boolean := false;
  v_subtotal numeric(12,2) := 0;
  v_discount_total numeric(12,2) := 0;
  v_tax_total numeric(12,2) := 0;
  v_total numeric(12,2) := 0;

  -- Discount evaluation
  v_disc_id bigint;
  v_disc_amount numeric(12,2);
  v_candidate record;
  v_line record;
  v_eligible_amount numeric(12,2);
  v_eligible_qty int;
  v_lines_amount_total numeric(12,2);
  v_allocated numeric(12,2);
  v_running numeric(12,2);
begin
  -- Lock subscription and fetch joined data
  select s.* into v_sub
  from subscriptions s
  where s.id = p_subscription_id
  for update;

  if not found then
    return null;
  end if;

  select * into v_plan from plans where id = v_sub.plan_id;
  select * into v_terms from payment_terms where id = v_sub.payment_terms_id;

  -- Billable check per R5
  if v_sub.status <> 'active' or v_sub.next_billing_date is null
     or v_sub.next_billing_date > p_run_date
     or v_sub.next_billing_date > v_sub.expiry_date then
    return null;
  end if;

  v_period_start := v_sub.next_billing_date; -- start of next unbilled period
  -- Compute end from the anchored start_date and periods_billed (k)
  v_period_end := period_end_for(v_sub.start_date, v_plan.billing_period, v_sub.periods_billed);

  -- Create draft invoice, idempotent on (subscription_id, period_start)
  insert into invoices (
    subscription_id, customer_id, period_start, period_end,
    invoice_date, due_date, status, subtotal, discount_total, tax_total, total
  )
  values (
    v_sub.id, v_sub.customer_id, v_period_start, v_period_end,
    p_run_date, p_run_date + (v_terms.due_days || ' days')::interval,
    'draft', 0, 0, 0, 0
  )
  on conflict (subscription_id, period_start) do nothing
  returning id into v_invoice_id;

  -- Advance anchor regardless; this period has been considered (already billed or created now)
  update subscriptions set
    periods_billed = v_sub.periods_billed + 1,
    next_billing_date = period_start_for(v_sub.start_date, v_plan.billing_period, v_sub.periods_billed + 1)
  where id = v_sub.id;

  if v_invoice_id is null then
    -- Already billed; report as skipped by caller
    return null;
  end if;

  -- Copy subscription lines → invoice lines (gross amounts only for now)
  for v_line in
    select id, product_id, description, quantity, unit_price, amount, tax_pct
    from subscription_lines
    where subscription_id = v_sub.id
  loop
    insert into invoice_lines (invoice_id, product_id, description, quantity, unit_price, amount, discount_amount, tax_pct, tax_amount)
    values (v_invoice_id, v_line.product_id, v_line.description, v_line.quantity, v_line.unit_price, v_line.amount, 0, v_line.tax_pct, 0);
  end loop;

  -- Evaluate discounts (R7) and pick the best eligible one
  -- Precompute invoice-wide amounts for eligibility
  select coalesce(sum(amount),0) into v_lines_amount_total from invoice_lines where invoice_id = v_invoice_id;

  -- Iterate over candidates ordered by potential savings (best first)
  for v_candidate in
    with base as (
      select d.*,
             -- Eligible amount and qty per scope
             case when d.scope = 'product' then coalesce((
               select sum(l.amount) from invoice_lines l
               where l.invoice_id = v_invoice_id and l.product_id = d.product_id
             ),0)
             else coalesce((
               select sum(l.amount) from invoice_lines l where l.invoice_id = v_invoice_id
             ),0) end as elig_amount,
             case when d.scope = 'product' then coalesce((
               select sum(l.quantity) from invoice_lines l
               where l.invoice_id = v_invoice_id and l.product_id = d.product_id
             ),0)
             else coalesce((
               select sum(l.quantity) from invoice_lines l where l.invoice_id = v_invoice_id and l.product_id is not null
             ),0) end as elig_qty
      from discounts d
      where d.is_active
        and d.starts_on <= p_run_date
        and (d.ends_on is null or p_run_date <= d.ends_on)
    )
    select id, kind, value, scope, product_id, usage_limit, used_count, elig_amount, elig_qty,
           case when kind = 'percentage' then round(least(elig_amount, greatest(0, elig_amount)) * value / 100.0, 2)
                else round(least(value, greatest(0, elig_amount)), 2) end as potential
    from base
    where (usage_limit is null or used_count < usage_limit)
      and elig_amount > 0
      and (min_purchase is null or elig_amount >= min_purchase)
      and (min_quantity is null or elig_qty >= min_quantity)
    order by potential desc, id asc
  loop
    -- Try to claim atomically
    update discounts set used_count = used_count + 1
    where id = v_candidate.id
      and (usage_limit is null or used_count < usage_limit)
    returning id into v_disc_id;

    if v_disc_id is not null then
      v_disc_amount := v_candidate.potential;
      exit; -- claimed
    end if;
  end loop;

  if v_disc_id is not null and v_disc_amount > 0 then
    -- Allocate discount to lines
    if v_candidate.scope = 'product' then
      -- Only lines for the product receive the discount, capped per line
      v_running := 0;
      for v_line in
        select id, amount from invoice_lines where invoice_id = v_invoice_id and product_id = v_candidate.product_id order by id
      loop
        if v_running + 0.01 >= v_disc_amount then
          exit;
        end if;
        v_allocated := round(least(v_line.amount, v_disc_amount - v_running), 2);
        update invoice_lines set discount_amount = v_allocated where id = v_line.id;
        v_running := v_running + v_allocated;
      end loop;
    else
      -- Proportional across all lines, remainder on the last line
      v_running := 0;
      for v_line in
        select id, amount from invoice_lines where invoice_id = v_invoice_id order by id
      loop
        if v_running + 0.01 >= v_disc_amount then
          exit;
        end if;
        if v_line.id <> (select id from invoice_lines where invoice_id = v_invoice_id order by id desc limit 1) then
          v_allocated := round((v_line.amount / nullif(v_lines_amount_total,0)) * v_disc_amount, 2);
          v_allocated := least(v_allocated, v_line.amount);
          update invoice_lines set discount_amount = v_allocated where id = v_line.id;
          v_running := v_running + v_allocated;
        else
          v_allocated := round(v_disc_amount - v_running, 2);
          v_allocated := least(v_allocated, v_line.amount);
          update invoice_lines set discount_amount = v_allocated where id = v_line.id;
          v_running := v_running + v_allocated;
        end if;
      end loop;
    end if;

    -- Record redemption and attach discount to invoice
    insert into discount_redemptions (discount_id, invoice_id, amount)
    values (v_disc_id, v_invoice_id, (select round(coalesce(sum(discount_amount),0),2) from invoice_lines where invoice_id = v_invoice_id));
    update invoices set discount_id = v_disc_id where id = v_invoice_id;
  end if;

  -- Compute tax per line and totals
  for v_line in select id, amount, discount_amount, tax_pct from invoice_lines where invoice_id = v_invoice_id loop
    update invoice_lines
      set tax_amount = round((greatest(0, v_line.amount - v_line.discount_amount) * v_line.tax_pct / 100.0), 2)
      where id = v_line.id;
  end loop;

  select round(coalesce(sum(amount),0),2),
         round(coalesce(sum(discount_amount),0),2),
         round(coalesce(sum(tax_amount),0),2)
    into v_subtotal, v_discount_total, v_tax_total
    from invoice_lines where invoice_id = v_invoice_id;

  v_total := round(v_subtotal - v_discount_total + v_tax_total, 2);

  update invoices
    set subtotal = v_subtotal,
        discount_total = v_discount_total,
        tax_total = v_tax_total,
        total = v_total
  where id = v_invoice_id;

  return v_invoice_id;
end;
$$;

-- Run billing for all due subscriptions; also auto-close where required
create or replace function run_billing(p_run_date date)
returns table(created int, skipped int, failed int, closed int)
language plpgsql as $$
declare
  v_created int := 0;
  v_skipped int := 0;
  v_failed int := 0;
  v_closed int := 0;
  r record;
  v_id bigint;
  v_iter int;
  v_due boolean;
  v_sub subscriptions%rowtype;
  v_plan plans%rowtype;
begin
  -- Auto-close per R4 when plan.auto_close and expired before run date
  update subscriptions s
    set status = 'closed', closed_at = now()
  from plans p
  where s.plan_id = p.id
    and s.status in ('active','paused')
    and p.auto_close
    and s.expiry_date < p_run_date;
  get diagnostics v_closed = row_count;

  for r in
    select id from subscriptions
    where status = 'active'
      and next_billing_date is not null
      and next_billing_date <= p_run_date
      and next_billing_date <= expiry_date
    order by id
    for update skip locked
  loop
    begin
      v_iter := 0;
      loop
        exit when v_iter >= 24;
        -- Refresh current due state
        select * into v_sub from subscriptions where id = r.id for update;
        select * into v_plan from plans where id = v_sub.plan_id;
        v_due := (v_sub.status = 'active'
                  and v_sub.next_billing_date is not null
                  and v_sub.next_billing_date <= p_run_date
                  and v_sub.next_billing_date <= v_sub.expiry_date);
        exit when not v_due;

        v_id := generate_invoice(r.id, p_run_date);
        if v_id is null then
          v_skipped := v_skipped + 1;
        else
          v_created := v_created + 1;
        end if;
        v_iter := v_iter + 1;
      end loop;
    exception when others then
      v_failed := v_failed + 1;
      -- Skip this subscription; continue with others
    end;
  end loop;

  return query select v_created, v_skipped, v_failed, v_closed;
end;
$$;

-- Confirm a draft invoice
create or replace function confirm_invoice(p_invoice_id bigint)
returns text language plpgsql as $$
declare v_number text; v_now date := current_date; begin
  update invoices set number = (
           'INV-' || to_char(v_now,'YYYY') || '-' || lpad(nextval('invoice_number_seq')::text, 6, '0')
         ), status = 'confirmed'
  where id = p_invoice_id and status = 'draft'
  returning number into v_number;
  if v_number is null then
    raise exception 'Invoice cannot be confirmed';
  end if;
  return v_number;
end; $$;

-- Cancel a draft or unpaid confirmed invoice; return discount use
create or replace function cancel_invoice(p_invoice_id bigint)
returns void language plpgsql as $$
declare v_inv invoices%rowtype; begin
  select * into v_inv from invoices where id = p_invoice_id for update;
  if not found then
    raise exception 'Invoice not found';
  end if;
  if not (v_inv.status = 'draft' or (v_inv.status = 'confirmed' and v_inv.amount_paid = 0)) then
    raise exception 'Invoice cannot be cancelled in its current state';
  end if;
  -- Return discount claim if present
  if v_inv.discount_id is not null then
    update discounts set used_count = used_count - 1 where id = v_inv.discount_id and used_count > 0;
    delete from discount_redemptions where invoice_id = v_inv.id and discount_id = v_inv.discount_id;
  end if;
  update invoices set status = 'cancelled' where id = v_inv.id;
end; $$;

-- Record a payment against a confirmed invoice
create or replace function record_payment(
  p_invoice_id bigint,
  p_method payment_method,
  p_amount numeric,
  p_paid_on date,
  p_note text,
  p_user uuid
) returns bigint language plpgsql as $$
declare v_inv invoices%rowtype; v_payment_id bigint; begin
  select * into v_inv from invoices where id = p_invoice_id for update;
  if not found then
    raise exception 'Invoice not found';
  end if;
  if v_inv.status <> 'confirmed' then
    raise exception 'Payments can be recorded only on confirmed invoices';
  end if;
  if p_amount <= 0 or p_amount > (v_inv.total - v_inv.amount_paid) then
    raise exception 'Invalid payment amount';
  end if;
  insert into payments (invoice_id, method, amount, paid_on, note, recorded_by)
  values (v_inv.id, p_method, round(p_amount,2), p_paid_on, p_note, p_user)
  returning id into v_payment_id;
  update invoices set amount_paid = round(amount_paid + round(p_amount,2),2),
                      status = case when (amount_paid + round(p_amount,2)) >= total then 'paid' else status end
  where id = v_inv.id;
  return v_payment_id;
end; $$;

-- Tighten execute privileges: service role only
do $$ begin
  perform 1;
  -- Revoke from public/authenticated; grant to service_role
  revoke all on function period_start_for(date,billing_period,int) from public;
  revoke all on function period_end_for(date,billing_period,int) from public;
  revoke all on function generate_invoice(bigint,date) from public;
  revoke all on function run_billing(date) from public;
  revoke all on function confirm_invoice(bigint) from public;
  revoke all on function cancel_invoice(bigint) from public;
  revoke all on function record_payment(bigint,payment_method,numeric,date,text,uuid) from public;
  grant execute on function period_start_for(date,billing_period,int) to service_role;
  grant execute on function period_end_for(date,billing_period,int) to service_role;
  grant execute on function generate_invoice(bigint,date) to service_role;
  grant execute on function run_billing(date) to service_role;
  grant execute on function confirm_invoice(bigint) to service_role;
  grant execute on function cancel_invoice(bigint) to service_role;
  grant execute on function record_payment(bigint,payment_method,numeric,date,text,uuid) to service_role;
exception when others then
  -- On non-Supabase Postgres without service_role, ignore grants
  null;
end $$;
