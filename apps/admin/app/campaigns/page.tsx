"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Megaphone,
  ArrowLeft,
  Send,
  Users,
  Briefcase,
  Globe,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
} from "lucide-react";
import { sendAdminBroadcastAction } from "../actions";

export default function CampaignsPage() {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [targetAudience, setTargetAudience] = useState<"all" | "customers" | "professionals">("all");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    count?: number;
    error?: string;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      setResult({ success: false, error: "Please enter both a title and message." });
      return;
    }

    try {
      setSending(true);
      setResult(null);
      const res = await sendAdminBroadcastAction({
        title: title.trim(),
        message: message.trim(),
        targetAudience,
      });

      if (res.success) {
        setResult({ success: true, count: res.count });
        setTitle("");
        setMessage("");
      } else {
        setResult({ success: false, error: res.error || "Failed to broadcast campaign." });
      }
    } catch (err: any) {
      console.error("Broadcast failed:", err);
      setResult({ success: false, error: err.message || "An unexpected error occurred." });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-xs font-semibold text-slate-300 transition"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Admin</span>
            </Link>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                <Megaphone className="h-4 w-4" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-white leading-tight">Broadcast Campaign Builder</h1>
                <p className="text-[11px] text-slate-400">Push notifications and announcements across apps</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Form & Preview */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
        {result && (
          <div
            className={`mb-6 p-4 rounded-2xl border flex items-center justify-between text-xs animate-in fade-in ${
              result.success
                ? "bg-emerald-950/60 border-emerald-500/50 text-emerald-300"
                : "bg-rose-950/60 border-rose-500/50 text-rose-300"
            }`}
          >
            <div className="flex items-center gap-2.5">
              {result.success ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
              )}
              <span>
                {result.success
                  ? `Campaign published successfully! Broadcast sent to ${result.count ?? 0} active recipients.`
                  : result.error}
              </span>
            </div>
            <button
              onClick={() => setResult(null)}
              className="font-bold opacity-70 hover:opacity-100"
            >
              ✕
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left: Compose Form */}
          <div className="lg:col-span-7 space-y-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl space-y-5">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-indigo-400" />
                <span>Compose Campaign</span>
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Target Audience */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2">
                    Target Audience
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setTargetAudience("all")}
                      className={`flex flex-col items-center p-3 rounded-xl border text-xs font-semibold transition ${
                        targetAudience === "all"
                          ? "bg-indigo-600/20 border-indigo-500 text-indigo-300 ring-1 ring-indigo-500"
                          : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <Globe className="h-4 w-4 mb-1 text-indigo-400" />
                      <span>All Users</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTargetAudience("customers")}
                      className={`flex flex-col items-center p-3 rounded-xl border text-xs font-semibold transition ${
                        targetAudience === "customers"
                          ? "bg-blue-600/20 border-blue-500 text-blue-300 ring-1 ring-blue-500"
                          : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <Users className="h-4 w-4 mb-1 text-blue-400" />
                      <span>Customers</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTargetAudience("professionals")}
                      className={`flex flex-col items-center p-3 rounded-xl border text-xs font-semibold transition ${
                        targetAudience === "professionals"
                          ? "bg-emerald-600/20 border-emerald-500 text-emerald-300 ring-1 ring-emerald-500"
                          : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <Briefcase className="h-4 w-4 mb-1 text-emerald-400" />
                      <span>Providers</span>
                    </button>
                  </div>
                </div>

                {/* Campaign Title */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Campaign / Notification Title
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Weekend Special: 20% Off Deep Cleaning!"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    maxLength={100}
                    required
                  />
                </div>

                {/* Message Body */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Message Body
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={5}
                    placeholder="Enter detailed notification copy for customers or professionals..."
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    maxLength={500}
                    required
                  />
                  <div className="flex justify-between text-[11px] text-slate-500 mt-1">
                    <span>Supports multi-line formatting</span>
                    <span>{message.length}/500</span>
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={sending || !title.trim() || !message.trim()}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 py-3 text-xs font-bold text-white shadow-lg shadow-indigo-600/25 transition"
                >
                  {sending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Transmitting Broadcast...</span>
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      <span>Send Broadcast Campaign</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Right: Live Preview */}
          <div className="lg:col-span-5 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Live Recipient Preview
            </h3>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl space-y-4">
              <div className="text-[11px] text-slate-400 flex items-center justify-between">
                <span>In-App Notification Bubble</span>
                <span className="text-indigo-400 font-semibold uppercase text-[10px]">
                  Target: {targetAudience}
                </span>
              </div>

              {/* Sample Notification Card */}
              <div className="p-4 rounded-xl border border-indigo-500/40 bg-slate-900 shadow-lg shadow-indigo-950/20 text-white space-y-2">
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0">
                    <Megaphone className="h-4 w-4" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-white">
                        {title.trim() || "Notification Headline"}
                      </h4>
                      <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-slate-800 text-slate-400 border border-slate-700">
                        Admin Broadcast
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
                      {message.trim() ||
                        "Your announcement copy will appear here in real-time on all recipient devices."}
                    </p>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 pt-1">
                      <Clock className="h-3 w-3" />
                      <span>Just now</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-1">
                <p className="font-semibold text-slate-300">Delivery Guarantee:</p>
                <p>
                  Broadcasts are saved to the persistent Supabase database and delivered instantly to
                  connected clients via Supabase Realtime WebSocket events.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

