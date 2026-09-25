"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createBrowserSupabaseClient,
  getCurrentUser,
  fetchPlatformFinanceLedger,
  approvePayoutAdmin,
  type Tables,
} from "@repo/db";
import {
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  RefreshCw,
  Percent,
  Banknote,
  Search,
  Filter,
  Check,
  ShieldCheck,
  ArrowUpRight,
  ArrowDownLeft,
} from "lucide-react";

export default function AdminFinancePage() {
  const router = useRouter();
  const supabase = createBrowserSupabaseClient();

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<{
    totalVolume: number;
    platformCommissions: number;
    pendingPayouts: number;
    completedPayouts: number;
  }>({
    totalVolume: 0,
    platformCommissions: 0,
    pendingPayouts: 0,
    completedPayouts: 0,
  });

  const [selectedFilter, setSelectedFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadFinanceData = async () => {
    try {
      const data = await fetchPlatformFinanceLedger(supabase);
      setTransactions(data.transactions);
      setMetrics(data.metrics);
    } catch (err: any) {
      console.error("Failed to load finance data:", err);
    }
  };

  useEffect(() => {
    let channel: any = null;

    async function init() {
      try {
        setLoading(true);
        const currentUser = await getCurrentUser(supabase);
        if (!currentUser) {
          router.push("/login?redirect=/finance");
          return;
        }
        setUser(currentUser);
        await loadFinanceData();

        // Realtime sync on transactions
        channel = supabase
          .channel("admin-finance-realtime")
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "transactions" },
            () => loadFinanceData()
          )
          .subscribe();
      } catch (err) {
        console.error("Admin finance init error:", err);
      } finally {
        setLoading(false);
      }
    }

    init();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  const handleApprovePayout = async (txId: string) => {
    try {
      setApprovingId(txId);
      setActionSuccess(null);
      setActionError(null);

      await approvePayoutAdmin(txId, supabase);
      setActionSuccess(`Payout #${txId.slice(0, 8)} approved and cleared successfully!`);
      await loadFinanceData();
    } catch (err: any) {
      setActionError(err.message || "Failed to approve payout");
    } finally {
      setApprovingId(null);
    }
  };

  const pendingPayoutsList = transactions.filter(
    (t) => t.type === "payout" && t.status === "pending"
  );

  const filteredTransactions = transactions.filter((t) => {
    if (selectedFilter !== "all" && t.type !== selectedFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const userName = t.user?.full_name?.toLowerCase() || "";
      const userEmail = t.user?.email?.toLowerCase() || "";
      const txId = t.id.toLowerCase();
      return userName.includes(q) || userEmail.includes(q) || txId.includes(q);
    }
    return true;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-8 w-8 text-indigo-500 animate-spin" />
          <p className="text-sm text-slate-400">Loading platform financials & transaction ledger...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Header */}
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-800 bg-slate-800/60 hover:bg-slate-800 text-xs font-semibold text-slate-300 transition"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Command Center</span>
            </Link>
            <div className="h-4 w-px bg-slate-800" />
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold text-sm">
                <DollarSign className="h-4 w-4" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-white flex items-center gap-2">
                  Financials & Master Ledger
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    Audit Controls
                  </span>
                </h1>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>{user?.email} (Super Admin)</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl w-full px-4 py-8 sm:px-6 space-y-8 flex-1">
        {actionSuccess && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-800/80 bg-emerald-950/40 p-4 text-xs text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>{actionSuccess}</span>
          </div>
        )}

        {actionError && (
          <div className="flex items-center gap-2 rounded-xl border border-rose-800/80 bg-rose-950/40 p-4 text-xs text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{actionError}</span>
          </div>
        )}

        {/* Financial Metrics Cards */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Gross Volume */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase">Gross Platform Volume</span>
              <DollarSign className="h-4 w-4 text-emerald-400" />
            </div>
            <p className="mt-2 text-2xl font-black text-white">${metrics.totalVolume.toFixed(2)}</p>
            <p className="mt-1 text-[11px] text-slate-500">Customer payments & deposits</p>
          </div>

          {/* Platform Revenue Commissions */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase">Platform Commissions</span>
              <Percent className="h-4 w-4 text-indigo-400" />
            </div>
            <p className="mt-2 text-2xl font-black text-indigo-400">
              ${metrics.platformCommissions.toFixed(2)}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">15% net platform retention</p>
          </div>

          {/* Pending Payouts */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase">Pending Payouts</span>
              <Clock className="h-4 w-4 text-amber-400" />
            </div>
            <p className="mt-2 text-2xl font-black text-amber-400">
              ${metrics.pendingPayouts.toFixed(2)}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">{pendingPayoutsList.length} awaiting approval</p>
          </div>

          {/* Completed Payouts */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase">Disbursed Payouts</span>
              <Banknote className="h-4 w-4 text-blue-400" />
            </div>
            <p className="mt-2 text-2xl font-black text-white">
              ${metrics.completedPayouts.toFixed(2)}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">Disbursed to service pros</p>
          </div>
        </section>

        {/* Pending Payout Approvals Queue */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-400" />
              <h2 className="text-sm font-bold text-white">Pending Provider Payout Requests</h2>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                {pendingPayoutsList.length} Pending
              </span>
            </div>
          </div>

          {pendingPayoutsList.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
              <span>All provider payouts are up to date. No pending withdrawal requests!</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingPayoutsList.map((tx) => (
                <div
                  key={tx.id}
                  className="rounded-2xl border border-amber-500/30 bg-slate-900/90 p-5 flex flex-col justify-between space-y-4"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-950/80 border border-amber-800 px-2 py-0.5 rounded-md">
                        Payout Request
                      </span>
                      <h3 className="text-sm font-bold text-white mt-2">
                        {tx.user?.full_name || "Professional"}
                      </h3>
                      <p className="text-xs text-slate-400">{tx.user?.email}</p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Requested: {new Date(tx.created_at).toLocaleString()}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-2xl font-black text-amber-400">
                        ${Number(tx.amount).toFixed(2)}
                      </span>
                      <p className="text-[10px] text-slate-400">Instant ACH / Card</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-3 border-t border-slate-800">
                    <button
                      onClick={() => handleApprovePayout(tx.id)}
                      disabled={approvingId === tx.id}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 py-2.5 text-xs font-bold text-white transition shadow-md shadow-emerald-600/20"
                    >
                      {approvingId === tx.id ? (
                        <>
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          <span>Approving...</span>
                        </>
                      ) : (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          <span>Approve & Disburse Payout</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Master Transaction Ledger */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Banknote className="h-4 w-4 text-indigo-400" />
              <h2 className="text-sm font-bold text-white">Platform Transaction Ledger</h2>
              <span className="text-xs text-slate-500">({filteredTransactions.length} records)</span>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search user or ID..."
                  className="rounded-xl border border-slate-700 bg-slate-900 pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <button
                onClick={loadFinanceData}
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition"
              >
                <RefreshCw className="h-3 w-3" />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Type Filter Chips */}
          <div className="flex flex-wrap gap-1.5 text-xs">
            {[
              { id: "all", label: "All Transactions" },
              { id: "booking_payment", label: "Bookings" },
              { id: "deposit", label: "Deposits" },
              { id: "promo_credit", label: "Promo Credits" },
              { id: "payout", label: "Payouts" },
              { id: "platform_fee", label: "Platform Fees" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setSelectedFilter(f.id)}
                className={`px-3 py-1.5 rounded-xl font-semibold transition ${
                  selectedFilter === f.id
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                    : "border border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Ledger Table */}
          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
            {filteredTransactions.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No transactions match the selected filter.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-800 bg-slate-900 text-slate-400">
                    <tr>
                      <th className="px-4 py-3 font-semibold">User / Profile</th>
                      <th className="px-4 py-3 font-semibold">Type</th>
                      <th className="px-4 py-3 font-semibold">Description</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Timestamp</th>
                      <th className="px-4 py-3 text-right font-semibold">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredTransactions.map((tx) => {
                      const isCredit =
                        tx.type === "deposit" ||
                        tx.type === "booking_payment" ||
                        tx.type === "promo_credit";

                      return (
                        <tr key={tx.id} className="hover:bg-slate-800/40 transition">
                          <td className="px-4 py-3.5">
                            <div>
                              <p className="font-bold text-white">
                                {tx.user?.full_name || "Platform Account"}
                              </p>
                              <p className="text-[11px] text-slate-500">{tx.user?.email || tx.user_id}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                tx.type === "payout"
                                  ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                  : tx.type === "platform_fee"
                                  ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                                  : tx.type === "promo_credit"
                                  ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                                  : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              }`}
                            >
                              {tx.type.replace("_", " ")}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 font-medium text-slate-300">
                            {tx.description || "Platform transaction"}
                          </td>
                          <td className="px-4 py-3.5">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                tx.status === "completed"
                                  ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                                  : "bg-amber-950 text-amber-400 border border-amber-800"
                              }`}
                            >
                              {tx.status}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-slate-400">
                            {new Date(tx.created_at).toLocaleString()}
                          </td>
                          <td
                            className={`px-4 py-3.5 text-right font-mono font-bold text-sm ${
                              isCredit ? "text-emerald-400" : "text-amber-400"
                            }`}
                          >
                            {isCredit ? "+" : "-"}${Number(tx.amount).toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
