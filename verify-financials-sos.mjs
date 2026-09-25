import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { createClient } = require("./packages/db/node_modules/@supabase/supabase-js");
import fs from "fs";

// Load environment variables
const envText = fs.readFileSync(".env.local", "utf8");
const env = Object.fromEntries(
  envText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const idx = l.indexOf("=");
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
    })
);

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || "https://aiosgumdbgoxfssgxssj.supabase.co";
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
  console.error("❌ SUPABASE_SERVICE_ROLE_KEY missing in environment!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function runVerification() {
  console.log("==================================================");
  console.log("🔍 E2E VERIFICATION: Financials, Wallets & Trust & Safety (SOS)");
  console.log("==================================================");

  let passed = 0;
  let failed = 0;

  // 1. Verify tables exist
  console.log("\n--- 1. Verifying Database Schema ---");
  try {
    const { data: wallets, error: wErr } = await supabase.from("wallets").select("id").limit(1);
    if (wErr) throw wErr;
    console.log("✅ public.wallets table exists and is accessible");
    passed++;
  } catch (err) {
    console.error("❌ public.wallets check failed:", err.message);
    failed++;
  }

  try {
    const { data: txs, error: tErr } = await supabase.from("transactions").select("id").limit(1);
    if (tErr) throw tErr;
    console.log("✅ public.transactions table exists and is accessible");
    passed++;
  } catch (err) {
    console.error("❌ public.transactions check failed:", err.message);
    failed++;
  }

  try {
    const { data: sos, error: sErr } = await supabase.from("sos_alerts").select("id").limit(1);
    if (sErr) throw sErr;
    console.log("✅ public.sos_alerts table exists and is accessible");
    passed++;
  } catch (err) {
    console.error("❌ public.sos_alerts check failed:", err.message);
    failed++;
  }

  // 2. Test Wallet creation & Auto-Seed
  console.log("\n--- 2. Verifying Wallets & Balance Operations ---");
  let testUserId = null;
  let testWallet = null;

  try {
    // Grab an existing profile
    const { data: profiles, error: pErr } = await supabase.from("profiles").select("id, full_name, email").limit(1);
    if (pErr) throw pErr;
    if (!profiles || profiles.length === 0) {
      throw new Error("No profiles found to verify wallet operations");
    }

    testUserId = profiles[0].id;
    console.log(`Using Profile ID: ${testUserId} (${profiles[0].email})`);

    // Check or create wallet
    let { data: wallet, error: wErr } = await supabase.from("wallets").select("*").eq("user_id", testUserId).maybeSingle();
    if (wErr) throw wErr;

    if (!wallet) {
      const { data: newW, error: insErr } = await supabase.from("wallets").insert({
        user_id: testUserId,
        balance: 100.00,
        promo_credits: 25.00,
      }).select().single();
      if (insErr) throw insErr;
      wallet = newW;
      console.log(`Created wallet for user: balance=$${wallet.balance}, promo=$${wallet.promo_credits}`);
    } else {
      console.log(`Found existing wallet: balance=$${wallet.balance}, promo=$${wallet.promo_credits}`);
    }

    testWallet = wallet;
    passed++;

    // Test deposit transaction
    const depositAmount = 25.50;
    const initialBal = Number(wallet.balance);
    const newBal = initialBal + depositAmount;

    const { error: updErr } = await supabase.from("wallets").update({ balance: newBal }).eq("id", wallet.id);
    if (updErr) throw updErr;

    const { data: tx, error: txErr } = await supabase.from("transactions").insert({
      wallet_id: wallet.id,
      user_id: testUserId,
      type: "deposit",
      amount: depositAmount,
      status: "completed",
      description: "Automated Test Deposit",
      metadata: { test: true },
    }).select().single();

    if (txErr) throw txErr;
    console.log(`✅ Logged deposit transaction ID ${tx.id} for $${depositAmount}`);
    passed++;

    // Test promo code transaction
    const promoAmt = 25.00;
    const initialPromo = Number(wallet.promo_credits);
    const newPromo = initialPromo + promoAmt;

    await supabase.from("wallets").update({ promo_credits: newPromo }).eq("id", wallet.id);
    const { data: promoTx, error: pTxErr } = await supabase.from("transactions").insert({
      wallet_id: wallet.id,
      user_id: testUserId,
      type: "promo_credit",
      amount: promoAmt,
      status: "completed",
      description: "WELCOME25 Promo Redemption Test",
      metadata: { promo_code: "WELCOME25", test: true },
    }).select().single();

    if (pTxErr) throw pTxErr;
    console.log(`✅ Logged promo transaction ID ${promoTx.id} (+ $${promoAmt} credits)`);
    passed++;

    // Test payout request & admin approval flow
    const payoutAmt = 15.00;
    const { data: payoutTx, error: poErr } = await supabase.from("transactions").insert({
      wallet_id: wallet.id,
      user_id: testUserId,
      type: "payout",
      amount: payoutAmt,
      status: "pending",
      description: "Automated Test Payout Request",
      metadata: { test: true },
    }).select().single();

    if (poErr) throw poErr;
    console.log(`✅ Created pending payout request ID ${payoutTx.id} for $${payoutAmt}`);
    passed++;

    // Admin approves payout
    const { data: approvedTx, error: apErr } = await supabase.from("transactions").update({
      status: "completed",
      metadata: { test: true, approved_at: new Date().toISOString() },
    }).eq("id", payoutTx.id).select().single();

    if (apErr) throw apErr;
    console.log(`✅ Admin approved payout ID ${approvedTx.id}: status=${approvedTx.status}`);
    passed++;
  } catch (err) {
    console.error("❌ Wallet operations test failed:", err.message);
    failed++;
  }

  // 3. Test SOS Alerts Workflow
  console.log("\n--- 3. Verifying Trust & Safety SOS Alerts Flow ---");
  try {
    const lat = 40.7128;
    const lng = -74.0060;

    // Create active SOS alert
    const { data: alert, error: aErr } = await supabase.from("sos_alerts").insert({
      creator_id: testUserId,
      creator_role: "user",
      lat,
      lng,
      status: "active",
      reason: "Automated Verification Emergency Beacon",
      notes: "Unit test emergency distress ping",
    }).select().single();

    if (aErr) throw aErr;
    console.log(`✅ Created emergency SOS alert ID: ${alert.id} (lat: ${alert.lat}, lng: ${alert.lng})`);
    passed++;

    // Admin views active alerts
    const { data: activeList, error: alErr } = await supabase.from("sos_alerts").select(`
      id,
      status,
      reason,
      lat,
      lng,
      creator:profiles!sos_alerts_creator_id_fkey(full_name, email)
    `).eq("id", alert.id);

    if (alErr) throw alErr;
    if (activeList.length === 0) throw new Error("Could not find created SOS alert in active list");
    console.log(`✅ Admin retrieved active alert: reason="${activeList[0].reason}", status=${activeList[0].status}`);
    passed++;

    // Admin resolves SOS alert
    const { data: resolvedAlert, error: rErr } = await supabase.from("sos_alerts").update({
      status: "resolved",
      notes: "Resolved by Automated Test Suite",
      resolved_at: new Date().toISOString(),
    }).eq("id", alert.id).select().single();

    if (rErr) throw rErr;
    console.log(`✅ Admin resolved alert ID ${resolvedAlert.id}: status=${resolvedAlert.status}`);
    passed++;

    // Clean up test alert and transactions
    await supabase.from("sos_alerts").delete().eq("id", alert.id);
    await supabase.from("transactions").delete().contains("metadata", { test: true });
    console.log("🧹 Cleaned up temporary test artifacts");
  } catch (err) {
    console.error("❌ SOS alerts test failed:", err.message);
    failed++;
  }

  console.log("\n==================================================");
  console.log(`📊 FINAL SUMMARY: ${passed} passed, ${failed} failed`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log("🎉 ALL FINANCIALS, WALLETS & SOS TESTS PASSED!");
  }
}

runVerification();
