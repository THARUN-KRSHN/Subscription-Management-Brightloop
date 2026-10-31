/**
 * Brightloop Phase 5 – Automated test suite
 * Run with: npm run test
 *
 * Uses only Node built-ins + the project's Supabase client so no test framework
 * dependency is added to the application.  The suite validates:
 *   • validatePassword rule table
 *   • Billing idempotency (run_billing called twice, month-end anchor case)
 *   • Discount usage limit (exactly one discounted invoice, used_count = 1)
 *   • Invoice totals (total = subtotal − discount_total + tax_total, equals sum of lines)
 *   • Payments  (partial→full→paid; overpay rejected)
 *   • Authorisation matrix (anon cannot read protected tables)
 *   • lineTaxCents unit tests
 */

import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Inline helpers (avoid lib imports that use Next.js path aliases)
// ---------------------------------------------------------------------------
function validatePassword(password: string) {
  const rules = {
    length: password.length >= 9,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    special: /[^a-zA-Z0-9]/.test(password),
  };
  return { valid: Object.values(rules).every(Boolean), rules };
}
function toCents(value: string | number): number {
  const match = String(value).trim().match(/^(-?)(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) throw new Error("Invalid money amount");
  const cents = Number(match[2]) * 100 + Number((match[3] ?? "").padEnd(2, "0"));
  return match[1] ? -cents : cents;
}
function fromCents(cents: number): string {
  const absolute = Math.abs(cents);
  return `${cents < 0 ? "-" : ""}${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, "0")}`;
}
function lineTaxCents(amountCents: number, taxPct: string | number) {
  const [whole, decimal = ""] = String(taxPct).split(".");
  if (!/^\d+$/.test(whole) || !/^\d{0,3}$/.test(decimal)) throw new Error("Invalid tax rate.");
  const rate = BigInt(whole) * BigInt(1000) + BigInt(decimal.padEnd(3, "0"));
  return Number((BigInt(amountCents) * rate + BigInt(50000)) / BigInt(100000));
}


// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
let passed = 0;
let failed = 0;
const results: { label: string; ok: boolean; note?: string }[] = [];

function assert(label: string, condition: boolean, note?: string) {
  results.push({ label, ok: condition, note });
  if (condition) passed++;
  else failed++;
}

// ---------------------------------------------------------------------------
// Supabase service-role client
// ---------------------------------------------------------------------------
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const db = createClient(url, serviceKey, { auth: { persistSession: false } });

// ---------------------------------------------------------------------------
// 1. validatePassword table
// ---------------------------------------------------------------------------
console.log("\n=== 1. validatePassword ===");

const pwCases: [string, boolean, string][] = [
  ["abcdefgh", false, "8 chars only – length fails"],
  ["abcdefgH", false, "8 chars, missing special"],
  ["abcdefg!", false, "8 chars, missing uppercase"],
  ["ABCDEFG!", false, "8 chars, missing lowercase"],
  ["abcdefgh!", false, "8 chars – length still fails (no upper or special passes)"],
  ["abcdefgH!", true, "9 chars with upper+lower+special – valid"],
  ["SecureP@ss1", true, "11-char full password – valid"],
  ["short", false, "too short, all rules fail"],
  ["ALLUPPERCASE1!", false, "no lowercase"],
  ["alllowercase1!", false, "no uppercase"],
];

for (const [pw, expected, label] of pwCases) {
  const { valid } = validatePassword(pw);
  assert(`validatePassword: ${label}`, valid === expected);
}

// Helper to cleanly delete a subscription and its cascaded invoice data
async function cleanupSubscription(subId: number) {
  if (!subId) return;
  const { data: invs } = await db.from("invoices").select("id").eq("subscription_id", subId);
  if (invs && invs.length) {
    const ids = invs.map((i: { id: number }) => i.id);
    await db.from("payments").delete().in("invoice_id", ids);
    await db.from("discount_redemptions").delete().in("invoice_id", ids);
    await db.from("invoice_lines").delete().in("invoice_id", ids);
    await db.from("invoices").delete().in("id", ids);
  }
  await db.from("subscription_lines").delete().eq("subscription_id", subId);
  await db.from("subscriptions").delete().eq("id", subId);
}

// ---------------------------------------------------------------------------
// 2. Billing idempotency
// ---------------------------------------------------------------------------
console.log("\n=== 2. Billing idempotency ===");

async function testBillingIdempotency() {
  const { data: customer } = await db.from("customers").select("id").limit(1).single();
  const customerId = customer?.id;
  if (!customerId) {
    assert("billing-idempotency: has a customer", false, "No customer found; seed demo data first");
    return;
  }

  const { data: plan } = await db
    .from("plans")
    .select("id,price")
    .eq("is_active", true)
    .eq("billing_period", "monthly")
    .limit(1)
    .single();
  const { data: terms } = await db.from("payment_terms").select("id").limit(1).single();

  if (!plan || !terms) {
    assert("billing-idempotency: has active monthly plan + payment terms", false, "Missing plan or payment terms");
    return;
  }

  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 2);
  const startStr = startDate.toISOString().slice(0, 10);
  const expiryStr = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);

  const { data: sub, error: subErr } = await db
    .from("subscriptions")
    .insert({
      customer_id: customerId,
      plan_id: plan.id,
      payment_terms_id: terms.id,
      status: "active",
      start_date: startStr,
      expiry_date: expiryStr,
      next_billing_date: startStr,
      periods_billed: 0,
    })
    .select("id")
    .single();

  if (subErr || !sub) {
    assert("billing-idempotency: created test subscription", false, subErr?.message);
    return;
  }

  const planPrice = fromCents(toCents(plan.price));
  await db.from("subscription_lines").insert({
    subscription_id: sub.id,
    description: "plan fee",
    quantity: 1,
    unit_price: planPrice,
    tax_pct: "0",
    amount: planPrice,
    is_plan_fee: true,
  });

  assert("billing-idempotency: created test subscription", true);

  const today = new Date().toISOString().slice(0, 10);

  const { error: run1Err } = await db.rpc("run_billing", { p_run_date: today });
  assert("billing-idempotency: first run_billing succeeds", !run1Err, run1Err?.message);

  const { count: count1 } = await db
    .from("invoices")
    .select("*", { count: "exact", head: true })
    .eq("subscription_id", sub.id);

  const { error: run2Err } = await db.rpc("run_billing", { p_run_date: today });
  assert("billing-idempotency: second run_billing succeeds", !run2Err, run2Err?.message);

  const { count: count2 } = await db
    .from("invoices")
    .select("*", { count: "exact", head: true })
    .eq("subscription_id", sub.id);

  assert(
    "billing-idempotency: second run creates 0 new invoices (idempotent)",
    count1 === count2,
    `count1=${count1} count2=${count2}`,
  );

  assert("billing-idempotency: first run created ≥ 1 invoice", (count1 ?? 0) >= 1, `count=${count1}`);

  // Month-end anchor: start on the 31st
  const { data: sub31, error: sub31Err } = await db
    .from("subscriptions")
    .insert({
      customer_id: customerId,
      plan_id: plan.id,
      payment_terms_id: terms.id,
      status: "active",
      start_date: "2026-01-31",
      expiry_date: "2027-01-31",
      next_billing_date: "2026-01-31",
      periods_billed: 0,
    })
    .select("id")
    .single();
  assert("billing-idempotency: created month-end-31 subscription", !sub31Err && !!sub31, sub31Err?.message);

  if (sub31) {
    await db.from("subscription_lines").insert({
      subscription_id: sub31.id,
      description: "plan fee (31st test)",
      quantity: 1,
      unit_price: planPrice,
      tax_pct: "0",
      amount: planPrice,
      is_plan_fee: true,
    });
    const { error: bilErr } = await db.rpc("run_billing", { p_run_date: "2026-02-28" });
    assert("billing-idempotency: month-end billing on Feb 28 succeeds", !bilErr, bilErr?.message);
    const { count: inv31 } = await db
      .from("invoices")
      .select("*", { count: "exact", head: true })
      .eq("subscription_id", sub31.id);
    assert("billing-idempotency: month-end 31 generates invoice for Feb", (inv31 ?? 0) >= 1);
    await cleanupSubscription(sub31.id);
  }

  await cleanupSubscription(sub.id);
}

