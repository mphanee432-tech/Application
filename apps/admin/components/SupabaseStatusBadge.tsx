"use client";

import { useEffect, useState } from "react";
import { checkSupabaseConnection, type SupabaseHealthResult } from "@repo/db";
import { Database, RefreshCw, AlertCircle, ShieldCheck } from "lucide-react";

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
    <div className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800/90 px-3.5 py-1.5 text-xs text-slate-200 shadow-sm backdrop-blur-sm">
      <Database className="h-3.5 w-3.5 text-indigo-400" />
      <span className="font-semibold text-slate-300">Cluster:</span>

      {loading ? (
        <span className="flex items-center gap-1.5 text-amber-400">
          <RefreshCw className="h-3 w-3 animate-spin" />
          <span>Verifying...</span>
        </span>
      ) : health?.ok ? (
        <span className="flex items-center gap-1.5 text-emerald-400">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400"></span>
          </span>
          <span className="font-medium text-emerald-300">Healthy</span>
          <span className="text-slate-600">|</span>
          <span className="font-mono text-[11px] text-slate-300">{health.projectRef}</span>
          <span className="rounded bg-emerald-950/80 border border-emerald-800 px-1.5 py-0.5 font-mono text-[10px] text-emerald-300">
            {health.latencyMs}ms
          </span>
        </span>
      ) : (
        <span className="flex items-center gap-1.5 text-rose-400" title={health?.error || "Connection failed"}>
          <AlertCircle className="h-3.5 w-3.5" />
          <span className="font-medium">Degraded</span>
        </span>
      )}

      <button
        onClick={testConnection}
        disabled={loading}
        title="Trigger live heartbeat"
        className="ml-1 rounded p-0.5 text-slate-400 hover:bg-slate-700 hover:text-slate-200 disabled:opacity-50"
      >
        <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
      </button>
    </div>
  );
}
