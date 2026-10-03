"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@repo/db";
import { LogIn, UserPlus, Shield, ArrowLeft, AlertCircle } from "lucide-react";
import Link from "next/link";

export default function UserLoginPage() {
  const router = useRouter();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const supabase = createBrowserSupabaseClient("user");

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
              role: "customer",
              phone,
            },
          },
        });

        if (data.session && data.user) {
          // Ensure phone is saved to profiles table
          const userPhone = phone.trim() || "";
          if (userPhone) {
            await (supabase as any)
              .from("profiles")
              .update({ phone: userPhone, mobile: userPhone })
              .eq("id", data.user.id);
          }
          router.push("/");
          router.refresh();
        } else {
          setErrorMessage("Check your email for the confirmation link, or sign in if confirmed.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;
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
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 rounded-2xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/50">
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600 transition mb-6"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Customer Portal
          </Link>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white font-bold text-xl shadow-lg shadow-blue-500/30">
            HS
          </div>
          <h2 className="mt-4 text-2xl font-black tracking-tight text-slate-900">
            {isSignUp ? "Create customer account" : "Sign in to HomeServe"}
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            {isSignUp
              ? "Discover verified home professionals and track real-time bookings"
              : "Access your active bookings, service history, and live tracking"}
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="flex rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(false);
              setErrorMessage(null);
            }}
            className={`flex-1 rounded-lg py-2 text-xs font-bold transition ${
              !isSignUp ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
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
              isSignUp ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Register
          </button>
        </div>

        {errorMessage && (
          <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-700">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <>
              <div>
                <label className="text-xs font-semibold text-slate-700">Full Name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Jane Doe"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Phone Number (Optional)</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-700">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="customer@example.com"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-xs font-bold text-white shadow-lg shadow-blue-500/25 transition hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? (
              <span>Processing...</span>
            ) : isSignUp ? (
              <>
                <UserPlus className="h-4 w-4" />
                <span>Create Customer Account</span>
              </>
            ) : (
              <>
                <LogIn className="h-4 w-4" />
                <span>Sign In to Account</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

