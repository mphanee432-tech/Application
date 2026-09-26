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
    lat?: number;
    lng?: number;
    address?: string;
    price?: number;
    notes?: string;
  },
  customClient?: TypedSupabaseClient
): Promise<Tables<"bookings">> {
  const client = (customClient ?? createBrowserSupabaseClient()) as any;
  const user = await getCurrentUser(client);
  if (!user) throw new Error("Authentication required to create a booking.");

  const insertPayload: TablesInsert<"bookings"> = {
    customer_id: user.id,
    service_type: booking.serviceType,
    status: "pending",
    lat: booking.lat ?? 37.7749,
    lng: booking.lng ?? -122.4194,
    address: booking.address ?? "Customer Location Pin",
    price: booking.price ?? 75.0,
    notes: booking.notes ?? null,
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
export async function fetchAvailableJobs(
  professionalId?: string,
  customClient?: TypedSupabaseClient
): Promise<any[]> {
  const client = (customClient ?? createBrowserSupabaseClient()) as any;

  if (professionalId) {
    // Get professional's city_id
    const { data: pro } = await client
      .from("professionals")
      .select("city_id")
      .eq("id", professionalId)
      .maybeSingle();

    // Get professional's active skills (service_ids)
    const { data: skills } = await client
      .from("professional_skills")
      .select("service_id")
      .eq("professional_id", professionalId);

    const serviceIds = (skills || []).map((s: any) => s.service_id);

    if (!pro?.city_id || serviceIds.length === 0) return [];

    const { data, error } = await client
      .from("bookings")
      .select("*, customer:profiles!bookings_customer_id_fkey(full_name, phone, email), services(name, description, base_price, icon)")
      .eq("status", "pending")
      .eq("city_id", pro.city_id)
      .in("service_id", serviceIds)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  }

  const { data, error } = await client
    .from("bookings")
    .select("*, customer:profiles!bookings_customer_id_fkey(full_name, phone, email), services(name, description, base_price, icon)")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function fetchActiveJobsForPro(
  customClient?: TypedSupabaseClient
): Promise<any[]> {
  const client = (customClient ?? createBrowserSupabaseClient()) as any;
  const user = await getCurrentUser(client);
  if (!user) return [];

  const { data, error } = await client
    .from("bookings")
    .select("*, customer:profiles!bookings_customer_id_fkey(full_name, phone, email), services(name, description, base_price, icon)")
    .eq("professional_id", user.id)
    .in("status", ["accepted", "en_route", "arrived", "in_progress"])
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
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
    .select("*, customer:profiles!bookings_customer_id_fkey(full_name, email, phone), professional:professionals(id, trade, rating, profile:profiles(full_name))")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function fetchAllProfessionalsAdmin(
  customClient?: TypedSupabaseClient
): Promise<any[]> {
  const client = (customClient ?? createBrowserSupabaseClient()) as any;
  const { data, error } = await client
    .from("professionals")
    .select("*, profile:profiles!professionals_id_fkey(full_name, email, phone)")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
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
    .select()
    .single();

  if (error) throw error;
  return data;
}

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
    targetId: string;
    rating: number;
    comment?: string;
  },
  customClient?: TypedSupabaseClient
): Promise<Tables<"reviews">> {
  const client = (customClient ?? createBrowserSupabaseClient()) as any;
  const user = await getCurrentUser(client);
  if (!user) throw new Error("Authentication required to submit review.");

  const { data, error } = await client
    .from("reviews")
    .insert({
      booking_id: payload.bookingId,
      reviewer_id: user.id,
      target_id: payload.targetId,
      rating: payload.rating,
      comment: payload.comment?.trim() || null,
    })
    .select()
    .single();

  if (error) throw error;
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
  const client = (customClient ?? createBrowserSupabaseClient()) as any;
  const { data: customerProfiles, error: profileErr } = await client
    .from("profiles")
    .select("*, bookings(id, price, status, created_at)")
    .eq("role", "user")
    .order("created_at", { ascending: false });

  if (profileErr) throw profileErr;

  return (customerProfiles || []).map((p: any) => ({
    ...p,
    mobile: p.mobile || p.phone,
    total_bookings: p.bookings ? p.bookings.length : 0,
    total_spent: p.bookings
      ? p.bookings.reduce((sum: number, b: any) => sum + (b.status === "completed" ? Number(b.price || 0) : 0), 0)
      : 0,
  }));
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
      balance: 50.00,
      promo_credits: 25.00,
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
      description: `Added $${amount.toFixed(2)} to in-app wallet`,
      metadata: { method: "instant_card_deposit" },
    })
    .select()
    .single();

  if (txError) throw txError;

  return { wallet: updatedWallet, transaction };
}

export const VALID_PROMO_CODES: Record<string, { credits: number; description: string }> = {
  WELCOME25: { credits: 25.00, description: "$25 Welcome Bonus Credits" },
  HOMESERVE50: { credits: 50.00, description: "$50 Platform Promo Credits" },
  SAVE10: { credits: 10.00, description: "$10 Community Discount Credits" },
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

export async function approvePayoutAdmin(
  transactionId: string,
  customClient?: TypedSupabaseClient
): Promise<Tables<"transactions">> {
  const client = (customClient ?? createBrowserSupabaseClient()) as any;
  const { data, error } = await client
    .from("transactions")
    .update({
      status: "completed",
      metadata: { approved_at: new Date().toISOString() },
    })
    .eq("id", transactionId)
    .select()
    .single();

  if (error) throw error;
  return data;
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

  return {
    transactions: data || [],
    metrics: {
      totalVolume,
      platformCommissions,
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
): Promise<any[]> {
  const client = (customClient ?? createBrowserSupabaseClient()) as any;
  const { data, error } = await client
    .from("sos_alerts")
    .select(`
      *,
      creator:profiles!sos_alerts_creator_id_fkey(id, full_name, email, phone, mobile, role),
      booking:bookings!sos_alerts_booking_id_fkey(id, service_id, status, scheduled_at, latitude, longitude),
      resolver:profiles!sos_alerts_resolved_by_fkey(id, full_name, email)
    `)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
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
  customClient?: TypedSupabaseClient
): Promise<any[]> {
  const client = (customClient ?? createBrowserSupabaseClient()) as any;
  const { data, error } = await client
    .from("chat_messages")
    .select("*, sender:profiles!chat_messages_sender_id_fkey(full_name)")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function sendChatMessage(
  bookingId: string,
  message: string,
  customClient?: TypedSupabaseClient
): Promise<any> {
  const client = (customClient ?? createBrowserSupabaseClient()) as any;
  const user = await getCurrentUser(client);
  if (!user) throw new Error("Not authenticated");
  const { data, error } = await client
    .from("chat_messages")
    .insert({ booking_id: bookingId, sender_id: user.id, message })
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


