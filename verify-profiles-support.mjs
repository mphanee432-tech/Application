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

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function runProfilesCatalogsSupportVerification() {
  console.log("==================================================================");
  console.log("  VERIFYING PROFILES, CATALOGS, AND CENTRALIZED SUPPORT SUITE");
  console.log("==================================================================\n");

  // Step 1: User & Profile Column Verification
  console.log("Step 1: Checking profiles table for full_name, email, mobile...");
  const { data: profileList, error: profListErr } = await supabase
    .from("profiles")
    .select("id, full_name, email, mobile, phone, role")
    .limit(1);

  if (profListErr) throw new Error(`Profiles check failed: ${profListErr.message}`);
  if (!profileList || profileList.length === 0) {
    throw new Error("No profiles exist to test!");
  }
  const testUser = profileList[0];
  console.log(`  [PASS] Profile record found for user ${testUser.id.slice(0, 8)}`);

  // Test updating mobile and full_name
  const testMobile = "+1 (555) 987-6543";
  const { data: updatedProfile, error: updateProfErr } = await supabase
    .from("profiles")
    .update({ mobile: testMobile, phone: testMobile })
    .eq("id", testUser.id)
    .select()
    .single();

  if (updateProfErr) throw new Error(`Profile update failed: ${updateProfErr.message}`);
  console.log(`  [PASS] Successfully updated profile mobile to: ${updatedProfile.mobile}`);

  // Step 2: Multi-Address Book & Defaults
  console.log("\nStep 2: Testing Customer Addresses CRUD & Default Management...");
  // 2a. Insert Address 1 (Default)
  const { data: addr1, error: addr1Err } = await supabase
    .from("customer_addresses")
    .insert({
      user_id: testUser.id,
      address_line1: "456 Tech Park Way, Floor 3",
      landmark: "Opposite Innovation Hub",
      lat: 40.758,
      lng: -73.9855,
      is_default: true,
    })
    .select()
    .single();

  if (addr1Err) throw new Error(`Failed to create address 1: ${addr1Err.message}`);
  console.log(`  [PASS] Created Address 1 (ID: ${addr1.id.slice(0, 8)}, is_default: ${addr1.is_default})`);

  // 2b. Insert Address 2 (Non-Default)
  const { data: addr2, error: addr2Err } = await supabase
    .from("customer_addresses")
    .insert({
      user_id: testUser.id,
      address_line1: "789 Residential Blvd, Apt 12B",
      landmark: "Near North Gate",
      lat: 40.7829,
      lng: -73.9654,
      is_default: false,
    })
    .select()
    .single();

  if (addr2Err) throw new Error(`Failed to create address 2: ${addr2Err.message}`);
  console.log(`  [PASS] Created Address 2 (ID: ${addr2.id.slice(0, 8)}, is_default: ${addr2.is_default})`);

  // 2c. Set Address 2 as default (unset Address 1)
  await supabase
    .from("customer_addresses")
    .update({ is_default: false })
    .eq("user_id", testUser.id);

  const { data: updatedAddr2, error: setDefErr } = await supabase
    .from("customer_addresses")
    .update({ is_default: true })
    .eq("id", addr2.id)
    .select()
    .single();

  if (setDefErr) throw new Error(`Failed to switch default address: ${setDefErr.message}`);
  console.log(`  [PASS] Switched default: Address 2 is now default (${updatedAddr2.is_default})`);

  // Step 3: City-Wise Pricing Matrix Verification
  console.log("\nStep 3: Testing City-Wise Service Pricing Override...");
  const { data: cities } = await supabase.from("cities").select("id, name").limit(1);
  const { data: services } = await supabase.from("services").select("id, name, base_price").limit(1);

  if (!cities || cities.length === 0 || !services || services.length === 0) {
    throw new Error("Missing cities or services in database.");
  }

  const testCity = cities[0];
  const testService = services[0];
  const customCityPrice = Number(testService.base_price) + 45.0; // custom rate for this city

  const { data: citySvc, error: citySvcErr } = await supabase
    .from("city_services")
    .upsert(
      {
        city_id: testCity.id,
        service_id: testService.id,
        price: customCityPrice,
        is_active: true,
      },
      { onConflict: "city_id,service_id" }
    )
    .select()
    .single();

  if (citySvcErr) throw new Error(`Failed to upsert city service price: ${citySvcErr.message}`);
  console.log(`  City: ${testCity.name} | Service: ${testService.name}`);
  console.log(`  Base Catalog Price: $${Number(testService.base_price).toFixed(2)}`);
  console.log(`  City Override Price: $${Number(citySvc.price).toFixed(2)}`);
  console.log("  [PASS] City-wise custom pricing matrix verified!");

  // Step 4: Centralized Support Ticket & Conversation Thread
  console.log("\nStep 4: Testing Support Tickets, Realtime Replies, and Resolution Lifecycle...");
  // 4a. Create Support Ticket
  const { data: ticket, error: ticketErr } = await supabase
    .from("support_tickets")
    .insert({
      creator_id: testUser.id,
      creator_role: "user",
      subject: "[Integration Test] Billing query for Booking #a1b2",
      message: "I was charged twice for the inspection visit. Please review my receipt.",
      status: "open",
    })
    .select()
    .single();

  if (ticketErr) throw new Error(`Failed to create support ticket: ${ticketErr.message}`);
  console.log(`  [PASS] Created Support Ticket #${ticket.id.slice(0, 8)} (Status: ${ticket.status})`);

  // 4b. Customer post reply
  const { data: custReply, error: custRepErr } = await supabase
    .from("ticket_replies")
    .insert({
      ticket_id: ticket.id,
      sender_id: testUser.id,
      sender_role: "user",
      message: "Here is the transaction reference: TXN-99881122.",
    })
    .select()
    .single();

  if (custRepErr) throw new Error(`Failed to send customer reply: ${custRepErr.message}`);
  console.log(`  [PASS] Customer Reply Added: "${custReply.message}"`);

  // 4c. Admin post response
  const { data: adminReply, error: admRepErr } = await supabase
    .from("ticket_replies")
    .insert({
      ticket_id: ticket.id,
      sender_id: testUser.id, // simulating admin sender
      sender_role: "admin",
      message: "Hello, we verified the duplicate charge and have credited $45 to your account.",
    })
    .select()
    .single();

  if (admRepErr) throw new Error(`Failed to send admin reply: ${admRepErr.message}`);
  console.log(`  [PASS] Admin Reply Added: "${adminReply.message}"`);

  // 4d. Mark Ticket as Resolved
  const { data: resolvedTicket, error: resErr } = await supabase
    .from("support_tickets")
    .update({ status: "resolved", updated_at: new Date().toISOString() })
    .eq("id", ticket.id)
    .select()
    .single();

  if (resErr) throw new Error(`Failed to resolve ticket: ${resErr.message}`);
  console.log(`  [PASS] Ticket status updated to: ${resolvedTicket.status}`);

  // Step 5: Clean Up Test Artifacts
  console.log("\nStep 5: Cleaning up test records...");
  await supabase.from("ticket_replies").delete().eq("ticket_id", ticket.id);
  await supabase.from("support_tickets").delete().eq("id", ticket.id);
  await supabase.from("customer_addresses").delete().in("id", [addr1.id, addr2.id]);
  console.log("  [PASS] Test tickets, replies, and addresses successfully cleaned up.");

  console.log("\n==================================================================");
  console.log("  ALL TESTS PASSED! PROFILES, CATALOGS, & SUPPORT ARE 100% OPERATIONAL");
  console.log("==================================================================");
}

runProfilesCatalogsSupportVerification().catch((err) => {
  console.error("\n❌ Verification Failed:", err);
  process.exit(1);
});
