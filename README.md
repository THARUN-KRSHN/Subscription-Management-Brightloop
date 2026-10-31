# Brightloop — Phases 1–4

Next.js App Router, TypeScript, Tailwind CSS, shadcn-style UI components, and Supabase Auth/Postgres. Phase 1 includes authentication, roles, customers, staff provisioning, and the catalogue. Phase 2 adds discount definitions, quotation templates, subscriptions, snapshot pricing, and lifecycle transitions. Phase 3 adds the billing engine, invoice generation with discounts/tax, confirmation/cancellation/sending/printing, payments, and a billing-run endpoint.

## Local setup

1. Use Node.js **22.15+** (Node 22 LTS recommended).
2. Run `npm ci`.
3. Copy `.env.example` to `.env.local` and set:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` — **server only; never prefix with `NEXT_PUBLIC_`**
   - `NEXT_PUBLIC_SITE_URL=http://localhost:3000`
4. Apply the database SQL as described below.
5. Run `npm run dev`, then open `http://localhost:3000`.

Without credentials, public auth pages render with a useful configuration error on submission. Protected pages redirect to login. The production build does not require secrets.

## Apply the schema and seed

In a **fresh Supabase project**, open **SQL Editor**:

1. Paste and run `supabase/migrations/0001_schema.sql` once. It is the exact schema from `00_CONTEXT.md`, including all 16 tables, the Auth trigger, RLS, sequences, and indexes. No RLS policies are created.
2. Paste and run `supabase/seed.sql`. It creates GST 18%, GST 5%, No tax, Immediate, Net 15, and Net 30. Running the seed again does not duplicate rows.
3. Paste and run `supabase/migrations/0002_billing.sql`. It adds billing SQL functions: `period_start_for`, `period_end_for`, `generate_invoice`, `run_billing`, `confirm_invoice`, `cancel_invoice`, and `record_payment`.
4. Paste and run `supabase/migrations/0003_dashboard.sql`. It adds dashboard aggregate functions (`dashboard_summary`, `dashboard_revenue_by_month`, `subscriptions_by_status`) and helpful indexes.

Do not reapply the migration to an already-initialized project. No cloud database was modified by this implementation session.

## Configure Supabase Auth

Under **Authentication → URL Configuration**:

- Set Site URL to the same origin as `NEXT_PUBLIC_SITE_URL`.
- Add `http://localhost:3000/auth/callback` and `http://localhost:3000/reset-password` to allowed redirect URLs.
- Add the corresponding production URLs after deploying. Avoid broad production wildcards.

Email/password Auth must be enabled. With **Confirm email** enabled, signup shows a confirmation message; after confirmation and login the customer lands on `/portal`. With confirmation disabled, signup signs in immediately. The app never accepts role metadata.

The default recovery email's `{{ .ConfirmationURL }}` redirects to `/reset-password?code=…`. Middleware exchanges that PKCE code and redirects to `/reset-password` with session cookies. The default PKCE flow should be completed in the browser that requested the link.

For confirmation/recovery links that also work in another browser, use these Supabase email-template link URLs instead:

```html
<!-- Confirm signup -->
<a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=signup">Confirm your email</a>
<!-- Reset password -->
<a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery">Reset your password</a>
```

The callback verifies the one-time hash on the server and redirects recovery sessions to `/reset-password`. Link expiry, email sending limits, delivery, and production SMTP are configured in Supabase; the application does not bypass them. Forgot-password responses are neutral whether the email is unknown or Supabase returns an error. No browser Supabase client or table access is used.

