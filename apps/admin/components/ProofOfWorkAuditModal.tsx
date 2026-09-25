"use client";

import React from "react";
import { Camera, CheckCircle2, X, ExternalLink, ShieldCheck, User, Calendar, DollarSign } from "lucide-react";

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
  if (!isOpen || !booking) return null;

  const proof = booking.proof_photos || {};
  const beforeUrl = proof.before;
  const afterUrl = proof.after;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6 text-slate-100 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-start border-b border-slate-800 pb-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-800/40">
              <Camera className="h-3.5 w-3.5" /> Proof-of-Work Quality Audit
            </div>
            <h3 className="text-lg font-bold text-white mt-1">
              Order #{booking.id.slice(0, 8)} Verification
            </h3>
            <p className="text-xs text-slate-400">
              Side-by-side photographic evidence uploaded by the service provider upon job completion.
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl text-xs">
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
            <span className="text-[10px] text-slate-500 uppercase block">Order Total</span>
            <span className="font-semibold text-white">${Number(booking.price || 0).toFixed(2)}</span>
          </div>
        </div>

        {/* Side-by-Side Photographic Proof */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Before Photo */}
          <div className="space-y-2 bg-slate-950/50 p-3.5 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5 uppercase tracking-wide">
                <span>1. Before Service (Pre-Condition)</span>
              </span>
              {beforeUrl && (
                <a
                  href={beforeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-indigo-400 hover:underline flex items-center gap-0.5"
                >
                  <span>Open Full-Res</span>
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
                  <span>Open Full-Res</span>
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

        {/* Audit Verification Stamp */}
        <div className="p-3.5 bg-emerald-950/20 border border-emerald-800/40 rounded-xl flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-emerald-300">
            <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>
              Quality Control Status: <strong>Verified Photographic Gate Passed</strong>
            </span>
          </div>
          <span className="text-[10px] font-mono text-slate-400">
            Uploaded: {proof.uploaded_at ? new Date(proof.uploaded_at).toLocaleString() : "Upon Completion"}
          </span>
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
