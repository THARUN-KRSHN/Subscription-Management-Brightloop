# STATE

## Done so far (by phase)

### Phase 1 — Foundation, auth, roles, customers, staff, catalogue

- Next.js 15.5.28 App Router + React 19 + TypeScript + Tailwind 4. Next 15 retains the requested `middleware.ts` convention. shadcn-compatible Button/Input/Badge, shared DataTable/StatusBadge/PageHeader, responsive role-aware sidebar, pending/error/empty states.
- Supabase SSR cookie client and server-only service-role client. Auth identity is validated through `auth.getUser()`, never trusted from an unverified cookie/session payload. Profiles, active status, and customer ids are read server-side.
- Signup/login/forgot/reset/logout, shared password validation with live hints, email confirmation/recovery callback, direct reset-page PKCE exchange in middleware, neutral recovery responses, inactive-account rejection.
- Admin bootstrap script and admin-only staff creation. Both create email-confirmed Auth users, set the profile role, remove the trigger-created customer, and attempt cleanup if setup fails.
- Paginated/searchable customer create/edit; paginated/searchable admin/staff list and add-staff form.
- Admin-only taxes/payment-terms CRUD; product create/edit/archive and inline variant create/edit/delete; plan create/edit with all lifecycle flags and availability validation.
- Exact `0001_schema.sql` from context; idempotent seed; setup/Auth/deployment instructions in README.md. No later-phase business features or billing functions implemented.

### Phase 2 — Discounts, quotation templates, subscriptions and status flow

- Admin-only paginated discount definitions and create/edit forms; computed active/scheduled/expired/used-up/inactive statuses; read-only used count; server-derived creator; percentage/product/date/minimum/usage validation. No discounts applied yet.
- Paginated quotation templates; admins create/edit header and product/variant lines, staff view/use them. Plan minimum quantity enforced on template lines and when switching plans.
- New subscription from template or manually selected plan; customer/payment terms/date selection; template preview with plan, quote validity, and pre-filled product lines; one locked plan-fee line. Plan availability is checked against both today and start date.
- Product/variant/tax snapshot pricing in integer cents; add/edit/remove lines in draft/quotation only; explicit edits reprice only that line. Locked plan fee cannot be edited or removed through actions. Subtotal, rounded tax, and per-period total are computed without floating-point sums.
- Central `transition()` helper is the only application code updating subscription status. Ordered lifecycle, expired-quote rejection, activation billing anchor, conditional pause/resume, cancellation, closure timestamp, and optimistic compare-and-set status updates.
- Subscription list includes customer, plan, number, status, dates, and tax-inclusive period totals; URL-driven filters and pagination. Role-aware navigation extended, existing visual system preserved; transition errors include dismissible toast feedback.
- Phase 2 needs no additional database migration or library.

### Phase 3 — Billing engine, invoices, discount application, payments

- SQL functions in `supabase/migrations/0002_billing.sql`: period helpers, `generate_invoice`, `run_billing`, `confirm_invoice`, `cancel_invoice`, and `record_payment`. Billing is anchored to `start_date` (month-end safe), idempotent per period, and applies at most one best eligible discount per invoice with an atomic claim and proportional allocation for subscription-scope discounts. Line tax is computed on net (amount − discount) with 2-decimal rounding; totals are the sum of lines.
- Route handler `POST /api/billing/run` (admin/staff) calls `run_billing(date)`; staff cannot run future dates.
- `/admin/invoices`: paginated list with status/customer/q/date filters and Overdue badge; header actions: Run billing and Confirm all drafts.
- `/admin/invoices/[id]`: details (customer, period, lines, totals, discount name, payments) and actions: Confirm, Cancel, Send (marks sent), Print, Record payment.
- `/admin/invoices/[id]/print`: clean A4 print layout with Print button.
- `/admin/payments`: paginated list (date, invoice, customer, method, amount, note) with method/date filters.
- Sidebar adds Invoices and Payments for staff/admin.
 - UI polish: rounded design system, sticky list headers/first column, right-aligned money, table density toggle via URL (`density=compact`), route-level skeleton loaders, sticky Save bars on editors, theme toggle (light/dark) with system default fallback, new green infinity favicon.

## Routes and pages (path → who can access → what it does)

