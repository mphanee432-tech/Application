"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@repo/db";
import { ensureSuperAdminRole } from "../actions";
import { ShieldCheck, LogIn, UserPlus, ArrowLeft, AlertCircle } from "lucide-react";
import Link from "next/link";

export default function AdminLoginPage() {
  const router = useRouter();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const supabase = createBrowserSupabaseClient("admin");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              role: "admin",
            },
          },
        });

        if (error) throw error;

        if (data.user) {
          // Trigger server action to grant super_admin if this is the initial account
          await ensureSuperAdminRole(data.user.id);
        }

        if (data.session) {
          router.push("/");
          router.refresh();
        } else {
          setErrorMessage("Admin account initialized. Please sign in or confirm your email.");
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        if (data.user) {
          await ensureSuperAdminRole(data.user.id);
        }

        router.push("/");
        router.refresh();
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12 sm:px-6 lg:px-8 text-slate-100">
      <div className="w-full max-w-md space-y-8 rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-2xl">
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-indigo-400 transition mb-6"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Command HQ
          </Link>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white font-bold text-xl shadow-lg shadow-indigo-500/30">
            HQ
          </div>
          <h2 className="mt-4 text-2xl font-black tracking-tight text-white">
            {isSignUp ? "Initialize Admin Access" : "Ops HQ Admin Sign In"}
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            {isSignUp
              ? "Initial registered account is automatically provisioned as super_admin"
              : "Authentication required for live dispatch, KYC verification, and escrow oversight"}
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="flex rounded-xl bg-slate-800 p-1 border border-slate-700">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(false);
              setErrorMessage(null);
            }}
            className={`flex-1 rounded-lg py-2 text-xs font-bold transition ${
              !isSignUp ? "bg-slate-700 text-white shadow-sm" : "text-slate-400 hover:text-white"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setIsSignUp(true);
              setErrorMessage(null);
            }}
            className={`flex-1 rounded-lg py-2 text-xs font-bold transition ${
              isSignUp ? "bg-slate-700 text-white shadow-sm" : "text-slate-400 hover:text-white"
            }`}
          >
            New Admin
          </button>
        </div>

        {errorMessage && (
          <div className="flex items-start gap-2.5 rounded-xl border border-rose-800 bg-rose-950/60 p-3.5 text-xs text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <div>
              <label className="text-xs font-semibold text-slate-300">Admin Full Name</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Platform Administrator"
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-300">Admin Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@homeserve.internal"
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300">Security Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-xs font-bold text-white shadow-lg shadow-indigo-500/25 transition hover:bg-indigo-500 disabled:opacity-50"
          >
            {loading ? (
              <span>Authenticating...</span>
            ) : isSignUp ? (
              <>
                <ShieldCheck className="h-4 w-4" />
                <span>Initialize Super Admin Account</span>
              </>
            ) : (
              <>
                <LogIn className="h-4 w-4" />
                <span>Sign In to Ops HQ</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

