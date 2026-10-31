# PHASE 4 of 5 — Customer Portal, Finance Dashboard, Performance

Time box: about 1h30. Prerequisite: Phases 1–3 complete; upload `docs/STATE.md` and `00_CONTEXT.md` with this file.

## Goal
Customers manage their own subscriptions and see their own invoices. The finance lead gets one dashboard with active subscriptions, revenue, outstanding amounts, payments and overdue invoices with filters. Every page responds in under 2 seconds with thousands of subscriptions.

## Tasks

### 4.1 Customer portal (about 35 min)
All portal pages use `requireRole(['customer'])`. The customer id is derived on the server from the session (`getSessionUser().customerId`); it is NEVER read from the URL, form or query. Every query filters by it; opening another customer's id must return 404.
- `/portal` home: summary cards (active subscriptions, outstanding balance, next invoice due) for this customer only.
- `/portal/subscriptions` and `/portal/subscriptions/[id]`: list and detail (number, plan, status, dates, lines, per-period total). Only own subscriptions. Self-service buttons, calling the same `transition()` as staff but only when the plan allows it: **Pause/Resume** (`allow_pause`), **Close** (`allow_early_close`). Customers cannot confirm or activate; quotations in `quotation` status show an "Accept quotation" button that performs `confirm` (fails if expired). If renewal is implemented (tier 2) show Renew when `allow_renewal`.
- `/portal/invoices` and `/portal/invoices/[id]`: list (number, date, due, total, balance, status incl. overdue badge) and detail with lines, discount, tax and payments received. Draft invoices are NOT visible to customers. "Print / Save as PDF" reuses the print layout.
- Portal navigation entries and layout only; no admin links.

### 4.2 Finance dashboard (admin + staff; about 40 min)
Create `supabase/migrations/0003_dashboard.sql` with SQL functions that aggregate in the database (no looping in TypeScript):
- `dashboard_summary(p_from date, p_to date, p_customer bigint, p_plan bigint)` returning: `active_subscriptions`, `paused_subscriptions`, `revenue_received` (payments in range), `outstanding_amount`, `overdue_count`, `overdue_amount`, `invoiced_in_range`, `mrr` (active subscriptions' per-period total normalised to monthly: daily×30, weekly×52/12, monthly×1, yearly÷12).
- `dashboard_revenue_by_month(p_from, p_to, ...)` → month, invoiced, received (for one chart).
- `subscriptions_by_status()` → counts per status.
`/admin/dashboard`:
- Filters in the URL: date range (default last 90 days), customer, plan, subscription status.
- Cards for the summary numbers; one bar/line chart (recharts) for invoiced vs received per month; a small status breakdown.
- Two tables below, each server-paginated: **Overdue invoices** (customer, invoice, due date, days overdue, balance; link to the invoice) and **Recent payments** (date, invoice, customer, method, amount).
- A "Summary" toggle/tab shows only the cards and chart (the summary view); the other tab shows the tables (the detail view).
- Optional tier 2 if time remains: CSV export of the overdue list.

### 4.3 Performance (about 25 min)
- `scripts/seed-perf.sql`: using `generate_series`, insert ~300 customers, ~3,000 subscriptions (active/paused/closed mix, different plans and periods, each with 2–3 lines), ~15,000 invoices (mix of draft/confirmed/paid/cancelled with some overdue) and the matching payments for paid invoices. Tag generated rows (e.g. customer email like `perf+N@example.test`) and provide a cleanup script `scripts/cleanup-perf.sql`. Keep totals consistent (invoice totals = sum of lines).
- Measure with the perf data loaded: dashboard, `/admin/subscriptions`, `/admin/invoices` (all filters), `/admin/payments`, `/portal` pages for a customer with many records. Use `EXPLAIN ANALYZE` on the slowest queries. Add or adjust indexes (the ones in `0001_schema.sql` are a start, e.g. composite on `invoices (status, due_date)`, `payments (paid_on)`, `subscriptions (status, plan_id)`), avoid `select *` and N+1 queries, make sure `count(*)` for pagination is not run on huge joins unnecessarily (use filtered counts or an estimated total on very large unfiltered lists).
- Target: each page's server time under 800 ms locally and the whole page under 2 s. Put the measured numbers in `docs/STATE.md`.

### 4.4 State file
Update `docs/STATE.md` with the new routes, SQL functions, measured timings and how to load/clean perf data.

## Acceptance checks (report PASS/FAIL for each)
1. `npm run build` passes; `0003_dashboard.sql` applies cleanly.
2. Log in as customer A: sees only A's subscriptions and invoices; manually changing the id in a URL to one of customer B's records returns 404; draft invoices are hidden.
3. Customer can pause/resume/close only when the plan flags allow it; the button is hidden otherwise AND the server action rejects it when called directly.
4. Dashboard numbers match a manual check on small data: active subscriptions count, revenue = sum of payments in range, outstanding = Σ(total − paid) for confirmed invoices, overdue count and amount, MRR.
5. Dashboard filters (date range, customer, plan, status) change the numbers and tables correctly; summary view and detail view both work; tables paginate.
6. With the perf dataset loaded, every listed page loads in under 2 seconds; the measured numbers are recorded.
7. Staff can open the dashboard; customers cannot.

## Do NOT do in this phase
Hardening, demo content polish, deployment (Phase 5).

## Handoff
Update `docs/STATE.md`. Then stop and say "Phase 4 complete".
