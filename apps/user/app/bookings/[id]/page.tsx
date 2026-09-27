"use client";

export const dynamic = "force-dynamic";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  createBrowserSupabaseClient,
  getCurrentUser,
  fetchBookingDetails,
  fetchBookingReview,
  type Tables,
} from "@repo/db";
import {
  ArrowLeft,
  Navigation,
  MapPin,
  Phone,
  MessageSquare,
  Calendar,
  DollarSign,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Camera,
  Star,
  RefreshCw,
  ExternalLink,
  ShieldAlert,
  Loader2,
  User,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { RateProfessionalModal } from "../../../components/RateProfessionalModal";
import CancelRescheduleModal from "../../../components/CancelRescheduleModal";

export default function CustomerBookingDrillDownPage() {
  const params = useParams();
  const router = useRouter();
  const bookingId = params?.id as string;

  const [supabase] = useState(() => createBrowserSupabaseClient());
  const [user, setUser] = useState<any>(null);
  const [booking, setBooking] = useState<any | null>(null);
  const [review, setReview] = useState<Tables<"reviews"> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadData = async () => {
    if (!bookingId) return;
    try {
      setError(null);
      const data = await fetchBookingDetails(bookingId, supabase);
      if (!data) {
        setError("Booking not found or could not be loaded.");
        return;
      }
      setBooking(data);

      if (data.status === "completed") {
        const rev = await fetchBookingReview(bookingId, supabase);
        setReview(rev);
      }
    } catch (err: any) {
      console.error("Error loading booking details:", err);
      setError(err?.message || "Failed to load booking details.");
    }
  };

  useEffect(() => {
    let isMounted = true;
    let channel: any = null;

    async function init() {
      try {
        setLoading(true);
        const currentUser = await getCurrentUser(supabase);
        if (!isMounted) return;
        if (!currentUser) {
          router.push(`/login?redirect=/bookings/${bookingId}`);
          return;
        }
        setUser(currentUser);

        await loadData();
        if (!isMounted) return;

        // Setup real-time listener for this booking
        const channelName = `booking-live-${bookingId}-${Date.now()}`;
        channel = supabase
          .channel(channelName)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "bookings",
              filter: `id=eq.${bookingId}`,
            },
            () => {
              if (isMounted) loadData();
            }
          )
          .subscribe();
      } catch (err: any) {
        console.error("Booking drilldown init error:", err);
        if (isMounted) setError(err?.message || "Initialization error.");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    init();

    return () => {
      isMounted = false;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [bookingId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
          <p className="text-sm text-slate-400">Loading live booking details & dispatch status...</p>
        </div>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 max-w-md w-full text-center space-y-4">
          <AlertCircle className="h-10 w-10 text-rose-400 mx-auto" />
          <h2 className="text-lg font-bold text-white">Booking Not Found</h2>
          <p className="text-xs text-slate-400">{error || "The requested service order does not exist."}</p>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Return to Dashboard</span>
          </Link>
        </div>
      </div>
    );
  }

  const steps = [
    { status: "pending", label: "Broadcast Dispatched", desc: "Searching for qualified technicians nearby" },
    { status: "accepted", label: "Provider Matched", desc: "Technician accepted and confirmed assignment" },
    { status: "en_route", label: "En Route", desc: "Technician is navigating to your address" },
    { status: "arrived", label: "Provider Arrived", desc: "Technician is on-site at your premises" },
    { status: "in_progress", label: "Work In Progress", desc: "Service repairs actively taking place" },
    { status: "completed", label: "Service Completed", desc: "Job done and verified with proof photos" },
  ];

  const order = ["pending", "accepted", "en_route", "arrived", "in_progress", "completed"];
  const currentIdx = order.indexOf(booking.status);
  const isCancelled = booking.status === "cancelled";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Header */}
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-800 bg-slate-800/60 hover:bg-slate-800 text-xs font-semibold text-slate-300 transition"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Portal</span>
            </Link>
            <div className="h-4 w-px bg-slate-800" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold text-white">Order #{booking.id.slice(0, 8)}</h1>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                    isCancelled
                      ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                      : booking.status === "completed"
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : "bg-blue-500/20 text-blue-400 border border-blue-500/30 animate-pulse"
                  }`}
                >
                  {booking.status}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {booking.service_type || booking.services?.name || "Service Order"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              className="p-2 text-slate-400 hover:text-white rounded-lg transition"
              title="Refresh status"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <Link
              href="/sos"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-800/60 bg-rose-950/60 hover:bg-rose-900/60 text-xs font-bold text-rose-300 transition"
            >
              <ShieldAlert className="h-3.5 w-3.5 text-rose-400" />
              <span>Safety SOS</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-5xl w-full px-4 py-8 sm:px-6 space-y-6 flex-1">
        {feedback && (
          <div
            className={`p-4 rounded-xl border flex items-center justify-between text-xs ${
              feedback.type === "success"
                ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300"
                : "bg-rose-950/40 border-rose-500/40 text-rose-300"
            }`}
          >
            <span>{feedback.text}</span>
            <button onClick={() => setFeedback(null)} className="text-xs font-bold opacity-70">
              ✕
            </button>
          </div>
        )}

        {/* Cancellation Notice Banner */}
        {isCancelled && (
          <div className="rounded-2xl border border-rose-800/80 bg-rose-950/30 p-5 space-y-2 text-xs">
            <div className="flex items-center gap-2 text-rose-300 font-bold text-sm">
              <AlertTriangle className="h-4 w-4 text-rose-400" />
              <span>This booking was cancelled</span>
            </div>
            {booking.cancellation_reason && (
              <p className="text-slate-300">
                <strong>Reason:</strong> {booking.cancellation_reason}
              </p>
            )}
            {booking.cancellation_fee > 0 && (
              <p className="text-amber-400">
                Cancellation Fee Applied: ${Number(booking.cancellation_fee).toFixed(2)}
              </p>
            )}
          </div>
        )}

        {/* Matched Professional Card */}
        {booking.professional ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center shrink-0">
                <User className="h-6 w-6 text-blue-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 bg-blue-950/60 border border-blue-800/50 px-2 py-0.5 rounded-full">
                    Assigned Technician
                  </span>
                  {booking.professional.is_online && (
                    <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-semibold">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Live GPS Active
                    </span>
                  )}
                </div>
                <h3 className="text-base font-bold text-white mt-1">
                  {booking.professional.full_name ||
                    booking.professional.profile?.full_name ||
                    "Certified Field Specialist"}
                </h3>
                <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                  <span>{booking.professional.trade || "Provider"}</span>
                  <span>•</span>
                  <span className="text-amber-400 flex items-center gap-0.5 font-bold">
                    <Star className="h-3.5 w-3.5 fill-amber-400" />
                    {booking.professional.rating
                      ? Number(booking.professional.rating).toFixed(1)
                      : "5.0"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {(booking.professional.profile?.phone || booking.professional.phone) && (
                <a
                  href={`tel:${booking.professional.profile?.phone || booking.professional.phone}`}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-md shadow-blue-600/20"
                >
                  <Phone className="h-3.5 w-3.5" />
                  <span>Call Provider</span>
                </a>
              )}
              <Link
                href="/chat"
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition"
              >
                <MessageSquare className="h-3.5 w-3.5 text-blue-400" />
                <span>Open Chat</span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 flex items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-slate-800 flex items-center justify-center shrink-0">
                <Clock className="h-5 w-5 text-blue-400 animate-spin" />
              </div>
              <div>
                <p className="text-white font-semibold">Broadcasting to Available Technicians</p>
                <p className="text-slate-400 text-[11px] mt-0.5">
                  Our automated dispatch engine is matching an approved provider in your service area.
                </p>
              </div>
            </div>
            {["pending", "accepted"].includes(booking.status) && (
              <button
                onClick={() => setShowCancelModal(true)}
                className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
              >
                Modify / Cancel
              </button>
            )}
          </div>
        )}

        {/* Live Status Lifecycle Stepper */}
        {!isCancelled && (
          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4 shadow-xl">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Navigation className="h-4 w-4 text-blue-400" />
              <span>Real-Time Service Progress</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-6 gap-3 pt-2">
              {steps.map((step, idx) => {
                const isComplete = currentIdx >= idx;
                const isCurrent = booking.status === step.status;

                return (
                  <div
                    key={step.status}
                    className={`rounded-xl border p-3 flex flex-col justify-between transition-all ${
                      isCurrent
                        ? "bg-blue-600/15 border-blue-500 shadow-md shadow-blue-500/10"
                        : isComplete
                        ? "bg-slate-900 border-emerald-800/40"
                        : "bg-slate-950/40 border-slate-800/60 opacity-60"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                          isCurrent
                            ? "bg-blue-600 text-white"
                            : isComplete
                            ? "bg-emerald-600 text-white"
                            : "bg-slate-800 text-slate-500"
                        }`}
                      >
                        {isComplete ? "✓" : idx + 1}
                      </span>
                      {isCurrent && (
                        <span className="h-2 w-2 rounded-full bg-blue-400 animate-ping" />
                      )}
                    </div>
                    <div>
                      <p
                        className={`text-xs font-bold ${
                          isCurrent ? "text-blue-300" : isComplete ? "text-slate-200" : "text-slate-500"
                        }`}
                      >
                        {step.label}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1 leading-tight">{step.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Order Details Grid */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Service & Pricing Details */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4 shadow-xl">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-400" />
              <span>Service & Payment Details</span>
            </h3>

            <div className="divide-y divide-slate-800/60 text-xs">
              <div className="py-2.5 flex justify-between items-center">
                <span className="text-slate-400">Service Category</span>
                <span className="font-semibold text-white">
                  {booking.service_type || booking.services?.name || "General Service"}
                </span>
              </div>
              <div className="py-2.5 flex justify-between items-center">
                <span className="text-slate-400">Total Price</span>
                <span className="font-mono text-emerald-400 font-bold text-sm">
                  ${Number(booking.price || 0).toFixed(2)}
                </span>
              </div>
              {booking.scheduled_date && (
                <div className="py-2.5 flex justify-between items-center">
                  <span className="text-slate-400">Scheduled Date / Slot</span>
                  <span className="font-semibold text-slate-200">
                    {new Date(booking.scheduled_date).toLocaleDateString()}
                  </span>
                </div>
              )}
              <div className="py-2.5 flex justify-between items-center">
                <span className="text-slate-400">Created At</span>
                <span className="text-slate-300">
                  {new Date(booking.created_at).toLocaleString()}
                </span>
              </div>
            </div>

            {booking.notes && (
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs space-y-1">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">
                  Problem Description / Notes
                </span>
                <p className="text-slate-200">{booking.notes}</p>
              </div>
            )}
          </div>

          {/* Location & GPS Pin */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4 shadow-xl">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <MapPin className="h-4 w-4 text-blue-400" />
              <span>Service Location & Coordinates</span>
            </h3>

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-3 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">
                  Destination Address
                </span>
                <p className="text-white font-medium mt-0.5">{booking.address}</p>
              </div>

              {(booking.latitude || booking.lat) && (
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">
                    GPS Coordinates
                  </span>
                  <p className="font-mono text-emerald-400 font-bold">
                    {Number(booking.latitude || booking.lat).toFixed(6)},{" "}
                    {Number(booking.longitude || booking.lng).toFixed(6)}
                  </p>
                </div>
              )}

              <a
                href={`https://www.google.com/maps/search/?api=1&query=${
                  booking.latitude || booking.lat
                },${booking.longitude || booking.lng}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-850 hover:bg-slate-800 text-xs font-semibold text-slate-200 transition"
              >
                <MapPin className="h-3.5 w-3.5 text-blue-400" />
                <span>Open in Google Maps</span>
                <ExternalLink className="h-3 w-3 ml-0.5" />
              </a>
            </div>
          </div>
        </section>

        {/* Verified Proof of Work Photos (if available) */}
        {booking.proof_photos &&
          (booking.proof_photos.before || booking.proof_photos.after) && (
            <section className="rounded-2xl border border-emerald-900/40 bg-slate-900/60 p-6 space-y-4 shadow-xl">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider">
                <Camera className="h-4 w-4" />
                <span>Verified Proof-of-Work Audit</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {booking.proof_photos.before && (
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-slate-300">Before Service</span>
                    <img
                      src={booking.proof_photos.before}
                      alt="Before service"
                      className="rounded-xl h-48 w-full object-cover border border-slate-800 shadow"
                    />
                  </div>
                )}
                {booking.proof_photos.after && (
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-slate-300">After Service</span>
                    <img
                      src={booking.proof_photos.after}
                      alt="After service"
                      className="rounded-xl h-48 w-full object-cover border border-slate-800 shadow"
                    />
                  </div>
                )}
              </div>
            </section>
          )}

        {/* Completed Service Actions: Review */}
        {booking.status === "completed" && (
          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-amber-400" />
                <span>Service Rating & Feedback</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {review
                  ? `You rated this provider ${review.rating} / 5 stars.`
                  : "Help us maintain top-tier service by rating your provider."}
              </p>
            </div>

            <button
              onClick={() => setShowReviewModal(true)}
              className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-md shadow-amber-500/20 shrink-0"
            >
              <Star className="h-4 w-4 fill-slate-950" />
              <span>{review ? "Update Review" : "Rate Technician"}</span>
            </button>
          </section>
        )}

        {/* Pending Actions: Cancel / Reschedule */}
        {["pending", "accepted"].includes(booking.status) && (
          <div className="flex justify-end pt-2">
            <button
              onClick={() => setShowCancelModal(true)}
              className="px-4 py-2 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-rose-400 text-xs font-semibold transition"
            >
              Cancel or Reschedule Booking
            </button>
          </div>
        )}
      </main>

      {/* Review Modal */}
      <RateProfessionalModal
        isOpen={showReviewModal}
        booking={booking}
        onClose={() => setShowReviewModal(false)}
        onSubmitSuccess={() => {
          setShowReviewModal(false);
          setFeedback({ type: "success", text: "Thank you! Your provider review has been published." });
          loadData();
        }}
      />

      {/* Cancel / Reschedule Modal */}
      <CancelRescheduleModal
        isOpen={showCancelModal}
        booking={booking}
        onClose={() => setShowCancelModal(false)}
        onSuccess={() => {
          setShowCancelModal(false);
          setFeedback({ type: "success", text: "Booking modified / cancelled successfully." });
          loadData();
        }}
      />
    </div>
  );
}
