# PHASE 1 of 5 — Foundation, Auth, Roles, Customers, Staff, Catalogue

Time box: about 1h45. Prerequisite: `00_CONTEXT.md` is uploaded (read it fully; schema and rules live there). Nothing exists yet.

## Goal
A running, deployable app where anyone can sign up, log in and reset a password; three roles are enforced; the admin can create staff; staff/admin can manage customers; and the admin can set up taxes, payment terms, products with variants, and plans.

## Tasks

### 1.1 Project setup (about 15 min)
- Scaffold Next.js (App Router, TypeScript, Tailwind), install shadcn/ui, zod, date-fns, lucide-react.
- Create the folder layout from section 4 of `00_CONTEXT.md`.
- `lib/supabase/server.ts` (cookie-based client using `@supabase/ssr`) and `lib/supabase/admin.ts` (service-role client; server only).
- `lib/money.ts` (toCents, fromCents, formatMoney in ₹), `lib/pagination.ts` (parse `page`/`pageSize` from search params, return `{rows, total, page, pageSize}`), `lib/validation.ts` with `validatePassword()` (rule R1) and zod schemas as needed.
- `components/`: `DataTable` (server-paginated table with prev/next), `StatusBadge`, `PageHeader`, app layout with a sidebar whose menu depends on role.
- Create `.env.example` listing all env vars from section 3 of the context.

### 1.2 Database (about 10 min)
- Write `supabase/migrations/0001_schema.sql` exactly as given in section 6 of `00_CONTEXT.md`. Provide the command or steps to apply it (Supabase SQL editor or CLI).
- Write `supabase/seed.sql` (idempotent): taxes (GST 18%, GST 5%, No tax 0%); payment terms (Immediate 0, Net 15 15, Net 30 30).

### 1.3 Authentication (about 25 min)
- Pages: `/signup`, `/login`, `/forgot-password`, `/reset-password`; logout action.
- Signup: server action validates email format and `validatePassword()`, checks the email is not already registered (friendly error), calls `supabase.auth.signUp` with `full_name` metadata only. The DB trigger creates the profile and customer row as role `customer`. Never send a role from the client.
- Show live password-rule hints on the signup and reset forms (all four rules).
- Forgot password: `resetPasswordForEmail` with redirect to `/reset-password`; same neutral message regardless of whether the email exists. Reset page validates the new password with the same function and calls `updateUser`.
- `lib/auth.ts`: `getSessionUser()` returns `{id, email, role, customerId|null}` by reading the session then the `profiles` row (service-role client); `requireRole(roles[])` redirects to `/login` if unauthenticated and to the user's home if the role is not allowed.
- `middleware.ts`: refresh the session; unauthenticated users on `/admin` or `/portal` go to `/login`; customers visiting `/admin/*` are sent to `/portal`; admin/staff visiting `/portal` are sent to `/admin`. Inactive profiles cannot log in.
- After login: customer → `/portal`, staff/admin → `/admin/dashboard` (the dashboard page may be a placeholder until Phase 4).
- `scripts/create-admin.ts`: creates the first admin from `ADMIN_EMAIL` / `ADMIN_PASSWORD` env vars (create auth user with email confirmed, then set `profiles.role='admin'` and delete that user's auto-created customer row).

### 1.4 Staff and customers (about 20 min)
- `/admin/staff` (admin only): list staff and admins; "Add staff" form (name, email, temporary password validated by R1) → service-role `auth.admin.createUser` (email confirmed) → set role `staff`, delete the auto-created customer row. Staff cannot open this page or call this action.
- `/admin/customers` (admin + staff): paginated, searchable list (name/company/email); create/edit form (company, contact, email, phone, address). Customers created here have no login (`profile_id` null).

### 1.5 Catalogue (admin only; about 35 min)
- `/admin/taxes`: CRUD (name, rate %, active).
- `/admin/payment-terms`: CRUD (name, due days).
- `/admin/products`: list + create/edit with name, type, sales price, cost price, notes, tax (select), active. On the same edit page manage **variants** inline (attribute, value, price adjustment; e.g. Brand / Odoo / 560). Archive (set inactive) instead of delete.
- `/admin/plans`: list + create/edit with name, price, billing period (daily/weekly/monthly/yearly), minimum quantity, available from/to (validate to ≥ from), checkboxes `auto_close`, `allow_early_close`, `allow_pause`, `allow_renewal`, active.
- All these pages and their actions use `requireRole(['admin'])`. Staff get no menu entries for them.

### 1.6 State file
- Create `docs/STATE.md` from the template in section 9 of the context and fill it in.

## Acceptance checks (report PASS/FAIL for each)
1. `npm run build` passes; migration applies on a fresh database; seed runs twice without errors.
2. Signup rejects: password of 8 characters, missing uppercase, missing lowercase, missing special character; accepts a 9+ character password with all four. Duplicate email shows a friendly error.
3. Forgot-password sends an email with a link that reaches `/reset-password` and lets the user set a new valid password.
4. A new signup is a `customer`, lands on `/portal`, and gets redirected away from every `/admin/*` URL.
5. Admin can create a staff user; that staff user can log in, sees customers but NOT staff/products/plans/taxes (menu hidden AND direct URL/action blocked).
6. Staff cannot create another staff user even by calling the action directly.
7. Admin creates product "Odoo CRM" with a Brand variant "Odoo" +560, a tax, and a monthly plan with all four flags; data persists and lists paginate.

## Do NOT do in this phase
Discounts, quotation templates, subscriptions, invoices, payments, dashboards, portal pages beyond an empty `/portal` page with the user's name and a logout button.

## Handoff
Update `docs/STATE.md` (routes, helper signatures, how to create the admin, env vars needed). Then stop and say "Phase 1 complete".
