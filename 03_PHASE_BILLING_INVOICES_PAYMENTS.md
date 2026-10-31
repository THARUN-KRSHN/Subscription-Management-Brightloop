# PHASE 3 of 5 — Billing Engine, Invoices, Discount Application, Payments

Time box: about 2h. This is the hardest phase; follow the order. Prerequisite: Phases 1–2 complete; upload `docs/STATE.md` and `00_CONTEXT.md` with this file.

## Goal
One click creates correct invoices for every due subscription (tax and discounts applied automatically, nothing billed twice or skipped). Staff can confirm, cancel, send and print invoices, record payments, and see paid, outstanding and overdue invoices.

## Tasks

### 3.1 SQL functions: `supabase/migrations/0002_billing.sql` (about 50 min)
Write these as PL/pgSQL, following rules R5–R9 in `00_CONTEXT.md` exactly.

1. `period_start_for(p_start date, p_period billing_period, p_k int) returns date` and `period_end_for(...)`: anchor math from `start_date` (start of period k = `start_date + k * step`; end = start of period k+1 minus one day). Month-end safe (e.g. start 31 Jan: Feb period start = 28/29 Feb, March period start = 31 Mar).
2. `generate_invoice(p_subscription_id bigint, p_run_date date) returns bigint`:
   - Lock the subscription row; return null if not billable (not active, `next_billing_date` null/after run date/after expiry).
   - `period_start = next_billing_date`; `period_end` via the helper; `invoice_date = p_run_date`; `due_date = p_run_date + payment_terms.due_days`.
   - Insert the invoice with `on conflict (subscription_id, period_start) do nothing`; if nothing inserted, still advance the subscription (it was already billed) and return null.
   - Copy subscription lines into invoice lines (`amount = quantity * unit_price`).
   - Evaluate eligible discounts (R7), compute each candidate's total discount, order best first, and for the first one whose atomic claim `update discounts set used_count = used_count + 1 where id = X and (usage_limit is null or used_count < usage_limit) returning id` succeeds: write `discount_amount` per invoice line (product scope: matching lines only; subscription scope: proportional across lines, remainder on last line, never above the line amount), insert `discount_redemptions`, set `invoices.discount_id`.
   - Compute `tax_amount` per line on `(amount - discount_amount)`, then invoice `subtotal`, `discount_total`, `tax_total`, `total` (all rounded to 2 decimals, totals equal the sum of lines).
   - Increment `periods_billed`, set `next_billing_date` to the start of the next period. Return the new invoice id.
3. `run_billing(p_run_date date) returns table(created int, skipped int, failed int, closed int)`:
   - First close subscriptions that must auto-close: status active/paused, plan `auto_close`, `expiry_date < p_run_date` (set status closed, `closed_at`).
   - Select active subscriptions where `next_billing_date <= p_run_date and next_billing_date <= expiry_date` (`for update skip locked`, ordered by id).
   - For each, loop `generate_invoice` while still due (catch-up, max 24 periods per subscription). Wrap each subscription in its own `begin ... exception when others then ... end` sub-block so one failure rolls back only that subscription and increments `failed`.
   - Return the counts. Running it twice with the same date must create zero new invoices the second time.
4. `confirm_invoice(p_invoice_id bigint) returns text`: draft → confirmed, assign `INV-YYYY-` + 6-digit number from `invoice_number_seq`; reject other states.
5. `cancel_invoice(p_invoice_id bigint)`: draft, or confirmed with `amount_paid = 0`, → cancelled. If a discount was redeemed, decrement `used_count` and delete the redemption so the use is returned (only when cancelling).
6. `record_payment(p_invoice_id bigint, p_method payment_method, p_amount numeric, p_paid_on date, p_note text, p_user uuid) returns bigint`: lock invoice; must be confirmed; `0 < p_amount <= total - amount_paid`; insert payment; update `amount_paid`; set status `paid` when fully covered. Return payment id.
Grant execute on these functions only to the service role.

### 3.2 Billing run endpoint and UI (about 20 min)
- `app/api/billing/run/route.ts` (POST, admin/staff only) calling `run_billing(date)` (date defaults to today; optional date input for the demo, not in the future beyond today + 0 unless admin). Return the counts.
- `/admin/invoices` page header has a "Run billing" button with a confirmation dialog and a result toast ("Created X, skipped Y, failed Z, closed W").

### 3.3 Invoices UI (about 35 min)
- `/admin/invoices`: server-paginated list (number, customer, subscription number, period, due date, total, paid, balance, status badge, overdue badge). Filters: status, customer, overdue only, date range, text search. A summary strip above the list: counts of draft / confirmed / paid / overdue.
- `/admin/invoices/[id]`: customer details, period, lines (quantity, unit price, discount, tax, total), totals, discount name if applied, payments list, status badge. Buttons by state: **Confirm**, **Cancel**, **Send**, **Print**, **Record payment**.
  - Send (confirmed only): email the customer through Resend if `RESEND_API_KEY` is set (subject with invoice number, link to the portal invoice and a short summary); otherwise just set `sent_at` and show "Marked as sent (email not configured)". Never block on email failure.
  - Print: `/admin/invoices/[id]/print`, a clean A4 print layout (company header, customer, lines, totals, status) with a Print button using `window.print()` and print CSS. This is the "PDF" (user chooses Save as PDF).
- Bulk action on the list: "Confirm all drafts" (loops `confirm_invoice`, reports counts).

### 3.4 Payments UI (about 15 min)
- Record payment form (dialog) on the invoice page: method, amount (default = balance), date (default today), note. Server action calls `record_payment` and shows validation errors.
- `/admin/payments`: paginated list (date, invoice number, customer, method, amount, note) with filters by method and date range.
- Invoices page filters: "Outstanding" (confirmed and unpaid) and "Overdue" per R9.

### 3.5 State file
Update `docs/STATE.md`: function signatures, billing rules as implemented, the routes, any deviations.

## Acceptance checks (report PASS/FAIL for each; test with real data, not just reading code)
1. `npm run build` passes; `0002_billing.sql` applies cleanly after `0001`.
2. Activate 3 subscriptions (monthly, weekly, yearly) with start dates in the past; "Run billing" creates the expected number of invoices including catch-up periods; period dates are correct (including a monthly subscription starting on the 31st).
3. Press "Run billing" again immediately: created = 0 (no duplicates). Run two requests at the same time: still no duplicates.
4. Paused and closed subscriptions are skipped; a subscription past expiry is not billed; a plan with `auto_close` closes after expiry on the next run.
5. Invoice totals: subtotal, discount, tax and total are correct and equal the sum of lines; due date = invoice date + payment terms.
6. Create a 10% subscription-scope discount with usage limit 1 and two eligible subscriptions: exactly one invoice gets the discount; `used_count` = 1; after expiry date or limit, no further invoices get it. Cancelling the discounted draft invoice returns the use. A product-scope discount discounts only its product's lines.
7. Confirm assigns `INV-YYYY-nnnnnn`; invoice cannot go from paid back to draft; cancel is blocked when payments exist; Send works on confirmed only.
8. Payment flow: partial payment keeps status confirmed and reduces balance; paying the rest sets paid; overpaying and paying a draft invoice are rejected; method, amount, date and note are stored.
9. Backdate a confirmed invoice's due date: it appears in the Overdue filter; paid invoices never appear overdue.
10. Staff and admin can use all of the above; customers get nothing here (no routes for them yet).

## Do NOT do in this phase
Customer portal, finance dashboard, performance seeding, renewal, CSV export.

## Handoff
Update `docs/STATE.md`. Then stop and say "Phase 3 complete".