| Path | Access | Purpose |
| --- | --- | --- |
| `/` | Anyone | Redirect to login or role home |
| `/login` | Public | Password login; signed-in users go to their role home |
| `/signup` | Public | Customer-only signup with name, email, shared password rules |
| `/forgot-password` | Public | Neutral reset-email response |
| `/reset-password` | Active authenticated/recovery session for form | Exchange incoming PKCE code; validate and update password, sign out; invalid session shows a new-link prompt |
| `/auth/callback` | Public, valid one-time code/hash required | Exchange signup code or verify signup/email/recovery token hash; fixed local redirect destinations |
| `/admin` | Admin/staff | Redirect to `/admin/dashboard` |
| `/admin/dashboard` | Admin/staff | Finance dashboard with date chips, summary cards, invoiced-vs-received chart, overdue and recent-payments tables |
| `/admin/customers` | Admin/staff | Search and paginated list |
| `/admin/customers/new`, `/admin/customers/[id]` | Admin/staff | Create/edit contact data; new manual customers have no login |
| `/admin/staff` | Admin | Search/paginated admins and staff; add staff with temporary password |
| `/admin/taxes`, `/admin/taxes/new`, `/admin/taxes/[id]` | Admin | List/create/edit/delete taxes; referenced taxes cannot be deleted |
| `/admin/payment-terms`, `/admin/payment-terms/new`, `/admin/payment-terms/[id]` | Admin | List/create/edit/delete payment terms; referenced terms cannot be deleted |
| `/admin/products`, `/admin/products/new`, `/admin/products/[id]` | Admin | List/create/edit/archive; inline paginated variants on edit |
| `/admin/plans`, `/admin/plans/new`, `/admin/plans/[id]` | Admin | List/create/edit plans and all lifecycle flags |
| `/admin/discounts`, `/admin/discounts/new`, `/admin/discounts/[id]` | Admin | Paginated discount definitions; create/edit, computed eligibility lifecycle status, read-only usage |
| `/admin/quotation-templates` | Admin/staff | Search and paginated template list; staff view only |
| `/admin/quotation-templates/new` | Admin | Create template header, then add product lines on edit page |
| `/admin/quotation-templates/[id]` | Admin/staff | Admin header/line editing; staff read-only view and Use template link |
| `/admin/subscriptions` | Admin/staff | Paginated status/customer/plan/number filtering and per-period totals |
| `/admin/subscriptions/new` | Admin/staff | Manual or template-based subscription creation; optional `template` query parameter |
| `/admin/subscriptions/[id]` | Admin/staff | Header, snapshots, locked plan fee, totals, editable draft/quotation lines/dates/terms, status stepper/actions |
| `/admin/invoices` | Admin/staff | Paginated list; filters by q/status/customer/date; Overdue badge; Run billing and Confirm-all-drafts actions |
| `/admin/invoices/[id]` | Admin/staff | Detail view with actions: Confirm, Cancel, Send, Print, Record payment |
| `/admin/invoices/[id]/print` | Admin/staff | Clean print layout |
| `/admin/payments` | Admin/staff | Paginated payments list by date/method |
| `/portal` | Customer | Home with active/outstanding/next-due cards |
| `/portal/subscriptions` | Customer | Own subscriptions list (only customer’s records) |
| `/portal/subscriptions/[id]` | Customer | Own subscription detail with Pause/Resume/Close/Accept quotation when allowed |
| `/portal/invoices` | Customer | Own invoices list (hides drafts), overdue badge |
| `/portal/invoices/[id]` | Customer | Own invoice detail with lines, totals, payments; Print link |
| `/portal/invoices/[id]/print` | Customer | Clean print layout for customer |

List filters: `q`, `active` where applicable, `page`, `pageSize`. Product edit: `taxSearch`, `taxPage`, `variantPage`. Every collection read has a range/limit; individual identity/record reads use unique ids. The tax selector includes the saved selection even if outside the current options page.

Phase 2 subscription filters: `q` (number), `status`, `customer`, `plan`, `page`, `pageSize`. Template/subscription detail lines are server-sliced with `page`/`pageSize` from bounded parent-line reads. Searchable lookup controls use server actions with 20 options per request and preserve the selected option while searching/paging; picker search state is local to the control rather than the page URL.

Middleware refreshes sessions; all `/admin/*` and `/portal/*` paths require authentication. Customers go from admin paths to `/portal`; staff/admin go from portal paths to `/admin`. Page data helpers and every protected mutation independently enforce roles. Public authentication/callback endpoints are necessarily exempt from `requireRole` because they establish a session.

