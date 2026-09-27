"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createBrowserSupabaseClient,
  getCurrentUser,
  fetchProEarningsMetrics,
  requestPayoutPro,
  fetchUserTransactions,
  type Tables,
  type ProEarningsMetrics,
} from "@repo/db";
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  RefreshCw,
  Percent,
  Sparkles,
  Banknote,
  Calendar,
} from "lucide-react";

export default function ProfessionalWalletPage() {
  const router = useRouter();
  const supabase = createBrowserSupabaseClient();

  const [user, setUser] = useState<any>(null);
  const [metrics, setMetrics] = useState<ProEarningsMetrics | null>(null);
  const [transactions, setTransactions] = useState<Tables<"transactions">[]>([]);
  const [loading, setLoading] = useState(true);

  // Payout Form State
  const [payoutAmount, setPayoutAmount] = useState<string>("");
  const [requestingPayout, setRequestingPayout] = useState(false);
  const [payoutSuccess, setPayoutSuccess] = useState<string | null>(null);
  const [payoutError, setPayoutError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async (userId: string) => {
    try {
      const [proMetrics, txs] = await Promise.all([
        fetchProEarningsMetrics(userId, supabase),
        fetchUserTransactions(userId, supabase),
      ]);
      setMetrics(proMetrics);
      setTransactions(txs);
    } catch (err: any) {
      console.error("Error loading professional wallet data:", err);
    }
  };

  useEffect(() => {
    let channel: any = null;

    async function init() {
      try {
        setLoading(true);
        const currentUser = await getCurrentUser(supabase);
        if (!currentUser) {
          router.push("/login?redirect=/wallet");
          return;
        }
        setUser(currentUser);
        await loadData(currentUser.id);

        // Realtime subscription
        channel = supabase
          .channel(`pro-wallet-${currentUser.id}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "wallets",
              filter: `user_id=eq.${currentUser.id}`,
            },
            () => loadData(currentUser.id)
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "transactions",
              filter: `user_id=eq.${currentUser.id}`,
            },
            () => loadData(currentUser.id)
          )
          .subscribe();
      } catch (err) {
        console.error("Pro wallet init error:", err);
      } finally {
        setLoading(false);
      }
    }

    init();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  const handleRequestPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(payoutAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setPayoutError("Please enter a valid payout amount greater than $0");
      return;
    }

    if (metrics && amountNum > metrics.balance) {
      setPayoutError(`Amount exceeds withdrawable balance of $${metrics.balance.toFixed(2)}`);
      return;
    }

    try {
      setRequestingPayout(true);
      setPayoutError(null);
      setPayoutSuccess(null);

      await requestPayoutPro(amountNum, supabase);
      setPayoutSuccess(`Instant payout request of $${amountNum.toFixed(2)} submitted for admin processing!`);
      setPayoutAmount("");
      if (user) await loadData(user.id);
    } catch (err: any) {
      setPayoutError(err.message || "Failed to request payout");
    } finally {
      setRequestingPayout(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-8 w-8 text-emerald-500 animate-spin" />
          <p className="text-sm text-slate-400">Loading professional earnings & payout balance...</p>
        </div>
      </div>
    );
  }

  const balance = metrics?.balance || 0;
  const lifetime = metrics?.lifetimeEarnings || 0;
  const today = metrics?.todayEarnings || 0;
  const week = metrics?.weekEarnings || 0;
  const month = metrics?.monthEarnings || 0;

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
              <span>Back to Dispatch</span>
            </Link>
            <div className="h-4 w-px bg-slate-800" />
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white font-bold text-sm">
                <Wallet className="h-4 w-4" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-white flex items-center gap-2">
                  Provider Financials & Earnings
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Live Realtime
                  </span>
                </h1>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-400">
            <button
              type="button"
              onClick={() => {
                if (!user) return;
                setRefreshing(true);
                router.refresh();
                loadData(user.id).finally(() => setRefreshing(false));
              }}
              disabled={refreshing}
              className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white transition"
              title="Soft Refresh Wallet"
            >
              <RefreshCw
                className={`h-4 w-4 text-slate-400 hover:text-white transition-transform ${
                  refreshing ? "animate-spin text-emerald-400" : ""
                }`}
              />
            </button>
            <span>{user?.email}</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl w-full px-4 py-8 sm:px-6 space-y-8 flex-1">
        {/* Earnings Metrics Cards */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Today */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase">Today</span>
              <Clock className="h-4 w-4 text-emerald-400" />
            </div>
            <p className="mt-2 text-2xl font-black text-white">${today.toFixed(2)}</p>
            <p className="mt-1 text-[11px] text-slate-500">Service fees + tips today</p>
          </div>

          {/* This Week */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase">This Week</span>
              <Calendar className="h-4 w-4 text-blue-400" />
            </div>
            <p className="mt-2 text-2xl font-black text-white">${week.toFixed(2)}</p>
            <p className="mt-1 text-[11px] text-slate-500">Rolling 7-day payouts</p>
          </div>

          {/* This Month */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase">This Month</span>
              <TrendingUp className="h-4 w-4 text-indigo-400" />
            </div>
            <p className="mt-2 text-2xl font-black text-white">${month.toFixed(2)}</p>
            <p className="mt-1 text-[11px] text-slate-500">Current calendar cycle</p>
          </div>

          {/* Lifetime */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase">Lifetime</span>
              <Sparkles className="h-4 w-4 text-amber-400" />
            </div>
            <p className="mt-2 text-2xl font-black text-white">${lifetime.toFixed(2)}</p>
            <p className="mt-1 text-[11px] text-slate-500">All-time gross provider earnings</p>
          </div>
        </section>

        {/* Balance & Payout Actions */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Available Withdrawable Balance */}
          <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/60 via-slate-900 to-slate-900 p-6 flex flex-col justify-between shadow-xl">
            <div>
              <div className="flex items-center justify-between text-emerald-300">
                <span className="text-xs font-semibold uppercase tracking-wider">Withdrawable Balance</span>
                <Banknote className="h-5 w-5 text-emerald-400" />
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-4xl font-black text-white">${balance.toFixed(2)}</span>
                <span className="text-xs font-bold text-emerald-400">USD</span>
              </div>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                Available for instant transfer to your linked bank account or debit card.
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800 text-xs text-slate-400 space-y-1">
              <div className="flex justify-between">
                <span>Pending Payout Requests:</span>
                <span className="font-bold text-amber-400">${(metrics?.pendingPayouts || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Platform Commission Rate:</span>
                <span className="font-bold text-slate-300">15% Standard</span>
              </div>
            </div>
          </div>

          {/* Request Payout Module */}
          <div className="md:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/80 p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <DollarSign className="h-4 w-4 text-emerald-400" />
                  <span>Request Instant Provider Payout</span>
                </div>
                <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700">
                  ACH / Instant Card
                </span>
              </div>
              <p className="text-xs text-slate-400 mb-4">
                Withdraw your verified completed job earnings directly. Payout requests are verified and cleared by dispatch finance operations.
              </p>

              {payoutSuccess && (
                <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-800/80 bg-emerald-950/40 p-3 text-xs text-emerald-300">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                  <span>{payoutSuccess}</span>
                </div>
              )}

              {payoutError && (
                <div className="mb-4 flex items-center gap-2 rounded-xl border border-rose-800/80 bg-rose-950/40 p-3 text-xs text-rose-300">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                  <span>{payoutError}</span>
                </div>
              )}

              {/* Quick Percentage Chips */}
              <div className="flex gap-2 mb-4">
                {[0.25, 0.5, 0.75, 1.0].map((ratio) => {
                  const val = (balance * ratio).toFixed(2);
                  return (
                    <button
                      key={ratio}
                      type="button"
                      onClick={() => setPayoutAmount(val)}
                      disabled={balance <= 0}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-800 bg-slate-800/70 hover:bg-slate-800 text-slate-300 disabled:opacity-50 transition"
                    >
                      {ratio === 1.0 ? "Max (100%)" : `${ratio * 100}%`} (${val})
                    </button>
                  );
                })}
              </div>

              {/* Amount input */}
              <div className="relative mb-4">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                  $
                </span>
                <input
                  type="number"
                  min="1"
                  max={balance}
                  step="0.01"
                  value={payoutAmount}
                  onChange={(e) => setPayoutAmount(e.target.value)}
                  placeholder="Enter payout amount"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 pl-8 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <button
              onClick={handleRequestPayout}
              disabled={requestingPayout || balance <= 0 || !payoutAmount}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 py-3 text-xs font-bold text-white shadow-lg shadow-emerald-600/25 transition"
            >
              {requestingPayout ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Submitting Payout Request...</span>
                </>
              ) : (
                <>
                  <ArrowUpRight className="h-4 w-4" />
                  <span>Request Payout of ${payoutAmount || "0.00"}</span>
                </>
              )}
            </button>
          </div>
        </section>

        {/* Transaction History & Earnings Ledger */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-slate-400" />
              <h2 className="text-sm font-bold text-white">Earnings & Payout Ledger</h2>
              <span className="text-xs text-slate-500">({transactions.length} records)</span>
            </div>
            <button
              onClick={() => user && loadData(user.id)}
              className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition"
            >
              <RefreshCw className="h-3 w-3" />
              <span>Refresh</span>
            </button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
            {transactions.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No earnings transactions logged yet. Complete service jobs on the dispatch feed to accumulate balances!
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-800 bg-slate-900 text-slate-400">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Type</th>
                      <th className="px-4 py-3 font-semibold">Description</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Timestamp</th>
                      <th className="px-4 py-3 text-right font-semibold">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {transactions.map((tx) => {
                      const isCredit =
                        tx.type === "booking_payment" ||
                        tx.type === "tip" ||
                        tx.type === "deposit" ||
                        tx.type === "promo_credit";
                      const amt = Number(tx.amount);

                      return (
                        <tr key={tx.id} className="hover:bg-slate-800/40 transition">
                          <td className="px-4 py-3.5">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                tx.type === "payout"
                                  ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                  : tx.type === "platform_fee"
                                  ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                  : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              }`}
                            >
                              {tx.type.replace("_", " ")}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 font-medium text-slate-200">
                            {tx.description || "Provider transaction"}
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
                            {isCredit ? `+` : `-`}${amt.toFixed(2)}
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
