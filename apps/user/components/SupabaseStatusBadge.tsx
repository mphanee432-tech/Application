"use client";

import { useEffect, useState } from "react";
import { checkSupabaseConnection, type SupabaseHealthResult } from "@repo/db";
import { CheckCircle2, AlertCircle, RefreshCw, Database } from "lucide-react";

export function SupabaseStatusBadge() {
  const [health, setHealth] = useState<SupabaseHealthResult | null>(null);
  const [loading, setLoading] = useState(true);

  async function testConnection() {
    setLoading(true);
    const result = await checkSupabaseConnection();
    setHealth(result);
    setLoading(false);
  }

  useEffect(() => {
    testConnection();
  }, []);

  return (
    <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs shadow-sm">
      <Database className="h-3.5 w-3.5 text-slate-500" />
      <span className="font-semibold text-slate-700">Supabase:</span>

      {loading ? (
        <span className="flex items-center gap-1.5 text-amber-600">
          <RefreshCw className="h-3 w-3 animate-spin" />
          <span>Verifying connection...</span>
        </span>
      ) : health?.ok ? (
        <span className="flex items-center gap-1.5 text-emerald-600">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
          </span>
          <span className="font-medium">Connected</span>
          <span className="text-slate-400">|</span>
          <span className="font-mono text-[11px] text-slate-600">{health.projectRef}</span>
          <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-mono text-[10px] text-emerald-700">
            {health.latencyMs}ms
          </span>
        </span>
      ) : (
        <span className="flex items-center gap-1.5 text-rose-600" title={health?.error || "Connection failed"}>
          <AlertCircle className="h-3.5 w-3.5" />
          <span className="font-medium">Disconnected</span>
          <span className="font-mono text-[10px] text-rose-500">({health?.error?.slice(0, 24)}...)</span>
        </span>
      )}

      <button
        onClick={testConnection}
        disabled={loading}
        title="Refresh connection test"
        className="ml-1 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
      >
        <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
      </button>
    </div>
  );
}
