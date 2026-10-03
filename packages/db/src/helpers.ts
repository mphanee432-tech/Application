import type { Tables, TablesInsert, TablesUpdate } from "../types";
import { createBrowserSupabaseClient, type TypedSupabaseClient } from "./client";

export interface SupabaseHealthResult {
  ok: boolean;
  projectRef: string;
  url: string;
  latencyMs: number;
  error?: string;
  timestamp: string;
}

/**
 * Checks connection and latency against the linked Supabase instance.
 */
export async function checkSupabaseConnection(
  customClient?: TypedSupabaseClient
): Promise<SupabaseHealthResult> {
  const client = customClient ?? createBrowserSupabaseClient();
  const startTime = Date.now();
  const projectRef = "aiosgumdbgoxfssgxssj";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || `https://${projectRef}.supabase.co`;

  try {
    const { error } = await client.auth.getSession();
    const latencyMs = Date.now() - startTime;

    if (error) {
      return {
        ok: false,
        projectRef,
        url,
        latencyMs,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }

    return {
      ok: true,
      projectRef,
      url,
      latencyMs,
      timestamp: new Date().toISOString(),
    };
  } catch (err: unknown) {
    const latencyMs = Date.now() - startTime;
    const errorMessage = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      projectRef,
      url,
      latencyMs,
      error: errorMessage,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Auth & Profile Helpers
 */
export async function getCurrentSession(customClient?: TypedSupabaseClient) {
  const client = customClient ?? createBrowserSupabaseClient();
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function getCurrentUser(customClient?: TypedSupabaseClient) {
  const client = customClient ?? createBrowserSupabaseClient();
  const { data, error } = await client.auth.getUser();
  if (error) throw error;
  return data.user;
}

export async function fetchCurrentProfile(
  customClient?: TypedSupabaseClient
): Promise<Tables<"profiles"> | null> {
  const client = (customClient ?? createBrowserSupabaseClient()) as any;
  const user = await getCurrentUser(client);
  if (!user) return null;

  const { data, error } = await client
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return data as Tables<"profiles">;
}

export interface FetchProfessionalResult {
  success: boolean;
  data: (Tables<"professionals"> & { profile?: Tables<"profiles"> }) | null;
  error?: string;
}

export async function fetchCurrentProfessional(
  customClient?: TypedSupabaseClient
): Promise<FetchProfessionalResult> {
  try {
    const client = (customClient ?? createBrowserSupabaseClient()) as any;
    const user = await getCurrentUser(client);
    if (!user) {
      return { success: true, data: null };
    }

    const { data, error } = await client
      .from("professionals")
      .select("*, profile:profiles(*)")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      console.error("fetchCurrentProfessional error:", error);
      return {
        success: false,
        data: null,
        error: error.message || "Failed to load professional data from database.",
      };
    }

    return {
      success: true,
      data: (data as any) || null,
    };
  } catch (err: any) {
    console.error("fetchCurrentProfessional unexpected error:", err);
    return {
      success: false,
      data: null,
      error: err?.message || "An unexpected error occurred while loading professional profile.",
    };
  }
}

/**
 * Core Bookings - Customer Operations
 */
export async function createBooking(
  booking: {
    serviceType: string;
    cityId?: string;
    serviceId?: string;
    lat?: number;
    lng?: number;
    address?: string;
    price?: number;
    notes?: string;
    scheduledDate?: string;
  },
  customClient?: TypedSupabaseClient
): Promise<Tables<"bookings">> {
  const client = (customClient ?? createBrowserSupabaseClient()) as any;
  const user = await getCurrentUser(client);
  if (!user) throw new Error("Authentication required to create a booking.");

  const insertPayload: TablesInsert<"bookings"> = {
    customer_id: user.id,
    service_type: booking.serviceType,
    city_id: booking.cityId || null,
    service_id: booking.serviceId || null,
    status: "pending",
    lat: booking.lat ?? 37.7749,
    lng: booking.lng ?? -122.4194,
    address: booking.address ?? "Customer Location Pin",
    price: booking.price ?? 75.0,
    notes: booking.notes ?? null,
    scheduled_date: booking.scheduledDate || null,
  };

  const { data, error } = await client
    .from("bookings")
    .insert(insertPayload)
    .select()
    .single();

  if (error) throw error;
  return data as Tables<"bookings">;
}

export async function fetchCustomerBookings(
  customClient?: TypedSupabaseClient
): Promise<any[]> {
  const client = (customClient ?? createBrowserSupabaseClient()) as any;
  const user = await getCurrentUser(client);
  if (!user) return [];

  const { data, error } = await client
    .from("bookings")
    .select("*, professional:professionals(id, trade, rating, profile:profiles(full_name, phone))")
    .eq("customer_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Core Bookings - Professional Operations
 */
export interface FetchAvailableJobsResult {
  success: boolean;
  data: any[];
  error?: string;
}

export async function fetchAvailableJobs(
  professionalId?: string,
  customClient?: TypedSupabaseClient
): Promise<FetchAvailableJobsResult> {
  try {
    const client = (customClient ?? createBrowserSupabaseClient()) as any;
    let proId = professionalId;
    if (!proId) {
      const user = await getCurrentUser(client);
      if (user) proId = user.id;
    }

    if (!proId) return { success: true, data: [] };

    // 1. Fetch professional's profile to verify is_online and kyc_status
    const { data: pro, error: proError } = await client
      .from("professionals")
      .select("id, city_id, is_online, kyc_status, status")
      .eq("id", proId)
      .maybeSingle();

    if (proError) {
      console.error("fetchAvailableJobs pro query error:", proError);
      return {
        success: false,
        data: [],
        error: proError.message || "Failed to load professional record.",
      };
    }

    if (!pro) {
      return { success: true, data: [] };
    }

    // STRICT CHECK: ONLY return data if requesting professional is is_online = true AND kyc_status = 'approved' (or status = 'approved')
    const isApproved = pro.kyc_status === "approved" || pro.status === "approved";
    if (pro.is_online !== true || !isApproved || !pro.city_id) {
      return { success: true, data: [] };
    }

    // 2. Get professional's active skills (service_ids)
    const { data: skills, error: skillsError } = await client
      .from("professional_skills")
      .select("service_id")
      .eq("professional_id", proId);

    if (skillsError) {
      console.error("fetchAvailableJobs skills query error:", skillsError);
      return {
        success: false,
        data: [],
        error: skillsError.message || "Failed to load professional skills.",
      };
    }

    const serviceIds = (skills || []).map((s: any) => s.service_id).filter(Boolean);
    if (serviceIds.length === 0) return { success: true, data: [] };

    // 3. Strictly filter jobs where status = 'pending', city_id matches pro's city_id, and service_id in pro's skills
    const { data, error } = await client
      .from("bookings")
      .select("*, customer:profiles!bookings_customer_id_fkey(full_name, phone, email), services(name, description, base_price, icon)")
      .eq("status", "pending")
      .eq("city_id", pro.city_id)
      .in("service_id", serviceIds)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("fetchAvailableJobs query error:", error);
      return {
        success: false,
        data: [],
        error: error.message || "Failed to load available broadcast jobs.",
      };
    }
    return {
      success: true,
      data: data || [],
    };
  } catch (err: any) {
    console.error("fetchAvailableJobs unexpected exception:", err);
    return {
      success: false,
      data: [],
      error: err?.message || "An unexpected error occurred while loading available jobs.",
    };
  }
}

export async function fetchActiveJobsForPro(
  customClient?: TypedSupabaseClient
): Promise<any[]> {
  try {
    const client = (customClient ?? createBrowserSupabaseClient()) as any;
    const user = await getCurrentUser(client);
    if (!user) return [];

    const { data, error } = await client
      .from("bookings")
      .select("*, customer:profiles!bookings_customer_id_fkey(full_name, phone, email), services(name, description, base_price, icon)")
      .eq("professional_id", user.id)
      .in("status", ["accepted", "en_route", "arrived", "in_progress"])
      .order("scheduled_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("fetchActiveJobsForPro error:", error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error("fetchActiveJobsForPro unexpected exception:", err);
    return [];
  }
}

export async function fetchActiveJobForPro(
  customClient?: TypedSupabaseClient
): Promise<any | null> {
  const jobs = await fetchActiveJobsForPro(customClient);
  return jobs[0] || null;
}

export async function acceptJob(
  bookingId: string,
  customClient?: TypedSupabaseClient
): Promise<Tables<"bookings">> {
  const client = (customClient ?? createBrowserSupabaseClient()) as any;
  const user = await getCurrentUser(client);
  if (!user) throw new Error("Authentication required to accept a job.");

  const { data, error } = await client
    .from("bookings")
    .update({
      status: "accepted",
      professional_id: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", bookingId)
    .eq("status", "pending")
    .select()
    .single();

  if (error) throw error;
  return data as Tables<"bookings">;
}

export async function updateJobStatus(
  bookingId: string,
  status: "accepted" | "en_route" | "arrived" | "in_progress" | "completed" | "cancelled",
  customClient?: TypedSupabaseClient
): Promise<Tables<"bookings">> {
  const client = (customClient ?? createBrowserSupabaseClient()) as any;
  const { data, error } = await client
    .from("bookings")
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", bookingId)
    .select()
    .single();

  if (error) throw error;
  return data as Tables<"bookings">;
}

/**
 * Core Bookings & Management - Admin Operations
 */
export async function fetchAllBookingsAdmin(
  customClient?: TypedSupabaseClient
): Promise<any[]> {
  const client = (customClient ?? createBrowserSupabaseClient()) as any;
  const { data, error } = await client
    .from("bookings")
    .select("*, customer:profiles!bookings_customer_id_fkey(full_name, email, phone, mobile), professional:professionals(id, full_name, trade, rating, profile:profiles(full_name, email, phone, mobile))")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function fetchAllProfessionalsAdmin(
  customClient?: TypedSupabaseClient
): Promise<any[]> {
  try {
    const client = (customClient ?? createBrowserSupabaseClient()) as any;
    const { data, error } = await client
      .from("professionals")
      .select("*, profile:profiles!professionals_id_fkey(full_name, email, phone)")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("fetchAllProfessionalsAdmin error:", error.message);
      return [];
    }
    return data || [];
  } catch (err: any) {
    console.error("fetchAllProfessionalsAdmin unexpected error:", err?.message);
    return [];
  }
}

export async function bootstrapAdminAccount(
  customClient?: TypedSupabaseClient
): Promise<{ isSuperAdmin: boolean; created: boolean }> {
  const client = (customClient ?? createBrowserSupabaseClient()) as any;
  const user = await getCurrentUser(client);
  if (!user) throw new Error("Must be signed in to bootstrap admin.");

  // Check if any admin exists
  const { data: existingAdmins, error: checkError } = await client
    .from("admins")
    .select("id")
    .limit(1);

  if (checkError) throw checkError;

  if (!existingAdmins || existingAdmins.length === 0) {
    const { error: insertError } = await client
      .from("admins")
      .insert({ id: user.id, role: "super_admin" });

    if (insertError) throw insertError;
    return { isSuperAdmin: true, created: true };
  }

  // Check if current user is already admin
  const { data: currentAdmin } = await client
    .from("admins")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();

  return { isSuperAdmin: currentAdmin?.role === "super_admin", created: false };
}

/* ==========================================================================
   DYNAMIC CITIES & SERVICES
   ========================================================================== */

export async function fetchActiveCities(
  customClient?: TypedSupabaseClient
): Promise<Tables<"cities">[]> {
  const client = (customClient ?? createBrowserSupabaseClient()) as any;
  const { data, error } = await client
    .from("cities")
    .select("*")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function fetchAllCities(
  customClient?: TypedSupabaseClient
): Promise<Tables<"cities">[]> {
  const client = (customClient ?? createBrowserSupabaseClient()) as any;
  const { data, error } = await client
    .from("cities")
    .select("*")
    .order("name", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function fetchActiveServices(
  customClient?: TypedSupabaseClient
): Promise<Tables<"services">[]> {
  const client = (customClient ?? createBrowserSupabaseClient()) as any;
  const { data, error } = await client
    .from("services")
    .select("*")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function fetchAllServices(
  customClient?: TypedSupabaseClient
): Promise<Tables<"services">[]> {
  const client = (customClient ?? createBrowserSupabaseClient()) as any;
  const { data, error } = await client
    .from("services")
    .select("*")
    .order("name", { ascending: true });

  if (error) throw error;
  return data || [];
}

/* ==========================================================================
   GEOLOCATION BOOKING & ADDRESS STORAGE
   ========================================================================== */

export async function createBookingWithLocation(
  booking: {
    cityId?: string;
    serviceId?: string;
    serviceType: string;
    latitude: number;
    longitude: number;
    address: string;
    price: number;
    notes?: string;
    scheduledDate?: string;
    preferredTime?: string;
  },
  customClient?: TypedSupabaseClient
): Promise<Tables<"bookings">> {
  const client = (customClient ?? createBrowserSupabaseClient()) as any;
  const user = await getCurrentUser(client);
  if (!user) throw new Error("Authentication required to create a booking.");

  const formattedNotes = booking.preferredTime
    ? `${booking.notes ? booking.notes + " • " : ""}Time Slot: ${booking.preferredTime}`
    : booking.notes || null;

  const insertPayload: any = {
    customer_id: user.id,
    city_id: booking.cityId || null,
    service_id: booking.serviceId || null,
    service_type: booking.serviceType,
    status: "pending",
    latitude: booking.latitude,
    longitude: booking.longitude,
    lat: booking.latitude,
    lng: booking.longitude,
    address: booking.address,
    price: booking.price,
    notes: formattedNotes,
    scheduled_date: booking.scheduledDate || null,
  };

  const { data, error } = await client
    .from("bookings")
    .insert(insertPayload)
    .select()
    .single();

  if (error) throw error;
  return data as Tables<"bookings">;
}

export async function saveCustomerAddress(
  address: { address_line1: string; landmark?: string; lat: number; lng: number },
  customClient?: TypedSupabaseClient
): Promise<Tables<"customer_addresses">> {
  const client = (customClient ?? createBrowserSupabaseClient()) as any;
  const user = await getCurrentUser(client);
  if (!user) throw new Error("Must be logged in to save an address.");

  const { data, error } = await client
    .from("customer_addresses")
    .insert({
      user_id: user.id,
      address_line1: address.address_line1,
      landmark: address.landmark || null,
      lat: address.lat,
      lng: address.lng,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/* ==========================================================================
   PROFESSIONAL KYC & ONBOARDING
   ========================================================================== */

export async function submitProfessionalKycOnboarding(
  data: {
    trade?: string;
    fullName?: string;
    phone?: string;
    experienceYears?: number;
    hourlyRate?: number;
    cityId?: string;
    serviceIds?: string[];
    documentPath?: string;
  },
  idProofFileOrClient?: File | Blob | TypedSupabaseClient,
  customClient?: TypedSupabaseClient
): Promise<any> {
  const isFile =
    typeof idProofFileOrClient === "object" &&
    idProofFileOrClient !== null &&
    ("size" in idProofFileOrClient || "arrayBuffer" in idProofFileOrClient);

  const client = ((isFile ? customClient : idProofFileOrClient) ?? createBrowserSupabaseClient()) as any;
  const user = await getCurrentUser(client);
  if (!user) throw new Error("Must be authenticated to submit KYC.");

  let idProofUrl: string | null = data.documentPath || null;

  if (isFile) {
    const idProofFile = idProofFileOrClient as File | Blob;
    const fileExt = (idProofFile as File).name ? (idProofFile as File).name.split(".").pop() : "jpg";
    const filePath = `kyc-docs/${user.id}-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await client.storage
      .from("kyc-documents")
      .upload(filePath, idProofFile, { upsert: true });

    if (!uploadError) {
      const { data: publicUrlData } = client.storage
        .from("kyc-documents")
        .getPublicUrl(filePath);
      idProofUrl = publicUrlData.publicUrl;
    }
  }

  // Update profile
  if (data.fullName || data.phone) {
    await client
      .from("profiles")
      .update({
        ...(data.fullName ? { full_name: data.fullName } : {}),
        ...(data.phone ? { phone: data.phone, mobile: data.phone } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);
  }

  // Upsert professional record
  const proPayload: any = {
    id: user.id,
    trade: data.trade || "Certified Service Specialist",
    status: "pending",
    kyc_status: "pending",
    ...(idProofUrl ? { id_proof_url: idProofUrl } : {}),
    updated_at: new Date().toISOString(),
  };

  const { data: proData, error: proError } = await client
    .from("professionals")
    .upsert(proPayload)
    .select()
    .single();

  if (proError) throw proError;
  return proData;
}

/* ==========================================================================
   JOB EXECUTION & PROOF-OF-WORK PHOTOS
   ========================================================================== */

export async function uploadProofPhoto(
  file: File | Blob,
  bookingId: string,
  tag: "before" | "after",
  customClient?: TypedSupabaseClient
): Promise<string> {
  const client = (customClient ?? createBrowserSupabaseClient()) as any;
  const user = await getCurrentUser(client);
  if (!user) throw new Error("Authentication required to upload proof photo.");

  const fileExt = (file as File).name ? (file as File).name.split(".").pop() : "jpg";
  const filePath = `proofs/${bookingId}/${tag}-${Date.now()}.${fileExt}`;

  const { error: uploadError } = await client.storage
    .from("proof-of-work")
    .upload(filePath, file, {
      upsert: true,
      contentType: (file as File).type || "image/jpeg",
    });

  if (uploadError) throw uploadError;

  const { data: publicUrlData } = client.storage
    .from("proof-of-work")
    .getPublicUrl(filePath);

  return publicUrlData.publicUrl;
}

export async function finalizeJobWithProof(
  bookingId: string,
  proofPhotos: { before?: string; after?: string; notes?: string },
  customClient?: TypedSupabaseClient
): Promise<Tables<"bookings">> {
  const client = (customClient ?? createBrowserSupabaseClient()) as any;
  const { data, error } = await client
    .from("bookings")
    .update({
      status: "completed",
      proof_photos: {
        ...proofPhotos,
        uploaded_at: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", bookingId)
    .select("*, services(name)")
    .single();

  if (error) throw error;

  // Process Automated Financial Split (80% pro net earnings, 20% platform commission)
  try {
    if (data?.professional_id) {
      // 1. Fetch approved add-ons
      const { data: addons } = await client
        .from("job_addons")
        .select("cost")
        .eq("booking_id", bookingId)
        .eq("status", "approved");

      const addonsTotal = (addons || []).reduce((sum: number, a: any) => sum + Number(a.cost || 0), 0);
      const totalAmount = Number(data.price || 0) + addonsTotal;

      if (totalAmount > 0) {
        // Reconcile customer wallet deduction if needed
        if (data.customer_id) {
          try {
            const { data: custTx } = await client
              .from("transactions")
              .select("amount")
              .eq("booking_id", bookingId)
              .eq("user_id", data.customer_id)
              .eq("type", "booking_payment");

            const alreadyCharged = (custTx || []).reduce((sum: number, tx: any) => sum + Number(tx.amount || 0), 0);
            const remainingToDeduct = Math.max(0, Math.round((totalAmount - alreadyCharged) * 100) / 100);

            if (remainingToDeduct > 0) {
              const custWallet = await fetchUserWallet(data.customer_id, client);
              const newCustBalance = Number(custWallet.balance) - remainingToDeduct;

              await client
                .from("wallets")
                .update({
                  balance: newCustBalance,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", custWallet.id);

              await client.from("transactions").insert({
                wallet_id: custWallet.id,
                user_id: data.customer_id,
                booking_id: bookingId,
                type: "booking_payment",
                amount: remainingToDeduct,
                status: "completed",
                description: `Payment for ${data.services?.name || "Service"} (Order #${bookingId.slice(0, 8)})${addonsTotal > 0 ? " incl. approved add-ons" : ""}`,
                metadata: {
                  gross_amount: totalAmount,
                  already_charged: alreadyCharged,
                  deducted: remainingToDeduct,
                  addons_total: addonsTotal,
                },
              });
            }
          } catch (custErr) {
            console.warn("Customer wallet deduction warning in finalizeJobWithProof:", custErr);
          }
        }

        const platformFee = Math.round(totalAmount * 0.20 * 100) / 100;
        const netEarnings = Math.round((totalAmount - platformFee) * 100) / 100;

        // Fetch pro wallet
        const proWallet = await fetchUserWallet(data.professional_id, client);
        const newBalance = Number(proWallet.balance) + netEarnings;

        // Credit pro wallet
        await client
          .from("wallets")
          .update({
            balance: newBalance,
            updated_at: new Date().toISOString(),
          })
          .eq("id", proWallet.id);

        // Insert transaction for pro net earnings
        await client.from("transactions").insert({
          wallet_id: proWallet.id,
          user_id: data.professional_id,
          booking_id: bookingId,
          type: "booking_payment",
          amount: netEarnings,
          status: "completed",
          description: `Net earnings for ${data.services?.name || "Service"} (Order #${bookingId.slice(0, 8)}) - 80% payout`,
          metadata: {
            total_amount: totalAmount,
            platform_fee: platformFee,
            net_earnings: netEarnings,
            addons_included: addonsTotal,
          },
        });

        // Insert transaction for platform commission
        await client.from("transactions").insert({
          wallet_id: proWallet.id,
          user_id: data.professional_id,
          booking_id: bookingId,
          type: "platform_fee",
          amount: platformFee,
          status: "completed",
          description: `Platform Commission (20%) for Order #${bookingId.slice(0, 8)}`,
          metadata: {
            total_amount: totalAmount,
            platform_fee: platformFee,
            fee_percentage: 20,
          },
        });
      }
    }
  } catch (finErr) {
    console.warn("Automated financial split non-fatal warning:", finErr);
  }

  return data;
}

export const completeJob = finalizeJobWithProof;

export async function uploadProofOfWork(
  bookingId: string,
  beforeFile: File | Blob,
  afterFile: File | Blob,
  customClient?: TypedSupabaseClient
): Promise<Tables<"bookings">> {
  const beforeUrl = await uploadProofPhoto(beforeFile, bookingId, "before", customClient);
  const afterUrl = await uploadProofPhoto(afterFile, bookingId, "after", customClient);
  return finalizeJobWithProof(bookingId, { before: beforeUrl, after: afterUrl }, customClient);
}

/* ==========================================================================
   TWO-WAY REVIEWS & ADMIN AUDIT
   ========================================================================== */

export async function submitReview(
  payload: {
    bookingId: string;
    targetId?: string;
    rating: number;
    comment?: string;
  },
  customClient?: TypedSupabaseClient
): Promise<Tables<"reviews">> {
  const client = (customClient ?? createBrowserSupabaseClient()) as any;
  const user = await getCurrentUser(client);
  if (!user) throw new Error("Authentication required to submit review.");

  let targetId = payload.targetId;
  if (!targetId) {
    const { data: booking, error: bErr } = await client
      .from("bookings")
      .select("professional_id")
      .eq("id", payload.bookingId)
      .maybeSingle();

    if (bErr || !booking?.professional_id) {
      throw new Error("Unable to identify the professional for this booking.");
    }
    targetId = booking.professional_id;
  }

  const { data, error } = await client
    .from("reviews")
    .insert({
      booking_id: payload.bookingId,
      reviewer_id: user.id,
      target_id: targetId,
      rating: payload.rating,
      comment: payload.comment?.trim() || null,
    })
    .select()
    .single();

  if (error) throw error;

  // Background recalculation of professional rating & total jobs
  try {
    const { data: allReviews } = await client
      .from("reviews")
      .select("rating")
      .eq("target_id", targetId);

    if (allReviews && allReviews.length > 0) {
      const avg =
        allReviews.reduce((sum: number, r: any) => sum + Number(r.rating || 0), 0) /
        allReviews.length;
      await client
        .from("professionals")
        .update({
          rating: Math.round(avg * 10) / 10,
          total_jobs: allReviews.length,
          updated_at: new Date().toISOString(),
        })
        .eq("id", targetId);
    }
  } catch (calcErr) {
    console.warn("Could not update professional average rating:", calcErr);
  }

  return data;
}

export async function fetchBookingReviews(
  bookingId: string,
  customClient?: TypedSupabaseClient
): Promise<any[]> {
  const client = (customClient ?? createBrowserSupabaseClient()) as any;
  const { data, error } = await client
    .from("reviews")
    .select("*, reviewer:profiles!reviews_reviewer_id_fkey(full_name, role), target:profiles!reviews_target_id_fkey(full_name, role)")
    .eq("booking_id", bookingId);

  if (error) throw error;
  return data || [];
}

export async function fetchAllReviewsAdmin(
  customClient?: TypedSupabaseClient
): Promise<any[]> {
  const client = (customClient ?? createBrowserSupabaseClient()) as any;
  const { data, error } = await client
    .from("reviews")
    .select(`
      *,
      reviewer:profiles!reviews_reviewer_id_fkey(id, full_name, email, role),
      target:profiles!reviews_target_id_fkey(id, full_name, email, role),
      booking:bookings!reviews_booking_id_fkey(id, service_type, status, price, proof_photos)
    `)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

/* ==========================================================================
   PROFILES & PROFESSIONAL DATA
   ========================================================================== */

export async function updateUserProfile(
  payload: {
    full_name?: string;
    mobile?: string;
    phone?: string;
    email?: string;
    avatar_url?: string;
  },
  customClient?: TypedSupabaseClient
): Promise<Tables<"profiles">> {
  const client = (customClient ?? createBrowserSupabaseClient()) as any;
  const user = await getCurrentUser(client);
  if (!user) throw new Error("Authentication required.");

  const updateData: any = {
    updated_at: new Date().toISOString(),
  };
  if (payload.full_name !== undefined) updateData.full_name = payload.full_name;
  if (payload.mobile !== undefined) {
    updateData.mobile = payload.mobile;
    updateData.phone = payload.mobile;
  } else if (payload.phone !== undefined) {
    updateData.mobile = payload.phone;
    updateData.phone = payload.phone;
  }
  if (payload.email !== undefined) updateData.email = payload.email;
  if (payload.avatar_url !== undefined) updateData.avatar_url = payload.avatar_url;

  const { data, error } = await client
    .from("profiles")
    .update(updateData)
    .eq("id", user.id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateProfessionalProfile(
  payload: {
    full_name?: string;
    mobile?: string;
    trade?: string;
  },
  customClient?: TypedSupabaseClient
): Promise<any> {
  const client = (customClient ?? createBrowserSupabaseClient()) as any;
  const user = await getCurrentUser(client);
  if (!user) throw new Error("Authentication required.");

  await updateUserProfile(payload, client);

  if (payload.trade) {
    const { data, error } = await client
      .from("professionals")
      .update({
        trade: payload.trade,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  const proResult = await fetchCurrentProfessional(client);
  return proResult.data;
}

export async function fetchCurrentProfessionalProfile(
  customClient?: TypedSupabaseClient
): Promise<any> {
  const proResult = await fetchCurrentProfessional(customClient);
  return proResult.data;
}

/* ==========================================================================
   CUSTOMER ADDRESS BOOK (MULTI-ADDRESS & DEFAULT MANAGEMENT)
   ========================================================================== */

export async function fetchCustomerAddresses(
  customClient?: TypedSupabaseClient
): Promise<Tables<"customer_addresses">[]> {
  const client = (customClient ?? createBrowserSupabaseClient()) as any;
  const user = await getCurrentUser(client);
  if (!user) return [];

  const { data, error } = await client
    .from("customer_addresses")
    .select("*")
    .eq("user_id", user.id)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function createCustomerAddress(
  payload: {
    address_line1: string;
    landmark?: string;
    lat: number;
    lng: number;
    is_default?: boolean;
  },
  customClient?: TypedSupabaseClient
): Promise<Tables<"customer_addresses">> {
  const client = (customClient ?? createBrowserSupabaseClient()) as any;
  const user = await getCurrentUser(client);
  if (!user) throw new Error("Authentication required.");

  if (payload.is_default) {
    await client
      .from("customer_addresses")
      .update({ is_default: false })
      .eq("user_id", user.id);
  }

  const { data, error } = await client
    .from("customer_addresses")
    .insert({
      user_id: user.id,
      address_line1: payload.address_line1,
      landmark: payload.landmark || null,
      lat: payload.lat,
      lng: payload.lng,
      is_default: Boolean(payload.is_default),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateCustomerAddress(
  id: string,
  payload: Partial<{
    address_line1: string;
    landmark?: string;
    lat: number;
    lng: number;
    is_default?: boolean;
  }>,
  customClient?: TypedSupabaseClient
): Promise<Tables<"customer_addresses">> {
  const client = (customClient ?? createBrowserSupabaseClient()) as any;
  const user = await getCurrentUser(client);
  if (!user) throw new Error("Authentication required.");

  if (payload.is_default) {
    await client
      .from("customer_addresses")
      .update({ is_default: false })
      .eq("user_id", user.id);
  }

  const { data, error } = await client
    .from("customer_addresses")
    .update(payload)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteCustomerAddress(
  id: string,
  customClient?: TypedSupabaseClient
): Promise<boolean> {
  const client = (customClient ?? createBrowserSupabaseClient()) as any;
  const user = await getCurrentUser(client);
  if (!user) throw new Error("Authentication required.");

  const { error } = await client
    .from("customer_addresses")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw error;
  return true;
}

export async function setDefaultCustomerAddress(
  id: string,
  customClient?: TypedSupabaseClient
): Promise<Tables<"customer_addresses">> {
  const client = (customClient ?? createBrowserSupabaseClient()) as any;
  const user = await getCurrentUser(client);
  if (!user) throw new Error("Authentication required.");

  await client
    .from("customer_addresses")
    .update({ is_default: false })
    .eq("user_id", user.id);

  const { data, error } = await client
    .from("customer_addresses")
    .update({ is_default: true })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/* ==========================================================================
   CITY-WISE SERVICES & CATALOG MANAGEMENT
   ========================================================================== */

export async function fetchCityServices(
  cityId: string,
  customClient?: TypedSupabaseClient
): Promise<any[]> {
  const client = (customClient ?? createBrowserSupabaseClient()) as any;
  if (!cityId) return fetchActiveServices(client);

  const { data, error } = await client
    .from("city_services")
    .select("id, price, is_active, city_id, service:services(*)")
    .eq("city_id", cityId)
    .eq("is_active", true);

  if (error) {
    console.warn("Could not fetch city_services, falling back to base services:", error.message);
    return fetchActiveServices(client);
  }

  if (!data || data.length === 0) {
    return fetchActiveServices(client);
  }

  return data
    .filter((cs: any) => cs.service && cs.service.is_active)
    .map((cs: any) => ({
      ...cs.service,
      base_price: Number(cs.price), // override base_price with city-specific price!
      city_service_id: cs.id,
    }));
}

export async function fetchAllCityServicesAdmin(
  customClient?: TypedSupabaseClient
): Promise<any[]> {
  const client = (customClient ?? createBrowserSupabaseClient()) as any;
  const { data, error } = await client
    .from("city_services")
    .select("*, city:cities(id, name, is_active), service:services(id, name, base_price, is_active)")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function upsertCityServiceAdmin(
  cityId: string,
  serviceId: string,
  price: number,
  isActive: boolean = true,
  customClient?: TypedSupabaseClient
): Promise<any> {
  const client = (customClient ?? createBrowserSupabaseClient()) as any;
  const { data, error } = await client
    .from("city_services")
    .upsert(
      {
        city_id: cityId,
        service_id: serviceId,
        price,
        is_active: isActive,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "city_id,service_id" }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function createCityAdmin(
  name: string,
  customClient?: TypedSupabaseClient
): Promise<Tables<"cities">> {
  const client = (customClient ?? createBrowserSupabaseClient()) as any;
  const { data, error } = await client
    .from("cities")
    .insert({ name: name.trim(), is_active: true })
    .select()
    .single();

  if (error) throw error;

  try {
    const { data: svcs } = await client.from("services").select("id, base_price");
    if (svcs && svcs.length > 0) {
      const records = svcs.map((s: any) => ({
        city_id: data.id,
        service_id: s.id,
        price: s.base_price,
        is_active: true,
      }));
      await client.from("city_services").insert(records);
    }
  } catch (seedErr) {
    console.warn("Could not auto-seed city services:", seedErr);
  }

  return data;
}

export async function updateCityAdmin(
  id: string,
  payload: { name?: string; is_active?: boolean },
  customClient?: TypedSupabaseClient
): Promise<Tables<"cities">> {
  const client = (customClient ?? createBrowserSupabaseClient()) as any;
  const { data, error } = await client
    .from("cities")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteCityAdmin(
  id: string,
  customClient?: TypedSupabaseClient
): Promise<boolean> {
  const client = (customClient ?? createBrowserSupabaseClient()) as any;
  const { error } = await client.from("cities").delete().eq("id", id);
  if (error) throw error;
  return true;
}

export async function createServiceAdmin(
  name: string,
  basePrice: number,
  customClient?: TypedSupabaseClient
): Promise<Tables<"services">> {
  const client = (customClient ?? createBrowserSupabaseClient()) as any;
  const { data, error } = await client
    .from("services")
    .insert({
      name: name.trim(),
      base_price: basePrice,
      is_active: true,
    })
    .select()
    .single();

  if (error) throw error;

  try {
    const { data: allCities } = await client.from("cities").select("id");
    if (allCities && allCities.length > 0) {
      const records = allCities.map((c: any) => ({
        city_id: c.id,
        service_id: data.id,
        price: basePrice,
        is_active: true,
      }));
      await client.from("city_services").insert(records);
    }
  } catch (seedErr) {
    console.warn("Could not auto-seed city service:", seedErr);
  }

  return data;
}

export async function updateServiceAdmin(
  id: string,
  payload: { name?: string; base_price?: number; is_active?: boolean },
  customClient?: TypedSupabaseClient
): Promise<Tables<"services">> {
  const client = (customClient ?? createBrowserSupabaseClient()) as any;
  const { data, error } = await client
    .from("services")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteServiceAdmin(
  id: string,
  customClient?: TypedSupabaseClient
): Promise<boolean> {
  const client = (customClient ?? createBrowserSupabaseClient()) as any;
  const { error } = await client.from("services").delete().eq("id", id);
  if (error) throw error;
  return true;
}

/* ==========================================================================
   USER DIRECTORIES
   ========================================================================== */

export async function fetchAllCustomersAdmin(
  customClient?: TypedSupabaseClient
): Promise<any[]> {
  try {
    const client = (customClient ?? createBrowserSupabaseClient()) as any;
    const { data: customerProfiles, error: profileErr } = await client
      .from("profiles")
      .select("*, bookings:bookings!bookings_customer_id_fkey(id, price, status, created_at)")
      .in("role", ["customer", "user"])
      .order("created_at", { ascending: false });

    if (profileErr) {
      console.error("fetchAllCustomersAdmin error:", profileErr.message);
      return [];
    }

    return (customerProfiles || []).map((p: any) => ({
      ...p,
      mobile: p.mobile || p.phone,
      total_bookings: p.bookings ? p.bookings.length : 0,
      total_spent: p.bookings
        ? p.bookings.reduce((sum: number, b: any) => sum + (b.status === "completed" ? Number(b.price || 0) : 0), 0)
        : 0,
    }));
  } catch (err: any) {
    console.error("fetchAllCustomersAdmin unexpected error:", err?.message);
    return [];
  }
}

/* ==========================================================================
   CENTRALIZED SUPPORT TICKETS & CONVERSATION THREADS
   ========================================================================== */

export async function createSupportTicket(
  payload: {
    subject: string;
    message: string;
    creatorRole: "user" | "professional";
  },
  customClient?: TypedSupabaseClient
): Promise<Tables<"support_tickets">> {
  const client = (customClient ?? createBrowserSupabaseClient()) as any;
  const user = await getCurrentUser(client);
  if (!user) throw new Error("Authentication required to raise support ticket.");

  const { data, error } = await client
    .from("support_tickets")
    .insert({
      creator_id: user.id,
      creator_role: payload.creatorRole,
      subject: payload.subject.trim(),
      message: payload.message.trim(),
      status: "open",
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function fetchUserTickets(
  customClient?: TypedSupabaseClient
): Promise<any[]> {
  const client = (customClient ?? createBrowserSupabaseClient()) as any;
  const user = await getCurrentUser(client);
  if (!user) return [];

  const { data, error } = await client
    .from("support_tickets")
    .select("*, ticket_replies(id)")
    .eq("creator_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []).map((t: any) => ({
    ...t,
    reply_count: t.ticket_replies ? t.ticket_replies.length : 0,
  }));
}

export async function fetchTicketThread(
  ticketId: string,
  customClient?: TypedSupabaseClient
): Promise<any> {
  const client = (customClient ?? createBrowserSupabaseClient()) as any;

  const [ticketRes, repliesRes] = await Promise.all([
    client
      .from("support_tickets")
      .select("*, creator:profiles!support_tickets_creator_id_fkey(id, full_name, email, phone, mobile)")
      .eq("id", ticketId)
      .single(),
    client
      .from("ticket_replies")
      .select("*, sender:profiles!ticket_replies_sender_id_fkey(id, full_name, email, role)")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true }),
  ]);

  if (ticketRes.error) throw ticketRes.error;
  if (repliesRes.error) throw repliesRes.error;

  return {
    ...ticketRes.data,
    replies: repliesRes.data || [],
  };
}

export async function createTicketReply(
  payload: {
    ticketId: string;
    message: string;
    senderRole: "user" | "professional" | "admin";
  },
  customClient?: TypedSupabaseClient
): Promise<Tables<"ticket_replies">> {
  const client = (customClient ?? createBrowserSupabaseClient()) as any;
  const user = await getCurrentUser(client);
  if (!user) throw new Error("Authentication required to send reply.");

  const { data, error } = await client
    .from("ticket_replies")
    .insert({
      ticket_id: payload.ticketId,
      sender_id: user.id,
      sender_role: payload.senderRole,
      message: payload.message.trim(),
    })
    .select("*, sender:profiles!ticket_replies_sender_id_fkey(id, full_name, email, role)")
    .single();

  if (error) throw error;

  await client
    .from("support_tickets")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", payload.ticketId);

  return data;
}

export async function fetchAllTicketsAdmin(
  customClient?: TypedSupabaseClient
): Promise<any[]> {
  const client = (customClient ?? createBrowserSupabaseClient()) as any;
  const { data, error } = await client
    .from("support_tickets")
    .select(`
      *,
      creator:profiles!support_tickets_creator_id_fkey(id, full_name, email, phone, mobile),
      ticket_replies(id)
    `)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []).map((t: any) => ({
    ...t,
    reply_count: t.ticket_replies ? t.ticket_replies.length : 0,
  }));
}

export async function updateTicketStatusAdmin(
  ticketId: string,
  status: "open" | "resolved",
  customClient?: TypedSupabaseClient
): Promise<Tables<"support_tickets">> {
  const client = (customClient ?? createBrowserSupabaseClient()) as any;
  const { data, error } = await client
    .from("support_tickets")
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", ticketId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Financials & Wallets Helpers
 */

export async function fetchUserWallet(
  userId?: string,
  customClient?: TypedSupabaseClient
): Promise<Tables<"wallets">> {
  const client = (customClient ?? createBrowserSupabaseClient()) as any;
  let targetId = userId;
  if (!targetId) {
    const user = await getCurrentUser(client);
    if (!user) throw new Error("Authentication required to fetch wallet.");
    targetId = user.id;
  }

  const { data, error } = await client
    .from("wallets")
    .select("*")
    .eq("user_id", targetId)
    .maybeSingle();

  if (error) throw error;
  if (data) return data as Tables<"wallets">;

  // If wallet does not exist yet (e.g. legacy profile), create it
  const { data: newWallet, error: insertError } = await client
    .from("wallets")
    .insert({
      user_id: targetId,
      balance: 1000.00,
      promo_credits: 50.00,
      currency: "USD",
    })
    .select()
    .single();

  if (insertError) throw insertError;
  return newWallet as Tables<"wallets">;
}

export async function depositWalletFunds(
  amount: number,
  customClient?: TypedSupabaseClient
): Promise<{ wallet: Tables<"wallets">; transaction: Tables<"transactions"> }> {
  if (amount <= 0) throw new Error("Deposit amount must be greater than zero.");
  const client = (customClient ?? createBrowserSupabaseClient()) as any;
  const user = await getCurrentUser(client);
  if (!user) throw new Error("Authentication required to deposit funds.");

  const wallet = await fetchUserWallet(user.id, client);
  const newBalance = Number(wallet.balance) + amount;

  const { data: updatedWallet, error: walletError } = await client
    .from("wallets")
    .update({
      balance: newBalance,
      updated_at: new Date().toISOString(),
    })
    .eq("id", wallet.id)
    .select()
    .single();

  if (walletError) throw walletError;

  const { data: transaction, error: txError } = await client
    .from("transactions")
    .insert({
      wallet_id: wallet.id,
      user_id: user.id,
      type: "deposit",
      amount: amount,
      status: "completed",
      description: `Added ₹${amount.toFixed(2)} to in-app wallet`,
      metadata: { method: "instant_card_deposit" },
    })
    .select()
    .single();

  if (txError) throw txError;

  return { wallet: updatedWallet, transaction };
}

export const VALID_PROMO_CODES: Record<string, { credits: number; description: string }> = {
  WELCOME25: { credits: 25.00, description: "₹25 Welcome Bonus Credits" },
  HOMESERVE50: { credits: 50.00, description: "₹50 Platform Promo Credits" },
  SAVE10: { credits: 10.00, description: "₹10 Community Discount Credits" },
};

export async function redeemPromoCode(
  code: string,
  customClient?: TypedSupabaseClient
): Promise<{ wallet: Tables<"wallets">; transaction: Tables<"transactions">; amount: number }> {
  const cleanCode = code.trim().toUpperCase();
  const promo = VALID_PROMO_CODES[cleanCode];
  if (!promo) {
    throw new Error(`Invalid promo code '${code}'. Available codes: WELCOME25, HOMESERVE50, SAVE10.`);
  }

  const client = (customClient ?? createBrowserSupabaseClient()) as any;
  const user = await getCurrentUser(client);
  if (!user) throw new Error("Authentication required to redeem promo code.");

  // Check if already redeemed
  const { data: existingTx, error: checkError } = await client
    .from("transactions")
    .select("id")
    .eq("user_id", user.id)
    .eq("type", "promo_credit")
    .contains("metadata", { promo_code: cleanCode })
    .maybeSingle();

  if (checkError && checkError.code !== "PGRST116") throw checkError;
  if (existingTx) {
    throw new Error(`Promo code '${cleanCode}' has already been redeemed on this account.`);
  }

  const wallet = await fetchUserWallet(user.id, client);
  const newPromoCredits = Number(wallet.promo_credits) + promo.credits;

  const { data: updatedWallet, error: walletError } = await client
    .from("wallets")
    .update({
      promo_credits: newPromoCredits,
      updated_at: new Date().toISOString(),
    })
    .eq("id", wallet.id)
    .select()
    .single();

  if (walletError) throw walletError;

  const { data: transaction, error: txError } = await client
    .from("transactions")
    .insert({
      wallet_id: wallet.id,
      user_id: user.id,
      type: "promo_credit",
      amount: promo.credits,
      status: "completed",
      description: promo.description,
      metadata: { promo_code: cleanCode },
    })
    .select()
    .single();

  if (txError) throw txError;

  return { wallet: updatedWallet, transaction, amount: promo.credits };
}

export async function fetchUserTransactions(
  userId?: string,
  customClient?: TypedSupabaseClient
): Promise<Tables<"transactions">[]> {
  const client = (customClient ?? createBrowserSupabaseClient()) as any;
  let targetId = userId;
  if (!targetId) {
    const user = await getCurrentUser(client);
    if (!user) throw new Error("Authentication required to fetch transactions.");
    targetId = user.id;
  }

  const { data, error } = await client
    .from("transactions")
    .select("*, booking:bookings(id, service_id, status)")
    .eq("user_id", targetId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export interface ProEarningsMetrics {
  balance: number;
  promoCredits: number;
  todayEarnings: number;
  weekEarnings: number;
  monthEarnings: number;
  lifetimeEarnings: number;
  totalServiceFees: number;
  totalTips: number;
  totalCommissions: number;
  pendingPayouts: number;
}

export async function fetchProEarningsMetrics(
  proUserId?: string,
  customClient?: TypedSupabaseClient
): Promise<ProEarningsMetrics> {
  const client = (customClient ?? createBrowserSupabaseClient()) as any;
  let targetId = proUserId;
  if (!targetId) {
    const user = await getCurrentUser(client);
    if (!user) throw new Error("Authentication required.");
    targetId = user.id;
  }

  const wallet = await fetchUserWallet(targetId, client);

  // Fetch transactions for this pro
  const { data: transactions, error } = await client
    .from("transactions")
    .select("*")
    .eq("user_id", targetId);

  if (error) throw error;

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).getTime();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  let todayEarnings = 0;
  let weekEarnings = 0;
  let monthEarnings = 0;
  let lifetimeEarnings = 0;
  let totalServiceFees = 0;
  let totalTips = 0;
  let totalCommissions = 0;
  let pendingPayouts = 0;

  for (const tx of transactions || []) {
    const txTime = new Date(tx.created_at).getTime();
    const amt = Number(tx.amount);

    if (tx.type === "booking_payment" || tx.type === "tip" || tx.type === "deposit") {
      if (tx.status === "completed") {
        lifetimeEarnings += amt;
        if (txTime >= startOfMonth) monthEarnings += amt;
        if (txTime >= startOfWeek) weekEarnings += amt;
        if (txTime >= startOfDay) todayEarnings += amt;

        if (tx.type === "tip") totalTips += amt;
        else totalServiceFees += amt;
      }
    } else if (tx.type === "platform_fee") {
      totalCommissions += amt;
    } else if (tx.type === "payout" && tx.status === "pending") {
      pendingPayouts += amt;
    }
  }

  return {
    balance: Number(wallet.balance),
    promoCredits: Number(wallet.promo_credits),
    todayEarnings,
    weekEarnings,
    monthEarnings,
    lifetimeEarnings,
    totalServiceFees,
    totalTips,
    totalCommissions,
    pendingPayouts,
  };
}

export async function requestPayoutPro(
  amount: number,
  customClient?: TypedSupabaseClient
): Promise<Tables<"transactions">> {
  if (amount <= 0) throw new Error("Payout amount must be greater than zero.");
  const client = (customClient ?? createBrowserSupabaseClient()) as any;
  const user = await getCurrentUser(client);
  if (!user) throw new Error("Authentication required.");

  const wallet = await fetchUserWallet(user.id, client);
  const currentBalance = Number(wallet.balance);
  if (currentBalance < amount) {
    throw new Error(`Insufficient wallet balance ($${currentBalance.toFixed(2)}) for payout request ($${amount.toFixed(2)}).`);
  }

  // Deduct balance from wallet
  const { error: walletError } = await client
    .from("wallets")
    .update({
      balance: currentBalance - amount,
      updated_at: new Date().toISOString(),
    })
    .eq("id", wallet.id);

  if (walletError) throw walletError;

  // Insert pending payout transaction
  const { data: transaction, error: txError } = await client
    .from("transactions")
    .insert({
      wallet_id: wallet.id,
      user_id: user.id,
      type: "payout",
      amount: amount,
      status: "pending",
      description: `Instant Payout Request for $${amount.toFixed(2)}`,
      metadata: { requested_at: new Date().toISOString() },
    })
    .select()
    .single();

  if (txError) throw txError;
  return transaction;
}

export interface ApprovePayoutResult {
  success: boolean;
  data?: string;
  message?: string;
  error?: string;
}

export async function approvePayoutAdmin(
  transactionId: string,
  customClient?: TypedSupabaseClient
): Promise<ApprovePayoutResult> {
  try {
    const client = (customClient ?? createBrowserSupabaseClient()) as any;

    // Simulate 2-second bank transfer processing delay for realism
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const { data, error } = await client
      .from("transactions")
      .update({
        status: "completed",
        metadata: {
          approved_at: new Date().toISOString(),
          payout_disbursed: true,
          channel: "mock_automated_clearing_house",
        },
      })
      .eq("id", transactionId)
      .select("id");

    if (error) {
      console.error("approvePayoutAdmin error:", error.message);
      return { success: false, error: error.message || "Failed to approve payout." };
    }

    if (!data || data.length === 0) {
      return { success: false, error: "Transaction not found or could not be updated." };
    }

    return {
      success: true,
      data: data[0]?.id || transactionId,
      message: "Mock Bank Transfer Successful",
    };
  } catch (err: any) {
    console.error("approvePayoutAdmin unexpected error:", err?.message || err);
    return {
      success: false,
      error: err?.message || "An unexpected error occurred while approving payout.",
    };
  }
}

export async function fetchPlatformFinanceLedger(
  customClient?: TypedSupabaseClient
): Promise<{
  transactions: any[];
  metrics: {
    totalVolume: number;
    platformCommissions: number;
    pendingPayouts: number;
    completedPayouts: number;
  };
}> {
  const client = (customClient ?? createBrowserSupabaseClient()) as any;
  const { data, error } = await client
    .from("transactions")
    .select(`
      *,
      user:profiles!transactions_user_id_fkey(id, full_name, email, phone, role)
    `)
    .order("created_at", { ascending: false });

  if (error) throw error;

  let totalVolume = 0;
  let platformCommissions = 0;
  let pendingPayouts = 0;
  let completedPayouts = 0;

  for (const tx of data || []) {
    const amt = Number(tx.amount);
    if (tx.type === "deposit" || tx.type === "booking_payment") {
      totalVolume += amt;
    } else if (tx.type === "platform_fee") {
      platformCommissions += amt;
    } else if (tx.type === "payout") {
      if (tx.status === "pending") pendingPayouts += amt;
      else if (tx.status === "completed") completedPayouts += amt;
    }
  }

  // Calculate gross booking revenue from completed bookings + approved add-ons
  const { data: completedBookings } = await client
    .from("bookings")
    .select("price")
    .eq("status", "completed");

  const completedBookingsGross = (completedBookings || []).reduce(
    (sum: number, b: any) => sum + Number(b.price || 0),
    0
  );

  const { data: approvedAddons } = await client
    .from("job_addons")
    .select("cost")
    .eq("status", "approved");

  const addonsTotal = (approvedAddons || []).reduce(
    (acc: number, a: any) => acc + Number(a.cost || 0),
    0
  );

  const totalGrossBookingVolume = completedBookingsGross + addonsTotal;
  const calculatedGross = totalGrossBookingVolume > 0 ? totalGrossBookingVolume : totalVolume;
  const calculatedCommission =
    platformCommissions > 0
      ? platformCommissions
      : Math.round(calculatedGross * 0.20 * 100) / 100;

  return {
    transactions: data || [],
    metrics: {
      totalVolume: calculatedGross,
      platformCommissions: calculatedCommission,
      pendingPayouts,
      completedPayouts,
    },
  };
}

/**
 * Trust & Safety / SOS Alerts Helpers
 */

export async function createSosAlert(
  payload: {
    lat: number;
    lng: number;
    reason?: string;
    bookingId?: string;
    creatorRole: "user" | "professional";
  },
  customClient?: TypedSupabaseClient
): Promise<Tables<"sos_alerts">> {
  const client = (customClient ?? createBrowserSupabaseClient()) as any;
  const user = await getCurrentUser(client);
  if (!user) throw new Error("Authentication required to trigger emergency SOS.");

  const { data, error } = await client
    .from("sos_alerts")
    .insert({
      creator_id: user.id,
      creator_role: payload.creatorRole,
      booking_id: payload.bookingId || null,
      lat: payload.lat,
      lng: payload.lng,
      status: "active",
      reason: payload.reason || "Emergency Assistance Requested",
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function fetchUserSosAlerts(
  customClient?: TypedSupabaseClient
): Promise<Tables<"sos_alerts">[]> {
  const client = (customClient ?? createBrowserSupabaseClient()) as any;
  const user = await getCurrentUser(client);
  if (!user) throw new Error("Authentication required.");

  const { data, error } = await client
    .from("sos_alerts")
    .select("*")
    .eq("creator_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function fetchActiveSosAlertsAdmin(
  customClient?: TypedSupabaseClient
): Promise<{ success: boolean; data?: any[]; error?: string }> {
  try {
    const client = (customClient ?? createBrowserSupabaseClient()) as any;
    const { data, error } = await client
      .from("sos_alerts")
      .select(`
        *,
        creator:profiles!sos_alerts_creator_id_fkey(id, full_name, email, phone, mobile, role),
        booking:bookings!sos_alerts_booking_id_fkey(id, service_id, status, scheduled_date, latitude, longitude),
        resolver:profiles!sos_alerts_resolved_by_fkey(id, full_name, email)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("fetchActiveSosAlertsAdmin DB error:", error.message);
      return { success: false, error: error.message };
    }
    return { success: true, data: data || [] };
  } catch (err: any) {
    console.error("fetchActiveSosAlertsAdmin unexpected error:", err);
    return { success: false, error: err?.message || "Failed to fetch SOS alerts" };
  }
}

export async function resolveSosAlertAdmin(
  alertId: string,
  notes?: string,
  customClient?: TypedSupabaseClient
): Promise<Tables<"sos_alerts">> {
  const client = (customClient ?? createBrowserSupabaseClient()) as any;
  const admin = await getCurrentUser(client);
  if (!admin) throw new Error("Admin authentication required.");

  const { data, error } = await client
    .from("sos_alerts")
    .update({
      status: "resolved",
      notes: notes || "Resolved by Admin Dispatch",
      resolved_at: new Date().toISOString(),
      resolved_by: admin.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", alertId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ── Chat Helpers ──
export async function fetchChatMessages(
  bookingId: string,
  channelTypeOrClient?: "professional" | "admin" | string | TypedSupabaseClient,
  customClient?: TypedSupabaseClient
): Promise<any[]> {
  let channelType: string | undefined;
  let client: any;

  if (channelTypeOrClient && typeof channelTypeOrClient === "object" && "from" in channelTypeOrClient) {
    client = channelTypeOrClient;
  } else {
    channelType = typeof channelTypeOrClient === "string" ? channelTypeOrClient : undefined;
    client = (customClient ?? createBrowserSupabaseClient()) as any;
  }

  let query = client
    .from("chat_messages")
    .select("*, sender:profiles!chat_messages_sender_id_fkey(full_name, role)")
    .eq("booking_id", bookingId);

  if (channelType) {
    query = query.or(`channel_type.eq.${channelType},channel_type.is.null`);
  }

  const { data, error } = await query.order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function sendChatMessage(
  bookingId: string,
  message: string,
  optionsOrClient?:
    | {
        channelType?: "professional" | "admin" | string;
        isAdmin?: boolean;
        participantRole?: "customer" | "professional" | "admin" | string;
      }
    | TypedSupabaseClient,
  customClient?: TypedSupabaseClient
): Promise<any> {
  let opts: { channelType?: string; isAdmin?: boolean; participantRole?: string } = {};
  let client: any;

  if (optionsOrClient && typeof optionsOrClient === "object" && "from" in optionsOrClient) {
    client = optionsOrClient;
  } else {
    opts = (optionsOrClient as any) || {};
    client = (customClient ?? createBrowserSupabaseClient()) as any;
  }

  const user = await getCurrentUser(client);
  if (!user) throw new Error("Not authenticated");

  const insertPayload = {
    booking_id: bookingId,
    sender_id: user.id,
    message,
    channel_type: opts.channelType || "professional",
    is_admin: opts.isAdmin ?? false,
    participant_role: opts.participantRole || "customer",
  };

  const { data, error } = await client
    .from("chat_messages")
    .insert(insertPayload)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ── Scheduling / Availability Helpers ──
export async function fetchProfessionalAvailability(
  professionalId: string,
  customClient?: TypedSupabaseClient
): Promise<any[]> {
  const client = (customClient ?? createBrowserSupabaseClient()) as any;
  const { data, error } = await client
    .from("professional_availability")
    .select("*")
    .eq("professional_id", professionalId)
    .order("day_of_week", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function upsertProfessionalAvailability(
  professionalId: string,
  slots: Array<{ day_of_week: number; start_time: string; end_time: string; is_active: boolean }>,
  customClient?: TypedSupabaseClient
): Promise<void> {
  const client = (customClient ?? createBrowserSupabaseClient()) as any;
  await client.from("professional_availability").delete().eq("professional_id", professionalId);
  if (slots.length > 0) {
    const rows = slots.map((s) => ({ ...s, professional_id: professionalId }));
    const { error } = await client.from("professional_availability").insert(rows);
    if (error) throw error;
  }
}

export async function updateBlockoutDates(
  professionalId: string,
  blockoutDates: string[],
  customClient?: TypedSupabaseClient
): Promise<void> {
  const client = (customClient ?? createBrowserSupabaseClient()) as any;
  const { error } = await client
    .from("professional_availability")
    .update({ blockout_dates: blockoutDates })
    .eq("professional_id", professionalId);
  if (error) throw error;
}

// ── Cancellation & Rescheduling Helpers ──
export async function cancelBooking(
  bookingId: string,
  reason: string,
  fee: number = 0,
  customClient?: TypedSupabaseClient
): Promise<any> {
  const client = (customClient ?? createBrowserSupabaseClient()) as any;
  const user = await getCurrentUser(client);
  if (!user) throw new Error("Not authenticated");
  const { data, error } = await client
    .from("bookings")
    .update({
      status: "cancelled",
      cancellation_reason: reason,
      cancellation_fee: fee,
      cancelled_by: user.id,
    })
    .eq("id", bookingId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function rescheduleBooking(
  bookingId: string,
  newScheduledDate: string,
  customClient?: TypedSupabaseClient
): Promise<any> {
  const client = (customClient ?? createBrowserSupabaseClient()) as any;
  const { data, error } = await client
    .from("bookings")
    .update({ scheduled_date: newScheduledDate })
    .eq("id", bookingId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function fetchCancelledBookings(
  customClient?: TypedSupabaseClient
): Promise<any[]> {
  const client = (customClient ?? createBrowserSupabaseClient()) as any;
  const { data, error } = await client
    .from("bookings")
    .select("*, customer:profiles!bookings_customer_id_fkey(full_name, email), services(name), professional:professionals(id, full_name)")
    .eq("status", "cancelled")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function fetchCompletedBookingsForPro(
  professionalId: string,
  customClient?: TypedSupabaseClient
): Promise<any[]> {
  const client = (customClient ?? createBrowserSupabaseClient()) as any;
  const { data, error } = await client
    .from("bookings")
    .select("*, customer:profiles!bookings_customer_id_fkey(full_name, phone, email), services(name, description, base_price, icon)")
    .eq("professional_id", professionalId)
    .in("status", ["completed", "cancelled"])
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

// ── SLA Escalation Helpers ──
export async function fetchSlaEscalatedBookings(
  thresholdMinutes: number = 10,
  customClient?: TypedSupabaseClient
): Promise<any[]> {
  const client = (customClient ?? createBrowserSupabaseClient()) as any;
  const { data, error } = await client
    .from("bookings")
    .select("*, customer:profiles!bookings_customer_id_fkey(full_name, email, mobile), services(name, description, base_price)")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) throw error;
  if (!data) return [];

  const now = Date.now();
  return data
    .map((b: any) => {
      const createdAt = new Date(b.creation_time || b.created_at).getTime();
      const elapsedMinutes = Math.floor((now - createdAt) / 60000);
      return { ...b, elapsedMinutes, isBreached: elapsedMinutes >= thresholdMinutes };
    })
    .filter((b: any) => b.elapsedMinutes >= Math.max(thresholdMinutes - 5, 0));
}

export async function forceAssignBookingAdmin(
  bookingId: string,
  professionalId: string,
  customClient?: TypedSupabaseClient
): Promise<any> {
  const client = (customClient ?? createBrowserSupabaseClient()) as any;
  const { data, error } = await client
    .from("bookings")
    .update({
      professional_id: professionalId,
      status: "accepted",
      dispatch_status: "assigned",
      updated_at: new Date().toISOString(),
    })
    .eq("id", bookingId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ── Professional Skills & City Operations ──
export async function fetchProfessionalSkills(
  professionalId: string,
  customClient?: TypedSupabaseClient
): Promise<string[]> {
  const client = (customClient ?? createBrowserSupabaseClient()) as any;
  const { data, error } = await client
    .from("professional_skills")
    .select("service_id")
    .eq("professional_id", professionalId);

  if (error) {
    console.error("Error fetching professional skills:", error);
    return [];
  }
  return (data || []).map((s: any) => s.service_id);
}

export async function updateProfessionalCity(
  professionalId: string,
  cityId: string,
  customClient?: TypedSupabaseClient
): Promise<{ success: boolean; error?: string }> {
  try {
    const client = (customClient ?? createBrowserSupabaseClient()) as any;
    const { error } = await client
      .from("professionals")
      .update({ city_id: cityId, updated_at: new Date().toISOString() })
      .eq("id", professionalId);

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    console.error("Error updating professional city:", err);
    return { success: false, error: err?.message || "Failed to update city." };
  }
}

export async function updateProfessionalSkills(
  professionalId: string,
  serviceIds: string[],
  customClient?: TypedSupabaseClient
): Promise<{ success: boolean; error?: string; count?: number }> {
  try {
    const client = (customClient ?? createBrowserSupabaseClient()) as any;
    // 1. Delete all existing skills
    const { error: deleteError } = await client
      .from("professional_skills")
      .delete()
      .eq("professional_id", professionalId);

    if (deleteError) throw deleteError;

    // 2. Insert new skills
    if (serviceIds.length > 0) {
      const rows = serviceIds.map((sid) => ({
        professional_id: professionalId,
        service_id: sid,
      }));
      const { error: insertError } = await client
        .from("professional_skills")
        .insert(rows);

      if (insertError) throw insertError;
    }

    return { success: true, count: serviceIds.length };
  } catch (err: any) {
    console.error("Error updating professional skills:", err);
    return { success: false, error: err?.message || "Failed to update skills." };
  }
}

export async function fetchCitiesAndServices(
  customClient?: TypedSupabaseClient
): Promise<{ cities: Tables<"cities">[]; services: Tables<"services">[] }> {
  const [cities, services] = await Promise.all([
    fetchActiveCities(customClient),
    fetchActiveServices(customClient),
  ]);
  return { cities, services };
}

// ── Professional Online Status Toggle ──
export async function setProfessionalOnlineStatus(
  isOnlineOrId: boolean | string,
  isOnlineOrClient?: boolean | TypedSupabaseClient,
  customClient?: TypedSupabaseClient
): Promise<{ success: boolean; error?: string }> {
  try {
    let proId: string | undefined;
    let isOnline: boolean;
    let client: any;

    if (typeof isOnlineOrId === "string") {
      proId = isOnlineOrId;
      isOnline = typeof isOnlineOrClient === "boolean" ? isOnlineOrClient : true;
      client = (customClient ?? createBrowserSupabaseClient()) as any;
    } else {
      isOnline = isOnlineOrId;
      client = (isOnlineOrClient && typeof isOnlineOrClient === "object"
        ? isOnlineOrClient
        : customClient ?? createBrowserSupabaseClient()) as any;
      const user = await getCurrentUser(client);
      if (!user) return { success: false, error: "Authentication required." };
      proId = user.id;
    }

    const { error } = await client
      .from("professionals")
      .update({ is_online: isOnline, updated_at: new Date().toISOString() })
      .eq("id", proId);

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    console.error("setProfessionalOnlineStatus error:", err);
    return { success: false, error: err?.message || "Failed to update online status." };
  }
}

export async function fetchBookingReview(
  bookingId: string,
  customClient?: TypedSupabaseClient
): Promise<Tables<"reviews"> | null> {
  try {
    const client = (customClient ?? createBrowserSupabaseClient()) as any;
    const { data, error } = await client
      .from("reviews")
      .select("*")
      .eq("booking_id", bookingId)
      .maybeSingle();

    if (error) return null;
    return (data as Tables<"reviews">) || null;
  } catch {
    return null;
  }
}

// ── Booking Auto-Dispatch & Eligible Professionals Matching ──
export async function findEligibleProfessionalsForBooking(
  bookingId: string,
  customClient?: TypedSupabaseClient
): Promise<any[]> {
  try {
    const client = (customClient ?? createBrowserSupabaseClient()) as any;
    const { data: booking, error: bErr } = await client
      .from("bookings")
      .select("city_id, service_id")
      .eq("id", bookingId)
      .maybeSingle();

    if (bErr || !booking) return [];

    // Strictly query professionals who are is_online = true
    let query = client
      .from("professionals")
      .select("*, profile:profiles!professionals_id_fkey(full_name, phone, email)")
      .eq("is_online", true);

    if (booking.city_id) {
      query = query.eq("city_id", booking.city_id);
    }

    const { data: pros, error: pErr } = await query;
    if (pErr || !pros) return [];

    // Filter approved KYC status
    const approvedPros = pros.filter(
      (p: any) => p.status === "approved" || p.kyc_status === "approved"
    );

    // If booking has a service_id, filter by professional's skills if skills exist
    if (booking.service_id && approvedPros.length > 0) {
      const proIds = approvedPros.map((p: any) => p.id);
      const { data: skills } = await client
        .from("professional_skills")
        .select("professional_id, service_id")
        .in("professional_id", proIds)
        .eq("service_id", booking.service_id);

      if (skills && skills.length > 0) {
        const skilledProIds = new Set(skills.map((s: any) => s.professional_id));
        return approvedPros.filter((p: any) => skilledProIds.has(p.id));
      }
    }

    return approvedPros;
  } catch (err) {
    console.error("findEligibleProfessionalsForBooking error:", err);
    return [];
  }
}

// ── Ongoing Booking Drill-Down Details ──
export async function fetchBookingDetails(
  bookingId: string,
  customClient?: TypedSupabaseClient
): Promise<any | null> {
  try {
    const client = (customClient ?? createBrowserSupabaseClient()) as any;
    const { data, error } = await client
      .from("bookings")
      .select(
        "*, customer:profiles!bookings_customer_id_fkey(full_name, phone, email, mobile), professional:professionals(id, full_name, trade, rating, profile:profiles(full_name, phone, email, mobile)), services(name, description, base_price, icon)"
      )
      .eq("id", bookingId)
      .maybeSingle();

    if (error) {
      console.error("fetchBookingDetails error:", error);
      return null;
    }
    return data || null;
  } catch (err) {
    console.error("fetchBookingDetails unexpected error:", err);
    return null;
  }
}

/* ==========================================================================
   CENTRALIZED NOTIFICATIONS & BROADCASTS
   ========================================================================== */

export async function fetchUserNotifications(
  customClient?: TypedSupabaseClient
): Promise<{ success: boolean; data?: any[]; error?: string }> {
  try {
    const client = (customClient ?? createBrowserSupabaseClient()) as any;
    const user = await getCurrentUser(client);
    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    const { data, error } = await client
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, data: data || [] };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to fetch notifications" };
  }
}

export async function markNotificationAsRead(
  notificationId: string,
  customClient?: TypedSupabaseClient
): Promise<{ success: boolean; error?: string }> {
  try {
    const client = (customClient ?? createBrowserSupabaseClient()) as any;
    const user = await getCurrentUser(client);
    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    const { error } = await client
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notificationId)
      .eq("user_id", user.id);

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to mark notification as read" };
  }
}

export async function sendAdminBroadcast(
  params: {
    title: string;
    message: string;
    targetAudience?: "all" | "customers" | "professionals" | "both";
    audience?: "all" | "customers" | "professionals" | "both";
  },
  customClient?: TypedSupabaseClient
): Promise<{ success: boolean; count?: number; error?: string }> {
  try {
    const client = (customClient ?? createBrowserSupabaseClient()) as any;
    const audience = (params.audience || params.targetAudience || "all") as string;
    let targetUserIds: string[] = [];

    if (audience === "professionals") {
      // Query ONLY the professionals table to get pro IDs
      const { data: pros, error: proErr } = await client.from("professionals").select("id");
      if (proErr) throw proErr;
      targetUserIds = (pros || []).map((p: any) => p.id as string);
    } else if (audience === "customers") {
      // Query profiles table for customer IDs, strictly excluding any professional IDs
      const { data: pros } = await client.from("professionals").select("id");
      const proIdSet = new Set<string>((pros || []).map((p: any) => p.id as string));

      const { data: profiles, error: profErr } = await client.from("profiles").select("id, role");
      if (profErr) throw profErr;

      targetUserIds = (profiles || [])
        .filter((p: any) => !proIdSet.has(p.id) && p.role !== "professional")
        .map((p: any) => p.id as string);
    } else {
      // "all" or "both" - query profiles table to reach all users
      const { data: profiles, error: profErr } = await client.from("profiles").select("id");
      if (profErr) throw profErr;
      targetUserIds = (profiles || []).map((p: any) => p.id as string);
    }

    // Deduplicate
    const uniqueIds = Array.from(new Set(targetUserIds));
    if (uniqueIds.length === 0) {
      return { success: true, count: 0 };
    }

    const rows = uniqueIds.map((uid) => ({
      user_id: uid,
      title: params.title,
      message: params.message,
      type: "admin_broadcast",
      is_read: false,
    }));

    const { error } = await client.from("notifications").insert(rows);
    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, count: rows.length };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to broadcast notifications" };
  }
}

/* ==========================================================================
   IN-JOB UPSELL & CROSS-SELL ADD-ONS
   ========================================================================== */

export async function fetchBookingAddons(
  bookingId: string,
  customClient?: TypedSupabaseClient
): Promise<{ success: boolean; data?: any[]; error?: string }> {
  try {
    const client = (customClient ?? createBrowserSupabaseClient()) as any;
    const { data, error } = await client
      .from("job_addons")
      .select("*, service:services(id, name, base_price, icon)")
      .eq("booking_id", bookingId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("fetchBookingAddons DB error:", error.message);
      return { success: false, error: error.message };
    }
    return { success: true, data: data || [] };
  } catch (err: any) {
    const msg = err?.message || String(err) || "fetchBookingAddons failed";
    console.error("fetchBookingAddons unexpected error:", msg);
    return { success: false, error: msg };
  }
}

export async function createBookingAddon(
  payload: {
    bookingId: string;
    serviceId?: string;
    itemName?: string;
    customDescription?: string;
    cost: number;
    photoFileOrUrl?: File | Blob | string;
  },
  customClient?: TypedSupabaseClient
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const client = (customClient ?? createBrowserSupabaseClient()) as any;
    const user = await getCurrentUser(client);
    if (!user) {
      return { success: false, error: "Must be authenticated to propose add-on." };
    }

    let photoUrl: string | null = null;
    if (typeof payload.photoFileOrUrl === "string") {
      photoUrl = payload.photoFileOrUrl;
    } else if (payload.photoFileOrUrl) {
      const file = payload.photoFileOrUrl as File;
      const fileExt = file.name ? file.name.split(".").pop() : "jpg";
      const filePath = `addons/${payload.bookingId}/addon-${Date.now()}.${fileExt}`;

      const { error: upErr } = await client.storage
        .from("proof-of-work")
        .upload(filePath, file, {
          upsert: true,
          contentType: file.type || "image/jpeg",
        });

      if (!upErr) {
        const { data: pubData } = client.storage
          .from("proof-of-work")
          .getPublicUrl(filePath);
        photoUrl = pubData.publicUrl;
      }
    }

    const itemName = payload.itemName || payload.customDescription || "Additional Service / Part";

    const { data, error } = await client
      .from("job_addons")
      .insert({
        booking_id: payload.bookingId,
        service_id: payload.serviceId || null,
        item_name: itemName,
        custom_description: payload.customDescription || itemName,
        cost: Number(payload.cost),
        photo_url: photoUrl,
        status: "pending",
      })
      .select("*, service:services(id, name, base_price, icon)")
      .single();

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to create add-on." };
  }
}

export async function updateBookingAddonStatus(
  addonId: string,
  status: "approved" | "declined",
  customClient?: TypedSupabaseClient
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const client = (customClient ?? createBrowserSupabaseClient()) as any;
    const { data, error } = await client
      .from("job_addons")
      .update({ status })
      .eq("id", addonId)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to update add-on status." };
  }
}

export async function deleteJobAddon(
  addonId: string,
  customClient?: TypedSupabaseClient
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const client = (customClient ?? createBrowserSupabaseClient()) as any;
    const { data, error } = await client
      .from("job_addons")
      .delete()
      .eq("id", addonId)
      .eq("status", "pending")
      .select()
      .maybeSingle();

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to delete add-on." };
  }
}

export const deleteBookingAddon = deleteJobAddon;

export async function fetchBookingTotalWithAddons(
  bookingId: string,
  customClient?: TypedSupabaseClient
): Promise<{
  basePrice: number;
  approvedAddonsTotal: number;
  totalGMV: number;
  pendingAddonsCount: number;
  addons: any[];
}> {
  try {
    const client = (customClient ?? createBrowserSupabaseClient()) as any;
    const { data: booking } = await client
      .from("bookings")
      .select("price")
      .eq("id", bookingId)
      .maybeSingle();

    const addonsResult = await fetchBookingAddons(bookingId, client);
    const allAddons = addonsResult.success ? (addonsResult.data || []) : [];
    const basePrice = Number(booking?.price || 0);

    const approvedAddons = allAddons.filter((a: any) => a.status === "approved");
    const pendingAddons = allAddons.filter((a: any) => a.status === "pending");

    const approvedAddonsTotal = approvedAddons.reduce(
      (sum: number, a: any) => sum + Number(a.cost || 0),
      0
    );
    const totalGMV = basePrice + approvedAddonsTotal;

    return {
      basePrice,
      approvedAddonsTotal,
      totalGMV,
      pendingAddonsCount: pendingAddons.length,
      addons: allAddons,
    };
  } catch (err) {
    console.error("fetchBookingTotalWithAddons error:", err);
    return {
      basePrice: 0,
      approvedAddonsTotal: 0,
      totalGMV: 0,
      pendingAddonsCount: 0,
      addons: [],
    };
  }
}

/* ==========================================================================
   REALTIME BADGE & UNREAD COUNT HELPERS
   ========================================================================== */

export async function getUnreadChatCount(
  userId?: string,
  customClient?: TypedSupabaseClient
): Promise<number> {
  try {
    const client = (customClient ?? createBrowserSupabaseClient()) as any;
    let uid = userId;
    if (!uid) {
      const user = await getCurrentUser(client);
      if (!user) return 0;
      uid = user.id;
    }

    // Find active bookings for this user as either customer or professional
    const { data: bookings, error: bErr } = await client
      .from("bookings")
      .select("id")
      .or(`customer_id.eq.${uid},professional_id.eq.${uid}`)
      .in("status", ["pending", "accepted", "en_route", "arrived", "in_progress"]);

    if (bErr || !bookings || bookings.length === 0) return 0;

    const bookingIds = bookings.map((b: any) => b.id);
    const { count, error } = await client
      .from("chat_messages")
      .select("*", { count: "exact", head: true })
      .in("booking_id", bookingIds)
      .neq("sender_id", uid)
      .eq("is_read", false);

    if (error) {
      console.warn("getUnreadChatCount error:", error.message);
      return 0;
    }
    return count || 0;
  } catch (err: any) {
    console.warn("getUnreadChatCount unexpected error:", err?.message);
    return 0;
  }
}

export async function getUnreadSupportCount(
  userId?: string,
  role?: string,
  customClient?: TypedSupabaseClient
): Promise<number> {
  try {
    const client = (customClient ?? createBrowserSupabaseClient()) as any;
    let uid = userId;
    let userRole = role;
    if (!uid) {
      const user = await getCurrentUser(client);
      if (!user) return 0;
      uid = user.id;
      userRole = user.user_metadata?.role || "customer";
    }

    if (userRole === "admin" || userRole === "super_admin") {
      // For Admin: Count unread replies sent by non-admins
      const { count, error } = await client
        .from("ticket_replies")
        .select("*", { count: "exact", head: true })
        .neq("sender_role", "admin")
        .eq("is_read", false);

      if (error) return 0;
      return count || 0;
    }

    // For Customer or Professional: Get user's tickets first
    const { data: tickets, error: tErr } = await client
      .from("support_tickets")
      .select("id")
      .eq("creator_id", uid);

    if (tErr || !tickets || tickets.length === 0) return 0;

    const ticketIds = tickets.map((t: any) => t.id);
    const { count, error } = await client
      .from("ticket_replies")
      .select("*", { count: "exact", head: true })
      .in("ticket_id", ticketIds)
      .neq("sender_id", uid)
      .eq("is_read", false);

    if (error) return 0;
    return count || 0;
  } catch (err: any) {
    console.warn("getUnreadSupportCount unexpected error:", err?.message);
    return 0;
  }
}

export async function getActiveSosCountAdmin(
  customClient?: TypedSupabaseClient
): Promise<number> {
  try {
    const client = (customClient ?? createBrowserSupabaseClient()) as any;
    const { count, error } = await client
      .from("sos_alerts")
      .select("*", { count: "exact", head: true })
      .eq("status", "active");

    if (error) return 0;
    return count || 0;
  } catch (err) {
    return 0;
  }
}

export async function markChatAsRead(
  bookingId: string,
  customClient?: TypedSupabaseClient
): Promise<{ success: boolean; error?: string }> {
  try {
    const client = (customClient ?? createBrowserSupabaseClient()) as any;
    const user = await getCurrentUser(client);
    if (!user) return { success: false, error: "Not authenticated" };

    const { error } = await client
      .from("chat_messages")
      .update({ is_read: true })
      .eq("booking_id", bookingId)
      .neq("sender_id", user.id)
      .eq("is_read", false);

    if (error) {
      console.warn("markChatAsRead error:", error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed marking chat as read" };
  }
}

export async function markTicketAsRead(
  ticketId: string,
  customClient?: TypedSupabaseClient
): Promise<{ success: boolean; error?: string }> {
  try {
    const client = (customClient ?? createBrowserSupabaseClient()) as any;
    const user = await getCurrentUser(client);
    if (!user) return { success: false, error: "Not authenticated" };

    const { error } = await client
      .from("ticket_replies")
      .update({ is_read: true })
      .eq("ticket_id", ticketId)
      .neq("sender_id", user.id)
      .eq("is_read", false);

    if (error) {
      console.warn("markTicketAsRead error:", error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed marking ticket as read" };
  }
}

/* ==========================================================================
   SIMULATED WALLET CHECKOUT & DEMO TOP-UP
   ========================================================================== */

export async function topUpDemoBalance(
  amount: number = 500,
  customClient?: TypedSupabaseClient
): Promise<{ success: boolean; newBalance?: number; error?: string }> {
  try {
    const client = (customClient ?? createBrowserSupabaseClient()) as any;
    const user = await getCurrentUser(client);
    if (!user) return { success: false, error: "Authentication required." };

    const wallet = await fetchUserWallet(user.id, client);
    const newBalance = Number(wallet.balance) + amount;

    const { error: wErr } = await client
      .from("wallets")
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq("id", wallet.id);

    if (wErr) return { success: false, error: wErr.message };

    await client.from("transactions").insert({
      wallet_id: wallet.id,
      user_id: user.id,
      type: "deposit",
      amount: amount,
      status: "completed",
      description: `Demo Balance Top-Up (+₹${amount.toFixed(2)})`,
      metadata: { method: "demo_top_up", added_at: new Date().toISOString() },
    });

    return { success: true, newBalance };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to top up balance" };
  }
}

export async function processWalletPayment(
  bookingPayload: {
    cityId: string;
    serviceId: string;
    serviceType: string;
    latitude: number;
    longitude: number;
    address: string;
    price: number;
    notes?: string;
  },
  customClient?: TypedSupabaseClient
): Promise<{ success: boolean; booking?: any; error?: string }> {
  try {
    const client = (customClient ?? createBrowserSupabaseClient()) as any;
    const user = await getCurrentUser(client);
    if (!user) return { success: false, error: "Authentication required to confirm payment." };

    const wallet = await fetchUserWallet(user.id, client);
    const price = Number(bookingPayload.price);
    const currentBalance = Number(wallet.balance);

    if (currentBalance < price) {
      return {
        success: false,
        error: `Insufficient wallet balance (₹${currentBalance.toFixed(2)}) for order (₹${price.toFixed(2)}). Please top up.`,
      };
    }

    // 1. Deduct funds from customer wallet
    const newBalance = currentBalance - price;
    const { error: wErr } = await client
      .from("wallets")
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq("id", wallet.id);

    if (wErr) {
      return { success: false, error: `Failed to deduct balance: ${wErr.message}` };
    }

    // 2. Insert booking with status 'pending'
    const newBooking = await createBookingWithLocation(bookingPayload, client);

    // 3. Insert transaction record
    await client.from("transactions").insert({
      wallet_id: wallet.id,
      user_id: user.id,
      booking_id: newBooking.id,
      type: "booking_payment",
      amount: price,
      status: "completed",
      description: `Payment for ${bookingPayload.serviceType} (Order #${newBooking.id.slice(0, 8)})`,
      metadata: {
        service_id: bookingPayload.serviceId,
        service_name: bookingPayload.serviceType,
        paid_at: new Date().toISOString(),
      },
    });

    return { success: true, booking: newBooking };
  } catch (err: any) {
    console.error("processWalletPayment error:", err);
    return { success: false, error: err?.message || "Failed to process wallet payment." };
  }
}

/* ==========================================================================
   AI COPILOT & PROMPT GOVERNANCE HELPERS
   ========================================================================== */

export interface BotConfig {
  id: string;
  system_prompt: string;
  model: string;
  updated_at: string;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system" | "model";
  content: string;
}

export const DEFAULT_COPILOT_PROMPT =
  "You are the Universal Admin AI Copilot for the Home Services Platform (HomeServe). Your job is to assist platform operations admins with real-time operational insights, booking dispatch summaries, payout oversight, customer dispute analysis, and drafting professional customer support responses. When providing financial figures, format them using Indian Rupees (₹). Always be precise, professional, concise, and helpful.";

/**
 * Fetch the current AI Copilot configuration from ai_bot_configs table.
 */
export async function fetchCopilotConfig(
  customClient?: TypedSupabaseClient
): Promise<BotConfig> {
  const client = (customClient ?? createBrowserSupabaseClient("admin")) as any;

  const { data, error } = await client
    .from("ai_bot_configs")
    .select("*")
    .eq("id", "admin_copilot")
    .maybeSingle();

  if (error) {
    console.warn("fetchCopilotConfig error:", error.message);
  }

  if (data) {
    return data as BotConfig;
  }

  return {
    id: "admin_copilot",
    system_prompt: DEFAULT_COPILOT_PROMPT,
    model: "gemini-1.5-pro",
    updated_at: new Date().toISOString(),
  };
}

/**
 * Update the system prompt for the admin_copilot record.
 */
export async function updateCopilotPrompt(
  newPrompt: string,
  customClient?: TypedSupabaseClient
): Promise<BotConfig> {
  const client = (customClient ?? createBrowserSupabaseClient("admin")) as any;

  const { data, error } = await client
    .from("ai_bot_configs")
    .upsert(
      {
        id: "admin_copilot",
        system_prompt: newPrompt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    )
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update copilot prompt: ${error.message}`);
  }

  return data as BotConfig;
}

/**
 * Fetch a real-time operational snapshot across bookings, tickets, and finances.
 */
export async function fetchAdminOperationsContext(
  customClient?: TypedSupabaseClient
): Promise<string> {
  try {
    const client = (customClient ?? createBrowserSupabaseClient("admin")) as any;

    const [bookingsRes, ticketsRes, transactionsRes, sosRes] = await Promise.all([
      client
        .from("bookings")
        .select("id, status, price, cancellation_reason, created_at, services(name), profiles:customer_id(full_name)")
        .order("created_at", { ascending: false })
        .limit(15),
      client
        .from("support_tickets")
        .select("id, subject, status, priority, description, category, created_at")
        .order("created_at", { ascending: false })
        .limit(10),
      client
        .from("transactions")
        .select("id, type, amount, status, description, created_at")
        .order("created_at", { ascending: false })
        .limit(10),
      client
        .from("sos_alerts")
        .select("id, status, emergency_type, location, created_at")
        .eq("status", "active")
        .limit(5),
    ]);

    const bookings = bookingsRes.data || [];
    const tickets = ticketsRes.data || [];
    const transactions = transactionsRes.data || [];
    const sosAlerts = sosRes.data || [];

    const pendingCount = bookings.filter((b: any) => b.status === "pending").length;
    const activeCount = bookings.filter((b: any) =>
      ["accepted", "en_route", "arrived", "in_progress"].includes(b.status)
    ).length;
    const cancelledCount = bookings.filter((b: any) => b.status === "cancelled").length;
    const completedCount = bookings.filter((b: any) => b.status === "completed").length;

    let context = `=== CURRENT REAL-TIME PLATFORM SNAPSHOT ===\n`;
    context += `Snapshot Time: ${new Date().toISOString()}\n\n`;

    context += `--- BOOKINGS OVERVIEW ---\n`;
    context += `Total Queried: ${bookings.length} | Pending: ${pendingCount} | Active Field Dispatches: ${activeCount} | Completed: ${completedCount} | Cancelled: ${cancelledCount}\n`;
    context += `Recent Orders:\n`;
    if (bookings.length === 0) {
      context += `(No bookings recorded yet)\n`;
    } else {
      bookings.slice(0, 8).forEach((b: any) => {
        const orderId = b.id ? b.id.slice(0, 8) : "N/A";
        const service = b.services?.name || "General Service";
        const customer = b.profiles?.full_name || "Customer";
        const price = b.price != null ? `₹${Number(b.price).toFixed(2)}` : "₹0.00";
        const cancelNote = b.cancellation_reason ? ` (Reason: "${b.cancellation_reason}")` : "";
        context += `• Order #${orderId}: ${service} (${price}) | Status: ${b.status} | Customer: ${customer}${cancelNote}\n`;
      });
    }

    context += `\n--- SUPPORT TICKETS ---\n`;
    const openTickets = tickets.filter((t: any) => t.status !== "resolved" && t.status !== "closed");
    context += `Open/Pending Tickets: ${openTickets.length} of ${tickets.length} total\n`;
    if (tickets.length === 0) {
      context += `(No tickets recorded)\n`;
    } else {
      tickets.slice(0, 6).forEach((t: any) => {
        const tId = t.id ? t.id.slice(0, 8) : "N/A";
        context += `• Ticket #${tId}: "${t.subject || "No subject"}" | Status: ${t.status} | Priority: ${t.priority || "normal"} | Desc: ${t.description?.slice(0, 80) || "N/A"}\n`;
      });
    }

    context += `\n--- FINANCIALS & RECENT PAYOUTS ---\n`;
    const pendingPayouts = transactions.filter(
      (tx: any) => tx.type === "payout" && tx.status === "pending"
    );
    context += `Pending Professional Payouts: ${pendingPayouts.length}\n`;
    transactions.slice(0, 6).forEach((tx: any) => {
      const amt = tx.amount != null ? `₹${Number(tx.amount).toFixed(2)}` : "₹0.00";
      context += `• Tx #${tx.id?.slice(0, 8)}: ${tx.type} (${amt}) | Status: ${tx.status} | "${tx.description || ""}"\n`;
    });

    context += `\n--- EMERGENCY SOS STATUS ---\n`;
    if (sosAlerts.length === 0) {
      context += `• 0 active emergency alerts. All field operations nominal.\n`;
    } else {
      context += `• ⚠️ ${sosAlerts.length} ACTIVE EMERGENCY ALERT(S) REQUIRING IMMEDIATE ATTENTION!\n`;
      sosAlerts.forEach((a: any) => {
        context += `  - Alert #${a.id?.slice(0, 8)}: Type "${a.emergency_type || "SOS"}"\n`;
      });
    }

    context += `===========================================`;
    return context;
  } catch (err: any) {
    console.error("fetchAdminOperationsContext error:", err);
    return `Operational snapshot unavailable: ${err?.message || "Unknown error"}`;
  }
}

/**
 * Call the LLM (Gemini / OpenAI) with prompt, real-time context, and conversation history.
 */
export async function callCopilotLLM(params: {
  systemPrompt: string;
  context: string;
  messages: ChatMessage[];
  model?: string;
}): Promise<string> {
  const { systemPrompt, context, messages, model = "gemini-1.5-pro" } = params;

  // Retrieve API key from environment
  const apiKey =
    process.env.AI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.OPENAI_API_KEY;

  const fullSystemInstruction = `${systemPrompt}\n\n${context}\n\nInstructions for your response:
1. Ground your answers in the real-time operational context provided above whenever relevant.
2. If the user asks about bookings, dispatches, tickets, cancellations, or payouts, reference specific details from the snapshot.
3. If drafting a customer support response, maintain an empathetic, reassuring, professional tone representing HomeServe.
4. Format all monetary values in Indian Rupees (₹).
5. Format your output using clear markdown (bullet points, bold highlights, and headers).`;

  // Fallback if no API key is supplied in .env
  if (!apiKey) {
    const lastUserMsg =
      [...messages].reverse().find((m) => m.role === "user")?.content || "";

    return generateSimulatedResponse(lastUserMsg, context);
  }

  // Check if API key is OpenAI or model is GPT
  const isOpenAI =
    apiKey.startsWith("sk-") ||
    model.startsWith("gpt-") ||
    (!process.env.AI_API_KEY && !!process.env.OPENAI_API_KEY);

  if (isOpenAI) {
    try {
      const openAiMessages = [
        { role: "system", content: fullSystemInstruction },
        ...messages.map((m) => ({
          role: m.role === "assistant" || m.role === "model" ? "assistant" : "user",
          content: m.content,
        })),
      ];

      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model.startsWith("gpt-") ? model : "gpt-4o",
          messages: openAiMessages,
          temperature: 0.7,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`OpenAI API error (${res.status}): ${errText}`);
      }

      const data = await res.json();
      return (
        data.choices?.[0]?.message?.content ||
        "I received an empty response from the OpenAI API."
      );
    } catch (err: any) {
      console.error("OpenAI call failed:", err);
      return `❌ AI Provider Error: ${err.message || "Failed calling OpenAI API"}`;
    }
  }

  // Google Gemini API Gateway (v1beta REST)
  try {
    const geminiModel = model.startsWith("gemini-") ? model : "gemini-1.5-pro";
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`;

    const geminiContents = messages.map((m) => ({
      role: m.role === "assistant" || m.role === "model" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const payload = {
      systemInstruction: {
        parts: [{ text: fullSystemInstruction }],
      },
      contents: geminiContents.length > 0
        ? geminiContents
        : [{ role: "user", parts: [{ text: "Hello! Provide an operations summary." }] }],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 2048,
      },
    };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      // If gemini-1.5-pro returns 404, fallback to gemini-2.5-flash
      if (res.status === 404 && geminiModel !== "gemini-2.5-flash") {
        const fallbackEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
        const fallbackRes = await fetch(fallbackEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (fallbackRes.ok) {
          const fallbackData = await fallbackRes.json();
          return (
            fallbackData.candidates?.[0]?.content?.parts?.[0]?.text ||
            "No textual response generated by Gemini."
          );
        }
      }
      throw new Error(`Gemini API error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!replyText) {
      return "I processed your request, but the model generated no content. Please try rephrasing.";
    }
    return replyText;
  } catch (err: any) {
    console.error("Gemini call failed:", err);
    return `❌ AI Provider Error: ${err.message || "Failed calling Gemini API"}`;
  }
}

/**
 * Intelligent deterministic response generator when no external AI_API_KEY is configured.
 */
function generateSimulatedResponse(userQuery: string, context: string): string {
  const queryLower = userQuery.toLowerCase();

  let response = `> 💡 **Notice:** \`AI_API_KEY\` is not currently set in \`.env.local\`. Using live operational database telemetry to answer:\n\n`;

  if (queryLower.includes("cancel") || queryLower.includes("cancellation")) {
    response += `### 📋 Cancelled Bookings Report\n\n`;
    response += `Based on the real-time operations database:\n`;
    response += `- We scanned the recent platform bookings.\n`;
    response += `- Cancelled bookings are logged with customer details and recorded reasons in the operational ledger.\n\n`;
    response += `**Operational Insights:**\n`;
    response += `Check the full details from the live snapshot:\n\`\`\`\n${context.slice(0, 600)}...\n\`\`\``;
  } else if (queryLower.includes("ticket") || queryLower.includes("support") || queryLower.includes("refund")) {
    response += `### ✍️ Draft Support Resolution Response\n\n`;
    response += `**Subject:** Update regarding your HomeServe request\n\n`;
    response += `Dear Customer,\n\n`;
    response += `Thank you for reaching out to HomeServe Operations Support. We have carefully reviewed your service request and account history.\n\n`;
    response += `Our platform operations team has noted your feedback regarding the service execution. We are committed to upholding verified quality standards across all home repairs and installations.\n\n`;
    response += `If a refund or credit adjustment is warranted per our platform terms, the approved amount will be credited back to your HomeServe wallet within 24 hours.\n\n`;
    response += `Warm regards,\n**HomeServe Support Operations Team**`;
  } else if (queryLower.includes("payout") || queryLower.includes("finance") || queryLower.includes("money")) {
    response += `### 💰 Financials & Professional Payouts Summary\n\n`;
    response += `Our platform enforces the **80/20 cash flow split** (80% net earnings to professionals, 20% platform commission).\n\n`;
    response += `Review pending payout requests in the **Financials & Ledger** tab (\`/finance\`) for manual disbursement authorization.`;
  } else {
    response += `### 📊 Real-Time Operations Summary\n\n`;
    response += `Here is the current platform status retrieved directly from the database:\n\n`;
    response += `${context}\n\n`;
    response += `*Tip: Configure \`AI_API_KEY=your_gemini_api_key\` in \`.env.local\` to enable dynamic reasoning with Google Gemini.*`;
  }

  return response;
}


