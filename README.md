# Brightloop — Subscription Management

**Next.js 15 · TypeScript · Tailwind CSS 4 · Supabase Auth + Postgres**

A full-featured SaaS subscription-management platform: customer portal, admin/staff workspace, billing engine with tax and discounts, invoice lifecycle, payment recording, and a finance dashboard.

---

## Table of contents

1. [What it is](#what-it-is)
2. [Tech stack](#tech-stack)
3. [Local setup](#local-setup)
4. [Apply the schema and seed](#apply-the-schema-and-seed)
5. [Configure Supabase Auth](#configure-supabase-auth)
6. [Create the first administrator](#create-the-first-administrator)
7. [Seed demo data](#seed-demo-data)
8. [Demo accounts](#demo-accounts)
9. [Commands](#commands)
10. [3-minute demo script](#3-minute-demo-script)
11. [Deploy to Vercel](#deploy-to-vercel)
12. [Appearance](#appearance)
13. [Phase-by-phase demo paths](#phase-by-phase-demo-paths)

---

## What it is

Brightloop manages software subscriptions end-to-end:

- **Admin workspace** – catalogue (products, variants, plans, taxes, payment terms), discount definitions, quotation templates, subscriptions, invoices, payments, staff management, and a finance dashboard with charts.
- **Staff workspace** – same features except admin-only catalogue management and staff provisioning.
- **Customer portal** – own subscriptions (with Pause/Resume/Close/Accept), own invoices with print view, and a summary home.
- **Billing engine** – `run_billing` generates draft invoices anchored to the subscription start date (month-end safe, idempotent), applies the best eligible discount atomically, computes per-line GST, and accumulates totals without floating-point arithmetic.
- **Payment tracking** – partial and full payments on confirmed invoices; invoice flips to `paid` when fully covered.

---

## Tech stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 15 App Router, React 19, TypeScript |
| Styling | Tailwind CSS 4 (vanilla CSS variables), Lucide icons |
| UI primitives | shadcn-style Button/Input/Badge, shared DataTable/StatusBadge/PageHeader |
| Auth + DB | Supabase Auth + Postgres (SSR cookie client) |
| Charts | Recharts (dashboard) |
| Node | 22.15+ (LTS) |

---

## Local setup

1. **Node 22.15+** (use `nvm use 22` or install from [nodejs.org](https://nodejs.org)).
2. Clone the repo and run:
   ```bash
   npm ci
   ```
3. Copy `.env.example` → `.env.local` and fill in:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key   # server only
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   ```
4. Apply the database SQL (see next section).
5. Create the first administrator:
   ```bash
   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='SecureP@ss1' npm run create-admin
   ```
   Or add them to `.env.local` temporarily.
6. Start the dev server:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000`.

---

## Apply the schema and seed

In your **Supabase project → SQL Editor**, run these files **once** in order:

| Step | File | What it does |
|------|------|--------------|
| 1 | `supabase/migrations/0001_schema.sql` | 16 tables, Auth trigger, RLS (no policies → service-role only), sequences, indexes |
| 2 | `supabase/seed.sql` | GST 18%, GST 5%, No tax, Immediate, Net 15, Net 30 (idempotent) |
| 3 | `supabase/migrations/0002_billing.sql` | Billing functions: `period_start_for`, `period_end_for`, `generate_invoice`, `run_billing`, `confirm_invoice`, `cancel_invoice`, `record_payment` |
| 4 | `supabase/migrations/0003_dashboard.sql` | Dashboard aggregates: `dashboard_summary`, `dashboard_revenue_by_month`, `subscriptions_by_status`; performance indexes |

Do **not** re-run migrations on an already-initialized project.

---

## Configure Supabase Auth

**Authentication → URL Configuration** in the Supabase dashboard:

- **Site URL**: same as `NEXT_PUBLIC_SITE_URL`.
- **Redirect URLs**: add
  - `http://localhost:3000/auth/callback`
  - `http://localhost:3000/reset-password`
  - (plus production equivalents after deploying)

Enable **Email + Password** sign-in. Leave "Confirm email" enabled for production; it can be disabled locally.

**Optional – email templates** (cross-browser links):
```html
<!-- Confirm signup -->
<a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=signup">Confirm your email</a>
<!-- Reset password -->
<a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery">Reset your password</a>
```

---

## Create the first administrator

Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` (≥ 9 chars, uppercase, lowercase, special character) in `.env.local`, then:

```bash
npm run create-admin
```

- Creates an email-confirmed Auth user, sets `role = admin`, removes the trigger-created customer row.
- Rerunning for an existing admin is a no-op. Existing non-admin accounts are refused, not silently promoted.

Log in at `/login`. Add staff from `/admin/staff`.

---

## Seed demo data

After creating the administrator, populate the demo dataset:

```bash
npm run seed-demo
```

This is **idempotent** — safe to run multiple times. It creates:

- Four demo accounts (see below)
- Products, plans, taxes, payment terms, a quotation template
- Three discounts (active percentage, active fixed, expired)
- Subscriptions in every status (draft, quotation, confirmed, active, paused, closed)
- Invoices in draft, confirmed, and paid states
- Sample payments via different methods
- Two active subscriptions left unbilled for the live `Run billing` demo

---

## Demo accounts

| Email | Password | Role |
|-------|----------|------|
| `admin@demo.test` | `Brightloop@2026!` | Admin |
| `staff@demo.test` | `Brightloop@2026!` | Staff |
| `customer@demo.test` | `Brightloop@2026!` | Customer (customer 1) |
| `customer2@demo.test` | `Brightloop@2026!` | Customer (customer 2) |

> **Note**: Replace these credentials with your own production passwords before deploying to a customer-facing environment.

Your first administrator was created separately with `npm run create-admin` using the credentials in `.env.local`.

---

## Commands

```bash
npm run dev           # Dev server (http://localhost:3000)
npm run build         # Production build
npm run start         # Serve the production build
npm run typecheck     # TypeScript check (no emit)
npm run create-admin  # Bootstrap the first admin account
npm run seed-demo     # Load demo dataset (idempotent)
npm run test          # Phase 5 automated test suite
```

---

## 3-minute demo script

### Step 1 — Customer signup (30 s)
1. Open `/signup` in an incognito tab.
2. Type a **weak password** (e.g. `password`) → show the live rule hints failing.
3. Type `Brightloop@2026!` → all rules green; submit.
4. Show `/forgot-password` → neutral response regardless of whether the email exists.

### Step 2 — Admin: catalogue setup (30 s)
1. Log in as `admin@demo.test`.
2. Go to **Products → DEMO Odoo CRM** → show the **Brand / Odoo / +₹560** variant already added.
3. Go to **Plans** → open **DEMO Monthly Plan** → show all lifecycle flags.
4. Go to **Discounts** → show the active percentage discount (limit 3), fixed product discount, and the expired one.

### Step 3 — Staff: create a subscription from a template (30 s)
1. Log in as `staff@demo.test`.
2. Go to **Subscriptions → New subscription → Use template → DEMO Standard Template**.
3. Select `Demo Customer One`, set a past start date, choose Net 15 terms.
4. Walk it: **Send quotation → Confirm quotation → Activate**.

### Step 4 — Run billing (30 s)
1. Go to **Invoices → Run billing** (or as `admin@demo.test`).
2. Draft invoices appear with tax and discount applied.
3. Click **Run billing** again → `Created: 0` — idempotency demonstrated.

### Step 5 — Invoice lifecycle and payment (30 s)
1. Open a draft invoice → **Confirm** → **Send** (marks `sent_at`).
2. **Record payment** (partial) → status stays Confirmed.
3. **Record payment** (remaining balance) → status flips to **Paid**.
4. Show an overdue invoice (confirmed, past due date → red Overdue badge).

### Step 6 — Customer portal + dashboard (30 s)
1. Log in as `customer@demo.test`.
2. `/portal` → Active, Outstanding, Next-due summary cards.
3. **Subscriptions** → open one → show Pause/Resume/Close actions (plan-dependent).
4. **Invoices** → drafts hidden; open a paid invoice → Print.
5. Log in as admin → **Workspace** dashboard → use date chips, see charts, overdue table.

---

## Deploy to Vercel

1. Push the repo to GitHub / GitLab.
2. Import in [Vercel](https://vercel.com) — select **Next.js** preset, **Node 22**.
3. Set environment variables in Vercel dashboard:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_SITE_URL=https://your-production-domain.vercel.app`
4. In Supabase Auth settings, add:
   - `https://your-production-domain.vercel.app/auth/callback`
   - `https://your-production-domain.vercel.app/reset-password`
5. Apply migrations to the production Supabase project (SQL Editor).
6. Run `npm run create-admin` (with production `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`) to create the production admin.
7. Run `npm run seed-demo` for the demo dataset.
8. Open the live URL and smoke-test signup, login, reset-password link, all three demo roles, and the billing run.

**Optional**: set `RESEND_API_KEY` and `MAIL_FROM` to enable actual email delivery for the "Send" invoice action. Without them, `sent_at` is set in the database but no email is dispatched.

---

## Appearance

- **Theme toggle**: bottom of the sidebar — Auto (system), Light, Dark. Saved in `localStorage`.
- **Table density**: append `?density=compact` to any list page or use the density toggle in the table footer.
- **Favicon**: green infinity loop (`public/favicon.svg`).

---

## Phase-by-phase demo paths

<details>
<summary>Phase 1 – Foundation, auth, catalogue</summary>

1. Sign up a customer → check portal access only.
2. Log in as admin → Products, Plans, Taxes, Payment terms, Staff.
3. Add a staff account → log in → verify restricted navigation.
4. Try `/admin/staff` as staff → redirected.

</details>

<details>
<summary>Phase 2 – Discounts, quotation templates, subscriptions</summary>

1. Admin: create a discount definition (percentage, usage limit).
2. Admin: create a quotation template with product lines.
3. Staff: create subscription from template → walk lifecycle: Draft → Quotation → Confirmed → Active.
4. Test pause/resume (requires `allow_pause`), early close override for staff.

</details>

<details>
<summary>Phase 3 – Billing, invoices, payments</summary>

1. Create 2–3 active subscriptions with a past start date.
2. Run billing → draft invoices with tax and discount.
3. Confirm → Send → Print (browser Save as PDF).
4. Record partial then full payment → Paid.
5. Try overpaying → validation error.

</details>

<details>
<summary>Phase 4 – Customer portal, dashboard, performance</summary>

1. Customer portal: own subscriptions and invoices only.
2. Finance dashboard: date chips, summary cards, invoiced-vs-received chart.
3. Optional: apply `scripts/seed-perf.sql` in Supabase SQL Editor, verify pages stay under ~2s.

</details>

---

See `docs/STATE.md` for full route inventory, SQL function signatures, acceptance evidence, and known gaps.
