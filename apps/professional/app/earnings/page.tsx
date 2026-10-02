"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createBrowserSupabaseClient,
  fetchCompletedBookingsForPro,
  getCurrentUser,
} from "@repo/db";
import {
  ArrowLeft,
  TrendingUp,
  DollarSign,
  Percent,
  Banknote,
  Loader2,
  RefreshCw,
  CheckCircle,
  Briefcase,
  CalendarDays,
} from "lucide-react";

export default function EarningsPage() {
  const router = useRouter();
  const [supabase] = useState(() => createBrowserSupabaseClient("professional"));
  const [user, setUser] = useState<any>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestingPayout, setRequestingPayout] = useState(false);
  const [payoutMsg, setPayoutMsg] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function loadData() {
    try {
      setLoading(true);
      const currentUser = await getCurrentUser(supabase);
      if (!currentUser) {
        router.push("/login");
        return;
      }
      setUser(currentUser);
      const completedJobs = await fetchCompletedBookingsForPro(currentUser.id, supabase);
      setJobs(completedJobs.filter((j: any) => j.status === "completed"));
    } catch (err) {
      console.error("Earnings load error:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const grossTotal = jobs.reduce((sum, j) => sum + Number(j.price || 0), 0);
  const netEarnings = grossTotal * 0.8;
  const platformCommission = grossTotal * 0.2;

  const handleRequestPayout = async () => {
    if (netEarnings <= 0) return;
    try {
      setRequestingPayout(true);
      setPayoutMsg(null);

      // Insert a payout transaction
      const { error } = await supabase
        .from("transactions")
        .insert({
          user_id: user?.id,
          type: "payout",
          amount: netEarnings,
          status: "pending",
          description: `Payout request: ₹${netEarnings.toFixed(2)} (80% of ₹${grossTotal.toFixed(2)} gross)`,
        });

      if (error) throw error;
      setPayoutMsg(`✅ Payout request of ₹${netEarnings.toFixed(2)} submitted! Admin will review and disburse within 24-48 hours.`);
    } catch (err: any) {
      setPayoutMsg(`❌ Failed to request payout: ${err.message || "Unknown error"}`);
    } finally {
      setRequestingPayout(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <Loader2 className="animate-spin h-6 w-6 mr-2" /> Loading earnings...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md">
        <div className="mx-auto max-w-5xl flex items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-slate-400 hover:text-white transition p-2 rounded-lg hover:bg-slate-800">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white font-bold text-sm">
                <span>₹</span>
              </div>
              <div>
                <h1 className="text-sm font-bold text-white flex items-center gap-2">
                  Earnings & Payouts
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    80/20 Split
                  </span>
                </h1>
              </div>
            </div>
          </div>
          <button
            onClick={() => {
              setRefreshing(true);
              loadData().finally(() => setRefreshing(false));
            }}
            disabled={refreshing}
            className="p-1.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white transition"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin text-emerald-400" : ""}`} />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 space-y-8">
        {/* Earnings Summary Cards */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase">Gross Revenue</span>
              <DollarSign className="h-4 w-4 text-slate-500" />
            </div>
            <p className="mt-2 text-2xl font-black text-white">₹{grossTotal.toFixed(2)}</p>
            <p className="mt-1 text-[11px] text-slate-500">Total customer payments</p>
          </div>

          <div className="rounded-2xl border border-emerald-800/50 bg-emerald-950/30 p-5">
            <div className="flex items-center justify-between text-emerald-400">
              <span className="text-xs font-semibold uppercase">Your Net (80%)</span>
              <Banknote className="h-4 w-4" />
            </div>
            <p className="mt-2 text-2xl font-black text-emerald-400">₹{netEarnings.toFixed(2)}</p>
            <p className="mt-1 text-[11px] text-emerald-600">After platform commission</p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase">Platform Fee (20%)</span>
              <Percent className="h-4 w-4 text-indigo-400" />
            </div>
            <p className="mt-2 text-2xl font-black text-indigo-400">₹{platformCommission.toFixed(2)}</p>
            <p className="mt-1 text-[11px] text-slate-500">HomeServe commission</p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase">Jobs Completed</span>
              <Briefcase className="h-4 w-4 text-blue-400" />
            </div>
            <p className="mt-2 text-2xl font-black text-white">{jobs.length}</p>
            <p className="mt-1 text-[11px] text-slate-500">Verified & paid</p>
          </div>
        </section>

        {/* Payout Request */}
        <section className="rounded-2xl border border-emerald-800/50 bg-emerald-950/20 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-white">Request Payout</h2>
            <p className="text-xs text-slate-400 mt-1">
              Submit your 80% net earnings for disbursement. Admin reviews and transfers within 24-48 hours.
            </p>
            {payoutMsg && (
              <p className="mt-2 text-xs font-semibold text-emerald-400">{payoutMsg}</p>
            )}
          </div>
          <button
            onClick={handleRequestPayout}
            disabled={requestingPayout || netEarnings <= 0}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-2.5 px-6 rounded-xl transition shadow-lg shadow-emerald-900 shrink-0"
          >
            {requestingPayout ? <Loader2 className="animate-spin h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
            <span>Request Payout (₹{netEarnings.toFixed(2)})</span>
          </button>
        </section>

        {/* Completed Jobs Table */}
        <section className="space-y-4">
          <h2 className="text-sm font-bold text-white">Completed Job Ledger</h2>
          {jobs.length === 0 ? (
            <div className="text-center p-12 bg-slate-900 border border-slate-800 rounded-2xl text-slate-400">
              <Briefcase className="h-10 w-10 mx-auto opacity-20 mb-3" />
              <p>No completed jobs yet.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-800 bg-slate-900 text-slate-400">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Service</th>
                      <th className="px-4 py-3 font-semibold">Customer</th>
                      <th className="px-4 py-3 font-semibold">Date</th>
                      <th className="px-4 py-3 font-semibold">Gross Price</th>
                      <th className="px-4 py-3 text-right font-semibold text-emerald-400">Your 80% Cut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {jobs.map((job) => (
                      <tr key={job.id} className="hover:bg-slate-800/40 transition">
                        <td className="px-4 py-3.5">
                          <p className="font-bold text-white">{job.service_type || job.services?.name}</p>
                          <p className="text-[11px] text-slate-500 font-mono">#{job.id.slice(0, 8)}</p>
                        </td>
                        <td className="px-4 py-3.5 text-slate-300">
                          {job.customer?.full_name || "Customer"}
                        </td>
                        <td className="px-4 py-3.5 text-slate-400">
                          <div className="flex items-center gap-1">
                            <CalendarDays className="h-3 w-3" />
                            {new Date(job.created_at).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 font-mono text-slate-300">
                          ₹{Number(job.price).toFixed(2)}
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono font-bold text-emerald-400">
                          ₹{(Number(job.price) * 0.8).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
