"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createBrowserSupabaseClient,
  fetchAllBookingsAdmin,
  fetchAllProfessionalsAdmin,
  fetchAllReviewsAdmin,
  fetchBookingDetails,
  getCurrentUser,
  getUnreadSupportCount,
  getActiveSosCountAdmin,
  type Tables,
} from "@repo/db";
import { approveProfessionalKyc } from "./actions";
import { ProofOfWorkAuditModal } from "../components/ProofOfWorkAuditModal";
import { BookingDetailModal } from "../components/BookingDetailModal";
import { CatalogManager } from "../components/CatalogManager";
import { DirectoriesView } from "../components/DirectoriesView";
import { SupportHub } from "../components/SupportHub";
import {
  Activity,
  ShieldCheck,
  Users,
  DollarSign,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  LogIn,
  LogOut,
  Loader2,
  FileCheck,
  Briefcase,
  TrendingUp,
  Star,
  Camera,
  AlertTriangle,
  MessageSquare,
  ShieldAlert,
  Wallet,
  Megaphone,
  Eye,
} from "lucide-react";

export default function AdminPortal() {
  const router = useRouter();
  const supabase = createBrowserSupabaseClient("admin");

  const [user, setUser] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [professionals, setProfessionals] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [auditBooking, setAuditBooking] = useState<any | null>(null);
  const [detailBooking, setDetailBooking] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    "bookings" | "kyc" | "reviews" | "catalog" | "directories" | "support"
  >("bookings");
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // Realtime badge counts
  const [unreadSupportCount, setUnreadSupportCount] = useState<number>(0);
  const [activeSosCount, setActiveSosCount] = useState<number>(0);
  const [refreshing, setRefreshing] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);

      const [allBookings, allPros, allReviews, supportCount, sosCount] = await Promise.all([
        fetchAllBookingsAdmin(),
        fetchAllProfessionalsAdmin(),
        fetchAllReviewsAdmin(supabase),
        getUnreadSupportCount(currentUser?.id, "admin", supabase),
        getActiveSosCountAdmin(supabase),
      ]);

      setBookings(allBookings);
      setProfessionals(allPros);
      setReviews(allReviews);
      setUnreadSupportCount(supportCount);
      setActiveSosCount(sosCount);
    } catch (err) {
      console.error("Error loading admin data:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let isMounted = true;
    loadData();

    // Subscribe to changes on bookings, professionals, and reviews
    const adminChannel = supabase
      .channel("public:admin_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => {
        loadData();
      })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings" },
        (payload: any) => {
          if (!isMounted) return;
          if (payload.eventType === "INSERT" && payload.new) {
            setBookings((prev) => [payload.new, ...prev.filter((b) => b.id !== payload.new.id)]);
            fetchBookingDetails(payload.new.id, supabase).then((full) => {
              if (full && isMounted) {
                setBookings((prev) => prev.map((b) => (b.id === full.id ? full : b)));
              }
            });
          } else if (payload.eventType === "UPDATE" && payload.new) {
            setBookings((prev) =>
              prev.map((b) => (b.id === payload.new.id ? { ...b, ...payload.new } : b))
            );
            if (payload.new.professional_id || payload.new.status) {
              fetchBookingDetails(payload.new.id, supabase).then((full) => {
                if (full && isMounted) {
                  setBookings((prev) => prev.map((b) => (b.id === full.id ? full : b)));
                }
              });
            }
          } else if (payload.eventType === "DELETE" && payload.old) {
            setBookings((prev) => prev.filter((b) => b.id !== payload.old.id));
          }
        }
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "professionals" }, () => {
        loadData();
        if (isMounted) fetchAllProfessionalsAdmin().then(setProfessionals);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "reviews" }, () => {
        loadData();
        if (isMounted) fetchAllReviewsAdmin(supabase).then(setReviews);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "sos_alerts" }, () => {
        getActiveSosCountAdmin(supabase).then(setActiveSosCount);
        if (isMounted) getActiveSosCountAdmin(supabase).then(setActiveSosCount);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "ticket_replies" }, () => {
        getUnreadSupportCount(undefined, "admin", supabase).then(setUnreadSupportCount);
        if (isMounted) getUnreadSupportCount(undefined, "admin", supabase).then(setUnreadSupportCount);
      })
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(adminChannel);
    };
  }, []);

  async function handleApproveKyc(proId: string) {
    setActionLoading(proId);
    setFeedbackMessage(null);

    try {
      // Calls the Server Action using createAdminClient + SUPABASE_SERVICE_ROLE_KEY
      await approveProfessionalKyc(proId);
      setFeedbackMessage(`KYC approved successfully for professional ID ${proId.slice(0, 8)}`);
      await loadData();
    } catch (err: unknown) {
      setFeedbackMessage(
        err instanceof Error ? `KYC Approval failed: ${err.message}` : "Failed to approve KYC"
      );
    } finally {
      setActionLoading(null);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setUser(null);
    setBookings([]);
    setProfessionals([]);
    setReviews([]);
  }

  // Calculated Real Database Metrics
  const totalVolume = bookings.reduce((sum, b) => sum + Number(b.price || 0), 0);
  const pendingJobs = bookings.filter((b) => b.status === "pending").length;
  const activeJobs = bookings.filter((b) =>
    ["accepted", "en_route", "arrived", "in_progress"].includes(b.status)
  ).length;
  const completedJobs = bookings.filter((b) => b.status === "completed").length;
  const disputeCount = reviews.filter((r) => r.rating <= 2).length;
  const avgRating =
    reviews.length > 0
      ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)
      : "5.0";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Top Header */}
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-500/20 font-bold text-lg">
              HQ
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-white">HomeServe Ops</h1>
                <span className="rounded-md bg-indigo-950 border border-indigo-800 px-2 py-0.5 text-[10px] font-semibold text-indigo-400">
                  Command Center
                </span>
              </div>
              <p className="text-xs text-slate-400">Live Dispatch & Service Role KYC Control</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/campaigns"
              className="flex items-center gap-1.5 rounded-lg border border-indigo-700/60 bg-indigo-950/60 px-3 py-1.5 text-xs font-bold text-indigo-300 shadow-sm hover:bg-indigo-900/80 transition"
              title="Broadcast Campaigns"
            >
              <Megaphone className="h-3.5 w-3.5 text-indigo-400" />
              <span className="hidden sm:inline">Broadcasts</span>
            </Link>

            <button
              type="button"
              onClick={() => {
                setRefreshing(true);
                router.refresh();
                loadData().finally(() => setRefreshing(false));
              }}
              disabled={refreshing}
              className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white transition"
              title="Soft Refresh Admin Portal"
            >
              <RefreshCw
                className={`h-4 w-4 text-slate-400 hover:text-white transition-transform ${
                  refreshing ? "animate-spin text-indigo-400" : ""
                }`}
              />
            </button>

            {user ? (
              <div className="flex items-center gap-2">
                <div className="hidden sm:block text-right">
                  <p className="text-xs font-bold text-slate-200">
                    {user.user_metadata?.full_name || user.email?.split("@")[0]}
                  </p>
                  <p className="text-[10px] text-indigo-400 font-semibold">Role: Super Admin</p>
                </div>
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
                className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-500 transition"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>Admin Login</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 space-y-8">
        {!user && (
          <div className="flex items-center justify-between rounded-2xl border border-indigo-900/60 bg-indigo-950/30 p-4 text-xs text-indigo-300">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-indigo-400 shrink-0" />
              <div>
                <strong className="font-semibold">Admin authorization recommended.</strong>
                <p className="text-slate-400 mt-0.5">
                  Sign in or initialize your super_admin account to oversee live customer bookings and KYC approvals.
                </p>
              </div>
            </div>
            <Link
              href="/login"
              className="rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-indigo-500 transition shrink-0"
            >
              Sign In / Setup
            </Link>
          </div>
        )}

        {feedbackMessage && (
          <div className="rounded-xl border border-indigo-800 bg-indigo-950/60 p-3.5 text-xs text-indigo-300 font-medium">
            {feedbackMessage}
          </div>
        )}

        {/* Live Metrics Computed from Database */}
        <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Total Bookings Volume</span>
              <DollarSign className="h-4 w-4 text-emerald-400" />
            </div>
            <p className="mt-2 text-2xl font-black text-white">₹{totalVolume.toFixed(2)}</p>
            <p className="mt-1 text-[11px] text-slate-400">{bookings.length} total platform orders</p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Pending Broadcasts</span>
              <Clock className="h-4 w-4 text-amber-400" />
            </div>
            <p className="mt-2 text-2xl font-black text-amber-400">{pendingJobs}</p>
            <p className="mt-1 text-[11px] text-slate-400">Awaiting provider acceptance</p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Active Field Dispatches</span>
              <Activity className="h-4 w-4 text-blue-400" />
            </div>
            <p className="mt-2 text-2xl font-black text-blue-400">{activeJobs}</p>
            <p className="mt-1 text-[11px] text-slate-400">In-transit or performing service</p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Registered Providers</span>
              <Users className="h-4 w-4 text-indigo-400" />
            </div>
            <p className="mt-2 text-2xl font-black text-white">{professionals.length}</p>
            <p className="mt-1 text-[11px] text-slate-400">
              {professionals.filter((p) => p.status === "approved").length} approved •{" "}
              {professionals.filter((p) => p.status === "pending").length} pending KYC
            </p>
          </div>
        </section>

        {/* Tab Controls */}
        <div className="flex border-b border-slate-800 overflow-x-auto">
          <button
            onClick={() => setActiveTab("bookings")}
            className={`flex items-center gap-2 border-b-2 px-5 py-3 text-xs font-bold transition shrink-0 ${
              activeTab === "bookings"
                ? "border-indigo-500 text-white"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>Live Bookings & Dispatch ({bookings.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("kyc")}
            className={`flex items-center gap-2 border-b-2 px-5 py-3 text-xs font-bold transition shrink-0 ${
              activeTab === "kyc"
                ? "border-indigo-500 text-white"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>KYC Review Pipeline ({professionals.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("reviews")}
            className={`flex items-center gap-2 border-b-2 px-5 py-3 text-xs font-bold transition shrink-0 ${
              activeTab === "reviews"
                ? "border-indigo-500 text-white"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>Centralized Reviews ({reviews.length})</span>
            {disputeCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-600 text-white animate-pulse">
                {disputeCount} Dispute{disputeCount > 1 ? "s" : ""}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("catalog")}
            className={`flex items-center gap-2 border-b-2 px-5 py-3 text-xs font-bold transition shrink-0 ${
              activeTab === "catalog"
                ? "border-indigo-500 text-white"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>Catalog & City Pricing</span>
          </button>
          <button
            onClick={() => setActiveTab("directories")}
            className={`flex items-center gap-2 border-b-2 px-5 py-3 text-xs font-bold transition shrink-0 ${
              activeTab === "directories"
                ? "border-indigo-500 text-white"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>Directories</span>
          </button>
          <button
            onClick={() => setActiveTab("support")}
            className={`flex items-center gap-2 border-b-2 px-5 py-3 text-xs font-bold transition shrink-0 ${
              activeTab === "support"
                ? "border-indigo-500 text-white"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>Support Hub</span>
            {unreadSupportCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-600 text-white shadow-sm animate-pulse">
                {unreadSupportCount > 99 ? "99+" : unreadSupportCount}
              </span>
            )}
          </button>

          <Link
            href="/finance"
            className="flex items-center gap-1.5 border-b-2 border-transparent px-5 py-3 text-xs font-bold text-slate-400 hover:text-indigo-400 transition shrink-0"
          >
            <DollarSign className="h-3.5 w-3.5 text-emerald-400" />
            <span>Financials & Ledger</span>
          </Link>

          <Link
            href="/sos"
            className="flex items-center gap-1.5 border-b-2 border-transparent px-5 py-3 text-xs font-bold text-rose-400 hover:text-rose-300 transition shrink-0"
          >
            <ShieldAlert className="h-3.5 w-3.5 text-rose-500" />
            <span>Emergency SOS Hub</span>
            {activeSosCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-600 text-white shadow-sm animate-pulse">
                {activeSosCount} Active
              </span>
            )}
          </Link>

          <Link
            href="/campaigns"
            className="flex items-center gap-1.5 border-b-2 border-transparent px-5 py-3 text-xs font-bold text-indigo-400 hover:text-indigo-300 transition shrink-0"
          >
            <Megaphone className="h-3.5 w-3.5 text-indigo-400" />
            <span>Campaigns & Broadcasts</span>
          </Link>
        </div>

        {/* Tab 1: Live Bookings Dispatch Snapshot */}
        {activeTab === "bookings" && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-white">Live Platform Bookings</h3>
                <p className="text-xs text-slate-400">
                  Real-time snapshot: which customer booked, assigned professional, status, and proof-of-work
                </p>
              </div>
              <button
                onClick={loadData}
                className="flex items-center gap-1.5 text-xs text-indigo-400 hover:underline font-semibold"
              >
                <RefreshCw className="h-3 w-3" />
                <span>Refresh Table</span>
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center p-12 text-xs text-slate-400">
                <Loader2 className="h-5 w-5 animate-spin mr-2 text-indigo-400" />
                Loading bookings from database...
              </div>
            ) : bookings.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-800 p-12 text-center text-xs text-slate-400">
                <p className="font-semibold text-slate-300">No bookings recorded yet</p>
                <p className="mt-1 text-slate-500">
                  Open the Customer Portal (port 3000) to place a booking. It will appear here immediately!
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="pb-3 font-semibold">Order ID</th>
                      <th className="pb-3 font-semibold">Service Type</th>
                      <th className="pb-3 font-semibold">Customer</th>
                      <th className="pb-3 font-semibold">Assigned Professional</th>
                      <th className="pb-3 font-semibold">Price</th>
                      <th className="pb-3 font-semibold">Status</th>
                      <th className="pb-3 font-semibold">Proof Photos</th>
                      <th className="pb-3 font-semibold">Time</th>
                      <th className="pb-3 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {bookings.map((booking) => (
                      <tr key={booking.id} className="hover:bg-slate-800/30 transition">
                        <td className="py-4">
                          <span className="font-mono text-indigo-400 font-bold bg-indigo-950/80 border border-indigo-800/80 px-2 py-0.5 rounded text-[11px]">
                            #{booking.id.slice(0, 8)}
                          </span>
                        </td>
                        <td className="py-4 font-bold text-white">{booking.service_type}</td>
                        <td className="py-4">
                          <div className="font-semibold text-slate-200">
                            {booking.customer?.full_name || "Customer"}
                          </div>
                          <div className="text-[10px] text-slate-500">{booking.customer?.email}</div>
                        </td>
                        <td className="py-4">
                          {booking.professional ? (
                            <div>
                              <div className="font-semibold text-emerald-400">
                                {booking.professional?.profile?.full_name || "Provider"}
                              </div>
                              <div className="text-[10px] text-slate-500">{booking.professional?.trade}</div>
                            </div>
                          ) : (
                            <span className="text-slate-500 italic">Unassigned (Broadcast)</span>
                          )}
                        </td>
                        <td className="py-4 font-bold text-slate-200 font-mono">
                          ₹{Number(booking.price).toFixed(2)}
                        </td>
                        <td className="py-4">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold capitalize ${
                              booking.status === "completed"
                                ? "bg-emerald-950 border border-emerald-800 text-emerald-300"
                                : booking.status === "pending"
                                ? "bg-amber-950 border border-amber-800 text-amber-300"
                                : booking.status === "arrived"
                                ? "bg-indigo-950 border border-indigo-800 text-indigo-300"
                                : "bg-blue-950 border border-blue-800 text-blue-300"
                            }`}
                          >
                            {booking.status.replace("_", " ")}
                          </span>
                        </td>
                        <td className="py-4">
                          {booking.proof_photos &&
                          (booking.proof_photos.before || booking.proof_photos.after) ? (
                            <button
                              onClick={() => setAuditBooking(booking)}
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-950/80 border border-emerald-800/80 px-2.5 py-1 text-[11px] font-semibold text-emerald-400 hover:bg-emerald-900/60 transition shadow-sm"
                            >
                              <Camera className="h-3 w-3" />
                              <span>Audit Proof</span>
                            </button>
                          ) : booking.status === "completed" ? (
                            <button
                              onClick={() => setAuditBooking(booking)}
                              className="inline-flex items-center gap-1 rounded-lg bg-slate-800 border border-slate-700 px-2.5 py-1 text-[11px] font-semibold text-slate-400 hover:text-slate-200 transition"
                            >
                              <Camera className="h-3 w-3" />
                              <span>Inspect</span>
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-600 font-mono italic">
                              Pending Job
                            </span>
                          )}
                        </td>
                        <td className="py-4 text-[11px] text-slate-400">
                          {new Date(booking.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="py-4 text-right">
                          <button
                            type="button"
                            onClick={() => setDetailBooking(booking)}
                            className="inline-flex items-center gap-1 rounded-lg bg-indigo-600/20 border border-indigo-500/30 px-2.5 py-1 text-[11px] font-semibold text-indigo-300 hover:bg-indigo-600/30 transition shadow-sm"
                          >
                            <Eye className="h-3 w-3" />
                            <span>View Details</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: KYC Review Pipeline */}
        {activeTab === "kyc" && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-white">Provider Verification & Compliance Pipeline</h3>
                <p className="text-xs text-slate-400">
                  Server action powered with service role key: approve credentials and grant dispatch access
                </p>
              </div>
              <span className="text-xs text-slate-400">{professionals.length} providers registered</span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center p-12 text-xs text-slate-400">
                <Loader2 className="h-5 w-5 animate-spin mr-2 text-indigo-400" />
                Loading professionals...
              </div>
            ) : professionals.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-800 p-12 text-center text-xs text-slate-400">
                <p className="font-semibold text-slate-300">No professionals registered yet</p>
                <p className="mt-1 text-slate-500">
                  Register a provider account on port 3001 to test the KYC approval server action!
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="pb-3 font-semibold">Provider</th>
                      <th className="pb-3 font-semibold">Trade Specialty</th>
                      <th className="pb-3 font-semibold">License #</th>
                      <th className="pb-3 font-semibold">KYC Status</th>
                      <th className="pb-3 font-semibold">Registered</th>
                      <th className="pb-3 text-right font-semibold">KYC Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {professionals.map((pro) => (
                      <tr key={pro.id} className="hover:bg-slate-800/30">
                        <td className="py-4">
                          <div className="font-bold text-white">{pro.profile?.full_name || "Provider"}</div>
                          <div className="text-[10px] text-slate-500">{pro.profile?.email}</div>
                        </td>
                        <td className="py-4 text-slate-300">{pro.trade}</td>
                        <td className="py-4 font-mono text-indigo-400">{pro.license_number || "N/A"}</td>
                        <td className="py-4">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold capitalize ${
                              pro.status === "approved"
                                ? "bg-emerald-950 border border-emerald-800 text-emerald-300"
                                : pro.status === "rejected"
                                ? "bg-rose-950 border border-rose-800 text-rose-300"
                                : "bg-amber-950 border border-amber-800 text-amber-300"
                            }`}
                          >
                            {pro.status}
                          </span>
                        </td>
                        <td className="py-4 text-slate-400 text-[11px]">
                          {new Date(pro.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-4 text-right">
                          {pro.status !== "approved" ? (
                            <button
                              onClick={() => handleApproveKyc(pro.id)}
                              disabled={actionLoading === pro.id}
                              className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-bold text-white hover:bg-emerald-500 transition shadow-sm disabled:opacity-50"
                            >
                              {actionLoading === pro.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                "Approve KYC (Bypass RLS)"
                              )}
                            </button>
                          ) : (
                            <span className="text-emerald-400 font-semibold flex items-center justify-end gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Verified
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Centralized Reviews & Dispute Highlighting */}
        {activeTab === "reviews" && (
          <div className="space-y-6">
            {/* Reviews Header Banner & Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Total Customer & Pro Reviews</span>
                  <MessageSquare className="h-4 w-4 text-indigo-400" />
                </div>
                <p className="mt-2 text-2xl font-black text-white">{reviews.length}</p>
                <p className="mt-1 text-[11px] text-slate-400">Two-way verified submissions</p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Platform Quality Score</span>
                  <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
                </div>
                <p className="mt-2 text-2xl font-black text-amber-400">{avgRating} / 5.0</p>
                <p className="mt-1 text-[11px] text-slate-400">Average cross-role satisfaction</p>
              </div>

              <div
                className={`rounded-2xl border p-5 ${
                  disputeCount > 0
                    ? "border-rose-800/80 bg-rose-950/30 text-rose-200"
                    : "border-slate-800 bg-slate-900"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Dispute Risk Alerts (≤ 2 Stars)</span>
                  <AlertTriangle
                    className={`h-4 w-4 ${
                      disputeCount > 0 ? "text-rose-400 animate-bounce" : "text-slate-600"
                    }`}
                  />
                </div>
                <p
                  className={`mt-2 text-2xl font-black ${
                    disputeCount > 0 ? "text-rose-400" : "text-slate-200"
                  }`}
                >
                  {disputeCount}
                </p>
                <p className="mt-1 text-[11px] text-slate-400">
                  {disputeCount > 0
                    ? "Immediate QA review recommended"
                    : "Zero dispute risks detected"}
                </p>
              </div>
            </div>

            {/* Reviews Ledger Table */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-base font-bold text-white">Centralized Quality & Reviews Ledger</h3>
                  <p className="text-xs text-slate-400">
                    Two-way ratings ledger. Ratings ≤ 2 stars automatically trigger red dispute highlights.
                  </p>
                </div>
                <button
                  onClick={loadData}
                  className="flex items-center gap-1.5 text-xs text-indigo-400 hover:underline font-semibold"
                >
                  <RefreshCw className="h-3 w-3" />
                  <span>Refresh Reviews</span>
                </button>
              </div>

              {loading ? (
                <div className="flex items-center justify-center p-12 text-xs text-slate-400">
                  <Loader2 className="h-5 w-5 animate-spin mr-2 text-indigo-400" />
                  Loading feedback ledger from database...
                </div>
              ) : reviews.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-800 p-12 text-center text-xs text-slate-400">
                  <p className="font-semibold text-slate-300">No reviews recorded yet</p>
                  <p className="mt-1 text-slate-500">
                    Complete jobs in the User or Professional portal to submit ratings.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400">
                        <th className="pb-3 font-semibold">Order ID</th>
                        <th className="pb-3 font-semibold">Review By</th>
                        <th className="pb-3 font-semibold">User ID</th>
                        <th className="pb-3 font-semibold">Reviewer</th>
                        <th className="pb-3 font-semibold">Target / Recipient</th>
                        <th className="pb-3 font-semibold">Score</th>
                        <th className="pb-3 font-semibold">Dispute Status</th>
                        <th className="pb-3 font-semibold">Feedback & Tags</th>
                        <th className="pb-3 font-semibold">Work Order</th>
                        <th className="pb-3 text-right font-semibold">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {reviews.map((rev) => {
                        const isDispute = rev.rating <= 2;
                        const reviewerRole = rev.reviewer?.role || "customer";
                        const orderId = rev.booking_id || rev.booking?.id || "N/A";
                        const reviewerUserId = rev.reviewer_id || rev.reviewer?.id || "N/A";

                        return (
                          <tr
                            key={rev.id}
                            className={`transition-colors ${
                              isDispute
                                ? "bg-rose-950/30 hover:bg-rose-950/40"
                                : "hover:bg-slate-800/30"
                            }`}
                          >
                            <td className="py-4">
                              <span className="font-mono text-indigo-400 font-bold bg-indigo-950/80 border border-indigo-800/80 px-2 py-0.5 rounded text-[11px]">
                                #{orderId.slice(0, 8)}
                              </span>
                            </td>
                            <td className="py-4">
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase border ${
                                  reviewerRole === "professional"
                                    ? "bg-emerald-950 border-emerald-800 text-emerald-300"
                                    : "bg-blue-950 border-blue-800 text-blue-300"
                                }`}
                              >
                                {reviewerRole === "professional" ? "Professional" : "Customer"}
                              </span>
                            </td>
                            <td className="py-4">
                              <span className="font-mono text-[10px] text-slate-400 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                                #{reviewerUserId.slice(0, 8)}
                              </span>
                            </td>
                            <td className="py-4">
                              <div className="font-bold text-white">
                                {rev.reviewer?.full_name || "Verified Member"}
                              </div>
                              <div className="text-[10px] text-slate-500">{rev.reviewer?.email}</div>
                            </td>
                            <td className="py-4">
                              <div className="font-bold text-slate-200">
                                {rev.target?.full_name || "Member"}
                              </div>
                              <div className="text-[10px] text-slate-500">{rev.target?.email}</div>
                            </td>
                            <td className="py-4">
                              <div className="flex items-center gap-1">
                                <div className="flex">
                                  {[1, 2, 3, 4, 5].map((s) => (
                                    <Star
                                      key={s}
                                      className={`h-3.5 w-3.5 ${
                                        rev.rating >= s
                                          ? isDispute
                                            ? "text-rose-400 fill-rose-400"
                                            : "text-amber-400 fill-amber-400"
                                          : "text-slate-700"
                                      }`}
                                    />
                                  ))}
                                </div>
                                <span
                                  className={`font-bold ml-1 ${
                                    isDispute ? "text-rose-400" : "text-amber-400"
                                  }`}
                                >
                                  {rev.rating}.0
                                </span>
                              </div>
                            </td>
                            <td className="py-4">
                              {isDispute ? (
                                <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold bg-rose-950 border border-rose-800 text-rose-300">
                                  <AlertTriangle className="h-3 w-3 text-rose-400" />
                                  <span>🚨 Dispute Risk</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold bg-emerald-950 border border-emerald-800 text-emerald-300">
                                  <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                                  <span>Satisfied</span>
                                </span>
                              )}
                            </td>
                            <td className="py-4 max-w-xs">
                              {rev.comment ? (
                                <p className="text-slate-300 truncate" title={rev.comment}>
                                  "{rev.comment}"
                                </p>
                              ) : (
                                <span className="text-slate-600 italic">No written comment</span>
                              )}
                            </td>
                            <td className="py-4">
                              {rev.booking ? (
                                <div className="space-y-1">
                                  <span className="font-semibold text-slate-300 block">
                                    {rev.booking.service_type}
                                  </span>
                                  {rev.booking.proof_photos &&
                                    (rev.booking.proof_photos.before ||
                                      rev.booking.proof_photos.after) && (
                                      <button
                                        onClick={() => setAuditBooking(rev.booking)}
                                        className="text-[10px] text-emerald-400 hover:underline flex items-center gap-0.5"
                                      >
                                        <Camera className="h-2.5 w-2.5" />
                                        <span>Audit Proof</span>
                                      </button>
                                    )}
                                </div>
                              ) : (
                                <span className="text-slate-500 font-mono text-[10px]">
                                  #{orderId.slice(0, 8)}
                                </span>
                              )}
                            </td>
                            <td className="py-4 text-right text-[11px] text-slate-400">
                              {new Date(rev.created_at).toLocaleDateString()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 4: Service & City Catalog Manager */}
        {activeTab === "catalog" && <CatalogManager />}

        {/* Tab 5: User & Professional Directories */}
        {activeTab === "directories" && <DirectoriesView />}

        {/* Tab 6: Centralized Support Hub */}
        {activeTab === "support" && <SupportHub />}
      </main>

      {/* Proof of Work Side-by-Side Audit Modal */}
      <ProofOfWorkAuditModal
        isOpen={Boolean(auditBooking)}
        booking={auditBooking}
        onClose={() => setAuditBooking(null)}
      />

      {/* Booking Drill-Down Details Modal */}
      <BookingDetailModal
        isOpen={Boolean(detailBooking)}
        booking={detailBooking}
        onClose={() => setDetailBooking(null)}
        onAuditProof={(b) => {
          setDetailBooking(null);
          setAuditBooking(b);
        }}
      />
    </div>
  );
}