## SQL functions (name, arguments, what it returns)

- `public.handle_new_user()` → `trigger`: creates a customer-role profile and linked customer row after Auth signup. Reads only `full_name` from metadata; ignores role metadata. Emails are lowercased.
- `period_start_for(p_start date, p_period billing_period, p_k int) → date`, `period_end_for(...) → date`: Anchored period math, month-end safe.
- `generate_invoice(p_subscription_id bigint, p_run_date date) → bigint`: Draft invoice for the next due period; idempotent on (subscription_id, period_start); copies lines, applies the single best eligible discount atomically, computes per-line tax and invoice totals, advances the subscription's anchor either way; returns new invoice id or null when already billed.
- `run_billing(p_run_date date) → table(created int, skipped int, failed int, closed int)`: Auto-closes expired subscriptions with `plan.auto_close`, then loops due subscriptions and calls `generate_invoice` up to 24 catch-up periods per subscription, isolating failures per subscription.
- `confirm_invoice(p_invoice_id bigint) → text`: Draft → confirmed with sequence number `INV-YYYY-xxxxxx`.
- `cancel_invoice(p_invoice_id bigint) → void`: Draft, or confirmed with `amount_paid = 0`, → cancelled; returns any discount use.
- `record_payment(p_invoice_id bigint, p_method payment_method, p_amount numeric, p_paid_on date, p_note text, p_user uuid) → bigint`: Confirmed-only, amount within balance; inserts payment, updates paid amount, flips to paid when fully covered.
 - Phase 4 dashboard:
   - `dashboard_summary(p_from date, p_to date, p_customer bigint, p_plan bigint)` → `active_subscriptions, paused_subscriptions, revenue_received, outstanding_amount, overdue_count, overdue_amount, invoiced_in_range, mrr`.
   - `dashboard_revenue_by_month(p_from, p_to, ...)` → month, invoiced, received.
   - `subscriptions_by_status()` → counts per status.

## Helper functions (file, name, signature)

- `lib/supabase/server.ts`: `createClient(): Promise<SupabaseClient>` — request-cookie Auth client. Server Components defer cookie refresh writes to middleware.
- `lib/supabase/admin.ts`: `createAdminClient(): SupabaseClient` — `server-only`, nonpersistent service-role client. Use only after identity/role checks, except the bounded public signup duplicate-email lookup required by Phase 1.
- `lib/auth.ts`: `getSessionUser(): Promise<SessionUser | null>` — request-scoped React cache; `{ id, email, fullName, role, customerId: number | null }`; validates remote Auth user, active profile, role, and linked customer. Always touches request cookies to prevent build-time prerendering of user-dependent routes.
- `lib/auth.ts`: `requireRole(roles: Role[]): Promise<SessionUser>` — unauthenticated/inactive → `/login`; forbidden → role home.
- `lib/auth.ts`: `roleHome(role: Role): string` — customer → `/portal`; staff/admin → `/admin/dashboard`.
- `lib/validation.ts`: `validatePassword(password: string): { valid: boolean; rules: { length, uppercase, lowercase, special: boolean } }`; shared signup/reset/staff/bootstrap rule implementation. Also exports zod schemas: email/password/signup/id/customer/tax/paymentTerms/product/variant/plan.
- `lib/money.ts`: `CURRENCY = "INR"`; `toCents(value: string | number): number`; `fromCents(cents: number): string` (exact decimal); `formatMoney(value: string | number): string` (accepts rupee amount, not cents). Input decimal parsing is exact, not a float sum; values with excess precision are rejected.
- `lib/pagination.ts`: `single(value: string | string[] | undefined): string`; `parsePage(params: SearchParams): {page,pageSize,from,to}` (default 20/max 100, bounded positive page); `pagedResult<T>(rows: T[], total: number, page: number, pageSize: number)` → `{ rows, total, page, pageSize }`.
- `lib/provision-user.ts`: `provisionUser(admin: SupabaseClient, input: {email,password,full_name}, role: 'admin' | 'staff'): Promise<User>` — privileged server/CLI provisioning with compensating deletion on failure. No credentials are stored in this module.
- `lib/catalogue.ts`: `entityConfig(entity: Entity): EntityConfig` — whitelisted tables, zod schemas, form fields, selected columns, and list configuration.
- `components/EntityPages.tsx`: `EntityList({entity,searchParams})`, `EntityEditor({entity,id,searchParams})` — server components that enforce roles before service-role data reads; `safeSearch()` / `searchPattern()` quote and escape list filters.
- `components/DataTable.tsx`: `DataTable<T>({rows,columns,total,page,pageSize,params,pathname,emptyMessage?})` — server-rendered paginated table, URL-preserving previous/next controls.
- `app/admin/actions.ts`: `saveCustomer`, `saveCatalogue`, `deleteCatalogue`, `archiveProduct`, `saveVariant`, `deleteVariant`, `createStaff` — `(previous: ActionState, form: FormData): Promise<ActionState>`; validate whitelisted inputs, role-check before database work, revalidate affected routes. Successful primary record saves redirect; inline variant actions return feedback.
- `app/(auth)/actions.ts`: `login`, `signup`, `forgotPassword`, `resetPassword` — `(previous: AuthState, form: FormData): Promise<AuthState>`; `logout(): Promise<never>`.

