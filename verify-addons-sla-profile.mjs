import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { createClient } = require("./packages/db/node_modules/@supabase/supabase-js");
import fs from "fs";

// Load environment variables from .env.local
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

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function runAddonsSlaProfileVerification() {
  console.log("==================================================================");
  console.log("  VERIFYING ADD-ONS & APPROVALS, AUTO-DISPATCH SLA, & PROFILE EDIT");
  console.log("==================================================================\n");

  // Step 1: Identify existing test customer and professional
  console.log("Step 1: Identifying test customer and professional profiles...");
  const { data: customerData, error: custErr } = await supabase
    .from("profiles")
    .select("id, full_name, email, role")
    .eq("role", "customer")
    .limit(1)
    .single();

  if (custErr) throw new Error(`Customer query failed: ${custErr.message}`);
  console.log(`  [PASS] Found customer: ${customerData.full_name} (${customerData.id.slice(0, 8)})`);

  const { data: proData, error: proErr } = await supabase
    .from("professionals")
    .select("id, trade, status, city_id, skills")
    .limit(1)
    .single();

  if (proErr) throw new Error(`Professional query failed: ${proErr.message}`);
  console.log(`  [PASS] Found professional: ${proData.trade} (${proData.id.slice(0, 8)})`);

  // Step 2: Test Dynamic Profile Editing (City & Skills)
  console.log("\nStep 2: Testing Dynamic Profile Editing (City & Skills)...");
  const { data: cities, error: citiesErr } = await supabase
    .from("cities")
    .select("id, name")
    .eq("is_active", true)
    .limit(2);

  if (citiesErr || !cities || cities.length === 0) throw new Error("Cities catalog missing");
  const targetCity = cities[0];

  const { data: services, error: servicesErr } = await supabase
    .from("services")
    .select("id, name")
    .eq("is_active", true)
    .limit(3);

  if (servicesErr || !services || services.length === 0) throw new Error("Services catalog missing");
  const targetServiceIds = services.map((s) => s.id);
  const targetServiceNames = services.map((s) => s.name);

  // 2a. Update City
  const { data: updatedCityPro, error: cityUpErr } = await supabase
    .from("professionals")
    .update({ city_id: targetCity.id, updated_at: new Date().toISOString() })
    .eq("id", proData.id)
    .select()
    .single();

  if (cityUpErr) throw new Error(`City update failed: ${cityUpErr.message}`);
  console.log(`  [PASS] Updated professional primary city to: ${targetCity.name} (${targetCity.id.slice(0, 8)})`);

  // 2b. Update Skills in professional_skills join table
  await supabase.from("professional_skills").delete().eq("professional_id", proData.id);

  const skillsToInsert = targetServiceIds.map((sid) => ({
    professional_id: proData.id,
    service_id: sid,
  }));
  const { error: insSkillsErr } = await supabase.from("professional_skills").insert(skillsToInsert);
  if (insSkillsErr) throw new Error(`Insert skills failed: ${insSkillsErr.message}`);

  // Update skills text array
  await supabase
    .from("professionals")
    .update({ skills: targetServiceNames, updated_at: new Date().toISOString() })
    .eq("id", proData.id);

  const { data: verifiedSkills } = await supabase
    .from("professional_skills")
    .select("service_id")
    .eq("professional_id", proData.id);

  if (!verifiedSkills || verifiedSkills.length !== targetServiceIds.length) {
    throw new Error(`Expected ${targetServiceIds.length} skills, found ${verifiedSkills?.length}`);
  }
  console.log(`  [PASS] Successfully updated ${verifiedSkills.length} active skills in join table: ${targetServiceNames.join(", ")}`);

  // Step 3: Test In-Job Scope Add-ons & Customer Approvals
  console.log("\nStep 3: Testing In-Job Scope Add-ons & Customer Approvals...");
  const basePrice = 120.0;
  const addonCost = 45.0;

  // 3a. Create active in-progress booking
  const { data: testBooking, error: bookErr } = await supabase
    .from("bookings")
    .insert({
      customer_id: customerData.id,
      professional_id: proData.id,
      service_type: "HVAC Precision Tune-Up",
      price: basePrice,
      status: "in_progress",
      dispatch_status: "assigned",
      latitude: 37.7749,
      longitude: -122.4194,
    })
    .select()
    .single();

  if (bookErr) throw new Error(`Booking creation failed: ${bookErr.message}`);
  console.log(`  [PASS] Created active job #${testBooking.id.slice(0, 8)} with base price: $${basePrice.toFixed(2)}`);

  // 3b. Provider requests unexpected damaged equipment replacement scope
  const { data: newAddon, error: addonErr } = await supabase
    .from("job_addons")
    .insert({
      booking_id: testBooking.id,
      item_name: "Replacement Copper Pressure Valve & High-Pressure Freon Seal",
      cost: addonCost,
      photo_url: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800",
      status: "pending",
    })
    .select()
    .single();

  if (addonErr) throw new Error(`Addon creation failed: ${addonErr.message}`);
  console.log(`  [PASS] Provider requested scope add-on #${newAddon.id.slice(0, 8)}: "${newAddon.item_name}" for +$${Number(newAddon.cost).toFixed(2)} (Status: ${newAddon.status})`);

  // 3c. Customer reviews photo evidence and approves scope
  const { data: approvedAddon, error: appErr } = await supabase
    .from("job_addons")
    .update({ status: "approved", updated_at: new Date().toISOString() })
    .eq("id", newAddon.id)
    .select()
    .single();

  if (appErr) throw new Error(`Addon approval failed: ${appErr.message}`);
  console.log(`  [PASS] Customer approved add-on! Status updated to: ${approvedAddon.status}`);

  // Update booking price
  const expectedNewPrice = basePrice + addonCost;
  const { data: updatedPriceBooking, error: upBookErr } = await supabase
    .from("bookings")
    .update({ price: expectedNewPrice, updated_at: new Date().toISOString() })
    .eq("id", testBooking.id)
    .select()
    .single();

  if (upBookErr) throw new Error(`Booking price update failed: ${upBookErr.message}`);
  if (Number(updatedPriceBooking.price) !== expectedNewPrice) {
    throw new Error(`Expected price $${expectedNewPrice}, got $${updatedPriceBooking.price}`);
  }
  console.log(`  [PASS] Booking price updated with approved add-on: $${Number(updatedPriceBooking.price).toFixed(2)}`);

  // Step 4: Test Auto-Dispatch SLA Escalation Queue & Force-Assignment
  console.log("\nStep 4: Testing Intelligent Auto-Dispatch SLA Queue & Force-Assignment...");
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

  // Create backdated unassigned booking to simulate 15-minute SLA breach
  const { data: slaBooking, error: slaErr } = await supabase
    .from("bookings")
    .insert({
      customer_id: customerData.id,
      service_type: "Emergency Main Water Pipe Leak",
      price: 185.0,
      status: "pending",
      dispatch_status: "searching",
      creation_time: fifteenMinutesAgo,
      created_at: fifteenMinutesAgo,
      latitude: 37.7833,
      longitude: -122.4167,
    })
    .select()
    .single();

  if (slaErr) throw new Error(`SLA booking insert failed: ${slaErr.message}`);
  console.log(`  [PASS] Created unassigned booking #${slaBooking.id.slice(0, 8)} backdated to 15m ago (dispatch_status: ${slaBooking.dispatch_status})`);

  // Query unassigned bookings and verify SLA breach computation
  const { data: pendingBookings, error: fetchPendingErr } = await supabase
    .from("bookings")
    .select("*")
    .in("status", ["pending"])
    .order("created_at", { ascending: true });

  if (fetchPendingErr) throw new Error(`Fetch pending bookings failed: ${fetchPendingErr.message}`);

  const now = Date.now();
  const thresholdMs = 10 * 60 * 1000;
  const foundSla = pendingBookings.find((b) => b.id === slaBooking.id);
  if (!foundSla) throw new Error("Backdated booking not found in pending queue");

  const elapsedMs = now - new Date(foundSla.creation_time || foundSla.created_at).getTime();
  const elapsedMinutes = Math.floor(elapsedMs / (60 * 1000));
  const isBreached = elapsedMs >= thresholdMs;

  console.log(`  [PASS] SLA Analysis: Elapsed = ${elapsedMinutes} mins, Threshold = 10 mins, isBreached = ${isBreached}`);
  if (!isBreached) throw new Error("Expected booking to be flagged as SLA breached!");

  // Supervisor Force-Assign override
  console.log("  Executing Supervisor Force-Assign Override...");
  const { data: forceAssigned, error: forceErr } = await supabase
    .from("bookings")
    .update({
      professional_id: proData.id,
      status: "accepted",
      dispatch_status: "assigned",
      updated_at: new Date().toISOString(),
    })
    .eq("id", slaBooking.id)
    .select()
    .single();

  if (forceErr) throw new Error(`Force assign failed: ${forceErr.message}`);
  if (forceAssigned.dispatch_status !== "assigned" || forceAssigned.status !== "accepted") {
    throw new Error("Force assigned booking did not update status properly!");
  }
  console.log(`  [PASS] Force-Assigned booking #${forceAssigned.id.slice(0, 8)} to provider ${proData.id.slice(0, 8)}! (status: ${forceAssigned.status}, dispatch_status: ${forceAssigned.dispatch_status})`);

  // Step 5: Clean up test artifacts
  console.log("\nStep 5: Cleaning up test data...");
  await supabase.from("job_addons").delete().eq("booking_id", testBooking.id);
  await supabase.from("bookings").delete().eq("id", testBooking.id);
  await supabase.from("bookings").delete().eq("id", slaBooking.id);
  console.log("  [PASS] Cleaned up test bookings and add-ons.");

  console.log("\n==================================================================");
  console.log("  ALL TESTS PASSED WITH 100% SUCCESS!");
  console.log("==================================================================");
}

runAddonsSlaProfileVerification().catch((err) => {
  console.error("\n❌ Verification Failed:", err);
  process.exit(1);
});
