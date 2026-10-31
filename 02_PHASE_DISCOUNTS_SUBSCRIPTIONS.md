# PHASE 2 of 5 — Discounts, Quotation Templates, Subscriptions and Status Flow

Time box: about 1h30. Prerequisite: Phase 1 complete and `docs/STATE.md` available (upload/paste it with this file). Also upload `00_CONTEXT.md` again if the agent lacks it.

## Goal
Admins define discount rules and quotation templates. Staff/admin build subscriptions (from a template or from scratch) with priced lines, move them through Draft → Quotation → Confirmed → Active → Closed, and the whole team sees status.

## Tasks

### 2.1 Discounts (admin only; about 25 min)
- `/admin/discounts`: paginated list with status (active / scheduled / expired / used up) computed from dates and `used_count` vs `usage_limit`.
- Create/edit form: name, kind (fixed/percentage), value (percentage ≤ 100), scope (product/subscription), product (required when scope is product), min purchase, min quantity, starts on, ends on (≥ starts on), usage limit (blank = unlimited), active. Show `used_count` read-only. `created_by` = current admin.
- Staff cannot see or call these (`requireRole(['admin'])`).
- Do NOT apply discounts to anything yet; that happens in Phase 3.

### 2.2 Quotation templates (admin creates; staff can use; about 15 min)
- `/admin/quotation-templates`: list; create/edit with name, plan, validity in days, and lines (product, optional variant, quantity). Admin only for create/edit; staff can view and pick them.

### 2.3 Pricing and transition helpers (about 20 min)
- `lib/subscriptions/pricing.ts`:
  - `priceLine(productId, variantId?)` → `{unit_price, tax_pct, description}` per rule R3 (description = product name plus " (Attribute: Value)" when a variant is chosen).
  - `buildPlanFeeLine(plan)` → the plan-fee line (R3).
  - `lineAmount(qty, unitPriceCents)` using integer cents.
- `lib/subscriptions/transitions.ts`: the ONLY place that changes `subscriptions.status`. Export `transition(subscriptionId, action, actor)` for actions `sendQuotation`, `confirm`, `activate`, `pause`, `resume`, `close`, `cancel`, implementing R4 exactly, including plan-flag checks and a clear error message when blocked. Compute `quote_valid_until`, set `next_billing_date`/`periods_billed` on activate, set `closed_at` on close.

### 2.4 Subscriptions (staff + admin; about 40 min)
- `/admin/subscriptions`: paginated list showing number, customer, plan, status badge, start, expiry, period total; filters: status, customer, plan, text search by number. Server-side pagination.
- "New subscription": choose customer, then either pick a quotation template (pre-fills plan, quote validity and product lines) or choose a plan manually. Fields: payment terms, start date, expiry date (default start + 1 year, must be ≥ start). Validate plan availability (R3) and minimum quantity per line against the plan.
- Editor/detail `/admin/subscriptions/[id]`: header (number, customer, plan, dates, payment terms), lines table (product, variant, quantity, unit price, tax %, amount) with add/remove/edit while status is draft or quotation, plan-fee line shown and locked, totals (subtotal, tax, total per period). Lines are re-priced from the catalogue only when added/edited (snapshots otherwise).
- Status stepper showing Draft → Quotation → Confirmed → Active → Closed (with Paused shown when relevant) and buttons for the actions currently allowed. Every action goes through `transition()`; show toast errors.
- Lines are read-only once confirmed.

### 2.5 State file
Update `docs/STATE.md` (routes, helper signatures, transition actions and their rules).

## Acceptance checks (report PASS/FAIL for each)
1. `npm run build` passes.
2. Admin creates a percentage discount (10%, subscription scope, min quantity 5, usage limit 3, dates) and a fixed discount for one product; staff cannot access the discount pages or actions.
3. Admin creates a quotation template with a plan and two product lines, validity 15 days.
4. Staff creates a subscription from the template: lines pre-filled, plan-fee line present, unit price of the Odoo variant line = product price + 560, subscription number like `SUB-2026-000001`, numbers unique.
5. Quantity below plan minimum is rejected; a plan outside its availability window cannot be chosen; expiry before start is rejected.
6. Walk a subscription Draft → Quotation → Confirmed → Active; `next_billing_date` equals start date after activation. Trying to skip a step (for example Draft → Active) is rejected.
7. Pause only works on a plan with `allow_pause`; early close only on `allow_early_close` (admin/staff cancel of draft/quotation still works). An expired quote cannot be confirmed.
8. Subscription list paginates and filters; status is visible to staff and admin.

## Do NOT do in this phase
Invoices, billing, discount application, payments, portal, dashboard.

## Handoff
Update `docs/STATE.md`. Then stop and say "Phase 2 complete".
