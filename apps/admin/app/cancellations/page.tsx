"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchCancelledBookings } from "@repo/db";
import { ArrowLeft, RefreshCw, Loader2, AlertCircle, DollarSign, ListX } from "lucide-react";
import ChatTranscriptModal from "../../components/ChatTranscriptModal";
import { getAdminUserRoleAction } from "../actions";

export default function CancellationsDashboard() {
  const [cancellations, setCancellations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [transcriptBookingId, setTranscriptBookingId] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    try {
      const roleRes = await getAdminUserRoleAction();
      if (roleRes.role !== "super_admin") {
        setAccessDenied(true);
        setLoading(false);
        return;
      }
      const data = await fetchCancelledBookings();
      setCancellations(data || []);
    } catch (err) {
      console.error("Error loading cancellations:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const totalCancellations = cancellations.length;
  const totalFees = cancellations.reduce((acc, c) => acc + Number(c.cancellation_fee || 0), 0);
  const avgFee = totalCancellations > 0 ? (totalFees / totalCancellations).toFixed(2) : "0.00";
  
  const reasonsCount: Record<string, number> = {};
  cancellations.forEach(c => {
    const reason = c.cancellation_reason || "Unknown";
    reasonsCount[reason] = (reasonsCount[reason] || 0) + 1;
  });
  const topReasons: [string, number][] = Object.entries(reasonsCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  if (accessDenied) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center space-y-4 shadow-2xl">
          <AlertCircle className="h-12 w-12 text-rose-500 mx-auto" />
          <h2 className="text-xl font-bold text-white">Access Denied</h2>
          <p className="text-xs text-slate-400">
            This module contains cancellation logs and penalty fee records reserved strictly for <strong>Super Admins</strong>. Staff members do not have clearance.
          </p>
          <div className="pt-2">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-indigo-500 transition shadow-lg shadow-indigo-900"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Return to Dashboard</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <Link
            href="/"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-800 text-xs font-semibold text-slate-300 hover:text-white transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Dashboard</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-rose-950 border border-rose-800 px-2.5 py-0.5 text-[10px] font-bold text-rose-300 uppercase tracking-wider flex items-center gap-1">
              Cancellations Hub
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl w-full flex-1 px-4 py-8 sm:px-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <h1 className="text-xl font-black text-white flex items-center gap-2">
              <ListX className="h-6 w-6 text-rose-500" />
              Cancellations & Modifications
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Overview of all cancelled orders, associated fees, and chat transcripts.
            </p>
          </div>
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-200 transition shrink-0"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-indigo-400 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Total Cancellations</span>
              <AlertCircle className="h-4 w-4 text-rose-400" />
            </div>
            <p className="mt-2 text-2xl font-black text-white">{totalCancellations}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Average Fee</span>
              <DollarSign className="h-4 w-4 text-emerald-400" />
            </div>
            <p className="mt-2 text-2xl font-black text-emerald-400">₹{avgFee}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Top Reasons</span>
              <ListX className="h-4 w-4 text-amber-400" />
            </div>
            <div className="mt-2 space-y-1">
              {topReasons.length > 0 ? topReasons.map(([reason, count]) => (
                <div key={reason} className="text-xs text-slate-300 flex justify-between">
                  <span className="truncate pr-2">{reason}</span>
                  <span className="font-bold">{count}</span>
                </div>
              )) : (
                <div className="text-xs text-slate-500">No data</div>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <h2 className="text-base font-bold text-white">Cancelled Orders Ledger</h2>
          </div>

          {loading ? (
            <div className="flex items-center justify-center p-16 text-xs text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin mr-2.5 text-indigo-400" />
              Loading cancellations...
            </div>
          ) : cancellations.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-800 p-12 text-center text-xs text-slate-400">
              <p className="font-semibold text-slate-300">No cancelled bookings found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="pb-3 font-semibold">Booking ID</th>
                    <th className="pb-3 font-semibold">Service</th>
                    <th className="pb-3 font-semibold">Customer</th>
                    <th className="pb-3 font-semibold">Professional</th>
                    <th className="pb-3 font-semibold">Reason</th>
                    <th className="pb-3 font-semibold">Fee</th>
                    <th className="pb-3 font-semibold">Date</th>
                    <th className="pb-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {cancellations.map((booking) => (
                    <tr key={booking.id} className="hover:bg-slate-800/20 transition">
                      <td className="py-4 font-mono text-indigo-400 font-bold">#{booking.id.slice(0, 8)}</td>
                      <td className="py-4 font-bold text-white">{booking.service_type}</td>
                      <td className="py-4 text-slate-300">{booking.customer?.full_name || "N/A"}</td>
                      <td className="py-4 text-slate-300">{booking.professional?.profile?.full_name || "Unassigned"}</td>
                      <td className="py-4 text-rose-300 max-w-[150px] truncate" title={booking.cancellation_reason}>
                        {booking.cancellation_reason || "None"}
                      </td>
                      <td className="py-4 font-mono text-emerald-400">
                        ₹{Number(booking.cancellation_fee || 0).toFixed(2)}
                      </td>
                      <td className="py-4 text-slate-400 text-[11px]">
                        {new Date(booking.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-4 text-right">
                        <button
                          onClick={() => setTranscriptBookingId(booking.id)}
                          className="px-3 py-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 text-[10px] font-bold transition"
                        >
                          View Chat
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      <ChatTranscriptModal
        bookingId={transcriptBookingId || ""}
        isOpen={!!transcriptBookingId}
        onClose={() => setTranscriptBookingId(null)}
      />
    </div>
  );
}