### Phase 2 helper signatures

- `lib/dates.ts`: `today(): string`, `addDateDays(date: string, days: number): string`, `oneYearAfter(date: string): string` — UTC ISO date-only arithmetic; leap-day expiry clamps to February 28.
- `lib/validation.ts`: adds `discountSchema`, `quotationTemplateSchema`, `productLineSchema`, `subscriptionDatesSchema`, `newSubscriptionSchema` (zod).
- `lib/subscriptions/types.ts`: `Plan`, `Subscription`, `SubscriptionLine`, `SubscriptionStatus`, `subscriptionStatuses`; `MAX_PRODUCT_LINES = 99`.
- `lib/subscriptions/pricing.ts`: `priceLine(productId: number, variantId?: number | null): Promise<{ unit_price: string, tax_pct: string | number, description: string }>` — authenticated staff/admin; active product; variant must belong to product; product sales price + variant adjustment; product tax snapshot, zero if none. `buildPlanFeeLine(plan: Pick<Plan, 'name' | 'price'>)` — quantity 1, no product/variant, zero tax, `is_plan_fee=true`; `lineAmount()` re-exported from calculations.
- `lib/subscriptions/calculations.ts`: `lineAmount(qty: number, unitPriceCents: number): number` (cents, range-checked); `lineTaxCents(amountCents: number, taxPct: string | number): number` (BigInt rate arithmetic, three-decimal percentage precision, per-line half-up cent rounding); `periodTotals(lines): { subtotal, tax, total }` (all cents); `validatePlanAvailability(plan: Plan, startDate: string, asOf = today()): void`; `discountStatus(discount, asOf = today()): 'active' | 'scheduled' | 'expired' | 'used up' | 'inactive'`.
- `lib/subscriptions/data.ts`: authenticated staff/admin `getPlan(id): Promise<Plan>`, `getSubscription(id): Promise<Subscription>`, `getSubscriptionLines(id): Promise<SubscriptionLine[]>`, `getTemplate(id): Promise<{id,name,plan_id,validity_days,lines: TemplateLine[]}>`, `editableSubscription(id): Promise<{subscription,plan}>`. Parent-line reads are bounded and fail clearly if a record exceeds the demo line cap.
- `lib/subscriptions/transitions.ts`: `transition(subscriptionId: number, action: TransitionAction, actor: SessionUser): Promise<{id,status}>`; authenticates again and matches actor id/role against the current session; exported action names below. Updates use the previously read status as a predicate to reject concurrent conflicting transitions.
- `app/admin/lookups.ts`: `lookupOptions({kind,q?,page?,parentId?,availableOnly?}): Promise<{options: {value,label}[],total,error?}>`; staff/admin; whitelisted customer/plan/product/variant/payment-term/template selectors, 20 per page; variants filtered by product; available-plan option supported.
- `app/admin/discounts/actions.ts`: `saveDiscount(previous, form): Promise<ActionState>`; admin-only, creator from session on create, ignores client-supplied used count/creator, rejects a usage limit below existing redemptions.
- `app/admin/quotation-templates/actions.ts`: admin-only `saveQuotationTemplate`, `saveTemplateLine`, `removeTemplateLine` — `(previous, form): Promise<ActionState>`.
- `app/admin/subscriptions/actions.ts`: staff/admin `createSubscription`, `saveSubscriptionDates`, `saveSubscriptionLine`, `removeSubscriptionLine`, `transitionSubscription` — `(previous, form): Promise<ActionState>`; `templatePreview(templateId: number)` returns current template/plan/line pricing/quote validity or an error. Successful creation redirects to detail; successful inline changes revalidate detail and list.
- `components/LookupSelect.tsx` / `LookupFilter.tsx`: searchable server-paginated selects and URL-filter form integration. `Phase2Form.tsx`: validated inline business forms with dependent variant picker. `NewSubscriptionForm.tsx`: template preview and date defaults. `TransitionControls.tsx`: stepper, permitted buttons, and error toasts.