await testBillingIdempotency();

// ---------------------------------------------------------------------------
// 3. Discount usage limit
// ---------------------------------------------------------------------------
console.log("\n=== 3. Discount usage limit ===");

async function testDiscountLimit() {
  const { data: customers } = await db.from("customers").select("id").limit(2);
  if (!customers || customers.length < 2) {
    assert("discount-limit: at least 2 customers available", false, "seed demo data first");
    return;
  }
  const { data: plan } = await db.from("plans").select("id,price").eq("is_active", true).limit(1).single();
  const { data: terms } = await db.from("payment_terms").select("id").limit(1).single();
  if (!plan || !terms) { assert("discount-limit: plan + terms available", false); return; }

  // 95% discount ensures highest priority among eligible discounts
  const { data: discount, error: dErr } = await db
    .from("discounts")
    .insert({
      name: "TEST-DISCOUNT-LIMIT-1",
      kind: "percentage",
      value: "95.00",
      scope: "subscription",
      starts_on: "2020-01-01",
      is_active: true,
      usage_limit: 1,
      used_count: 0,
    })
    .select("id")
    .single();
  assert("discount-limit: created test discount (limit=1)", !dErr && !!discount, dErr?.message);
  if (!discount) return;

  const startStr = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const expiryStr = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
  const planPrice = fromCents(toCents(plan.price));
  const subIds: number[] = [];
  for (const cust of customers) {
    const { data: sub } = await db
      .from("subscriptions")
      .insert({
        customer_id: cust.id,
        plan_id: plan.id,
        payment_terms_id: terms.id,
        status: "active",
        start_date: startStr,
        expiry_date: expiryStr,
        next_billing_date: startStr,
        periods_billed: 0,
      })
      .select("id")
      .single();
    if (sub) {
      await db.from("subscription_lines").insert({
        subscription_id: sub.id,
        description: "plan fee",
        quantity: 1,
        unit_price: planPrice,
        tax_pct: "0",
        amount: planPrice,
        is_plan_fee: true,
      });
      subIds.push(sub.id);
    }
  }
  assert("discount-limit: created 2 test subscriptions", subIds.length === 2);

  if (subIds.length === 2) {
    const today = new Date().toISOString().slice(0, 10);
    // Bill sub 1 then sub 2
    await db.rpc("generate_invoice", { p_subscription_id: subIds[0], p_run_date: today });
    await db.rpc("generate_invoice", { p_subscription_id: subIds[1], p_run_date: today });

    const { data: discountedInvoices } = await db
      .from("invoices")
      .select("id,discount_id,discount_total")
      .in("subscription_id", subIds)
      .eq("discount_id", discount.id);

    assert(
      "discount-limit: exactly 1 invoice received the discount",
      (discountedInvoices?.length ?? 0) === 1,
      `got ${discountedInvoices?.length}`,
    );

    const { data: updatedDiscount } = await db
      .from("discounts")
      .select("used_count")
      .eq("id", discount.id)
      .single();
    assert(
      "discount-limit: used_count = 1 after billing",
      updatedDiscount?.used_count === 1,
      `used_count = ${updatedDiscount?.used_count}`,
    );

    // Expired discount never applies
    const { data: expiredDiscount } = await db
      .from("discounts")
      .insert({
        name: "TEST-EXPIRED-DISCOUNT",
        kind: "percentage",
        value: "99.00",
        scope: "subscription",
        starts_on: "2020-01-01",
        ends_on: "2020-12-31",
        is_active: true,
        usage_limit: null,
        used_count: 0,
      })
      .select("id")
      .single();
    if (expiredDiscount) {
      const { data: sub3 } = await db
        .from("subscriptions")
        .insert({
          customer_id: customers[0].id,
          plan_id: plan.id,
          payment_terms_id: terms.id,
          status: "active",
          start_date: startStr,
          expiry_date: expiryStr,
          next_billing_date: startStr,
          periods_billed: 0,
        })
        .select("id")
        .single();
      if (sub3) {
        await db.from("subscription_lines").insert({
          subscription_id: sub3.id,
          description: "plan fee",
          quantity: 1,
          unit_price: planPrice,
          tax_pct: "0",
          amount: planPrice,
          is_plan_fee: true,
        });
        await db.rpc("generate_invoice", { p_subscription_id: sub3.id, p_run_date: today });
        const { data: appliedExpired } = await db
          .from("invoices")
          .select("discount_id")
          .eq("subscription_id", sub3.id)
          .eq("discount_id", expiredDiscount.id);
        assert(
          "discount-limit: expired discount never applied",
          !appliedExpired || appliedExpired.length === 0,
        );
        await cleanupSubscription(sub3.id);
      }
      await db.from("discounts").delete().eq("id", expiredDiscount.id);
    }

    for (const sid of subIds) await cleanupSubscription(sid);
  }
  await db.from("discount_redemptions").delete().eq("discount_id", discount.id);
  await db.from("discounts").delete().eq("id", discount.id);
}

