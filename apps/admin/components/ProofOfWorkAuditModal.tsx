"use client";

import React, { useEffect, useState } from "react";
import {
  Camera,
  CheckCircle2,
  X,
  ExternalLink,
  ShieldCheck,
  User,
  Calendar,
  DollarSign,
  AlertTriangle,
  Receipt,
  Sparkles,
  Clock,
  XCircle,
  HelpCircle,
} from "lucide-react";
import { fetchBookingAddons, createBrowserSupabaseClient } from "@repo/db";

interface ProofOfWorkAuditModalProps {
  isOpen: boolean;
  booking: any;
  onClose: () => void;
}

export function ProofOfWorkAuditModal({
  isOpen,
  booking,
  onClose,
}: ProofOfWorkAuditModalProps) {
  const [supabase] = useState(() => createBrowserSupabaseClient());
  const [addons, setAddons] = useState<any[]>([]);
  const [loadingAddons, setLoadingAddons] = useState(false);

  useEffect(() => {
    if (!isOpen || !booking) return;

    let isMounted = true;
    setLoadingAddons(true);

    fetchBookingAddons(booking.id, supabase)
      .then((res) => {
        if (isMounted) setAddons(res.success ? (res.data || []) : []);
      })
      .catch((err) => {
        console.error("Failed to load addons for audit:", err);
      })
      .finally(() => {
        if (isMounted) setLoadingAddons(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, booking, supabase]);

  if (!isOpen || !booking) return null;

  const proof = booking.proof_photos || {};
  const beforeUrl = proof.before;
  const afterUrl = proof.after;

  const basePrice = Number(booking.price || 0);
  const approvedAddons = addons.filter((a) => a.status === "approved");
  const approvedTotal = approvedAddons.reduce((sum, a) => sum + Number(a.cost || 0), 0);
  const finalGMV = basePrice + approvedTotal;
  const platformCommission = finalGMV * 0.2; // 20% commission
  const proPayout = finalGMV * 0.8; // 80% pro payout

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6 text-slate-100 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-start border-b border-slate-800 pb-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-800/40">
              <Camera className="h-3.5 w-3.5" /> Order Verification & Invoice Audit
            </div>
            <h3 className="text-lg font-bold text-white mt-1">
              Order #{booking.id.slice(0, 8)} Full Quality & Financial Inspection
            </h3>
            <p className="text-xs text-slate-400">
              Side-by-side photographic proof, mid-job upsell audit, and GMV revenue reconciliation.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Dispatch Meta Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl text-xs">
          <div>
            <span className="text-[10px] text-slate-500 uppercase block">Service</span>
            <span className="font-semibold text-slate-200">{booking.service_type || booking.service?.name}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase block">Customer</span>
            <span className="font-semibold text-slate-200">{booking.customer?.full_name || "Verified Client"}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase block">Provider</span>
            <span className="font-semibold text-emerald-400">
              {booking.professional?.profile?.full_name || "Assigned Provider"}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase block">Base Price</span>
            <span className="font-semibold text-slate-300">${basePrice.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-[10px] text-emerald-400 uppercase block font-bold">Total Invoiced GMV</span>
            <span className="font-black text-white text-sm">${finalGMV.toFixed(2)}</span>
          </div>
        </div>

        {/* ── Section 1: Photographic Proof-of-Work ── */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <Camera className="h-4 w-4 text-indigo-400" />
            <span>Job Execution Photographic Proof</span>
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Before Photo */}
            <div className="space-y-2 bg-slate-950/50 p-3.5 rounded-xl border border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wide">
                  1. Before Service (Pre-Condition)
                </span>
                {beforeUrl && (
                  <a
                    href={beforeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-indigo-400 hover:underline flex items-center gap-0.5"
                  >
                    <span>Full-Res</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>

              {beforeUrl ? (
                <div className="aspect-video rounded-lg overflow-hidden border border-slate-700 bg-black flex items-center justify-center">
                  <img
                    src={beforeUrl}
                    alt="Before Service Condition"
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                  />
                </div>
              ) : (
                <div className="aspect-video rounded-lg border border-dashed border-slate-800 flex flex-col items-center justify-center text-xs text-slate-500">
                  <Camera className="h-6 w-6 text-slate-600 mb-1" />
                  <span>No 'Before' photo attached</span>
                </div>
              )}
            </div>

            {/* After Photo */}
            <div className="space-y-2 bg-slate-950/50 p-3.5 rounded-xl border border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 uppercase tracking-wide">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>2. After Service (Finished Work)</span>
                </span>
                {afterUrl && (
                  <a
                    href={afterUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-indigo-400 hover:underline flex items-center gap-0.5"
                  >
                    <span>Full-Res</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>

              {afterUrl ? (
                <div className="aspect-video rounded-lg overflow-hidden border border-emerald-800/60 bg-black flex items-center justify-center">
                  <img
                    src={afterUrl}
                    alt="After Service Completed"
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                  />
                </div>
              ) : (
                <div className="aspect-video rounded-lg border border-dashed border-slate-800 flex flex-col items-center justify-center text-xs text-slate-500">
                  <CheckCircle2 className="h-6 w-6 text-slate-600 mb-1" />
                  <span>No 'After' photo attached</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Section 2: Invoice Audit & Mid-Job Add-ons ── */}
        <div className="space-y-3 pt-4 border-t border-slate-800">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Receipt className="h-4 w-4 text-emerald-400" />
              <span>Invoice Audit & Mid-Job Upsell Analysis</span>
            </h4>
            <span className="text-[11px] text-slate-400">
              {addons.length} Add-on{addons.length === 1 ? "" : "s"} Logged
            </span>
          </div>

          {/* Financial Breakdown Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase block font-semibold">Service Base</span>
              <p className="text-base font-bold text-white mt-1">${basePrice.toFixed(2)}</p>
            </div>
            <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800">
              <span className="text-[10px] text-emerald-400 uppercase block font-semibold">Approved Add-ons</span>
              <p className="text-base font-bold text-emerald-400 mt-1">+${approvedTotal.toFixed(2)}</p>
            </div>
            <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800">
              <span className="text-[10px] text-indigo-400 uppercase block font-semibold">Platform Fee (20%)</span>
              <p className="text-base font-bold text-indigo-300 mt-1">${platformCommission.toFixed(2)}</p>
            </div>
            <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase block font-semibold">Provider Net (80%)</span>
              <p className="text-base font-bold text-slate-200 mt-1">${proPayout.toFixed(2)}</p>
            </div>
          </div>

          {/* Add-ons List with Fraud / Gouging Detection */}
          {addons.length === 0 ? (
            <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-xl text-center text-xs text-slate-500">
              No mid-job add-ons or parts requested for this order. Clean single-service invoice.
            </div>
          ) : (
            <div className="space-y-2.5">
              {addons.map((addon) => {
                const cost = Number(addon.cost || 0);
                const isHighRatio = basePrice > 0 && cost > basePrice;
                const isMissingPhoto = !addon.photo_url && cost > 50;

                return (
                  <div
                    key={addon.id}
                    className={`p-3.5 rounded-xl border transition-all ${
                      addon.status === "approved"
                        ? "bg-slate-950/90 border-slate-800"
                        : addon.status === "declined"
                        ? "bg-slate-950/50 border-rose-950/40 opacity-70"
                        : "bg-amber-950/20 border-amber-900/40"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {addon.photo_url ? (
                          <a
                            href={addon.photo_url}
                            target="_blank"
                            rel="noreferrer"
                            className="h-12 w-12 rounded-lg overflow-hidden border border-slate-700 shrink-0 block group relative"
                            title="Inspect Condition Evidence"
                          >
                            <img
                              src={addon.photo_url}
                              alt="Condition evidence"
                              className="h-full w-full object-cover group-hover:scale-110 transition"
                            />
                          </a>
                        ) : (
                          <div className="h-12 w-12 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                            <Camera className="h-5 w-5 text-slate-500" />
                          </div>
                        )}

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white">
                              {addon.custom_description || addon.service?.name || "Additional Service / Part"}
                            </span>
                            <span className="text-xs font-mono font-bold text-emerald-400">
                              +${cost.toFixed(2)}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            Logged: {new Date(addon.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>

                      {/* Status & Fraud Guardrails */}
                      <div className="flex items-center gap-2">
                        {addon.status === "approved" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            <CheckCircle2 className="h-3 w-3" /> Customer Approved
                          </span>
                        ) : addon.status === "declined" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                            <XCircle className="h-3 w-3" /> Customer Declined
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse">
                            <Clock className="h-3 w-3" /> Pending Client Decision
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Fraud / Anomaly Audit Callout */}
                    {(isHighRatio || isMissingPhoto) && (
                      <div className="mt-2.5 p-2 rounded-lg bg-amber-950/30 border border-amber-800/40 text-[11px] text-amber-300 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                        <span>
                          {isHighRatio && (
                            <strong>High Upsell Ratio: Add-on cost exceeds 100% of the service base price. Verify photo evidence. </strong>
                          )}
                          {isMissingPhoto && (
                            <span>Material charge &gt; $50 without attached photo proof.</span>
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-colors"
          >
            Close Audit View
          </button>
        </div>
      </div>
    </div>
  );
}

export default ProofOfWorkAuditModal;

