"use server";

import {
  createAdminClient,
  fetchAllProfessionalsAdmin as fetchPros,
  fetchAllCustomersAdmin as fetchCusts,
  sendAdminBroadcast,
  approvePayoutAdmin as approvePayoutHelper,
  fetchCopilotConfig,
  updateCopilotPrompt,
  fetchAdminOperationsContext,
  callCopilotLLM,
  DEFAULT_COPILOT_PROMPT,
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
  try {
    const adminClient = getAdminClient();
    const pros = await fetchPros(adminClient as any);
    return Array.isArray(pros) ? pros : [];
  } catch (err: any) {
    console.error("fetchAllProfessionalsAdmin action error:", err?.message || err);
    return [];
  }
}

/**
 * Server Action: Fetch all customer profiles & bookings bypassing RLS via admin client
 */
export async function fetchAllCustomersAdmin() {
  try {
    const adminClient = getAdminClient();
    const custs = await fetchCusts(adminClient as any);
    return Array.isArray(custs) ? custs : [];
  } catch (err: any) {
    console.error("fetchAllCustomersAdmin action error:", err?.message || err);
    return [];
  }
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

/**
 * Server Action: Send broadcast notification to customers and/or professionals bypassing RLS via admin client
 */
export async function sendAdminBroadcastAction(params: {
  title: string;
  message: string;
  targetAudience: "all" | "customers" | "professionals";
}) {
  const adminClient = getAdminClient();
  return sendAdminBroadcast(params, adminClient as any);
}

/**
 * Server Action: Approve and clear a professional payout via admin service client
 */
export async function approvePayoutAdminAction(transactionId: string) {
  try {
    const adminClient = getAdminClient();
    const result = await approvePayoutHelper(transactionId, adminClient as any);
    return {
      success: !!result.success,
      data: result.data || transactionId,
      message: result.message || "Mock Bank Transfer Successful",
      error: result.error || undefined,
    };
  } catch (err: any) {
    console.error("approvePayoutAdminAction error:", err?.message || err);
    return {
      success: false,
      error: err?.message || "Failed to approve payout.",
    };
  }
}

/**
 * Server Action: Mark support ticket replies as read for admin
 */
export async function markSupportTicketReadAction(ticketId: string) {
  try {
    const adminClient = getAdminClient();
    const { error } = await adminClient
      .from("ticket_replies")
      .update({ is_read: true })
      .eq("ticket_id", ticketId)
      .neq("sender_role", "admin");

    if (error) {
      console.error("markSupportTicketReadAction error:", error);
      return { success: false, error: error.message };
    }

    revalidatePath("/");
    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Failed to mark support ticket as read.",
    };
  }
}

/**
 * Server Action: Acknowledge or resolve an emergency SOS alert
 */
export async function acknowledgeSosAlertAction(alertId: string, resolvedBy?: string) {
  try {
    const adminClient = getAdminClient();
    const { data, error } = await adminClient
      .from("sos_alerts")
      .update({
        status: "resolved",
        resolved_at: new Date().toISOString(),
        ...(resolvedBy ? { resolved_by: resolvedBy } : {}),
      })
      .eq("id", alertId)
      .select()
      .maybeSingle();

    if (error) {
      console.error("acknowledgeSosAlertAction error:", error);
      return { success: false, error: error.message };
    }

    revalidatePath("/");
    revalidatePath("/sos");
    return { success: true, data };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Failed to acknowledge SOS alert.",
    };
  }
}

/**
 * Server Action: Get active Copilot configuration (system prompt and model)
 */
export async function getCopilotConfigAction() {
  try {
    const adminClient = getAdminClient();
    const config = await fetchCopilotConfig(adminClient as any);
    return { success: true, data: config };
  } catch (err: any) {
    console.error("getCopilotConfigAction error:", err);
    return {
      success: false,
      error: err?.message || "Failed to retrieve Copilot configuration.",
    };
  }
}

/**
 * Server Action: Update the system prompt for the admin_copilot record
 */
export async function updateCopilotPromptAction(newPrompt: string) {
  try {
    if (!newPrompt || typeof newPrompt !== "string" || !newPrompt.trim()) {
      return { success: false, error: "System prompt cannot be empty." };
    }
    const adminClient = getAdminClient();
    const updated = await updateCopilotPrompt(newPrompt.trim(), adminClient as any);
    revalidatePath("/ai-copilot");
    return { success: true, data: updated };
  } catch (err: any) {
    console.error("updateCopilotPromptAction error:", err);
    return {
      success: false,
      error: err?.message || "Failed to update Copilot system prompt.",
    };
  }
}

/**
 * Server Action: Send conversation history with system prompt & operations context to OpenRouter API
 */
export async function chatWithCopilotAction(
  messages: { role: string; content: string }[]
) {
  try {
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return { success: false, error: "No chat messages provided." };
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return {
        success: false,
        error: "OpenRouter API key is missing in environment variables.",
      };
    }

    const model = process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash";

    const adminClient = getAdminClient();

    // 1. Fetch live system prompt and model
    const config = await fetchCopilotConfig(adminClient as any);

    // 2. Query real-time database operations context
    const opsContext = await fetchAdminOperationsContext(adminClient as any);

    const systemPrompt = `${config.system_prompt || DEFAULT_COPILOT_PROMPT}\n\n${opsContext}`;

    // 3. Format message roles
    const conversationMessages = messages.map((m) => ({
      role: m.role === "assistant" || m.role === "model" ? "assistant" : "user",
      content: m.content || "",
    }));

    // 4. Send POST request to OpenRouter API
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3002",
        "X-Title": "Home Services Admin",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          ...conversationMessages,
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return {
        success: false,
        error: `OpenRouter API error (${response.status}): ${errText}`,
      };
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content || "";

    return {
      success: true,
      reply: content,
      data: {
        reply: content,
      },
    };
  } catch (err: any) {
    console.error("chatWithCopilotAction error:", err);
    return {
      success: false,
      error: err?.message || "Failed processing Copilot response.",
    };
  }
}