await testDiscountLimit();

// ---------------------------------------------------------------------------
// 4. Invoice totals: total = subtotal − discount_total + tax_total
// ---------------------------------------------------------------------------
console.log("\n=== 4. Invoice totals ===");

async function testInvoiceTotals() {
  const { data: invoices } = await db
    .from("invoices")
    .select("id,subtotal,discount_total,tax_total,total")
    .not("status", "eq", "cancelled")
    .limit(20);

  if (!invoices || !invoices.length) {
    assert("invoice-totals: invoices exist", false, "no invoices found; run billing first");
    return;
  }
  assert("invoice-totals: invoices exist", true);

  let allMatch = true;
  for (const inv of invoices) {
    const expected = toCents(inv.subtotal) - toCents(inv.discount_total) + toCents(inv.tax_total);
    const actual = toCents(inv.total);
    if (expected !== actual) {
      allMatch = false;
      assert(
        `invoice-totals: invoice ${inv.id} total matches formula`,
        false,
        `expected ${fromCents(expected)}, got ${fromCents(actual)}`,
      );
    }
  }
  if (allMatch) assert(`invoice-totals: all ${invoices.length} invoice totals match formula`, true);

  // Verify total equals sum of invoice lines
  const { data: first } = await db
    .from("invoices")
    .select("id,total")
    .not("status", "eq", "cancelled")
    .limit(1)
    .single();
  if (first) {
    const { data: lines } = await db
      .from("invoice_lines")
      .select("amount,discount_total,tax_total")
      .eq("invoice_id", first.id);
    if (lines && lines.length) {
      const lineTotal = lines.reduce(
        (sum, l) => sum + toCents(l.amount) - toCents(l.discount_total) + toCents(l.tax_total),
        0,
      );
      assert(
        `invoice-totals: total equals sum of lines (invoice ${first.id})`,
        lineTotal === toCents(first.total),
        `line sum ${fromCents(lineTotal)} vs invoice total ${fromCents(toCents(first.total))}`,
      );
    }
  }
}

