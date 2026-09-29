"use client";

import React, { useEffect, useState } from "react";
import {
  X,
  Clock,
  Calendar,
  DollarSign,
  Camera,
  ExternalLink,
  Loader2,
  FileText,
  User,
  Briefcase,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { createBrowserSupabaseClient } from "@repo/db";

interface UserBookingHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser: {
    id: string;
    name: string;
    email?: string;
    role: "customer" | "professional";
  } | null;
  onViewBookingDetails?: (booking: any) => void;
  onAuditProof?: (booking: any) => void;
}

export function UserBookingHistoryModal({
  isOpen,
  onClose,
  targetUser,
  onViewBookingDetails,
  onAuditProof,
}: UserBookingHistoryModalProps) {
  const [supabase] = useState(() => createBrowserSupabaseClient("admin"));
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = targetUser;
    if (!isOpen || !user) {
      setBookings([]);
      return;
    }

    let isMounted = true;

    async function fetchHistory() {
      if (!user) return;
      try {
        setLoading(true);
        const query = (supabase as any)
          .from("bookings")
          .select(
            `
            *,
            services(name, base_price, icon),
            customer:profiles!bookings_customer_id_fkey(full_name, email, phone, mobile),
            professional:professionals(id, full_name, trade, rating, profile:profiles(full_name, email, phone))
          `
          );

        if (user.role === "customer") {
          query.eq("customer_id", user.id);
        } else {
          query.eq("professional_id", user.id);
        }

        const { data, error } = await query.order("created_at", { ascending: false });

        if (error) {
          console.error("Failed to fetch user booking history:", error);
          return;
        }

        if (isMounted) {
          setBookings(data || []);
        }
      } catch (err) {
        console.error("User history fetch error:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchHistory();

    return () => {
      isMounted = false;
    };
  }, [isOpen, targetUser, supabase]);

  if (!isOpen || !targetUser) return null;

  const totalSpentOrEarned = bookings.reduce((sum, b) => sum + Number(b.price || 0), 0);
  const completedCount = bookings.filter((b) => b.status === "completed").length;
  const activeCount = bookings.filter((b) =>
    ["accepted", "en_route", "arrived", "in_progress"].includes(b.status)
  ).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl flex flex-col text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 p-6 sticky top-0 bg-slate-900/95 backdrop-blur-md z-10">
          <div className="flex items-center gap-3">
            <div
              className={`h-10 w-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                targetUser.role === "customer"
                  ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                  : "bg-emerald-600/20 text-emerald-400 border border-emerald-500/30"
              }`}
            >
              {targetUser.role === "customer" ? (
                <User className="h-5 w-5" />
              ) : (
                <Briefcase className="h-5 w-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">{targetUser.name}</h3>
                <span
                  className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${
                    targetUser.role === "customer"
                      ? "bg-blue-950 border-blue-800 text-blue-300"
                      : "bg-emerald-950 border-emerald-800 text-emerald-300"
                  }`}
                >
                  {targetUser.role}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                ID: {targetUser.id} {targetUser.email && `• ${targetUser.email}`}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Summary Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-6 pb-2">
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5">
            <span className="text-[11px] text-slate-400 block font-semibold uppercase">
              Total Bookings
            </span>
            <span className="text-xl font-black text-white mt-1 block">{bookings.length}</span>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5">
            <span className="text-[11px] text-slate-400 block font-semibold uppercase">
              Completed
            </span>
            <span className="text-xl font-black text-emerald-400 mt-1 block">{completedCount}</span>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5">
            <span className="text-[11px] text-slate-400 block font-semibold uppercase">
              Active / In-Flight
            </span>
            <span className="text-xl font-black text-blue-400 mt-1 block">{activeCount}</span>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5">
            <span className="text-[11px] text-slate-400 block font-semibold uppercase">
              {targetUser.role === "customer" ? "Gross Spend" : "Gross Order Volume"}
            </span>
            <span className="text-xl font-black text-white mt-1 block font-mono">
              ₹{totalSpentOrEarned.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 pt-4 flex-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center p-16 text-xs text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-400 mb-2" />
              <span>Loading complete booking history...</span>
            </div>
          ) : bookings.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-800 p-12 text-center text-xs text-slate-400">
              <FileText className="h-8 w-8 text-slate-600 mx-auto mb-2" />
              <p className="font-semibold text-slate-300">No booking history recorded</p>
              <p className="mt-1 text-slate-500">
                This {targetUser.role} has not been associated with any orders yet.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="pb-3 font-semibold">Order ID</th>
                    <th className="pb-3 font-semibold">Service</th>
                    <th className="pb-3 font-semibold">
                      {targetUser.role === "customer" ? "Provider" : "Customer"}
                    </th>
                    <th className="pb-3 font-semibold">Price</th>
                    <th className="pb-3 font-semibold">Status</th>
                    <th className="pb-3 font-semibold">Date</th>
                    <th className="pb-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {bookings.map((b) => {
                    const hasProof =
                      b.proof_photos && (b.proof_photos.before || b.proof_photos.after);

                    return (
                      <tr key={b.id} className="hover:bg-slate-800/30 transition">
                        <td className="py-3 font-mono font-bold text-indigo-400">
                          #{b.id.slice(0, 8)}
                        </td>
                        <td className="py-3 font-semibold text-white">
                          {b.services?.name || b.service_type || "Home Service"}
                        </td>
                        <td className="py-3 text-slate-300">
                          {targetUser.role === "customer" ? (
                            b.professional ? (
                              <span className="text-emerald-400 font-medium">
                                {b.professional?.full_name ||
                                  b.professional?.profile?.full_name ||
                                  "Provider"}
                              </span>
                            ) : (
                              <span className="text-slate-500 italic">Unassigned</span>
                            )
                          ) : (
                            <span className="text-blue-300 font-medium">
                              {b.customer?.full_name || "Client"}
                            </span>
                          )}
                        </td>
                        <td className="py-3 font-mono font-bold text-slate-200">
                          ₹{Number(b.price || 0).toFixed(2)}
                        </td>
                        <td className="py-3">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${
                              b.status === "completed"
                                ? "bg-emerald-950 border border-emerald-800 text-emerald-300"
                                : b.status === "cancelled"
                                ? "bg-rose-950 border border-rose-800 text-rose-300"
                                : b.status === "pending"
                                ? "bg-amber-950 border border-amber-800 text-amber-300"
                                : "bg-blue-950 border border-blue-800 text-blue-300"
                            }`}
                          >
                            {b.status.replace("_", " ")}
                          </span>
                        </td>
                        <td className="py-3 text-slate-400 text-[11px]">
                          {new Date(b.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {hasProof && onAuditProof && (
                              <button
                                type="button"
                                onClick={() => onAuditProof(b)}
                                className="p-1.5 rounded-lg bg-emerald-950/80 border border-emerald-800 text-emerald-400 hover:bg-emerald-900 transition"
                                title="Audit Proof Photos"
                              >
                                <Camera className="h-3.5 w-3.5" />
                              </button>
                            )}

                            {onViewBookingDetails && (
                              <button
                                type="button"
                                onClick={() => onViewBookingDetails(b)}
                                className="px-2 py-1 rounded-lg bg-slate-800 border border-slate-700 text-[11px] font-semibold text-slate-300 hover:text-white transition flex items-center gap-1"
                              >
                                <span>Details</span>
                                <ExternalLink className="h-3 w-3" />
                              </button>
                            )}
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
      </div>
    </div>
  );
}
