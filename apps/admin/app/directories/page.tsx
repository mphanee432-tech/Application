"use client";

import { useEffect, useState } from "react";
import { DirectoriesView } from "../../components/DirectoriesView";
import Link from "next/link";
import { ArrowLeft, AlertCircle, Loader2 } from "lucide-react";
import { getAdminUserRoleAction } from "../actions";

export default function DirectoriesPage() {
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    async function checkRole() {
      try {
        const res = await getAdminUserRoleAction();
        if (res.role !== "super_admin") {
          setAccessDenied(true);
        }
      } catch (err) {
        setAccessDenied(true);
      } finally {
        setLoading(false);
      }
    }
    checkRole();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center space-y-4 shadow-2xl">
          <AlertCircle className="h-12 w-12 text-rose-500 mx-auto" />
          <h2 className="text-xl font-bold text-white">Access Denied</h2>
          <p className="text-xs text-slate-400">
            Platform user directories and complete contact books are restricted strictly to <strong>Super Admins</strong>. Staff members do not have clearance.
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
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 space-y-6">
      <div className="max-w-7xl mx-auto flex items-center justify-between pb-4 border-b border-slate-800">
        <Link
          href="/"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-xs font-semibold text-slate-300 transition"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Admin Dashboard</span>
        </Link>
        <span className="text-xs text-slate-400 font-mono">Platform Directories & KYC</span>
      </div>
      <div className="max-w-7xl mx-auto">
        <DirectoriesView />
      </div>
    </div>
  );
}

