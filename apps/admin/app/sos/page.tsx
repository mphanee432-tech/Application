"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createBrowserSupabaseClient,
  getCurrentUser,
  fetchActiveSosAlertsAdmin,
  resolveSosAlertAdmin,
  type Tables,
} from "@repo/db";
import {
  ShieldAlert,
  AlertTriangle,
  PhoneCall,
  MapPin,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  RefreshCw,
  Radio,
  ExternalLink,
  ShieldCheck,
  Check,
  User,
  Building,
} from "lucide-react";

// Dynamically import Leaflet Emergency Map to avoid SSR errors
const EmergencyDispatchMap = dynamic(
  () => import("../../components/EmergencyDispatchMap"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[460px] rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-xs text-slate-500">
        <div className="flex flex-col items-center gap-2">
          <RefreshCw className="h-6 w-6 text-rose-500 animate-spin" />
          <span>Loading Emergency Dispatch Map...</span>
        </div>
      </div>
    ),
  }
);

export default function AdminSosHubPage() {
  const router = useRouter();
  const [supabase] = useState(() => createBrowserSupabaseClient());

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadAlerts = async () => {
    const result = await fetchActiveSosAlertsAdmin(supabase);
    if (result.success && Array.isArray(result.data)) {
      setAlerts(result.data);
    } else {
      console.error("Failed to load SOS alerts:", result.error);
      setAlerts([]); // always keep alerts as a safe empty array, never undefined/object
    }
  };

  useEffect(() => {
    let isMounted = true;

    // Decoupled Realtime subscription: established immediately on mount
    const channel = supabase
      .channel("admin-sos-channel")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "sos_alerts" },
        (payload) => {
          if (!isMounted) return;
          console.log("Admin SOS Realtime alert received:", payload);
          loadAlerts();
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "sos_alerts" },
        () => {
          if (!isMounted) return;
          loadAlerts();
        }
      )
      .subscribe();

    async function init() {
      try {
        setLoading(true);
        const currentUser = await getCurrentUser(supabase);
        if (!isMounted) return;
        if (!currentUser) {
          router.push("/login?redirect=/sos");
          return;
        }
        setUser(currentUser);
        await loadAlerts();
      } catch (err) {
        console.error("Admin SOS hub init error:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    init();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const handleResolveAlert = async (alertId: string) => {
    try {
      setResolvingId(alertId);
      setFeedback(null);

      const notes = resolutionNotes[alertId] || "Resolved by Admin Dispatch Ops";
      await resolveSosAlertAdmin(alertId, notes, supabase);

      setFeedback({
        type: "success",
        text: `Emergency SOS #${alertId.slice(0, 8)} marked as RESOLVED.`,
      });
      await loadAlerts();
    } catch (err: any) {
      setFeedback({
        type: "error",
        text: err.message || "Failed to resolve alert",
      });
    } finally {
      setResolvingId(null);
    }
  };

  const activeAlerts = alerts.filter(
    (a) => a.status === "active" || a.status === "dispatched"
  );
  const resolvedAlerts = alerts.filter((a) => a.status === "resolved");

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-8 w-8 text-rose-500 animate-spin" />
          <p className="text-sm text-slate-400">Loading Live Emergency Dispatch Center...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Header */}
      <header className="sticky top-0 z-40 border-b border-rose-950 bg-slate-900/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-800 bg-slate-800/60 hover:bg-slate-800 text-xs font-semibold text-slate-300 transition"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Command Center</span>
            </Link>
            <div className="h-4 w-px bg-slate-800" />
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-600 text-white font-bold text-sm">
                <ShieldAlert className="h-4 w-4" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-white flex items-center gap-2">
                  Emergency Dispatch & Safety Ops
                  {activeAlerts.length > 0 ? (
                    <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-rose-500 text-white font-black uppercase tracking-wider animate-pulse">
                      <Radio className="h-3 w-3" />
                      {activeAlerts.length} Active Distress
                    </span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      All Clear
                    </span>
                  )}
                </h1>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadAlerts}
              className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 transition"
            >
              <RefreshCw className="h-3 w-3" />
              <span>Refresh Dispatch</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl w-full px-4 py-8 sm:px-6 space-y-8 flex-1">
        {feedback && (
          <div
            className={`flex items-center gap-2 rounded-xl border p-4 text-xs font-medium ${
              feedback.type === "success"
                ? "border-emerald-800/80 bg-emerald-950/40 text-emerald-300"
                : "border-rose-800/80 bg-rose-950/40 text-rose-300"
            }`}
          >
            {feedback.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            )}
            <span>{feedback.text}</span>
          </div>
        )}

        {/* Live Interactive Emergency Map */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-rose-500" />
              <h2 className="text-sm font-bold text-white">Live Emergency Dispatch Map</h2>
              <span className="text-xs text-slate-500">
                ({activeAlerts.length} active pins / {alerts.length} total)
              </span>
            </div>
          </div>

          <EmergencyDispatchMap alerts={alerts} />
        </section>

        {/* Active Emergency Incident Desk */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-rose-500 animate-pulse" />
            <h2 className="text-sm font-bold text-white">Active Distress Calls Requiring Response</h2>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-600 text-white">
              {activeAlerts.length}
            </span>
          </div>

          {activeAlerts.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-2">
              <ShieldCheck className="h-8 w-8 text-emerald-500/60" />
              <span className="text-slate-400 font-semibold">Zero active emergencies across the platform.</span>
              <span className="text-slate-500 text-[11px]">Dispatch listening in real-time for customer & pro beacons.</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {activeAlerts.map((alert) => {
                const victimName = alert.creator?.full_name || alert.creator?.email || "Unknown";
                const victimPhone = alert.creator?.phone || alert.creator?.mobile;

                return (
                  <div
                    key={alert.id}
                    className="rounded-2xl border-2 border-rose-600/80 bg-slate-900 p-6 space-y-4 shadow-xl shadow-rose-950/40"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-600 text-white">
                            {alert.status}
                          </span>
                          <span className="text-xs font-bold text-slate-400">
                            Incident #{alert.id.slice(0, 8)}
                          </span>
                          <span className="text-xs text-rose-400 font-semibold">
                            Role: {alert.creator_role === "professional" ? "Field Professional" : "Customer"}
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-white mt-1">
                          {alert.reason}
                        </h3>
                        <p className="text-xs text-slate-400">
                          Reported: {new Date(alert.created_at).toLocaleString()}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {victimPhone && (
                          <a
                            href={`tel:${victimPhone}`}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-md shadow-rose-600/25"
                          >
                            <PhoneCall className="h-3.5 w-3.5" />
                            <span>Call Victim ({victimPhone})</span>
                          </a>
                        )}

                        <a
                          href={`https://www.google.com/maps?q=${alert.lat},${alert.lng}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition"
                        >
                          <MapPin className="h-3.5 w-3.5 text-rose-400" />
                          <span>Google Maps Pin</span>
                          <ExternalLink className="h-3 w-3 ml-0.5" />
                        </a>
                      </div>
                    </div>

                    {/* Metadata breakdown */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 rounded-xl bg-slate-950/80 border border-slate-800 p-4 text-xs">
                      <div>
                        <span className="text-slate-500 block text-[10px] uppercase font-bold">Victim Contact</span>
                        <p className="text-white font-medium">{victimName}</p>
                        <p className="text-slate-400">{alert.creator?.email}</p>
                      </div>

                      <div>
                        <span className="text-slate-500 block text-[10px] uppercase font-bold">Exact GPS Coordinates</span>
                        <p className="font-mono text-emerald-400 font-bold">
                          {alert.lat}, {alert.lng}
                        </p>
                        <p className="text-slate-400 text-[11px]">Satellite lock confirmed</p>
                      </div>

                      <div>
                        <span className="text-slate-500 block text-[10px] uppercase font-bold">Associated Booking</span>
                        {alert.booking ? (
                          <p className="text-slate-300">
                            Booking #{alert.booking.id?.slice(0, 8)} ({alert.booking.status})
                          </p>
                        ) : (
                          <p className="text-slate-500 italic">None attached</p>
                        )}
                      </div>
                    </div>

                    {/* Resolution input & submit */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2 border-t border-slate-800">
                      <input
                        type="text"
                        value={resolutionNotes[alert.id] || ""}
                        onChange={(e) =>
                          setResolutionNotes({ ...resolutionNotes, [alert.id]: e.target.value })
                        }
                        placeholder="Enter resolution notes (e.g. Dispatched local police / confirmed customer safe)..."
                        className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-xs text-white placeholder-slate-500 focus:border-rose-500 focus:outline-none"
                      />
                      <button
                        onClick={() => handleResolveAlert(alert.id)}
                        disabled={resolvingId === alert.id}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shrink-0 shadow-md shadow-emerald-600/20"
                      >
                        {resolvingId === alert.id ? (
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Check className="h-3.5 w-3.5" />
                        )}
                        <span>Mark as Resolved</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Resolved SOS Incident Archive */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-slate-400" />
              <h2 className="text-sm font-bold text-white">Resolved Safety Incidents Archive</h2>
              <span className="text-xs text-slate-500">({resolvedAlerts.length} resolved)</span>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
            {resolvedAlerts.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                No past resolved incidents on record.
              </div>
            ) : (
              <div className="divide-y divide-slate-800/60">
                {resolvedAlerts.map((alert) => (
                  <div key={alert.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
                          Resolved
                        </span>
                        <span className="font-bold text-white">{alert.reason}</span>
                        <span className="text-slate-500">({alert.creator_role})</span>
                      </div>
                      <p className="text-slate-400 mt-1">
                        Victim: {alert.creator?.full_name || alert.creator?.email} • Lat/Lng: {alert.lat}, {alert.lng}
                      </p>
                      {alert.notes && (
                        <p className="text-slate-300 mt-1 italic">
                          Resolution: "{alert.notes}" (by {alert.resolver?.full_name || "Admin"})
                        </p>
                      )}
                    </div>
                    <div className="text-right text-[11px] text-slate-500">
                      {new Date(alert.resolved_at || alert.created_at).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