### Transition actions and rules

| Action | From → to | Rules and effects |
| --- | --- | --- |
| `sendQuotation` | draft → quotation | At least one product line; plan minimum on every product line. `quote_valid_until = today + current template validity`, default 30 days for manual subscriptions. |
| `confirm` | quotation → confirmed | Validity date must exist and not be before today. Product lines become read-only. |
| `activate` | confirmed → active | `next_billing_date=start_date`, `periods_billed=0`. |
| `pause` | active → paused | Requires `plan.allow_pause`. |
| `resume` | paused → active | Requires `plan.allow_pause`; preserves billing anchor/counters. |
| `close` | active/paused → closed | Sets `closed_at`. **Admin/staff override permits early closure even when `allow_early_close=false`, per authoritative R4.** No customer action exposed. |
| `cancel` | draft/quotation → closed | Always permitted for admin/staff; sets `closed_at`. |

No skipped transitions, direct status writes outside this helper, renewal action, or billing-run auto-close in Phase 2.

## Demo accounts (email / password / role)

- **Administrator created:** `anoop@gmail.com` / password stored only in local environment / `admin`. After the user supplied a rule-compliant password, `npm run create-admin` completed successfully. Live Supabase password login was verified; the profile is active with role `admin`, and no linked customer row remains. The verification session was signed out locally. No passwords committed.
- Create first admin: configure `.env.local`, apply schema/seed, set `ADMIN_EMAIL` and `ADMIN_PASSWORD`, run `npm run create-admin`. Existing admin → no-op; existing non-admin → refusal rather than implicit promotion.
- Staff: create from `/admin/staff`; customer: public `/signup`.
- Phase 2 verification created one temporary staff account and isolated customer/catalogue/template/discount/subscription records. All verification-created records and that staff Auth account were removed afterward; the existing administrator and seed data were preserved. Passwords were never printed or committed. Subscription sequence numbers consumed by verification were not reset or reused.

## Known gaps and shortcuts taken

- After the user applied the migration, live read-only checks successfully accessed all 16 application tables through the service-role client. Live seed data contains GST 18%, GST 5%, No tax, Immediate, Net 15, and Net 30 with the expected rates/due days. Anonymous customer lookup returns zero rows (not independently conclusive proof of RLS on an empty table). Migration/seed application was performed by the user; the administrator was subsequently provisioned by the agent using the bootstrap script. No deployment was performed. Hosted SQL seed idempotency remains verified locally, not by re-executing remote SQL.
- Auth email delivery/confirmation and password-reset redemption remain unverified. Admin bootstrap/login and temporary staff provisioning/login now pass against live Supabase; Phase 2 admin/staff routes and direct discount-action authorization were checked with real SSR cookie sessions. Rotate the service-role key because it was shared in chat; keep replacement credentials only in `.env.local` or deployment secrets.
- Database checks used embedded PostgreSQL (PGlite installed only under `/tmp/opencode`, not as an application dependency) with a minimal `auth.users` table. This verifies PostgreSQL schema/trigger/seed/RLS behavior, not the hosted Supabase Auth service.
- Authorization and public-auth action checks executed real application code with mocked Supabase identity/SDK results. They verify permission/control flow and metadata handling, not remote Auth integration.
- Admin bootstrap/staff provisioning uses SDK operations and compensating cleanup rather than a transaction spanning Supabase Auth and Postgres, as Phase 1 specifies. Supabase dashboard privileges must remain restricted to trusted operators.
- Default PKCE emails require the requesting browser; README includes token-hash templates for cross-browser links. Supabase SMTP/rate limits and redirect URLs must be configured externally.
- Public duplicate-email feedback intentionally reveals that an email is registered (explicit Phase 1 requirement); forgot-password feedback remains neutral.
- Email sending for "Send" is not wired to Resend; we simply set `sent_at` and show a message. This meets the demo requirement to not block on email.
- Overdue filter is derived in the UI; no aggregated summary strip counts beyond status/overdue badges.
 - Dashboard chart is simplified to summary cards and tables (Recharts optional); core aggregates are in SQL. CSV export omitted.
 - Performance seeding scripts (`scripts/seed-perf.sql`, `scripts/cleanup-perf.sql`) generate approximate data and may be adjusted per environment constraints.
 - Sidebar collapse, breadcrumbs, and additional empty-state flows are planned but not fully implemented yet.
