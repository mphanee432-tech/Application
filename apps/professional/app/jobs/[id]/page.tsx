"use client";

export const dynamic = "force-dynamic";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  createBrowserSupabaseClient,
  getCurrentUser,
  fetchBookingDetails,
  updateJobStatus,
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
  Building,
  Check,
  ChevronRight,
} from "lucide-react";
import { ProofOfWorkModal } from "../../../components/ProofOfWorkModal";

export default function ProfessionalJobDrillDownPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params?.id as string;

  const [supabase] = useState(() => createBrowserSupabaseClient("professional"));
  const [user, setUser] = useState<any>(null);
  const [job, setJob] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Proof Modal
  const [showProofModal, setShowProofModal] = useState(false);

  const loadData = async () => {
    if (!jobId) return;
    try {
      setError(null);
      const data = await fetchBookingDetails(jobId, supabase);
      if (!data) {
        setError("Job order not found or could not be loaded.");
        return;
      }
      setJob(data);
    } catch (err: any) {
      console.error("Error loading job details:", err);
      setError(err?.message || "Failed to load job order details.");
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
          router.push(`/login?redirect=/jobs/${jobId}`);
          return;
        }
        setUser(currentUser);

        await loadData();
        if (!isMounted) return;

        // Subscribe to real-time changes on this specific booking
        const channelName = `pro-job-drilldown-${jobId}-${Date.now()}`;
        channel = supabase
          .channel(channelName)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "bookings",
              filter: `id=eq.${jobId}`,
            },
            () => {
              if (isMounted) loadData();
            }
          )
          .subscribe();
      } catch (err: any) {
        console.error("Job drilldown init error:", err);
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
  }, [jobId]);

  const handleUpdateStatus = async (newStatus: "en_route" | "arrived" | "in_progress") => {
    if (!job) return;
    setActionLoading(newStatus);
    setFeedback(null);
    try {
      await updateJobStatus(job.id, newStatus, supabase);
      setFeedback({ type: "success", text: `Status updated to ${newStatus.replace("_", " ").toUpperCase()}!` });
      await loadData();
    } catch (err: any) {
      console.error("Failed to update status:", err);
      setFeedback({ type: "error", text: err?.message || "Failed to advance job status." });
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 text-emerald-500 animate-spin" />
          <p className="text-sm text-slate-400">Loading order execution workspace & navigation...</p>
        </div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 max-w-md w-full text-center space-y-4">
          <AlertCircle className="h-10 w-10 text-rose-400 mx-auto" />
          <h2 className="text-lg font-bold text-white">Job Order Not Found</h2>
          <p className="text-xs text-slate-400">{error || "The requested service order could not be located."}</p>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Return to Dispatch</span>
          </Link>
        </div>
      </div>
    );
  }

  const customerName =
    job.customer?.full_name ||
    job.customer?.email ||
    "Homeowner Client";
  const customerPhone = job.customer?.phone || job.customer?.mobile;

  const lat = job.latitude || job.lat || 37.7749;
  const lng = job.longitude || job.lng || -122.4194;

  const isCompleted = job.status === "completed";
  const isCancelled = job.status === "cancelled";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Header */}
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-800 bg-slate-800/60 hover:bg-slate-800 text-xs font-semibold text-slate-300 transition"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Dispatch</span>
            </Link>
            <div className="h-4 w-px bg-slate-800" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold text-white">Execution: Order #{job.id.slice(0, 8)}</h1>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                    isCompleted
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : isCancelled
                      ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                      : "bg-blue-500/20 text-blue-400 border border-blue-500/30 animate-pulse"
                  }`}
                >
                  {job.status}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {job.service_type || job.services?.name || "Service Assignment"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              className="p-2 text-slate-400 hover:text-white rounded-lg transition"
              title="Refresh job details"
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
      <main className="mx-auto max-w-6xl w-full px-4 py-8 sm:px-6 space-y-6 flex-1">
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

        {/* Top Summary: Customer & Navigation Card */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <User className="h-6 w-6 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/60 border border-emerald-800/50 px-2 py-0.5 rounded-full">
                  Customer Information
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  Created {new Date(job.created_at).toLocaleTimeString()}
                </span>
              </div>
              <h2 className="text-base font-bold text-white mt-1">{customerName}</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {customerPhone ? `Contact: ${customerPhone}` : "Phone number provided upon call"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {customerPhone && (
              <a
                href={`tel:${customerPhone}`}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-md shadow-emerald-600/20"
              >
                <Phone className="h-3.5 w-3.5" />
                <span>Call Client</span>
              </a>
            )}
            <Link
              href="/chat"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition"
            >
              <MessageSquare className="h-3.5 w-3.5 text-sky-400" />
              <span>In-App Chat</span>
            </Link>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-md shadow-blue-600/20"
            >
              <Navigation className="h-3.5 w-3.5" />
              <span>Turn-by-Turn GPS</span>
              <ExternalLink className="h-3 w-3 ml-0.5" />
            </a>
          </div>
        </section>

        {/* Execution Controls & Stepper */}
        {!isCancelled && (
          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-6 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Navigation className="h-4 w-4 text-emerald-400" />
                  <span>Job Lifecycle Progression</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Update your dispatch status so the homeowner and operations team track your arrival.
                </p>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Payout</span>
                <span className="text-lg font-black text-emerald-400">
                  ₹{Number(job.price || 0).toFixed(2)}
                </span>
              </div>
            </div>

            {/* Transition Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              {/* 1. En Route */}
              <button
                onClick={() => handleUpdateStatus("en_route")}
                disabled={actionLoading !== null || job.status === "en_route" || ["arrived", "in_progress", "completed"].includes(job.status)}
                className={`py-3 px-4 rounded-xl text-xs font-bold transition border flex flex-col items-center justify-center gap-1 ${
                  job.status === "en_route"
                    ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/20"
                    : ["arrived", "in_progress", "completed"].includes(job.status)
                    ? "bg-slate-950 border-emerald-800/40 text-emerald-400 opacity-80"
                    : "border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-750"
                }`}
              >
                <span>1. En Route 🚗</span>
                <span className="text-[10px] font-normal opacity-80">
                  {["arrived", "in_progress", "completed"].includes(job.status) ? "Completed" : "Traveling to site"}
                </span>
              </button>

              {/* 2. Arrived */}
              <button
                onClick={() => handleUpdateStatus("arrived")}
                disabled={actionLoading !== null || job.status === "arrived" || ["in_progress", "completed"].includes(job.status)}
                className={`py-3 px-4 rounded-xl text-xs font-bold transition border flex flex-col items-center justify-center gap-1 ${
                  job.status === "arrived"
                    ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20"
                    : ["in_progress", "completed"].includes(job.status)
                    ? "bg-slate-950 border-emerald-800/40 text-emerald-400 opacity-80"
                    : "border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-750"
                }`}
              >
                <span>2. Arrived On-Site 📍</span>
                <span className="text-[10px] font-normal opacity-80">
                  {["in_progress", "completed"].includes(job.status) ? "Completed" : "Parked at premises"}
                </span>
              </button>

              {/* 3. In Progress */}
              <button
                onClick={() => handleUpdateStatus("in_progress")}
                disabled={actionLoading !== null || job.status === "in_progress" || job.status === "completed"}
                className={`py-3 px-4 rounded-xl text-xs font-bold transition border flex flex-col items-center justify-center gap-1 ${
                  job.status === "in_progress"
                    ? "bg-amber-600 border-amber-500 text-white shadow-lg shadow-amber-600/20"
                    : job.status === "completed"
                    ? "bg-slate-950 border-emerald-800/40 text-emerald-400 opacity-80"
                    : "border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-750"
                }`}
              >
                <span>3. Start Job ⚡</span>
                <span className="text-[10px] font-normal opacity-80">
                  {job.status === "completed" ? "Completed" : "Repairs underway"}
                </span>
              </button>

              {/* 4. Complete & Proof */}
              <button
                onClick={() => setShowProofModal(true)}
                disabled={actionLoading !== null || isCompleted}
                className={`py-3 px-4 rounded-xl text-xs font-bold transition border flex flex-col items-center justify-center gap-1 ${
                  isCompleted
                    ? "bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-600/20"
                    : "border-emerald-600/60 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/60"
                }`}
              >
                <div className="flex items-center gap-1">
                  <Camera className="h-3.5 w-3.5" />
                  <span>4. Complete Proof 📸</span>
                </div>
                <span className="text-[10px] font-normal opacity-80">
                  {isCompleted ? "Verified & Paid" : "Upload Before/After"}
                </span>
              </button>
            </div>
          </section>
        )}

        {/* Location & Instructions Grid */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Destination Details */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4 shadow-xl">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <MapPin className="h-4 w-4 text-emerald-400" />
              <span>Destination Coordinates & Pin</span>
            </h3>

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-3 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">
                  Customer Street Address
                </span>
                <p className="text-white font-medium text-sm mt-0.5">{job.address}</p>
              </div>

              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">
                  Latitude / Longitude
                </span>
                <p className="font-mono text-emerald-400 font-bold text-xs mt-0.5">
                  {Number(lat).toFixed(6)}° N, {Number(lng).toFixed(6)}° W
                </p>
              </div>

              <div className="pt-2 border-t border-slate-800/80">
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition"
                >
                  <Navigation className="h-4 w-4" />
                  <span>Launch Google Navigation</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          </div>

          {/* Job Notes & Special Instructions */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4 shadow-xl">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Building className="h-4 w-4 text-emerald-400" />
              <span>Job Instructions & Scope</span>
            </h3>

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-3 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">
                  Service Type
                </span>
                <p className="text-white font-semibold mt-0.5">
                  {job.service_type || job.services?.name || "General Service"}
                </p>
              </div>

              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">
                  Homeowner Notes / Problem Description
                </span>
                <p className="text-slate-300 mt-0.5 leading-relaxed">
                  {job.notes || "No special instructions provided by the customer."}
                </p>
              </div>

              {job.scheduled_date && (
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">
                    Target Appointment Slot
                  </span>
                  <p className="text-slate-200 mt-0.5 font-medium">
                    {new Date(job.scheduled_date).toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Proof of Work Preview (if available) */}
        {job.proof_photos && (job.proof_photos.before || job.proof_photos.after) && (
          <section className="rounded-2xl border border-emerald-900/40 bg-slate-900 p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider">
                <CheckCircle2 className="h-4 w-4" />
                <span>Submitted Proof of Work</span>
              </div>
              <span className="text-[10px] text-emerald-400 font-mono">Job Verified</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {job.proof_photos.before && (
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-slate-300">Before Work Photo</span>
                  <img
                    src={job.proof_photos.before}
                    alt="Before service"
                    className="rounded-xl h-48 w-full object-cover border border-slate-800 shadow"
                  />
                </div>
              )}
              {job.proof_photos.after && (
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-slate-300">After Work Photo</span>
                  <img
                    src={job.proof_photos.after}
                    alt="After service"
                    className="rounded-xl h-48 w-full object-cover border border-slate-800 shadow"
                  />
                </div>
              )}
            </div>
          </section>
        )}
      </main>

      {/* Proof of Work Modal */}
      <ProofOfWorkModal
        isOpen={showProofModal}
        booking={job}
        onClose={() => setShowProofModal(false)}
        onSuccess={async () => {
          setShowProofModal(false);
          setFeedback({
            type: "success",
            text: "Proof of work uploaded and order finalized! Payout credited to your wallet.",
          });
          await loadData();
        }}
      />
    </div>
  );
}
