"use client";

import { DirectoriesView } from "../../components/DirectoriesView";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function DirectoriesPage() {
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

