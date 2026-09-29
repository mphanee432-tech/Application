"use client";

import React, { useEffect, useState } from "react";
import {
  Users,
  Briefcase,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Phone,
  Mail,
  Loader2,
  RefreshCw,
  Star,
  Power,
  ShieldCheck,
  History,
} from "lucide-react";
import {
  fetchAllCustomersAdmin,
  fetchAllProfessionalsAdmin,
} from "../app/actions";
import { UserBookingHistoryModal } from "./UserBookingHistoryModal";

export function DirectoriesView() {
  const [dirTab, setDirTab] = useState<"customers" | "professionals">("customers");
  const [customers, setCustomers] = useState<any[]>([]);
  const [professionals, setProfessionals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [kycFilter, setKycFilter] = useState<string>("all");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [historyTarget, setHistoryTarget] = useState<{
    id: string;
    name: string;
    email?: string;
    role: "customer" | "professional";
  } | null>(null);

  const loadDirectories = async () => {
    try {
      setLoading(true);
      const [fetchedCustomers, fetchedPros] = await Promise.all([
        fetchAllCustomersAdmin().catch((e) => {
          console.error("Failed fetching customers:", e);
          return [];
        }),
        fetchAllProfessionalsAdmin().catch((e) => {
          console.error("Failed fetching pros:", e);
          return [];
        }),
      ]);
      setCustomers(Array.isArray(fetchedCustomers) ? fetchedCustomers : []);
      setProfessionals(Array.isArray(fetchedPros) ? fetchedPros : []);
    } catch (err: any) {
      console.error("Error loading directories:", err);
      setCustomers([]);
      setProfessionals([]);
      setMessage({ type: "error", text: err?.message || "Failed to load directory." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDirectories();
  }, []);

  // Filtered lists
  const safeCustomers = Array.isArray(customers) ? customers : [];
  const safePros = Array.isArray(professionals) ? professionals : [];

  const filteredCustomers = safeCustomers.filter((c) => {
    const q = search.toLowerCase();
    const nameMatch = (c.full_name || "").toLowerCase().includes(q);
    const emailMatch = (c.email || "").toLowerCase().includes(q);
    const mobileMatch = (c.mobile || c.phone || "").toLowerCase().includes(q);
    return nameMatch || emailMatch || mobileMatch;
  });

  const filteredPros = safePros.filter((p) => {
    const q = search.toLowerCase();
    const nameMatch = (p.profile?.full_name || p.full_name || "").toLowerCase().includes(q);
    const emailMatch = (p.profile?.email || p.email || "").toLowerCase().includes(q);
    const mobileMatch = (p.profile?.phone || p.profile?.mobile || p.mobile || "").toLowerCase().includes(q);
    const tradeMatch = (p.trade || "").toLowerCase().includes(q);

    const matchesQuery = nameMatch || emailMatch || mobileMatch || tradeMatch;
    const matchesKyc = kycFilter === "all" || p.kyc_status === kycFilter;

    return matchesQuery && matchesKyc;
  });

  return (
    <div className="space-y-6">
      {/* Sub-Tabs & Search Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-800 pb-4">
        <div className="flex gap-2">
          <button
            onClick={() => {
              setDirTab("customers");
              setSearch("");
            }}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
              dirTab === "customers"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            <span>Customer Directory ({customers.length})</span>
          </button>

          <button
            onClick={() => {
              setDirTab("professionals");
              setSearch("");
            }}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
              dirTab === "professionals"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
            }`}
          >
            <Briefcase className="h-3.5 w-3.5" />
            <span>Professional Directory ({professionals.length})</span>
          </button>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Search Box */}
          <div className="relative flex-1 sm:w-64">
            <Search className="h-3.5 w-3.5 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder={`Search ${dirTab === "customers" ? "customers" : "pros"} by name, email, mobile...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-xs rounded-xl pl-9 pr-3 py-2 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {dirTab === "professionals" && (
            <select
              value={kycFilter}
              onChange={(e) => setKycFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-xs rounded-xl px-2.5 py-2 text-slate-300 font-semibold focus:outline-none focus:border-indigo-500"
            >
              <option value="all">All KYC Statuses</option>
              <option value="pending_approval">Pending Approval</option>
              <option value="approved">Approved</option>
              <option value="pending_submission">Pending Submission</option>
            </select>
          )}

          <button
            onClick={loadDirectories}
            disabled={loading}
            className="p-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 hover:text-white transition"
            title="Refresh Directory"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex justify-between items-center ${
            message.type === "success"
              ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300"
              : "bg-rose-950/40 border-rose-500/40 text-rose-300"
          }`}
        >
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-xs font-bold opacity-70 hover:opacity-100">
            ✕
          </button>
        </div>
      )}

      {/* 1. CUSTOMER DIRECTORY TABLE */}
      {dirTab === "customers" && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4">
          <div className="flex justify-between items-center border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-bold text-white">Verified Customer Accounts</h3>
              <p className="text-xs text-slate-400">
                All registered users who place orders and receive local dispatch services.
              </p>
            </div>
            <span className="text-xs font-mono text-slate-400">
              Showing {filteredCustomers.length} of {customers.length}
            </span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center p-12 text-xs text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin mr-2 text-indigo-400" />
              Loading customer directory...
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="text-center py-12 text-xs text-slate-500">
              No customer records match your filter criteria.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="pb-3 font-semibold">User ID</th>
                    <th className="pb-3 font-semibold">User</th>
                    <th className="pb-3 font-semibold">Email</th>
                    <th className="pb-3 font-semibold">Mobile / Phone</th>
                    <th className="pb-3 font-semibold">Total Orders</th>
                    <th className="pb-3 font-semibold">Total Spend</th>
                    <th className="pb-3 font-semibold">Registered</th>
                    <th className="pb-3 text-right font-semibold">History</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredCustomers.map((cust) => (
                    <tr key={cust.id} className="hover:bg-slate-800/30 transition">
                      <td className="py-4">
                        <span className="font-mono text-[10px] text-slate-400 bg-slate-950 px-2 py-1 rounded-md border border-slate-800">
                          #{cust.id.slice(0, 8)}
                        </span>
                      </td>
                      <td className="py-4 font-bold text-white">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center font-bold text-xs uppercase">
                            {(cust.full_name || "U")[0]}
                          </div>
                          <span>{cust.full_name || "Resident Client"}</span>
                        </div>
                      </td>
                      <td className="py-4 text-slate-300 font-mono flex items-center gap-1.5">
                        <Mail className="h-3 w-3 text-slate-500" />
                        <span>{cust.email || "No email"}</span>
                      </td>
                      <td className="py-4 text-slate-300 font-mono">
                        <div className="flex items-center gap-1.5">
                          <Phone className="h-3 w-3 text-slate-500" />
                          <span>{cust.mobile || cust.phone || "Not provided"}</span>
                        </div>
                      </td>
                      <td className="py-4">
                        <span className="font-bold text-slate-200 bg-slate-800 px-2 py-0.5 rounded-full text-[10px]">
                          {cust.total_bookings} order{cust.total_bookings === 1 ? "" : "s"}
                        </span>
                      </td>
                      <td className="py-4 font-bold text-emerald-400 font-mono">
                        ₹{Number(cust.total_spent || 0).toFixed(2)}
                      </td>
                      <td className="py-4 text-slate-400 text-[11px]">
                        {new Date(cust.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-4 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            setHistoryTarget({
                              id: cust.id,
                              name: cust.full_name || "Resident Client",
                              email: cust.email,
                              role: "customer",
                            })
                          }
                          className="px-2.5 py-1 rounded-lg bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/30 transition text-[11px] font-semibold inline-flex items-center gap-1"
                        >
                          <History className="h-3 w-3" />
                          <span>View History</span>
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

      {/* 2. PROFESSIONAL DIRECTORY TABLE */}
      {dirTab === "professionals" && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4">
          <div className="flex justify-between items-center border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-bold text-white">Service Provider Network</h3>
              <p className="text-xs text-slate-400">
                Technicians registered to claim FCFS broadcasts, fulfill orders, and submit proof-of-work.
              </p>
            </div>
            <span className="text-xs font-mono text-slate-400">
              Showing {filteredPros.length} of {professionals.length}
            </span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center p-12 text-xs text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin mr-2 text-indigo-400" />
              Loading professionals directory...
            </div>
          ) : filteredPros.length === 0 ? (
            <div className="text-center py-12 text-xs text-slate-500">
              No service professionals match your filter criteria.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="pb-3 font-semibold">Pro ID</th>
                    <th className="pb-3 font-semibold">Technician</th>
                    <th className="pb-3 font-semibold">Trade Specialty</th>
                    <th className="pb-3 font-semibold">Contact (Email & Mobile)</th>
                    <th className="pb-3 font-semibold">City Zone</th>
                    <th className="pb-3 font-semibold">Rating</th>
                    <th className="pb-3 font-semibold">KYC Compliance</th>
                    <th className="pb-3 text-right font-semibold">History</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredPros.map((pro) => {
                    const fullName = pro.profile?.full_name || pro.full_name || "Specialist";
                    const email = pro.profile?.email || pro.email || "N/A";
                    const mobile = pro.profile?.phone || pro.profile?.mobile || pro.mobile || "N/A";

                    return (
                      <tr key={pro.id} className="hover:bg-slate-800/30 transition">
                        <td className="py-4">
                          <span className="font-mono text-[10px] text-slate-400 bg-slate-950 px-2 py-1 rounded-md border border-slate-800">
                            #{pro.id.slice(0, 8)}
                          </span>
                        </td>
                        <td className="py-4">
                          <div className="font-bold text-white flex items-center gap-2">
                            <div className="h-7 w-7 rounded-lg bg-emerald-600/20 text-emerald-400 flex items-center justify-center font-bold text-xs uppercase">
                              {fullName[0]}
                            </div>
                            <div>
                              <span>{fullName}</span>
                              <div className="text-[10px] text-slate-500 font-mono">
                                License: {pro.license_number || "Verified Provider"}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-4">
                          <span className="font-semibold text-slate-200 block">{pro.trade}</span>
                          {pro.skills && pro.skills.length > 0 && (
                            <span className="text-[10px] text-slate-400">
                              {pro.skills.map((s: any) => s.service?.name).filter(Boolean).join(", ")}
                            </span>
                          )}
                        </td>
                        <td className="py-4 space-y-0.5">
                          <div className="flex items-center gap-1.5 text-slate-300 font-mono text-[11px]">
                            <Mail className="h-3 w-3 text-slate-500" />
                            <span>{email}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-slate-400 font-mono text-[11px]">
                            <Phone className="h-3 w-3 text-slate-500" />
                            <span>{mobile}</span>
                          </div>
                        </td>
                        <td className="py-4 text-slate-300">
                          {pro.city?.name || "All Zones"}
                        </td>
                        <td className="py-4">
                          <div className="flex items-center gap-1 font-bold text-amber-400">
                            <Star className="h-3.5 w-3.5 fill-amber-400" />
                            <span>{pro.rating ? Number(pro.rating).toFixed(1) : "5.0"}</span>
                          </div>
                        </td>
                        <td className="py-4">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold capitalize ${
                              pro.kyc_status === "approved" || pro.status === "approved"
                                ? "bg-emerald-950 border border-emerald-800 text-emerald-300"
                                : pro.kyc_status === "pending_approval"
                                ? "bg-amber-950 border border-amber-800 text-amber-300"
                                : "bg-slate-800 border border-slate-700 text-slate-400"
                            }`}
                          >
                            {pro.kyc_status === "approved" || pro.status === "approved" ? (
                              <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                            ) : (
                              <Clock className="h-3 w-3 text-amber-400" />
                            )}
                            <span>{pro.kyc_status?.replace("_", " ") || pro.status}</span>
                          </span>
                        </td>
                        <td className="py-4 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              setHistoryTarget({
                                id: pro.id,
                                name: fullName,
                                email: email !== "N/A" ? email : undefined,
                                role: "professional",
                              })
                            }
                            className="px-2.5 py-1 rounded-lg bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/30 transition text-[11px] font-semibold inline-flex items-center gap-1"
                          >
                            <History className="h-3 w-3" />
                            <span>View History</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* User Booking History Drill-Down Modal */}
      <UserBookingHistoryModal
        isOpen={Boolean(historyTarget)}
        targetUser={historyTarget}
        onClose={() => setHistoryTarget(null)}
      />
    </div>
  );
}