## Create the first administrator

Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env.local`. Passwords need at least 9 characters, uppercase, lowercase, and a non-alphanumeric character. Then:

```bash
npm run create-admin
```

The script creates an email-confirmed Auth user, sets its profile role to `admin`, and deletes the trigger-created customer row. A setup failure attempts to roll back the new Auth user. Rerunning for an existing admin makes no changes. Existing non-admin accounts are not silently promoted. The script uses the project's TypeScript compiler, so it also works on Node builds without native TypeScript stripping.

Log in at `/login`. Add staff from `/admin/staff`. Staff accounts are email-confirmed and receive a temporary password; share it securely. They can use the password reset flow to change it. Remove bootstrap credentials from your deployment environment after provisioning. No demo passwords are committed.

## Working demo path

1. Admin: create or select GST 18% under **Taxes**.
2. Create **Odoo CRM**, type **Software**, set sales/cost prices and its tax, and save.
3. On the product edit page, add **Brand / Odoo / 560.00** under Product variants.
4. Add a monthly plan with an availability start date, minimum quantity, and all four lifecycle flags enabled. Save and reopen to check persistence.
5. Add a staff account. Log out, log in as staff, and verify only Workspace and Customers appear.
6. Staff can add/edit a customer. Try `/admin/staff`, `/admin/products`, `/admin/plans`, `/admin/taxes`, and `/admin/payment-terms`: each redirects to the staff home.
7. Sign up a customer separately and verify only `/portal` is accessible.
8. List queries use URL filters and `page` / `pageSize` (20 default, 100 maximum). Add enough records or set `?pageSize=1` to verify pagination. Product variants use `variantPage`; the tax selector supports search and `taxPage`, 100 options at a time.

## Phase 3 demo path

1. Create 2–3 subscriptions: go to `/admin/subscriptions/new`, choose a customer, plan, and payment terms; set a past start date for quick billing. Send quotation → Confirm → Activate (sets `next_billing_date = start_date`).
2. Go to `/admin/invoices` and click Run billing. Draft invoices are created for due periods; running again immediately shows Created 0.
3. Open a draft invoice → Confirm. Optionally click Send to mark `sent_at` (email is not required in the demo).
4. Click Print to open a clean printable view (use browser Save as PDF).
5. Record a partial payment, then the balance; status flips to Paid when fully covered. Try overpaying to see validation.
6. Create an active discount and re-run billing to see an applied discount on exactly one eligible invoice (usage limit respected).

## Phase 4 demo path

1. Customer portal
   - Log in as a customer → `/portal` shows Active, Outstanding, and Next-due cards
   - `/portal/subscriptions` → open a subscription and use Pause/Resume/Close (only when plan allows), Accept quotation if applicable
   - `/portal/invoices` → drafts hidden; open detail and use Print (clean A4 view)
2. Finance dashboard
   - `/admin/dashboard` → use quick date chips (Last 30/90/180d, YTD); verify summary cards, invoiced-vs-received chart, Overdue and Recent payments tables
3. Performance (optional)
   - Seed synthetic data in Supabase SQL Editor: `scripts/seed-perf.sql`, then verify pages stay under ~2s; clean with `scripts/cleanup-perf.sql`

## Appearance

- Theme toggle: at the bottom of the sidebar.
  - Modes: Auto (system), Light, Dark. Manual choice is saved in `localStorage` and applied via `data-theme` on `<html>`; system dark is used when no choice exists.
- Table density: append `?density=compact` to list pages (Invoices, Subscriptions, Payments) or use the toggle next to pagination.
- Favicon: green infinity loop (`public/favicon.svg`).

## Verify and deploy

```bash
npm run typecheck
npm run build
npm start
```

Deploy to Vercel using the Next.js preset, Node 22, and the four required application environment variables. Set `NEXT_PUBLIC_SITE_URL` to the production origin, configure Supabase's redirect allowlist, and apply the schema/seed before testing. Email (`RESEND_API_KEY`, `MAIL_FROM`) remains optional; “Send” marks `sent_at` without sending when unset.

## Phase 2 demo path

No new SQL migration is required beyond `0001_schema.sql` and the existing seed.

1. As admin, create a plan available today and on the subscription start date. Set its minimum product quantity and pause/early-close flags.
2. Create products and an optional variant (for example Brand / Odoo / +₹560).
3. Open **Discounts** and define a percentage or fixed rule. These rules are stored only; they are not applied until Phase 3. Used count is read-only.
4. Open **Quotation templates**, create a template with the plan and validity, then add at least one product line. Staff may view/use templates but cannot edit them.
5. As admin or staff, open **Subscriptions → New subscription**, choose a customer and template (or choose a plan manually), payment terms, start date, and expiry. Expiry defaults to one calendar year after start, including leap-day handling.
6. The detail page shows the locked plan-fee line and snapshotted product prices/taxes. Product lines are editable only in Draft/Quotation. Changing the catalogue does not update existing lines unless you explicitly edit a line.
7. Send quotation → Confirm quotation → Activate subscription. Activation sets the next billing date to the start date. Pause/resume requires `allow_pause`. Closed subscriptions show their closure timestamp.
8. Per authoritative context R4, admins/staff may close active/paused subscriptions even if `allow_early_close` is off; draft/quotation cancellation is always allowed. This staff override takes precedence over the conflicting shorthand in Phase 2 acceptance check 7.
9. Filter subscriptions by number, customer, plan, or status and use pagination. Lookup selectors also have searchable, server-paginated options (20 per lookup page).

Demo scope: a quotation template supports up to 99 product lines; a subscription supports those 99 lines plus one locked plan-fee line. Subscription creation uses compensating cleanup if the line insert fails. Line edits and status changes use separate API requests, so simultaneous editing/confirmation is not transactionally serialized in this phase.

See `docs/STATE.md` for routes, helper signatures, acceptance evidence, and remaining limitations. Stop at the Phase 2 handoff before starting billing.
