"use server";

import { createNextServerClient } from "@repo/db";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

/**
 * Server Action: Save professional operating city and service skills
 * Uses cookie-aware Next.js server client with standard Row Level Security (RLS).
 * Strictly upserts the base record in `professionals` first to prevent FK crashes,
 * then syncs the `professional_skills` join table.
 */
export async function saveProfessionalSettingsAction(params: {
  professionalId?: string;
  cityId?: string;
  serviceIds?: string[];
  city_id?: string;
  services?: string[];
}): Promise<{ success: boolean; data?: any; error?: string }> {
  const city_id = params?.city_id ?? params?.cityId;
  const services = params?.services ?? params?.serviceIds;
  console.log("=== INCOMING SAVE PAYLOAD ===", { city_id, services });

  try {
    const cookieStore = await cookies();
    const supabase = createNextServerClient(cookieStore);

    // Verify session
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.log("=== SUPABASE ERROR ===", authError || "No active session");
      return { success: false, error: "Authentication required. Please log in again." };
    }

    const professionalId = user.id;

    // 1. Fetch user's profile to retrieve full_name if creating the row for the first time
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", professionalId)
      .maybeSingle();

    const proUpsertPayload: any = {
      id: professionalId,
      updated_at: new Date().toISOString(),
    };

    if (city_id) {
      proUpsertPayload.city_id = city_id;
    }
    if (profile?.full_name) {
      proUpsertPayload.full_name = profile.full_name;
    }

    // 2. Perform upsert on `professionals` table first and wait for success
    let pro: any = null;
    try {
      const { data, error: proErr } = await supabase
        .from("professionals")
        .upsert(proUpsertPayload, { onConflict: "id" })
        .select()
        .single();

      if (proErr) {
        console.log("=== SUPABASE ERROR ===", proErr);
        console.error("saveProfessionalSettingsAction pro upsert error:", proErr);
        return { success: false, error: `Failed to save professional profile: ${proErr.message}` };
      }
      pro = data;
    } catch (error) {
      console.log("=== SUPABASE ERROR ===", error);
      throw error;
    }

    // 3. If serviceIds/services provided, sync the `professional_skills` join table
    const serviceList = services ?? params.serviceIds;
    if (serviceList !== undefined) {
      try {
        const { error: delErr } = await supabase
          .from("professional_skills")
          .delete()
          .eq("professional_id", professionalId);

        if (delErr) {
          console.log("=== SUPABASE ERROR ===", delErr);
          console.error("saveProfessionalSettingsAction delete skills error:", delErr);
          return { success: false, error: `Failed to clear existing skills: ${delErr.message}` };
        }
      } catch (error) {
        console.log("=== SUPABASE ERROR ===", error);
        throw error;
      }

      if (serviceList.length > 0) {
        const rows = serviceList.map((sid: string) => ({
          professional_id: professionalId,
          service_id: sid,
        }));

        try {
          const { error: insErr } = await supabase
            .from("professional_skills")
            .insert(rows);

          if (insErr) {
            console.log("=== SUPABASE ERROR ===", insErr);
            console.error("saveProfessionalSettingsAction insert skills error:", insErr);
            return { success: false, error: `Failed to save service skills: ${insErr.message}` };
          }
        } catch (error) {
          console.log("=== SUPABASE ERROR ===", error);
          throw error;
        }
      }
    }

    revalidatePath("/settings");
    revalidatePath("/profile");
    revalidatePath("/");

    return {
      success: true,
      data: {
        cityId: city_id,
        skillCount: serviceList ? serviceList.length : 0,
        professional: pro,
      },
    };
  } catch (error: any) {
    console.log("=== SUPABASE ERROR ===", error);
    console.error("saveProfessionalSettingsAction unexpected error:", error);
    return {
      success: false,
      error: error?.message || "An unexpected error occurred while saving professional settings.",
    };
  }
}

export const saveProfessionalProfile = saveProfessionalSettingsAction;