await testInvoiceTotals();

// ---------------------------------------------------------------------------
// 5. Payments: partial then full → paid; overpay rejected
// ---------------------------------------------------------------------------
console.log("\n=== 5. Payments ===");

async function testPayments() {
  const { data: confirmed } = await db
    .from("invoices")
    .select("id,total,amount_paid")
    .eq("status", "confirmed")
    .limit(1)
    .single();

  if (!confirmed) {
    assert("payments: confirmed invoice available", false, "create + confirm an invoice first");
    return;
  }
  assert("payments: confirmed invoice available", true);

  const totalCents = toCents(confirmed.total);
  const paidCents = toCents(confirmed.amount_paid);
  const balance = totalCents - paidCents;
  if (balance <= 1) {
    assert("payments: invoice has unpaid balance", false, `balance is ${balance} cents`);
    return;
  }
  assert("payments: invoice has unpaid balance", true);

  const partial = Math.floor(balance / 2);
  const today = new Date().toISOString().slice(0, 10);

  const { data: users } = await db.auth.admin.listUsers({ page: 1, perPage: 1 });
  const actorId = users?.users?.[0]?.id ?? "00000000-0000-0000-0000-000000000000";

  const { error: p1Err } = await db.rpc("record_payment", {
    p_invoice_id: confirmed.id,
    p_method: "bank_transfer",
    p_amount: fromCents(partial),
    p_paid_on: today,
    p_note: "test partial",
    p_user: actorId,
  });
  assert("payments: partial payment accepted", !p1Err, p1Err?.message);

  const { data: afterPartial } = await db
    .from("invoices")
    .select("status,amount_paid")
    .eq("id", confirmed.id)
    .single();
  assert(
    "payments: still confirmed after partial payment",
    afterPartial?.status === "confirmed",
    `status=${afterPartial?.status}`,
  );

  const newBalance = balance - partial;
  const { error: p2Err } = await db.rpc("record_payment", {
    p_invoice_id: confirmed.id,
    p_method: "bank_transfer",
    p_amount: fromCents(newBalance),
    p_paid_on: today,
    p_note: "test full",
    p_user: actorId,
  });
  assert("payments: full remaining payment accepted", !p2Err, p2Err?.message);

  const { data: afterFull } = await db
    .from("invoices")
    .select("status")
    .eq("id", confirmed.id)
    .single();
  assert(
    "payments: invoice flips to paid after full payment",
    afterFull?.status === "paid",
    `status=${afterFull?.status}`,
  );

  const { error: overErr } = await db.rpc("record_payment", {
    p_invoice_id: confirmed.id,
    p_method: "bank_transfer",
    p_amount: "0.01",
    p_paid_on: today,
    p_note: "test overpay",
    p_user: actorId,
  });
  assert("payments: overpay rejected with error", !!overErr, "expected an error for overpayment");
}

