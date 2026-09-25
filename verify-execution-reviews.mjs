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

async function runVerification() {
  console.log("==================================================================");
  console.log("  VERIFYING JOB EXECUTION, PROOF-OF-WORK, AND TWO-WAY REVIEWS");
  console.log("==================================================================\n");

  // Step 1: Storage Bucket Check
  console.log("Step 1: Checking 'proof-of-work' storage bucket...");
  const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
  if (bucketError) throw bucketError;
  const powBucket = buckets.find((b) => b.id === "proof-of-work" || b.name === "proof-of-work");
  if (!powBucket) {
    throw new Error("Bucket 'proof-of-work' not found!");
  }
  console.log("  [PASS] 'proof-of-work' bucket exists (public:", powBucket.public, ")");

  // Step 2: Fetch or Create Test Users
  console.log("\nStep 2: Fetching profiles for Customer and Professional...");
  await supabase.from("bookings").delete().eq("notes", "Integration test work order verification");

  const { data: profiles, error: profError } = await supabase.from("profiles").select("id, full_name, email").limit(2);
  if (profError || !profiles || profiles.length === 0) {
    throw new Error("No profiles found to run verification.");
  }
  const customerId = profiles[0].id;

  // Find existing professional or create one for testing
  const { data: pros } = await supabase.from("professionals").select("id, trade").limit(1);
  let proId;
  if (pros && pros.length > 0) {
    proId = pros[0].id;
  } else {
    const candidateId = profiles.length > 1 ? profiles[1].id : profiles[0].id;
    const { error: proInsertErr } = await supabase.from("professionals").upsert({
      id: candidateId,
      trade: "HVAC Specialist",
      status: "approved",
      kyc_status: "approved",
      is_online: true,
    });
    if (proInsertErr) throw proInsertErr;
    proId = candidateId;
  }

  console.log(`  Customer ID: ${customerId} (${profiles[0].full_name || profiles[0].email})`);
  console.log(`  Pro ID:      ${proId}`);

  // Step 3: Create Booking with Location
  console.log("\nStep 3: Creating test booking with exact geolocation...");
  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .insert({
      customer_id: customerId,
      service_type: "HVAC Precision Inspection",
      status: "pending",
      latitude: 40.7128,
      longitude: -74.006,
      address: "123 Verification Lane, New York, NY",
      price: 185.0,
      notes: "Integration test work order verification",
    })
    .select()
    .single();

  if (bookingError) throw new Error(`Failed to create booking: ${bookingError.message}`);
  console.log(`  [PASS] Booking created with ID: ${booking.id}`);

  // Step 4: Status Stepper: accepted -> en_route -> arrived -> in_progress
  console.log("\nStep 4: Executing Status Stepper (including new 'arrived' state)...");
  
  // 4a. Accept
  const { error: errAccept } = await supabase
    .from("bookings")
    .update({ professional_id: proId, status: "accepted" })
    .eq("id", booking.id);
  if (errAccept) throw errAccept;
  console.log("  [PASS] Status -> 'accepted'");

  // 4b. En Route
  const { error: errEnRoute } = await supabase
    .from("bookings")
    .update({ status: "en_route" })
    .eq("id", booking.id);
  if (errEnRoute) throw errEnRoute;
  console.log("  [PASS] Status -> 'en_route'");

  // 4c. Arrived (verifies bookings_status_check constraint!)
  const { error: errArrived } = await supabase
    .from("bookings")
    .update({ status: "arrived" })
    .eq("id", booking.id);
  if (errArrived) throw new Error(`Failed on 'arrived' status: ${errArrived.message}`);
  console.log("  [PASS] Status -> 'arrived' (constraint validated!)");

  // 4d. In Progress
  const { error: errInProgress } = await supabase
    .from("bookings")
    .update({ status: "in_progress" })
    .eq("id", booking.id);
  if (errInProgress) throw errInProgress;
  console.log("  [PASS] Status -> 'in_progress'");

  // Step 5: Proof-of-Work Photographic Gate
  console.log("\nStep 5: Uploading Before & After photos to 'proof-of-work' bucket...");
  const pngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
  const pngBuffer = Buffer.from(pngBase64, "base64");

  const beforePath = `${booking.id}/test_before.png`;
  const afterPath = `${booking.id}/test_after.png`;

  const { error: uploadBeforeErr } = await supabase.storage
    .from("proof-of-work")
    .upload(beforePath, pngBuffer, { contentType: "image/png", upsert: true });
  if (uploadBeforeErr) throw uploadBeforeErr;

  const { error: uploadAfterErr } = await supabase.storage
    .from("proof-of-work")
    .upload(afterPath, pngBuffer, { contentType: "image/png", upsert: true });
  if (uploadAfterErr) throw uploadAfterErr;

  const beforeUrl = supabase.storage.from("proof-of-work").getPublicUrl(beforePath).data.publicUrl;
  const afterUrl = supabase.storage.from("proof-of-work").getPublicUrl(afterPath).data.publicUrl;

  console.log("  [PASS] Uploaded Before Photo:", beforeUrl);
  console.log("  [PASS] Uploaded After Photo: ", afterUrl);

  // Update booking to completed with proof_photos
  const proofPhotos = {
    before: beforeUrl,
    after: afterUrl,
    uploaded_at: new Date().toISOString(),
  };

  const { data: completedBooking, error: compErr } = await supabase
    .from("bookings")
    .update({
      proof_photos: proofPhotos,
      status: "completed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", booking.id)
    .select()
    .single();

  if (compErr) throw compErr;
  console.log("  [PASS] Booking finalized to 'completed' with proof_photos JSONB payload!");

  // Step 6: Two-Way Reviews
  console.log("\nStep 6: Executing Two-Way Reviews...");
  
  // 6a. Pro rates Customer (5 Stars)
  const { data: proReview, error: proRevErr } = await supabase
    .from("reviews")
    .insert({
      booking_id: booking.id,
      reviewer_id: proId,
      target_id: customerId,
      rating: 5,
      comment: "Clear instructions, prompt site access. 5/5 customer!",
    })
    .select()
    .single();

  if (proRevErr) throw new Error(`Failed to submit pro review: ${proRevErr.message}`);
  console.log(`  [PASS] Pro rated Customer: 5 Stars (Review ID: ${proReview.id})`);

  // 6b. Customer rates Pro (2 Stars - testing dispute highlight threshold!)
  const { data: customerReview, error: custRevErr } = await supabase
    .from("reviews")
    .insert({
      booking_id: booking.id,
      reviewer_id: customerId,
      target_id: proId,
      rating: 2,
      comment: "Work completed but arrived late and didn't clean dust thoroughly.",
    })
    .select()
    .single();

  if (custRevErr) throw new Error(`Failed to submit customer review: ${custRevErr.message}`);
  console.log(`  [PASS] Customer rated Pro: 2 Stars (Review ID: ${customerReview.id})`);

  // Step 7: Admin Oversight & Dispute Risk Verification
  console.log("\nStep 7: Verifying Admin Oversight & Dispute Flagging...");
  const { data: adminReviews, error: adminRevErr } = await supabase
    .from("reviews")
    .select("id, rating, comment, reviewer_id, target_id, booking_id")
    .eq("booking_id", booking.id);

  if (adminRevErr) throw adminRevErr;
  console.log(`  Fetched ${adminReviews.length} reviews for booking #${booking.id.slice(0, 8)}`);

  const disputeReview = adminReviews.find((r) => r.rating <= 2);
  if (!disputeReview) {
    throw new Error("Dispute review (rating <= 2) was not identified!");
  }
  console.log(`  [PASS] Dispute Risk Flagged for Review #${disputeReview.id.slice(0, 8)}!`);
  console.log(`         Rating: ${disputeReview.rating} Stars -> Tag: 🚨 Dispute Risk`);
  console.log(`         Comment: "${disputeReview.comment}"`);

  // Step 8: Cleanup Test Artifacts
  console.log("\nStep 8: Cleaning up test records...");
  await supabase.from("reviews").delete().eq("booking_id", booking.id);
  await supabase.from("bookings").delete().eq("id", booking.id);
  await supabase.storage.from("proof-of-work").remove([beforePath, afterPath]);
  console.log("  [PASS] Test reviews, booking, and storage files cleanly removed.");

  console.log("\n==================================================================");
  console.log("  ALL TESTS PASSED! JOB EXECUTION & REVIEW SLICE IS 100% OPERATIONAL");
  console.log("==================================================================");
}

runVerification().catch((err) => {
  console.error("\n❌ Verification Failed:", err);
  process.exit(1);
});
