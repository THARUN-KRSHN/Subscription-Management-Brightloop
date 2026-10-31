import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !key) throw new Error("Missing Supabase env. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");

const admin = createClient(url, key, { auth: { persistSession: false } });

function today() {
  return new Date().toISOString().slice(0,10);
}

async function main() {
  const stamp = Date.now();
  const email = `smoke+${stamp}@example.test`;
  const company = `Smoke Co ${stamp}`;
  const planName = `Smoke Plan ${stamp}`;
  const productName = `Smoke Product ${stamp}`;

  const out: string[] = [];
  function pass(msg: string) { out.push(`PASS: ${msg}`); }
  function fail(msg: string, e?: any) { out.push(`FAIL: ${msg}${e?.message ? ` — ${e.message}` : ""}`); }

  // 1) Customer
  const { data: customer, error: cErr } = await admin
    .from("customers").insert({ contact_name: company, email }).select("id").single();
  if (cErr || !customer) return console.log(fail("create customer", cErr)), dump(out);
  pass("create customer");

  // 2) Payment terms (use existing Immediate)
  const { data: terms } = await admin.from("payment_terms").select("id").order("id").limit(1);
  const termsId = terms?.[0]?.id as number;

  // 3) Plan
  const { data: plan, error: pErr } = await admin.from("plans").insert({ name: planName, price: 1000, billing_period: "monthly", min_quantity: 1, available_from: today(), is_active: true, allow_pause: true, allow_early_close: true }).select("id").single();
  if (pErr || !plan) return console.log(fail("create plan", pErr)), dump(out);
  pass("create plan");

  // 4) Product
  const { data: product, error: prErr } = await admin.from("products").insert({ name: productName, type: "Software", sales_price: 500, cost_price: 0, is_active: true }).select("id").single();
  if (prErr || !product) return console.log(fail("create product", prErr)), dump(out);
  pass("create product");

  // 5) Subscription with lines
  const start = today();
  const { data: sub, error: sErr } = await admin
    .from("subscriptions")
    .insert({ customer_id: customer.id, plan_id: plan.id, payment_terms_id: termsId, status: "confirmed", start_date: start, expiry_date: start })
    .select("id")
    .single();
  if (sErr || !sub) return console.log(fail("create subscription", sErr)), dump(out);
  await admin.from("subscription_lines").insert([
    { subscription_id: sub.id, product_id: null, description: `Plan fee: ${planName}`, quantity: 1, unit_price: 1000, tax_pct: 0, amount: 1000, is_plan_fee: true },
    { subscription_id: sub.id, product_id: product.id, description: productName, quantity: 1, unit_price: 500, tax_pct: 0, amount: 500, is_plan_fee: false },
  ]);
  pass("create subscription + lines");

  // 6) Activate (sets next_billing_date)
  const { error: actErr } = await admin.from("subscriptions").update({ status: "active", next_billing_date: start, periods_billed: 0 }).eq("id", sub.id);
  if (actErr) return console.log(fail("activate subscription", actErr)), dump(out);
  pass("activate subscription");

  // 7) Run billing today
  const { data: run, error: runErr } = await admin.rpc("run_billing", { p_run_date: start });
  if (runErr) return console.log(fail("run_billing", runErr)), dump(out);
  pass(`run_billing: ${JSON.stringify(run)}`);

  // 8) Get draft invoice
  const { data: inv, error: iErr } = await admin.from("invoices").select("id,status,total,amount_paid").eq("subscription_id", sub.id).maybeSingle();
  if (iErr || !inv) return console.log(fail("select invoice", iErr)), dump(out);
  pass("invoice created");

  // 9) Confirm invoice
  const { data: num, error: confErr } = await admin.rpc("confirm_invoice", { p_invoice_id: inv.id });
  if (confErr) return console.log(fail("confirm invoice", confErr)), dump(out);
  pass(`confirm invoice → ${num}`);

  // 10) Record partial payment then full
  const partial = 500;
  const { error: pay1Err } = await admin.rpc("record_payment", { p_invoice_id: inv.id, p_method: "upi", p_amount: partial, p_paid_on: start, p_note: "smoke", p_user: null });
  if (pay1Err) return console.log(fail("record partial payment", pay1Err)), dump(out);
  pass("record partial payment");
  const { data: inv2 } = await admin.from("invoices").select("total,amount_paid,status").eq("id", inv.id).single();
  const balance = Number(inv2?.total ?? 0) - Number(inv2?.amount_paid ?? 0);
  const { error: pay2Err } = await admin.rpc("record_payment", { p_invoice_id: inv.id, p_method: "upi", p_amount: balance, p_paid_on: start, p_note: "smoke", p_user: null });
  if (pay2Err) return console.log(fail("record final payment", pay2Err)), dump(out);
  pass("record final payment → paid");

  // 11) Dashboard summary sanity
  const { data: dash, error: dErr } = await admin.rpc("dashboard_summary", { p_from: start, p_to: start, p_customer: null, p_plan: null });
  if (dErr) return console.log(fail("dashboard_summary", dErr)), dump(out);
  pass("dashboard_summary returns data");

  console.log(out.join("\n"));
}

function dump(out: string[]) {
  console.log(out.join("\n"));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