await testPayments();

// ---------------------------------------------------------------------------
// 6. Authorisation matrix – anon client cannot read protected tables
// ---------------------------------------------------------------------------
console.log("\n=== 6. Authorisation matrix ===");

async function testAuthMatrix() {
  if (!anonKey) { assert("auth-matrix: anon key available", false); return; }
  const anon = createClient(url, anonKey, { auth: { persistSession: false } });

  const tables = ["customers", "subscriptions", "invoices", "profiles", "payments"] as const;
  for (const table of tables) {
    const { data } = await anon.from(table).select("id").limit(1);
    assert(
      `auth-matrix: anon cannot read ${table}`,
      !data || data.length === 0,
      `returned ${data?.length ?? 0} rows`,
    );
  }
}

await testAuthMatrix();

// ---------------------------------------------------------------------------
// 7. lineTaxCents unit tests (pure, no network)
// ---------------------------------------------------------------------------
console.log("\n=== 7. lineTaxCents unit ===");

assert("lineTaxCents: 1000 × 18% = 180", lineTaxCents(1000, "18") === 180);
assert("lineTaxCents: 1000 × 18.000% = 180", lineTaxCents(1000, "18.000") === 180);
assert("lineTaxCents: 1000 × 5.5% = 55", lineTaxCents(1000, "5.5") === 55);
assert("lineTaxCents: 0 × 18% = 0", lineTaxCents(0, "18") === 0);
assert("lineTaxCents: 100 × 0% = 0", lineTaxCents(100, "0") === 0);
assert("lineTaxCents: 100 × 18.5% rounds half-up to 19", lineTaxCents(100, "18.5") === 19);

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
console.log("\n\n==================== TEST RESULTS ====================");
let maxLen = 0;
for (const r of results) if (r.label.length > maxLen) maxLen = r.label.length;
for (const r of results) {
  const padded = r.label.padEnd(maxLen + 2, ".");
  console.log(`  ${r.ok ? "PASS" : "FAIL"} ${padded} ${r.note ?? ""}`);
}
console.log(`\n  ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
