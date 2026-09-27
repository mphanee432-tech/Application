"use client";

import React, { useState } from "react";
import {
  X,
  Copy,
  Check,
  MapPin,
  User,
  Briefcase,
  DollarSign,
  Calendar,
  Clock,
  Camera,
  ExternalLink,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  FileText,
} from "lucide-react";

interface BookingDetailModalProps {
  booking: any | null;
  isOpen: boolean;
  onClose: () => void;
  onAuditProof?: (booking: any) => void;
}

export function BookingDetailModal({
  booking,
  isOpen,
  onClose,
  onAuditProof,
}: BookingDetailModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !booking) return null;

  const handleCopyId = () => {
    if (booking.id) {
      navigator.clipboard.writeText(booking.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const customerName =
    booking.profiles?.full_name ||
    booking.customer?.full_name ||
    "Customer";
  const customerEmail =
    booking.profiles?.email ||
    booking.customer?.email ||
    "No email";
  const customerPhone =
    booking.profiles?.phone ||
    booking.profiles?.mobile ||
    booking.customer?.phone ||
    booking.customer?.mobile ||
    "N/A";

  const pro = booking.professionals || booking.professional;
  const proName =
    booking.professionals?.full_name ||
    booking.professionals?.profile?.full_name ||
    booking.professional?.profile?.full_name ||
    booking.professional?.full_name ||
    null;
  const proPhone =
    pro?.profile?.phone ||
    pro?.profile?.mobile ||
    pro?.phone ||
    pro?.mobile ||
    "N/A";
  const proTrade = pro?.trade || "General Service";
  const proRating = pro?.rating ? Number(pro?.rating).toFixed(1) : "5.0";

  const cityName =
    booking.cities?.name ||
    booking.city?.name ||
    booking.city_name ||
    (booking.city_id ? `City ID: ${booking.city_id.slice(0, 8)}` : "All Regions");

  const serviceName =
    booking.services?.name ||
    booking.service?.name ||
    booking.service_type ||
    "Standard Service";

  const lat = booking.latitude ?? booking.lat;
  const lng = booking.longitude ?? booking.lng;
  const hasGps = typeof lat === "number" && typeof lng === "number" && lat !== 0 && lng !== 0;

  const proofPhotos = booking.proof_photos;
  const hasProof = proofPhotos && (proofPhotos.before || proofPhotos.after);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl flex flex-col text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 sticky top-0 bg-slate-900/95 backdrop-blur z-10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Booking Details</h3>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold capitalize ${
                    booking.status === "completed"
                      ? "bg-emerald-950 border border-emerald-800 text-emerald-300"
                      : booking.status === "pending"
                      ? "bg-amber-950 border border-amber-800 text-amber-300"
                      : booking.status === "cancelled"
                      ? "bg-rose-950 border border-rose-800 text-rose-300"
                      : "bg-blue-950 border border-blue-800 text-blue-300"
                  }`}
                >
                  {booking.status?.replace("_", " ") || "Pending"}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="font-mono text-xs text-indigo-400">#{booking.id}</span>
                <button
                  onClick={handleCopyId}
                  className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white transition"
                  title="Copy Full Booking ID"
                >
                  {copied ? (
                    <span className="text-emerald-400 flex items-center gap-0.5">
                      <Check className="h-3 w-3" /> Copied
                    </span>
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </button>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 text-xs">
          {/* Key Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <span className="text-slate-400 block mb-1">Service Type</span>
              <span className="font-bold text-white text-sm block truncate">{serviceName}</span>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <span className="text-slate-400 block mb-1">Order Amount</span>
              <span className="font-bold text-emerald-400 text-sm block">
                ${Number(booking.price || 0).toFixed(2)}
              </span>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <span className="text-slate-400 block mb-1">Operating City</span>
              <span className="font-bold text-slate-200 text-sm block truncate">{cityName}</span>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <span className="text-slate-400 block mb-1">Created At</span>
              <span className="font-semibold text-slate-300 block truncate">
                {new Date(booking.created_at).toLocaleDateString([], {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </div>

          {/* Customer & Professional 2-Column Section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Customer Box */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 space-y-2">
              <div className="flex items-center gap-2 text-indigo-400 font-bold border-b border-slate-800 pb-2">
                <User className="h-4 w-4" />
                <span>Customer Information</span>
              </div>
              <div className="space-y-1 pt-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Full Name:</span>
                  <span className="font-semibold text-white">{customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Email:</span>
                  <span className="text-slate-300">{customerEmail}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Phone:</span>
                  <span className="text-slate-300">{customerPhone}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-800/60">
                  <span className="text-slate-500">Customer ID:</span>
                  <span className="font-mono text-[10px] text-slate-400">
                    {booking.customer_id?.slice(0, 12)}...
                  </span>
                </div>
              </div>
            </div>

            {/* Professional Box */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 font-bold border-b border-slate-800 pb-2">
                <Briefcase className="h-4 w-4" />
                <span>Assigned Professional</span>
              </div>
              {proName ? (
                <div className="space-y-1 pt-1">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Name:</span>
                    <span className="font-semibold text-emerald-400">{proName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Trade:</span>
                    <span className="text-slate-300">{proTrade}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Rating:</span>
                    <span className="text-amber-400 font-bold">★ {proRating}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Phone:</span>
                    <span className="text-slate-300">{proPhone}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-slate-800/60">
                    <span className="text-slate-500">Provider ID:</span>
                    <span className="font-mono text-[10px] text-slate-400">
                      {booking.professional_id?.slice(0, 12)}...
                    </span>
                  </div>
                </div>
              ) : (
                <div className="py-4 text-center text-slate-500 italic">
                  <p className="font-medium text-amber-400/90 not-italic mb-1">
                    {booking.professionals?.full_name || "Unassigned (Broadcast)"}
                  </p>
                  <p className="text-[11px]">Awaiting acceptance from eligible providers in {cityName}</p>
                </div>
              )}
            </div>
          </div>

          {/* Location & Schedule */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2 text-blue-400 font-bold">
                <MapPin className="h-4 w-4" />
                <span>Location & Scheduling</span>
              </div>
              {hasGps && (
                <a
                  href={`https://www.google.com/maps?q=${lat},${lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold"
                >
                  <span>Open in Google Maps</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <span className="text-slate-400 block mb-0.5">Service Address:</span>
                <p className="font-medium text-slate-200">
                  {booking.address || "No street address recorded"}
                </p>
                {hasGps && (
                  <p className="font-mono text-[10px] text-slate-500 mt-1">
                    GPS: {lat.toFixed(6)}, {lng.toFixed(6)}
                  </p>
                )}
              </div>

              <div>
                <span className="text-slate-400 block mb-0.5">Scheduled Timing:</span>
                <p className="font-medium text-slate-200">
                  {booking.scheduled_date || booking.scheduled_at
                    ? new Date(booking.scheduled_date || booking.scheduled_at).toLocaleString([], {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "Immediate On-Demand Dispatch"}
                </p>
              </div>
            </div>
          </div>

          {/* Notes & Special Instructions */}
          {booking.notes && (
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 space-y-1.5">
              <span className="text-slate-400 font-semibold block">Customer Notes / Instructions:</span>
              <p className="text-slate-300 bg-slate-900 p-2.5 rounded-lg border border-slate-800 font-mono text-[11px]">
                {booking.notes}
              </p>
            </div>
          )}

          {/* Cancellation Info if cancelled */}
          {booking.status === "cancelled" && (
            <div className="rounded-xl border border-rose-900/60 bg-rose-950/30 p-4 space-y-2">
              <div className="flex items-center gap-2 text-rose-400 font-bold">
                <AlertCircle className="h-4 w-4" />
                <span>Cancellation Information</span>
              </div>
              <div className="text-slate-300 space-y-1">
                <p>
                  <strong className="text-slate-400">Reason:</strong>{" "}
                  {booking.cancellation_reason || "None recorded"}
                </p>
                {booking.cancellation_fee > 0 && (
                  <p>
                    <strong className="text-slate-400">Cancellation Fee:</strong> $
                    {Number(booking.cancellation_fee).toFixed(2)}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Proof of Work Photos Preview */}
          {hasProof && (
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2 text-emerald-400 font-bold">
                  <Camera className="h-4 w-4" />
                  <span>Proof of Work Photos</span>
                </div>
                {onAuditProof && (
                  <button
                    onClick={() => onAuditProof(booking)}
                    className="flex items-center gap-1 text-[11px] text-emerald-400 hover:underline font-semibold"
                  >
                    <span>Full Audit View</span>
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 pt-1">
                {proofPhotos.before && (
                  <div>
                    <span className="text-[10px] text-slate-400 block mb-1 uppercase font-bold">
                      Before Service
                    </span>
                    <img
                      src={proofPhotos.before}
                      alt="Before Work"
                      className="h-28 w-full object-cover rounded-lg border border-slate-700 bg-slate-950"
                    />
                  </div>
                )}
                {proofPhotos.after && (
                  <div>
                    <span className="text-[10px] text-slate-400 block mb-1 uppercase font-bold">
                      After Service
                    </span>
                    <img
                      src={proofPhotos.after}
                      alt="After Work"
                      className="h-28 w-full object-cover rounded-lg border border-slate-700 bg-slate-950"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-800 px-6 py-4 bg-slate-900/90 rounded-b-2xl">
          <span className="text-[11px] text-slate-500 font-mono">
            Updated: {new Date(booking.updated_at || booking.created_at).toLocaleTimeString()}
          </span>

          <div className="flex items-center gap-3">
            {onAuditProof && (hasProof || booking.status === "completed") && (
              <button
                onClick={() => onAuditProof(booking)}
                className="flex items-center gap-1.5 rounded-xl border border-emerald-800 bg-emerald-950/80 px-4 py-2 text-xs font-bold text-emerald-400 hover:bg-emerald-900/60 transition"
              >
                <Camera className="h-3.5 w-3.5" />
                <span>Audit Proof Photos</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 hover:text-white transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

