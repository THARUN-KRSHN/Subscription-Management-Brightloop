/**
 * Brightloop Phase 5 – Demo seed (idempotent)
 * Run with: npm run seed-demo
 */

// @ts-check
import { createClient } from "@supabase/supabase-js";

// Inline money helpers
function toCents(value) {
  const match = String(value).trim().match(/^(-?)(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) throw new Error("Invalid money amount");
  const cents = Number(match[2]) * 100 + Number((match[3] ?? "").padEnd(2, "0"));
  return match[1] ? -cents : cents;
}
function fromCents(cents) {
  const absolute = Math.abs(cents);
  return `${cents < 0 ? "-" : ""}${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, "0")}`;
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const db = createClient(url, serviceKey, { auth: { persistSession: false } });

// Strong demo password that meets all rules: 9+ chars, upper, lower, special
const DEMO_PASSWORD = "Brightloop@2026!";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function upsertAuthUser(email, fullName, role) {
  const { data: existing } = await db
    .from("profiles")
    .select("id,role")
    .eq("email", email)
    .maybeSingle();
  if (existing) {
    console.log(`  ↩ ${email} already exists (${existing.role})`);
    return existing.id;
  }

  const { data, error } = await db.auth.admin.createUser({
    email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error || !data.user) throw new Error(`Auth user creation failed for ${email}: ${error?.message}`);

  const uid = data.user.id;

  if (role !== "customer") {
    await db.from("profiles").update({ role }).eq("id", uid);
    await db.from("customers").delete().eq("profile_id", uid);
  }

  console.log(`  ✓ Created ${role}: ${email}`);
  return uid;
}

async function findOrCreate(table, matchCol, matchVal, insertData) {
  const { data: existing } = await db
    .from(table)
    .select("id")
    .eq(matchCol, matchVal)
    .maybeSingle();
  if (existing) return existing.id;
  const { data, error } = await db.from(table).insert(insertData).select("id").single();
  if (error || !data) throw new Error(`Insert into ${table} failed: ${error?.message}`);
  return data.id;
}

// ---------------------------------------------------------------------------
// 1. Demo accounts
// ---------------------------------------------------------------------------
console.log("\n── 1. Demo accounts ──");

await upsertAuthUser("admin@demo.test", "Demo Admin", "admin");
await upsertAuthUser("staff@demo.test", "Demo Staff", "staff");
const cust1Uid = await upsertAuthUser("customer@demo.test", "Demo Customer One", "customer");
const cust2Uid = await upsertAuthUser("customer2@demo.test", "Demo Customer Two", "customer");

const { data: cust1Row } = await db.from("customers").select("id").eq("profile_id", cust1Uid).maybeSingle();
const { data: cust2Row } = await db.from("customers").select("id").eq("profile_id", cust2Uid).maybeSingle();
const cust1Id = cust1Row?.id ?? 0;
const cust2Id = cust2Row?.id ?? 0;

if (!cust1Id || !cust2Id) {
  console.error("Customer rows not found after provisioning. Aborting.");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 2. Catalogue
// ---------------------------------------------------------------------------
console.log("\n── 2. Catalogue ──");

const gst18Id = await findOrCreate("taxes", "name", "GST 18%", { name: "GST 18%", rate_pct: 18, is_active: true });
await findOrCreate("taxes", "name", "GST 5%", { name: "GST 5%", rate_pct: 5, is_active: true });
await findOrCreate("taxes", "name", "No tax", { name: "No tax", rate_pct: 0, is_active: true });
const termsImmediate = await findOrCreate("payment_terms", "name", "Immediate", { name: "Immediate", due_days: 0 });
const termsNet15 = await findOrCreate("payment_terms", "name", "Net 15", { name: "Net 15", due_days: 15 });
const termsNet30 = await findOrCreate("payment_terms", "name", "Net 30", { name: "Net 30", due_days: 30 });
console.log("  ✓ Taxes and payment terms ready");

const productId = await findOrCreate("products", "name", "DEMO Odoo CRM", {
  name: "DEMO Odoo CRM",
  type: "Software",
  sales_price: "1000.00",
  cost_price: "400.00",
  tax_id: gst18Id,
  is_active: true,
  notes: "Demo product – Odoo CRM subscription",
});
console.log(`  ✓ Product: DEMO Odoo CRM (id=${productId})`);

const { data: existingVariant } = await db
  .from("product_variants")
  .select("id")
  .eq("product_id", productId)
  .eq("attribute", "Brand")
  .eq("value", "Odoo")
  .maybeSingle();
let variantId;
if (existingVariant) {
  variantId = existingVariant.id;
} else {
  const { data: v, error: vErr } = await db
    .from("product_variants")
    .insert({ product_id: productId, attribute: "Brand", value: "Odoo", price_adjustment: "560.00" })
    .select("id")
    .single();
  if (vErr || !v) throw new Error(`Variant insert failed: ${vErr?.message}`);
  variantId = v.id;
  console.log(`  ✓ Variant: Brand/Odoo +₹560 (id=${variantId})`);
}

const today = new Date().toISOString().slice(0, 10);

const planDaily = await findOrCreate("plans", "name", "DEMO Daily Plan", {
  name: "DEMO Daily Plan", price: "50.00", billing_period: "daily", min_quantity: 1,
  available_from: "2025-01-01", is_active: true, auto_close: false, allow_early_close: true,
  allow_pause: true, allow_renewal: true,
});
const planWeekly = await findOrCreate("plans", "name", "DEMO Weekly Plan", {
  name: "DEMO Weekly Plan", price: "300.00", billing_period: "weekly", min_quantity: 1,
  available_from: "2025-01-01", is_active: true, auto_close: false, allow_early_close: true,
  allow_pause: false, allow_renewal: false,
});
const planMonthly = await findOrCreate("plans", "name", "DEMO Monthly Plan", {
  name: "DEMO Monthly Plan", price: "1000.00", billing_period: "monthly", min_quantity: 1,
  available_from: "2025-01-01", is_active: true, auto_close: false, allow_early_close: true,
  allow_pause: true, allow_renewal: true,
});
const planYearly = await findOrCreate("plans", "name", "DEMO Yearly Plan", {
  name: "DEMO Yearly Plan", price: "10000.00", billing_period: "yearly", min_quantity: 1,
  available_from: "2025-01-01", is_active: true, auto_close: true, allow_early_close: false,
  allow_pause: false, allow_renewal: true,
});
console.log(`  ✓ Plans: daily(${planDaily}) weekly(${planWeekly}) monthly(${planMonthly}) yearly(${planYearly})`);

const templateId = await findOrCreate("quotation_templates", "name", "DEMO Standard Template", {
  name: "DEMO Standard Template", plan_id: planMonthly, validity_days: 30,
});
const { data: existingTLine } = await db
  .from("template_lines").select("id").eq("template_id", templateId).eq("product_id", productId).maybeSingle();
if (!existingTLine) {
  await db.from("template_lines").insert({ template_id: templateId, product_id: productId, variant_id: variantId, quantity: 2 });
}
console.log(`  ✓ Quotation template: DEMO Standard Template (id=${templateId})`);

// ---------------------------------------------------------------------------
// 3. Discounts
// ---------------------------------------------------------------------------
console.log("\n── 3. Discounts ──");

const discPercentageId = await findOrCreate("discounts", "name", "DEMO 10% Off Subscription", {
  name: "DEMO 10% Off Subscription", kind: "percentage", value: "10.00", scope: "subscription",
  starts_on: "2025-01-01", is_active: true, usage_limit: 3, used_count: 0,
});
const discFixedId = await findOrCreate("discounts", "name", "DEMO ₹100 Off Product", {
  name: "DEMO ₹100 Off Product", kind: "fixed", value: "100.00", scope: "product",
  product_id: productId, starts_on: "2025-01-01", is_active: true, usage_limit: null, used_count: 0,
});
const discExpiredId = await findOrCreate("discounts", "name", "DEMO 5% Off (Expired)", {
  name: "DEMO 5% Off (Expired)", kind: "percentage", value: "5.00", scope: "subscription",
  starts_on: "2024-01-01", ends_on: "2024-12-31", is_active: true, usage_limit: null, used_count: 0,
});
console.log(`  ✓ Discounts: active % (${discPercentageId}), fixed (${discFixedId}), expired (${discExpiredId})`);

// ---------------------------------------------------------------------------
// 4. Subscriptions
// ---------------------------------------------------------------------------
console.log("\n── 4. Subscriptions ──");

async function ensureSubscription(opts) {
  const { data: existing } = await db
    .from("subscriptions").select("id")
    .eq("customer_id", opts.customerId).eq("plan_id", opts.planId).eq("status", opts.status)
    .limit(1).maybeSingle();
  if (existing) {
    console.log(`  ↩ Subscription (${opts.tag}) already exists`);
    return existing.id;
  }

  const patch = {
    customer_id: opts.customerId, plan_id: opts.planId, payment_terms_id: opts.termsId,
    status: opts.status, start_date: opts.startDate, expiry_date: opts.expiryDate,
    periods_billed: opts.periodsBilled ?? 0,
  };
  if (opts.nextBillingDate) patch.next_billing_date = opts.nextBillingDate;
  if (opts.quoteValidUntil) patch.quote_valid_until = opts.quoteValidUntil;
  if (opts.closedAt) patch.closed_at = opts.closedAt;

  const { data: sub, error } = await db.from("subscriptions").insert(patch).select("id").single();
  if (error || !sub) throw new Error(`Subscription insert failed (${opts.tag}): ${error?.message}`);
  const sid = sub.id;

  await db.from("subscription_lines").insert({
    subscription_id: sid, description: opts.lineDesc, quantity: 1,
    unit_price: opts.planPrice, tax_pct: "0", amount: opts.planPrice, is_plan_fee: true,
  });

  if (opts.productId) {
    const unitPrice = opts.unitPrice ?? "1000.00";
    const tax = opts.taxPct ?? "18";
    const amt = fromCents(Math.round(toCents(unitPrice) * 2));
    await db.from("subscription_lines").insert({
      subscription_id: sid, product_id: opts.productId, variant_id: opts.variantId ?? null,
      description: "Odoo CRM – Brand/Odoo", quantity: 2, unit_price: unitPrice,
      tax_pct: tax, amount: amt, is_plan_fee: false,
    });
  }
  console.log(`  ✓ Subscription (${opts.tag}, ${opts.status}, id=${sid})`);
  return sid;
}

const pastStart = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
const futureExpiry = new Date(Date.now() + 275 * 86400000).toISOString().slice(0, 10);
const overdueStart = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10);
const nextMonth = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

await ensureSubscription({ tag: "draft", customerId: cust1Id, planId: planWeekly, termsId: termsNet30, status: "draft", startDate: today, expiryDate: futureExpiry, planPrice: "300.00", lineDesc: "DEMO Weekly Plan fee", productId, variantId, unitPrice: "1560.00", taxPct: "18" });
await ensureSubscription({ tag: "quotation", customerId: cust2Id, planId: planDaily, termsId: termsNet15, status: "quotation", startDate: today, expiryDate: futureExpiry, quoteValidUntil: nextMonth, planPrice: "50.00", lineDesc: "DEMO Daily Plan fee", productId });
await ensureSubscription({ tag: "confirmed", customerId: cust1Id, planId: planYearly, termsId: termsImmediate, status: "confirmed", startDate: today, expiryDate: futureExpiry, planPrice: "10000.00", lineDesc: "DEMO Yearly Plan fee", productId, variantId });

const activeSub1Id = await ensureSubscription({ tag: "active-c1", customerId: cust1Id, planId: planMonthly, termsId: termsNet15, status: "active", startDate: pastStart, expiryDate: futureExpiry, nextBillingDate: pastStart, periodsBilled: 0, planPrice: "1000.00", lineDesc: "DEMO Monthly Plan fee", productId, variantId });
const activeSub2Id = await ensureSubscription({ tag: "active-c2", customerId: cust2Id, planId: planMonthly, termsId: termsNet30, status: "active", startDate: overdueStart, expiryDate: futureExpiry, nextBillingDate: overdueStart, periodsBilled: 0, planPrice: "1000.00", lineDesc: "DEMO Monthly Plan fee", productId });
await ensureSubscription({ tag: "paused", customerId: cust1Id, planId: planMonthly, termsId: termsNet30, status: "paused", startDate: pastStart, expiryDate: futureExpiry, nextBillingDate: nextMonth, periodsBilled: 2, planPrice: "1000.00", lineDesc: "DEMO Monthly Plan fee" });
await ensureSubscription({ tag: "closed", customerId: cust2Id, planId: planWeekly, termsId: termsNet15, status: "closed", startDate: "2026-01-01", expiryDate: "2026-06-30", planPrice: "300.00", lineDesc: "DEMO Weekly Plan fee", closedAt: new Date("2026-06-30").toISOString() });

// ---------------------------------------------------------------------------
// 5. Invoices + payments
// ---------------------------------------------------------------------------
console.log("\n── 5. Invoices + payments ──");

const { error: billingErr } = await db.rpc("run_billing", { p_run_date: today });
if (billingErr) console.warn(`  ⚠ run_billing: ${billingErr.message}`);
else console.log("  ✓ run_billing executed – draft invoices created");

const { data: draftInv1 } = await db.from("invoices").select("id,total").eq("subscription_id", activeSub1Id).eq("status", "draft").limit(1).maybeSingle();
if (draftInv1) {
  await db.rpc("confirm_invoice", { p_invoice_id: draftInv1.id });
  console.log(`  ✓ Confirmed invoice ${draftInv1.id}`);
  const { data: users } = await db.auth.admin.listUsers({ page: 1, perPage: 1 });
  const actorId = users?.users?.[0]?.id ?? "00000000-0000-0000-0000-000000000000";
  const halfAmount = fromCents(Math.floor(toCents(draftInv1.total) / 2));
  const { error: pyErr } = await db.rpc("record_payment", { p_invoice_id: draftInv1.id, p_method: "bank_transfer", p_amount: halfAmount, p_paid_on: today, p_note: "Demo partial payment", p_user: actorId });
  if (!pyErr) console.log(`  ✓ Partial payment ₹${halfAmount} recorded`);
}

const { data: draftInv2 } = await db.from("invoices").select("id,total").eq("subscription_id", activeSub2Id).eq("status", "draft").limit(1).maybeSingle();
if (draftInv2) {
  await db.rpc("confirm_invoice", { p_invoice_id: draftInv2.id });
  const { data: users2 } = await db.auth.admin.listUsers({ page: 1, perPage: 1 });
  const actorId2 = users2?.users?.[0]?.id ?? "00000000-0000-0000-0000-000000000000";
  const { error: py2Err } = await db.rpc("record_payment", { p_invoice_id: draftInv2.id, p_method: "cash", p_amount: draftInv2.total, p_paid_on: today, p_note: "Demo full payment", p_user: actorId2 });
  if (!py2Err) console.log("  ✓ Full payment recorded → invoice now Paid");
}

console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Demo seed complete.

  Demo accounts (email / password / role)
  ─────────────────────────────────────────
  admin@demo.test     / ${DEMO_PASSWORD} / admin
  staff@demo.test     / ${DEMO_PASSWORD} / staff
  customer@demo.test  / ${DEMO_PASSWORD} / customer (1)
  customer2@demo.test / ${DEMO_PASSWORD} / customer (2)

  Active subscriptions left unbilled for the live Run
  Billing demo. Re-run at any time; it is idempotent.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