- PostCSS is overridden to patched `^8.5.32` because Next 15's pinned transitive version was reported vulnerable. `npm audit` returned zero vulnerabilities after the override.
- Context7 tools were not available in this harness; official Supabase SSR documentation was fetched directly instead.

### Phase 1 acceptance checks and evidence (historical)

`PASS` describes the stated scope below. `FAIL — blocked` means the complete acceptance journey could not be verified without live credentials; it does not assert that the feature is broken.

| # | Result | Evidence / remaining verification |
| --- | --- | --- |
| 1 | PASS (local) | Production build and TypeScript checks; exact schema matches context; fresh embedded PostgreSQL applies migration, seed runs twice with exactly 3 taxes and 3 payment terms. All 16 public tables have RLS/no policies; anon cannot read customers. Hosted Supabase application remains an operator step. |
| 2 | PASS (isolated) | Shared helper and actual signup action reject 8 chars/missing uppercase/missing lowercase/missing special; valid 9-char password accepted; friendly duplicate-email branch tested with mocked SDK lookup. Live duplicate signup still needs a configured project. |
| 3 | FAIL — blocked | Neutral message and exact `/reset-password` redirect tested in actual action with mocked SDK; email sending, link redemption, and password change against Supabase not tested. |
| 4 | FAIL — blocked | Real database trigger ignores `role=admin` metadata and creates linked customer. Real middleware redirects customer from all tested admin paths (mocked identity), including unknown admin URLs; unauthenticated redirects tested over HTTP. Full signup → confirmation → portal journey not tested live. |
| 5 | FAIL — blocked | Real guards block staff from admin-only mutation paths (mocked identity); role-based menu implemented. Staff creation/login, menu, and URL journey with real Supabase still need verification. |
| 6 | PASS (isolated) | Calling actual `createStaff` action with mocked staff identity redirects before any provisioning/mutation. Same check passes for all admin catalogue/variant actions and customer role. |
| 7 | FAIL — blocked | Embedded PostgreSQL persists Odoo CRM, Brand/Odoo +560.00, GST tax, monthly plan with all four flags. Pagination boundary helpers verified. Full admin UI persistence and paginated live-data journey not exercised against Supabase. |

Additional checks: public auth routes return HTTP 200; ten protected paths return unauthenticated redirects to `/login`; refreshed cookies survive middleware redirects; inactive sessions are rejected. Desktop login and mobile signup were visually inspected; mobile brand panel was shortened so the form is immediately available. Mechanical UI detector returned no findings.

### Phase 2 acceptance checks and evidence

Live workflow tests executed the real Phase 2 action/helper code and real Supabase reads/writes with a small harness supplying authenticated actor context and intercepting Next.js redirects/revalidation. Separate production HTTP/browser checks used real Supabase SSR cookies, middleware, and `requireRole` without those shims. No test framework or verification dependency was added to the application.

