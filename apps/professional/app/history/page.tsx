"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabaseClient, fetchCompletedBookingsForPro } from "@repo/db";
import Link from "next/link";
import { ArrowLeft, History, Loader2, CalendarDays, CheckCircle, XCircle } from "lucide-react";

export default function HistoryPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const supabase = createBrowserSupabaseClient();

  useEffect(() => {
    async function loadHistory() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const data = await fetchCompletedBookingsForPro(user.id);
          setJobs(data || []);
        }
      } catch (err) {
        console.error("Failed to load history", err);
      } finally {
        setLoading(false);
      }
    }
    loadHistory();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <Loader2 className="animate-spin h-6 w-6 mr-2" /> Loading history...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md px-4 py-3 sm:px-6">
        <div className="mx-auto max-w-5xl flex items-center gap-4">
          <Link href="/" className="text-slate-400 hover:text-white transition p-2 rounded-lg hover:bg-slate-800">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <History className="h-5 w-5 text-indigo-400" />
            Job History
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="grid gap-4">
          {jobs.length === 0 ? (
            <div className="text-center p-12 bg-slate-900 border border-slate-800 rounded-2xl text-slate-400">
              <History className="h-10 w-10 mx-auto opacity-20 mb-3" />
              <p>No past jobs found in your history.</p>
            </div>
          ) : (
            jobs.map((job) => (
              <div key={job.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition hover:border-slate-700">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="font-bold text-lg text-white">{job.service_type}</h3>
                    {job.status === "completed" ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase bg-emerald-950 text-emerald-400 px-2 py-0.5 rounded border border-emerald-900">
                        <CheckCircle className="h-3 w-3" /> Completed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase bg-rose-950 text-rose-400 px-2 py-0.5 rounded border border-rose-900">
                        <XCircle className="h-3 w-3" /> Cancelled
                      </span>
                    )}
                  </div>
                  
                  <div className="mt-2 space-y-1 text-sm text-slate-400">
                    <p>Customer: {job.customer?.full_name || "Unknown"}</p>
                    <p className="flex items-center gap-1.5">
                      <CalendarDays className="h-4 w-4" />
                      {new Date(job.created_at).toLocaleDateString()}
                    </p>
                    {job.status === "cancelled" && job.cancellation_reason && (
                      <p className="text-rose-400 mt-2 bg-rose-950/30 p-2 rounded border border-rose-900/50 inline-block text-xs">
                        Reason: {job.cancellation_reason}
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="text-left sm:text-right">
                  <p className="text-sm text-slate-500">Payout</p>
                  <p className={`text-2xl font-black ${job.status === 'completed' ? 'text-emerald-400' : 'text-slate-500 line-through'}`}>
                    ${Number(job.price).toFixed(2)}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
