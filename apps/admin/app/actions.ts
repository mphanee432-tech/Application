"use server";

import {
  createAdminClient,
  fetchAllProfessionalsAdmin as fetchPros,
  fetchAllCustomersAdmin as fetchCusts,
} from "@repo/db";
import { revalidatePath } from "next/cache";

/**
 * Helper: Strictly retrieve and validate environment variables inside Server Actions
 */
function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase Admin credentials in environment variables.");
  }
  return createAdminClient(url, key);
}

/**
 * Server Action: Approve a professional's KYC credentials
 * Uses createAdminClient with SUPABASE_SERVICE_ROLE_KEY to bypass RLS.
 */
export async function approveProfessionalKyc(professionalId: string) {
  const adminClient = getAdminClient();

  const { data, error } = await adminClient
    .from("professionals")
    .update({
      status: "approved",
      kyc_status: "approved",
      updated_at: new Date().toISOString(),
    })
    .eq("id", professionalId)
    .select("*, profile:profiles(*)")
    .single();

  if (error) {
    throw new Error(`Failed to approve professional KYC: ${error.message}`);
  }

  revalidatePath("/");
  return { success: true, professional: data };
}

/**
 * Server Action: Fetch all professionals bypassing RLS via admin client
 */
export async function fetchAllProfessionalsAdmin() {
  const adminClient = getAdminClient();
  return fetchPros(adminClient as any);
}

/**
 * Server Action: Fetch all customer profiles & bookings bypassing RLS via admin client
 */
export async function fetchAllCustomersAdmin() {
  const adminClient = getAdminClient();
  return fetchCusts(adminClient as any);
}

/**
 * Server Action: Ensure the first admin gets the super_admin role
 */
export async function ensureSuperAdminRole(userId: string) {
  const adminClient = getAdminClient();

  // Check if any admin exists
  const { data: existing, error: fetchErr } = await adminClient
    .from("admins")
    .select("id")
    .limit(1);

  if (fetchErr) {
    throw new Error(`Failed checking existing admins: ${fetchErr.message}`);
  }

  if (!existing || existing.length === 0) {
    const { error: insertErr } = await adminClient
      .from("admins")
      .insert({ id: userId, role: "super_admin" });

    if (insertErr) {
      throw new Error(`Failed to assign initial super_admin role: ${insertErr.message}`);
    }

    return { assigned: true, role: "super_admin" };
  }

  const { data: userAdmin } = await adminClient
    .from("admins")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  return { assigned: false, role: userAdmin?.role || "standard" };
}
