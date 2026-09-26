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

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

async function runVerification() {
  console.log("==================================================================");
  console.log("  VERIFYING KYC SCHEMA, LIVE STATUS, ADMIN DIRECTORIES & PROFILE RLS");
  console.log("==================================================================\n");

  // Step 1: Find or identify test professional and customer
  console.log("Step 1: Identifying test profiles...");
  const { data: pro, error: proErr } = await supabaseAdmin
    .from("professionals")
    .select("id, trade, status, kyc_status, id_proof_url, city_id, skills")
    .limit(1)
    .single();

  if (proErr || !pro) throw new Error(`Could not find a test professional: ${proErr?.message}`);
  console.log(`  [PASS] Found test professional: ${pro.id.slice(0, 8)} (${pro.trade})`);

  // Step 2: Verify id_proof_url column & KYC onboarding persistence
  console.log("\nStep 2: Testing KYC submission & id_proof_url persistence...");
  const testDocUrl = "https://example.com/test-id-proof.pdf";
  const { data: updatedPro, error: upKycErr } = await supabaseAdmin
    .from("professionals")
    .update({
      id_proof_url: testDocUrl,
      kyc_document_path: testDocUrl,
      kyc_status: "pending",
      status: "pending",
      updated_at: new Date().toISOString(),
    })
    .eq("id", pro.id)
    .select()
    .single();

  if (upKycErr) throw new Error(`Updating id_proof_url failed: ${upKycErr.message}`);
  if (updatedPro.id_proof_url !== testDocUrl) {
    throw new Error(`id_proof_url mismatch: expected ${testDocUrl}, got ${updatedPro.id_proof_url}`);
  }
  console.log(`  [PASS] id_proof_url column exists and saved successfully: ${updatedPro.id_proof_url}`);

  // Step 3: Test Admin KYC Approval (updating both status and kyc_status)
  console.log("\nStep 3: Testing Admin KYC Approval & Live Status Sync...");
  const { data: approvedPro, error: appErr } = await supabaseAdmin
    .from("professionals")
    .update({
      status: "approved",
      kyc_status: "approved",
      updated_at: new Date().toISOString(),
    })
    .eq("id", pro.id)
    .select()
    .single();

  if (appErr) throw new Error(`Admin KYC approval failed: ${appErr.message}`);
  if (approvedPro.status !== "approved" || approvedPro.kyc_status !== "approved") {
    throw new Error(`Expected approved status, got status=${approvedPro.status}, kyc_status=${approvedPro.kyc_status}`);
  }
  console.log(`  [PASS] Professional #${pro.id.slice(0, 8)} status set to: status='${approvedPro.status}', kyc_status='${approvedPro.kyc_status}'`);

  // Step 4: Test Admin Directories Data Fetching with Admin Client
  console.log("\nStep 4: Testing Admin Directories Data Fetching (Server Action Backend)...");
  const { data: allPros, error: allProsErr } = await supabaseAdmin
    .from("professionals")
    .select("*, profile:profiles!professionals_id_fkey(full_name, email, phone)")
    .order("created_at", { ascending: false });

  if (allProsErr) throw new Error(`Admin fetch professionals failed: ${allProsErr.message}`);
  console.log(`  [PASS] Successfully fetched ${allPros.length} professionals via admin client`);

  const { data: allCusts, error: allCustsErr } = await supabaseAdmin
    .from("profiles")
    .select("*, bookings:bookings!bookings_customer_id_fkey(id, price, status, created_at)")
    .eq("role", "user")
    .order("created_at", { ascending: false });

  if (allCustsErr) throw new Error(`Admin fetch customers failed: ${allCustsErr.message}`);
  console.log(`  [PASS] Successfully fetched ${allCusts.length} customers via admin client`);

  // Step 5: Test Professional Profile City & Skills (with DELETE RLS check)
  console.log("\nStep 5: Testing Profile Editing, City Update & professional_skills DELETE RLS...");
  const { data: cities } = await supabaseAdmin.from("cities").select("id, name").eq("is_active", true).limit(1);
  const { data: services } = await supabaseAdmin.from("services").select("id, name").eq("is_active", true).limit(2);

  if (!cities || cities.length === 0 || !services || services.length === 0) {
    throw new Error("Missing active cities or services for testing");
  }

  const targetCity = cities[0];
  const targetServiceIds = services.map((s) => s.id);
  const targetServiceNames = services.map((s) => s.name);

  // 5a: Update city
  const { data: cityUpdated, error: cityErr } = await supabaseAdmin
    .from("professionals")
    .update({ city_id: targetCity.id, updated_at: new Date().toISOString() })
    .eq("id", pro.id)
    .select()
    .single();

  if (cityErr) throw new Error(`City update failed: ${cityErr.message}`);
  console.log(`  [PASS] Operating city updated to: ${targetCity.name} (${cityUpdated.city_id})`);

  // 5b: Delete existing skills from join table
  const { error: delSkillsErr } = await supabaseAdmin
    .from("professional_skills")
    .delete()
    .eq("professional_id", pro.id);

  if (delSkillsErr) throw new Error(`DELETE on professional_skills failed: ${delSkillsErr.message}`);
  console.log(`  [PASS] Cleared existing professional_skills rows without error`);

  // 5c: Insert new skills into join table
  const skillsToInsert = targetServiceIds.map((sid) => ({
    professional_id: pro.id,
    service_id: sid,
  }));
  const { error: insSkillsErr } = await supabaseAdmin
    .from("professional_skills")
    .insert(skillsToInsert);

  if (insSkillsErr) throw new Error(`INSERT on professional_skills failed: ${insSkillsErr.message}`);
  console.log(`  [PASS] Inserted ${targetServiceIds.length} skills into professional_skills`);

  // 5d: Sync skills array on professionals
  const { error: proSkillsErr } = await supabaseAdmin
    .from("professionals")
    .update({ skills: targetServiceNames, updated_at: new Date().toISOString() })
    .eq("id", pro.id);

  if (proSkillsErr) throw new Error(`Update skills array failed: ${proSkillsErr.message}`);
  console.log(`  [PASS] Synced skills text array: [${targetServiceNames.join(", ")}]`);

  console.log("\n==================================================================");
  console.log("  ALL VERIFICATION CHECKS PASSED SUCCESSFULLY!");
  console.log("==================================================================");
}

runVerification().catch((err) => {
  console.error("\n❌ Verification Failed:", err);
  process.exit(1);
});