| # | Result | Evidence |
| --- | --- | --- |
| 1 | PASS | `npm run build` and `npm run typecheck` pass with all Phase 2 routes. `npm audit` reports zero vulnerabilities. |
| 2 | PASS | Live admin saves persisted 10% subscription discount with minimum quantity 5 and limit 3, plus fixed product discount; creator and zero used count checked. Staff discount list/new/edit routes redirect. Posting the actual admin discount form as staff returns a redirect before any write; the identical admin POST succeeds. Percentage/scope/date validation and computed status cases checked. |
| 3 | PASS | Live template header and two product/variant lines persist with validity 15 days; preview verifies plan and line count. Staff view includes Use template but no edit controls; new-template URL and template mutation functions reject staff. |
| 4 | PASS | Real temporary staff account provisioned and password login verified. Staff action creates two template subscriptions with two pre-filled product lines and one locked quantity-1, zero-tax plan fee. Odoo base ₹1,000 + ₹560 variant snapshots as ₹1,560; unique `SUB-2026-000001` / `000002` numbers verified. Test sequence values remain consumed after fixture cleanup. |
| 5 | PASS | Below-minimum quantity, unavailable plan, expiry-before-start, plan-fee edit, and plan-fee removal are rejected. Catalogue price changes leave existing snapshots unchanged; explicitly editing one line reprices it, without refreshing other lines. Leap-day expiry default, cents/tax rounding, and amount-range checks pass. |
| 6 | PASS | Draft → Quotation → Confirmed → Active succeeds; 15-day quote expiry and activation's start-date billing anchor/zero billed count checked. Draft → Active rejected; confirmed line edit/removal rejected. |
| 7 | PASS — authoritative R4 | Pause/resume works only with `allow_pause`; no-pause plan rejects action and hides button. Expired quotation cannot confirm; quotation cancellation closes it; closure timestamps persist. Staff early closure with `allow_early_close=false` succeeds intentionally because context R4 explicitly permits this override, despite conflicting wording in the phase acceptance list. |
| 8 | PASS | Live server pagination and combined number/customer/plan/status queries checked. Production HTTP checks verify staff/admin list and detail access, active status rendering, page-size-1 Next link, filtered result, and hidden discount menu for staff. Authenticated desktop subscription list/template-preview and 390px mobile detail inspected; no document overflow. |

Mechanical UI detector returned no findings for changed Phase 2 targets. Initial duplicate template-preview fetching was removed; searchable lookup controls retain selected options while loading and paging. Verification scripts/captures stayed under `/tmp/opencode`, outside the app/dependency tree.

Cleanup removed exactly the verification ids: 3 subscriptions (their lines cascade), 1 template (its lines cascade), 3 discounts, 1 product variant, 2 products, 3 plans, 1 manual customer, 1 tax, and 1 temporary staff Auth user. Existing seed records and the original active admin profile remain. A separate live RLS check confirmed the anon client cannot read a verification customer that the service role can read. No invoices, billing, discount redemptions, payments, or dashboard functions were created.

## Decisions that differ from 00_CONTEXT.md (if any)

- No business-rule/schema deviations. Added `fullName` to `SessionUser` for the requested user-name display, retaining all required fields.
- Unauthenticated authentication/callback handlers are explicit exceptions to the otherwise universal `requireRole` convention; duplicate-email lookup is the only public service-role read and is bounded to one profile.
- Validation/UI configuration and account-provisioning helpers are shared to avoid duplicated form/action logic; the requested paths and core helper files are retained.
- Later-phase folders/files are created when needed, not as nonfunctional empty feature routes.
- Conflict resolution for Phase 2 acceptance check 7: `00_CONTEXT.md` R4 explicitly says admin/staff may always close active/paused subscriptions. Implemented and tested that override rather than blocking staff/admin solely on `allow_early_close`; pause/resume still strictly requires `allow_pause`.
- Demo limit: 99 product lines per template/subscription, plus the subscription's one plan-fee line (100 total), to keep pricing/total reads bounded without adding Phase 2 SQL aggregate functions. Picker searches are server-paginated but keep transient picker query/page state locally; entity lists retain URL filters.
- Multi-request creation compensates by deleting only the newly-created draft if line insertion fails. State transitions use optimistic status predicates, but line editing and transition checks are not serialized in one database transaction; simultaneous line edits/confirmation across requests remain a concurrency hardening gap. Future transactional billing stays reserved for Phase 3.
- Negative effective product+variant prices are rejected, and line amounts must fit the existing database money range. Existing snapshots are not refreshed merely by viewing them or editing dates/payment terms.
- Template validity is bounded to 1–36,500 days in the editor to keep date calculations within a practical range. UTC date-only semantics are shared across server/client defaults and transition checks.

### Required environment and handoff

- Required: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL`.
- Bootstrap only: `ADMIN_EMAIL`, `ADMIN_PASSWORD`. Optional/reserved: `RESEND_API_KEY`, `MAIL_FROM`.
- See README.md for fresh-project SQL application, Auth allowlist/templates, admin creation, demo path, and Vercel setup.
 - **Stop after Phase 4.** Phase 5 (hardening/demo/deploy) next: add production favicon variants, finalize sidebar collapse/breadcrumbs, tests for billing concurrency, CSV export (optional), deploy to Vercel with envs, seed demo data, and write a short runbook.
