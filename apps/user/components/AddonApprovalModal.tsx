"use client";

import React, { useState } from "react";
import {
  Sparkles,
  Camera,
  Check,
  X,
  AlertCircle,
  Loader2,
  DollarSign,
  ExternalLink,
  ShieldAlert,
} from "lucide-react";
import {
  createBrowserSupabaseClient,
  updateBookingAddonStatus,
} from "@repo/db";

interface AddonApprovalModalProps {
  isOpen: boolean;
  addon: any;
  onClose: () => void;
  onResponded: (approved: boolean) => void;
}

export function AddonApprovalModal({
  isOpen,
  addon,
  onClose,
  onResponded,
}: AddonApprovalModalProps) {
  const [supabase] = useState(() => createBrowserSupabaseClient());
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !addon) return null;

  const handleDecision = async (status: "approved" | "declined") => {
    try {
      setUpdating(true);
      setError(null);
      const res = await updateBookingAddonStatus(addon.id, status, supabase);
      if (!res.success) {
        throw new Error(res.error || `Failed to ${status} add-on.`);
      }
      onResponded(status === "approved");
      onClose();
    } catch (err: any) {
      console.error("Addon decision error:", err);
      setError(err.message || "An error occurred while saving your decision.");
    } finally {
      setUpdating(false);
    }
  };

  const cost = Number(addon.cost || 0).toFixed(2);
  const title =
    addon.custom_description || addon.service?.name || "Additional Service / Part";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-lg bg-slate-900 border border-indigo-500/40 rounded-2xl p-6 shadow-2xl space-y-5 text-slate-100 ring-2 ring-indigo-500/20">
        {/* Header */}
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-950/80 text-indigo-400 border border-indigo-800/40">
            <Sparkles className="h-3.5 w-3.5" /> Action Required: Mid-Job Service Suggestion
          </div>
          <h3 className="text-lg font-bold text-white">
            Your Professional Suggested an Add-On
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            The service specialist on-site has inspected your home and identified an additional requirement. Please review and decide whether to approve this addition to your invoice.
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-xl text-xs text-red-300 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Addon Details Card */}
        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold block">
                Proposed Service / Part
              </span>
              <h4 className="text-sm font-bold text-white mt-0.5">{title}</h4>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold block">
                Added Cost
              </span>
              <span className="text-base font-black text-emerald-400">+${cost}</span>
            </div>
          </div>

          {/* Photo Evidence */}
          {addon.photo_url && (
            <div className="space-y-1 pt-2 border-t border-slate-800/80">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <Camera className="h-3.5 w-3.5 text-indigo-400" />
                  <span>Condition Evidence Photo:</span>
                </span>
                <a
                  href={addon.photo_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-indigo-400 hover:underline flex items-center gap-0.5"
                >
                  <span>View Full Photo</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <div className="aspect-video w-full rounded-lg overflow-hidden border border-slate-800 bg-black flex items-center justify-center">
                <img
                  src={addon.photo_url}
                  alt="Add-on condition evidence"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          )}
        </div>

        {/* Protection Notice */}
        <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2">
          <ShieldAlert className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
          <span>
            <strong>Protected Transparency:</strong> Approving will update your final invoice. If you decline, the provider is instructed to proceed strictly with the original service.
          </span>
        </div>

        {/* Action Buttons: Mandatory Choice */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            type="button"
            onClick={() => handleDecision("declined")}
            disabled={updating}
            className="flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl border border-rose-800/80 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 font-bold text-xs transition disabled:opacity-50"
          >
            {updating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <X className="h-4 w-4" />
                <span>Decline Add-on</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleDecision("approved")}
            disabled={updating}
            className="flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-950 transition disabled:opacity-50"
          >
            {updating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Check className="h-4 w-4" />
                <span>Approve (+${cost})</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default AddonApprovalModal;
