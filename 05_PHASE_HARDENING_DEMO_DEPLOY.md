# PHASE 5 of 5 — Hardening, Demo Data, Polish, Deploy

Time box: about 1h (plus buffer). Prerequisite: Phases 1–4 complete; upload `docs/STATE.md` and `00_CONTEXT.md` with this file.

## Goal
Prove the rules hold, load a clean demo dataset, fix the rough edges and deploy, so the 3-minute demo runs flawlessly on the live site.

## Tasks

### 5.1 Automated checks (about 20 min)
Add a small script-based test suite (`npm run test`, using vitest or plain Node scripts against a local/test database). Keep it focused:
- `validatePassword`: table of passing and failing passwords (8 chars, no upper, no lower, no special, valid 9+).
- Billing idempotency: create an active subscription with past start date; `run_billing` twice → second run creates 0; invoice count equals expected periods; month-end anchor case (start on the 31st).
- Discount limit: usage limit 1, two eligible subscriptions → exactly one discounted invoice, `used_count` = 1; expired discount never applies.
- Totals: invoice `total = subtotal − discount_total + tax_total` and equals the sum of its lines.
- Payments: partial then full payment flips to paid; overpay rejected.
- Authorisation matrix (script that logs in as admin, staff, customer and calls each admin/portal route/action): admin-only items return forbidden for staff and customer; customer cannot read another customer's subscription or invoice.
Report failures and fix the underlying bug, not the test.

### 5.2 Demo dataset (about 15 min)
`scripts/seed-demo.ts` (idempotent, clearly named demo records; do not touch perf data):
- Accounts: `admin@demo.test`, `staff@demo.test`, `customer@demo.test` (and a second customer to show isolation), all with a valid strong password; list them in `docs/STATE.md` and the README.
- Catalogue: products with an "Odoo" brand variant (+560); plans: one each of daily, weekly, monthly, yearly with different flag combinations; taxes and payment terms; a quotation template.
- Discounts: one percentage (subscription scope, usage limit 3), one fixed (product scope), one expired.
- Subscriptions in every status; invoices in draft, confirmed (some overdue), paid; a few payments with different methods; so the dashboard looks alive. Keep the billing run available for the live demo (leave at least two subscriptions due and not yet billed).

### 5.3 Polish and fixes (about 15 min)
- Empty states and loading states on every list; clear error messages; consistent status badges; sidebar highlights current page; mobile-friendly basics.
- Check that currency, dates and numbers are formatted consistently (₹, 2 decimals, `dd MMM yyyy`).
- Confirm no secret keys are in client bundles; service-role client is only imported in server files.
- If time remains (tier 2): renewal for plans with `allow_renewal`; CSV export on invoices and payments; MRR card polish.

### 5.4 README and deploy (about 15 min)
- `README.md`: what it is, stack, setup steps (env vars, run migrations, seed, create admin, seed demo), commands, the demo accounts, and the 3-minute demo script below.
- Deploy: Vercel project with env vars; Supabase Auth URL configuration (site URL and redirect URLs for `/reset-password`); apply migrations on the production project; run seed and demo seed; smoke-test the live URL.

### 5.5 Demo script (put in README)
1. Customer signs up: show the password rules failing, then success; show forgot-password.
2. Admin: create a product with the Odoo variant (+560), a plan, a tax and a percentage discount.
3. Staff: create a subscription from a quotation template; walk it to Active.
4. Click Run billing: invoices appear with tax and discount; click again: nothing is duplicated.
5. Confirm and send an invoice; record a payment; it turns Paid; show an overdue invoice.
6. Customer portal: only their own data. Finance dashboard with filters on the large dataset, loading fast.

## Acceptance checks (report PASS/FAIL for each)
1. `npm run build` and `npm run test` pass.
2. Live URL works: signup, login, reset email link (points to the live domain), all three demo roles.
3. Demo script steps 1–6 run end-to-end on the deployed site without errors.
4. No customer can reach admin pages or other customers' data; no staff access to admin-only pages.
5. Dashboard and list pages still load under 2 seconds on the deployed site with the perf dataset (if perf data is loaded there; otherwise state this was verified locally).
6. README is accurate; a new person can set up from scratch by following it.

## Handoff
Update `docs/STATE.md` with final status, live URL, accounts and known gaps (list anything cut). Then say "Phase 5 complete".
