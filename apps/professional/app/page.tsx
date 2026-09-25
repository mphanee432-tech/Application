"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createBrowserSupabaseClient,
  fetchAvailableJobs,
  fetchActiveJobForPro,
  acceptJob,
  updateJobStatus,
  getCurrentUser,
  fetchCurrentProfessional,
  type Tables,
} from "@repo/db";
import { SupabaseStatusBadge } from "../components/SupabaseStatusBadge";
import KycOnboardingModal from "../components/KycOnboardingModal";
import { ProofOfWorkModal } from "../components/ProofOfWorkModal";
import { RateCustomerModal } from "../components/RateCustomerModal";
import { ProSupportModal } from "../components/ProSupportModal";
import { ProProfileModal } from "../components/ProProfileModal";
import {
  Radio,
  Navigation,
  DollarSign,
  Clock,
  MapPin,
  CheckCircle,
  ExternalLink,
  Loader2,
  LogIn,
  LogOut,
  AlertCircle,
  Briefcase,
  User,
  Phone,
  Camera,
  Star,
  RefreshCw,
  ShieldAlert,
  LifeBuoy,
  FileCheck,
  Wallet,
} from "lucide-react";

export default function ProfessionalPortal() {
  const router = useRouter();
  const supabase = createBrowserSupabaseClient();

  const [user, setUser] = useState<any>(null);
  const [proRecord, setProRecord] = useState<any>(null);
  const [availableJobs, setAvailableJobs] = useState<any[]>([]);
  const [activeJob, setActiveJob] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // Modals state
  const [showKycModal, setShowKycModal] = useState(false);
  const [showProofModal, setShowProofModal] = useState(false);
  const [showRateModal, setShowRateModal] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [ratingBooking, setRatingBooking] = useState<any | null>(null);

  async function loadData() {
    setLoading(true);
    try {
      const currentUser = await getCurrentUser(supabase);
      setUser(currentUser);

      if (currentUser) {
        const proData = await fetchCurrentProfessional(supabase);
        setProRecord(proData);

        const [jobs, active] = await Promise.all([
          fetchAvailableJobs(supabase),
          fetchActiveJobForPro(supabase),
        ]);
        setAvailableJobs(jobs);
        setActiveJob(active);
      } else {
        setProRecord(null);
        setAvailableJobs([]);
        setActiveJob(null);
      }
    } catch (err) {
      console.error("Error loading professional data:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();

    // Subscribe to real-time changes on bookings, professionals (for instant KYC sync), and profiles
    const channel = supabase
      .channel("public:professional_portal_sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings" },
        () => {
          loadData();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "professionals" },
        () => {
          // Instant KYC approval sync: when Admin clicks Approve, pro automatically unblocks!
          loadData();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        () => {
          loadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function handleAccept(bookingId: string) {
    if (!user) {
      router.push("/login");
      return;
    }

    setActionLoading(bookingId);
    setFeedbackMessage(null);

    try {
      await acceptJob(bookingId, supabase);
      setFeedbackMessage("Job accepted! View active assignment below.");
      await loadData();
    } catch (err: unknown) {
      setFeedbackMessage(
        err instanceof Error ? `Failed to accept job: ${err.message}` : "Failed to accept job"
      );
    } finally {
      setActionLoading(null);
    }
  }

  async function handleUpdateStatus(status: "en_route" | "arrived" | "in_progress" | "completed") {
    if (!activeJob) return;

    if (status === "completed") {
      setShowProofModal(true);
      return;
    }

    setActionLoading(status);
    try {
      await updateJobStatus(activeJob.id, status, supabase);
      setFeedbackMessage(`Status updated to ${status}!`);
      await loadData();
    } catch (err: unknown) {
      setFeedbackMessage(
        err instanceof Error ? `Failed updating status: ${err.message}` : "Failed to update status"
      );
    } finally {
      setActionLoading(null);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setUser(null);
    setProRecord(null);
    setAvailableJobs([]);
    setActiveJob(null);
  }

  const isApproved = proRecord?.status === "approved" || proRecord?.kyc_status === "approved";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Top Header */}
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-md shadow-emerald-500/20 font-bold text-lg">
              PRO
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-white">HomeServe Pro</h1>
                <span className="rounded-md bg-emerald-950 border border-emerald-800 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                  Provider Portal
                </span>
              </div>
              <p className="text-xs text-slate-400">Real-Time Dispatch Feed & Execution</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <SupabaseStatusBadge />

            {user ? (
              <div className="flex items-center gap-2">
                {/* Online Toggle */}
                <button
                  onClick={() => setIsOnline(!isOnline)}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition ${
                    isOnline
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                      : "bg-slate-800 text-slate-400 border border-slate-700"
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      isOnline ? "bg-emerald-400 animate-pulse" : "bg-slate-500"
                    }`}
                  />
                  <span>{isOnline ? "Online" : "Offline"}</span>
                </button>

                {/* Earnings & Wallet Link */}
                <Link
                  href="/wallet"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-xs font-semibold text-slate-300 transition"
                  title="Earnings & Payout Wallet"
                >
                  <Wallet className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="hidden sm:inline">Earnings</span>
                </Link>

                {/* Support Modal Trigger */}
                <button
                  onClick={() => setShowSupportModal(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-xs font-semibold text-slate-300 transition"
                  title="Contact Dispatch Ops"
                >
                  <LifeBuoy className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="hidden sm:inline">Support</span>
                </button>

                {/* SOS Trigger Link */}
                <Link
                  href="/sos"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-rose-800/60 bg-rose-950/60 hover:bg-rose-900/60 text-xs font-bold text-rose-300 transition"
                  title="Field Danger SOS"
                >
                  <ShieldAlert className="h-3.5 w-3.5 text-rose-400" />
                  <span className="hidden sm:inline">SOS</span>
                </Link>

                {/* Profile Modal Trigger */}
                <button
                  onClick={() => setShowProfileModal(true)}
                  className="hidden sm:flex flex-col text-right hover:opacity-80 transition"
                  title="Edit Profile"
                >
                  <p className="text-xs font-bold text-slate-200">
                    {proRecord?.profile?.full_name || user.email?.split("@")[0]}
                  </p>
                  <p className="text-[10px] text-emerald-400 flex items-center justify-end gap-1">
                    <span>{proRecord?.trade || "Professional"}</span>
                    <span>•</span>
                    <span className="uppercase font-bold">{proRecord?.status || "pending"}</span>
                  </p>
                </button>

                <button
                  onClick={handleSignOut}
                  title="Sign Out"
                  className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-slate-400 hover:text-white transition"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-500 transition"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>Provider Sign In</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 space-y-8">
        {!user && (
          <div className="flex items-center justify-between rounded-2xl border border-emerald-900/60 bg-emerald-950/30 p-4 text-xs text-emerald-300">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-emerald-400 shrink-0" />
              <div>
                <strong className="font-semibold">Provider account required to accept broadcast jobs.</strong>
                <p className="text-slate-400 mt-0.5">
                  Sign in or register your trade license to access live customer assignments.
                </p>
              </div>
            </div>
            <Link
              href="/login"
              className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 transition shrink-0"
            >
              Sign In / Register
            </Link>
          </div>
        )}

        {/* KYC Pending Approval Blocker Notice */}
        {user && proRecord && !isApproved && (
          <div className="rounded-2xl border border-amber-800/80 bg-amber-950/30 p-6 backdrop-blur-sm shadow-xl space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-amber-500/20 p-2 text-amber-400 border border-amber-500/30 shrink-0">
                  <ShieldAlert className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-white">KYC Verification Under Review</h3>
                    <span className="rounded-md bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold text-amber-300 uppercase">
                      Status: {proRecord.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                    Your professional trade profile and identity documents are currently under operational review by Dispatch HQ.
                    As soon as an administrator approves your license, this banner will automatically dismiss in real-time, unlocking job broadcasts and GPS navigation.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={loadData}
                  disabled={loading}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-200 transition"
                  title="Check approval status"
                >
                  <RefreshCw className={`h-3.5 w-3.5 text-amber-400 ${loading ? "animate-spin" : ""}`} />
                  <span>Refresh Status</span>
                </button>
                <button
                  onClick={() => setShowKycModal(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-xs font-bold text-white shadow-md shadow-amber-600/20 transition"
                >
                  <FileCheck className="h-3.5 w-3.5" />
                  <span>Update KYC Docs</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {feedbackMessage && (
          <div className="rounded-xl border border-emerald-800 bg-emerald-950/60 p-3.5 text-xs text-emerald-300 font-medium flex items-center justify-between">
            <span>{feedbackMessage}</span>
            <button
              onClick={() => setFeedbackMessage(null)}
              className="text-xs opacity-70 hover:opacity-100"
            >
              ✕
            </button>
          </div>
        )}

        {/* 2-Column: Active Job vs Job Broadcast Feed */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Active Job Workflow (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            <div>
              <h3 className="text-base font-bold text-white">Active Job Assignment</h3>
              <p className="text-xs text-slate-400">Live order execution, navigation, and proof-of-work</p>
            </div>

            {loading ? (
              <div className="flex items-center justify-center p-12 text-xs text-slate-400">
                <Loader2 className="h-5 w-5 animate-spin mr-2 text-emerald-400" />
                Loading active database assignments...
              </div>
            ) : activeJob ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-6 shadow-xl">
                <div className="flex items-start justify-between border-b border-slate-800 pb-4">
                  <div>
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                      Order #{activeJob.id.slice(0, 8)} • Status: {activeJob.status.toUpperCase()}
                    </div>
                    <h2 className="mt-2 text-lg font-bold text-white">{activeJob.service_type}</h2>
                    <p className="text-xs text-slate-400 mt-1">
                      Customer: {activeJob.customer?.full_name || "Homeowner"} • {activeJob.customer?.phone || activeJob.customer?.mobile || "No phone listed"}
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="text-xs text-slate-400">Job Payout</span>
                    <p className="text-xl font-black text-emerald-400">
                      ${Number(activeJob.price).toFixed(2)}
                    </p>
                  </div>
                </div>

                {/* Destination & Coordinates */}
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30">
                        <Navigation className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-200">Customer Destination</p>
                        <p className="text-xs text-slate-400 mt-0.5">{activeJob.address}</p>
                        <p className="font-mono text-[11px] text-emerald-400 mt-1">
                          Coordinates: {Number(activeJob.latitude || activeJob.lat || 37.7749).toFixed(4)}° N, {Number(activeJob.longitude || activeJob.lng || -122.4194).toFixed(4)}° W
                        </p>
                      </div>
                    </div>

                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${activeJob.latitude || activeJob.lat || 37.7749},${activeJob.longitude || activeJob.lng || -122.4194}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition shadow-sm shrink-0"
                    >
                      <span>Open Navigation</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>

                  {activeJob.notes && (
                    <div className="mt-3 border-t border-slate-800/80 pt-2 text-xs text-slate-300">
                      <strong>Customer Notes:</strong> {activeJob.notes}
                    </div>
                  )}
                </div>

                {/* Status Progression Controls (4-step stepper including arrived) */}
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-slate-300">Advance Job Lifecycle Status:</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button
                      onClick={() => handleUpdateStatus("en_route")}
                      disabled={actionLoading !== null || activeJob.status === "en_route"}
                      className={`rounded-xl py-2.5 text-xs font-bold transition border ${
                        activeJob.status === "en_route"
                          ? "bg-blue-600 border-blue-500 text-white"
                          : "border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-700"
                      }`}
                    >
                      1. En Route
                    </button>
                    <button
                      onClick={() => handleUpdateStatus("arrived")}
                      disabled={actionLoading !== null || activeJob.status === "arrived"}
                      className={`rounded-xl py-2.5 text-xs font-bold transition border ${
                        activeJob.status === "arrived"
                          ? "bg-indigo-600 border-indigo-500 text-white"
                          : "border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-700"
                      }`}
                    >
                      2. Arrived
                    </button>
                    <button
                      onClick={() => handleUpdateStatus("in_progress")}
                      disabled={actionLoading !== null || activeJob.status === "in_progress"}
                      className={`rounded-xl py-2.5 text-xs font-bold transition border ${
                        activeJob.status === "in_progress"
                          ? "bg-amber-600 border-amber-500 text-white"
                          : "border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-700"
                      }`}
                    >
                      3. In Progress
                    </button>
                    <button
                      onClick={() => setShowProofModal(true)}
                      disabled={actionLoading !== null}
                      className="rounded-xl py-2.5 text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-500 transition shadow-lg shadow-emerald-950 flex items-center justify-center gap-1.5"
                    >
                      <Camera className="h-3.5 w-3.5" />
                      <span>4. Complete Proof</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-800 p-12 text-center text-xs text-slate-400">
                <Briefcase className="h-8 w-8 text-slate-600 mx-auto mb-2" />
                <p className="font-semibold text-slate-300">No active assignment</p>
                <p className="mt-1 text-slate-500">
                  Accept an incoming broadcast job from the feed on the right to start working.
                </p>
              </div>
            )}
          </div>

          {/* Job Broadcast Feed (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Radio className="h-4 w-4 text-emerald-400 animate-pulse" />
                <h3 className="text-base font-bold text-white">Live Job Broadcasts</h3>
              </div>
              <button
                onClick={loadData}
                className="text-xs text-emerald-400 hover:underline font-semibold"
              >
                Refresh Feed
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center p-8 text-xs text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin mr-2 text-emerald-400" />
                Checking available broadcasts...
              </div>
            ) : availableJobs.length === 0 ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center text-xs text-slate-400">
                <p className="font-semibold text-slate-300">No pending jobs in your area</p>
                <p className="mt-1 text-slate-500">
                  New customer bookings will appear here instantly via Supabase realtime.
                </p>
              </div>
            ) : (
              availableJobs.map((job) => (
                <div
                  key={job.id}
                  className="rounded-2xl border border-slate-800 bg-slate-900 p-4 transition hover:border-slate-700 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-mono text-[10px] text-slate-400 font-semibold">
                        #{job.id.slice(0, 8)}
                      </span>
                      <h4 className="text-sm font-bold text-white mt-0.5">{job.service_type}</h4>
                    </div>
                    <span className="text-sm font-black text-emerald-400">
                      ${Number(job.price).toFixed(2)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <MapPin className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                    <span className="truncate">{job.address || "Customer address"}</span>
                  </div>

                  {job.notes && (
                    <p className="text-[11px] text-slate-300 bg-slate-950 p-2 rounded-lg border border-slate-800">
                      {job.notes}
                    </p>
                  )}

                  <div className="flex items-center justify-between border-t border-slate-800/80 pt-3">
                    <span className="text-[11px] text-slate-400">
                      Requested: {new Date(job.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <button
                      onClick={() => handleAccept(job.id)}
                      disabled={actionLoading === job.id || !isApproved}
                      className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 transition shadow-md shadow-emerald-950 disabled:opacity-50"
                      title={!isApproved ? "KYC approval required to claim jobs" : "Accept job"}
                    >
                      {actionLoading === job.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : !isApproved ? (
                        "Approval Needed"
                      ) : (
                        "Accept Job"
                      )}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      {/* KYC Onboarding & Document Upload Modal */}
      <KycOnboardingModal
        isOpen={showKycModal}
        onClose={() => setShowKycModal(false)}
        onSuccess={() => {
          setShowKycModal(false);
          loadData();
          setFeedbackMessage("KYC documents submitted successfully! Awaiting admin review.");
        }}
      />

      {/* Proof of Work Before/After Photo Upload Modal */}
      <ProofOfWorkModal
        isOpen={showProofModal}
        booking={activeJob}
        onClose={() => setShowProofModal(false)}
        onSuccess={(updated) => {
          setShowProofModal(false);
          setRatingBooking(updated || activeJob);
          setShowRateModal(true);
          loadData();
        }}
      />

      {/* Two-Way Rate Customer Modal */}
      <RateCustomerModal
        isOpen={showRateModal}
        booking={ratingBooking}
        onClose={() => setShowRateModal(false)}
        onSubmitSuccess={() => {
          setShowRateModal(false);
          setRatingBooking(null);
          setFeedbackMessage("Job finalized and customer rated! Payment logged to earnings.");
          loadData();
        }}
      />

      {/* Pro Support & Escalations Modal */}
      <ProSupportModal
        isOpen={showSupportModal}
        onClose={() => setShowSupportModal(false)}
      />

      {/* Professional Profile & Trade Specialty Modal */}
      <ProProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        onProfileUpdated={loadData}
      />
    </div>
  );
}
