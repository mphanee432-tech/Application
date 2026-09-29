"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createBrowserSupabaseClient,
  getCurrentUser,
  fetchSlaEscalatedBookings,
  fetchAllProfessionalsAdmin,
  forceAssignBookingAdmin,
  type Tables,
} from "@repo/db";
import {
  AlertTriangle,
  Clock,
  ShieldAlert,
  Users,
  CheckCircle2,
  RefreshCw,
  ArrowLeft,
  Navigation,
  Loader2,
  DollarSign,
  Phone,
  Zap,
  Building2,
  Send,
} from "lucide-react";

export default function SlaEscalationDashboard() {
  const router = useRouter();
  const supabase = createBrowserSupabaseClient("admin");

  const [loading, setLoading] = useState(true);
  const [escalatedBookings, setEscalatedBookings] = useState<any[]>([]);
  const [professionals, setProfessionals] = useState<any[]>([]);
  const [selectedProForBooking, setSelectedProForBooking] = useState<{ [bookingId: string]: string }>({});
  const [assigningBookingId, setAssigningBookingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function loadData() {
    setLoading(true);
    try {
      const [bookings, pros] = await Promise.all([
        fetchSlaEscalatedBookings(10, supabase),
        fetchAllProfessionalsAdmin(supabase),
      ]);

      setEscalatedBookings(bookings);
      const approvedPros = pros.filter((p: any) => p.status === "approved" || p.kyc_status === "approved");
      approvedPros.sort((a: any, b: any) => (b.is_online ? 1 : 0) - (a.is_online ? 1 : 0));
      setProfessionals(approvedPros);
    } catch (err: any) {
      console.error("Error loading escalation queue:", err);
      setFeedback({ type: "error", text: err.message || "Failed to load SLA queue." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();

    // Subscribe to bookings changes
    const channel = supabase
      .channel("public:sla_escalation_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => {
        loadData();
      })
      .subscribe();

    // Polling interval every 30 seconds to recalculate minutes elapsed
    const timer = setInterval(() => {
      loadData();
    }, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(timer);
    };
  }, []);

  const handleForceAssign = async (bookingId: string) => {
    const proId = selectedProForBooking[bookingId];
    if (!proId) {
      setFeedback({ type: "error", text: "Please select an approved professional to force-assign." });
      return;
    }

    setAssigningBookingId(bookingId);
    setFeedback(null);

    try {
      await forceAssignBookingAdmin(bookingId, proId, supabase);
      setFeedback({
        type: "success",
        text: `Booking successfully force-assigned! Dispatch status updated to 'assigned'.`,
      });
      await loadData();
    } catch (err: any) {
      console.error("Error force-assigning booking:", err);
      setFeedback({ type: "error", text: err.message || "Failed to force-assign provider." });
    } finally {
      setAssigningBookingId(null);
    }
  };

  const breachedCount = escalatedBookings.filter((b) => b.isBreached).length;
  const searchingCount = escalatedBookings.length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Header */}
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-800 text-xs font-semibold text-slate-300 hover:text-white transition"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Admin Portal</span>
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-md bg-rose-950 border border-rose-800 px-2.5 py-0.5 text-[10px] font-bold text-rose-300 uppercase tracking-wider flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-ping" />
              SLA Emergency Dispatch
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto max-w-7xl w-full flex-1 px-4 py-8 sm:px-6 space-y-6">
        {/* Title & Refresh */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <h1 className="text-xl font-black text-white flex items-center gap-2">
              <ShieldAlert className="h-6 w-6 text-rose-500" />
              Intelligent Auto-Dispatch & SLA Escalation Queue
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Real-time monitoring of unassigned customer dispatches. Bookings exceeding the 10-minute SLA threshold trigger urgent supervisor override controls.
            </p>
          </div>

          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-200 transition shrink-0"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-indigo-400 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh Queue</span>
          </button>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`p-4 rounded-xl border flex items-center justify-between text-xs font-semibold shadow-lg ${
              feedback.type === "success"
                ? "bg-emerald-950/80 border-emerald-500 text-emerald-200"
                : "bg-rose-950/80 border-rose-500 text-rose-200"
            }`}
          >
            <span>{feedback.text}</span>
            <button
              onClick={() => setFeedback(null)}
              className="text-xs opacity-70 hover:opacity-100 px-2 py-0.5"
            >
              ✕
            </button>
          </div>
        )}

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Searching Dispatches</span>
              <Navigation className="h-4 w-4 text-blue-400" />
            </div>
            <p className="mt-2 text-2xl font-black text-white">{searchingCount}</p>
            <p className="mt-1 text-[11px] text-slate-500">Awaiting provider pickup</p>
          </div>

          <div className="rounded-2xl border border-rose-900/50 bg-rose-950/20 p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-rose-300 font-semibold">SLA Breached (&gt;10 min)</span>
              <AlertTriangle className="h-4 w-4 text-rose-400 animate-bounce" />
            </div>
            <p className="mt-2 text-2xl font-black text-rose-400">{breachedCount}</p>
            <p className="mt-1 text-[11px] text-rose-300/70">Overdue dispatch threshold</p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Vetted Providers</span>
              <Users className="h-4 w-4 text-emerald-400" />
            </div>
            <p className="mt-2 text-2xl font-black text-emerald-400">{professionals.length}</p>
            <p className="mt-1 text-[11px] text-slate-500">KYC approved & ready to assign</p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Target SLA Response</span>
              <Clock className="h-4 w-4 text-amber-400" />
            </div>
            <p className="mt-2 text-2xl font-black text-amber-400">10 min</p>
            <p className="mt-1 text-[11px] text-slate-500">Maximum unassigned wait</p>
          </div>
        </div>

        {/* Escalation Queue Table */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-base font-bold text-white">Pending Dispatches & Overdue Orders</h2>
              <p className="text-xs text-slate-400">
                Supervisor Override: Force-assign unfulfilled broadcasts to qualified providers.
              </p>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              {escalatedBookings.length} orders in queue
            </span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center p-16 text-xs text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin mr-2.5 text-indigo-400" />
              Scanning dispatch SLA metrics...
            </div>
          ) : escalatedBookings.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-800 p-12 text-center text-xs text-slate-400">
              <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
              <p className="font-semibold text-slate-300">All Dispatches Within Healthy SLA</p>
              <p className="mt-1 text-slate-500">
                No orders have exceeded the 10-minute unassigned threshold.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="pb-3 font-semibold">Order / Service</th>
                    <th className="pb-3 font-semibold">Customer & Location</th>
                    <th className="pb-3 font-semibold">Price</th>
                    <th className="pb-3 font-semibold">Wait Time / SLA Status</th>
                    <th className="pb-3 text-right font-semibold">Supervisor Force-Assign</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {escalatedBookings.map((booking) => {
                    const isOverdue = booking.isBreached;
                    const selectedPro = selectedProForBooking[booking.id] || "";
                    const isAssigning = assigningBookingId === booking.id;

                    return (
                      <tr
                        key={booking.id}
                        className={`transition ${
                          isOverdue ? "bg-rose-950/20 hover:bg-rose-950/30" : "hover:bg-slate-800/20"
                        }`}
                      >
                        {/* Order & Service */}
                        <td className="py-4">
                          <span className="font-mono text-indigo-400 font-bold block">
                            #{booking.id.slice(0, 8)}
                          </span>
                          <span className="font-bold text-white text-xs block mt-0.5">
                            {booking.service_type}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            Created: {new Date(booking.creation_time || booking.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </td>

                        {/* Customer & Location */}
                        <td className="py-4">
                          <div className="font-semibold text-slate-200">
                            {booking.customer?.full_name || "Customer"}
                          </div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <Phone className="h-3 w-3 text-slate-500" />
                            <span>{booking.customer?.phone || booking.customer?.mobile || "No phone"}</span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-1 max-w-xs truncate">
                            {booking.address}
                          </div>
                        </td>

                        {/* Price */}
                        <td className="py-4 font-bold text-slate-200 font-mono">
                          ₹{Number(booking.price).toFixed(2)}
                        </td>

                        {/* Wait Time & SLA Badge */}
                        <td className="py-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <Clock className={`h-3.5 w-3.5 ${isOverdue ? "text-rose-400" : "text-amber-400"}`} />
                              <span className={`font-bold ${isOverdue ? "text-rose-400" : "text-amber-400"}`}>
                                {booking.elapsedMinutes} mins elapsed
                              </span>
                            </div>

                            {isOverdue ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-950 border border-rose-800 text-rose-300 animate-pulse">
                                <AlertTriangle className="h-3 w-3" />
                                SLA Breached (+{booking.minutesOverdue}m overdue)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-950/60 border border-amber-800/60 text-amber-300">
                                In Queue ({10 - booking.elapsedMinutes}m to SLA)
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Force Assign Provider */}
                        <td className="py-4 text-right">
                          <div className="inline-flex items-center gap-2">
                            <select
                              value={selectedPro}
                              onChange={(e) =>
                                setSelectedProForBooking((prev) => ({
                                  ...prev,
                                  [booking.id]: e.target.value,
                                }))
                              }
                              className="px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-950 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
                            >
                              <option value="">Select Technician...</option>
                              {professionals.map((pro) => (
                                <option key={pro.id} value={pro.id}>
                                  {pro.is_online ? "🟢 [Online]" : "⚪ [Offline]"} {pro.full_name || pro.trade} ({pro.trade})
                                </option>
                              ))}
                            </select>

                            <button
                              onClick={() => handleForceAssign(booking.id)}
                              disabled={!selectedPro || isAssigning}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition disabled:opacity-40 shadow-sm"
                            >
                              {isAssigning ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Send className="h-3.5 w-3.5" />
                              )}
                              <span>Force Assign</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
