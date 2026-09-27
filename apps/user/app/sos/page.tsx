"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createBrowserSupabaseClient,
  getCurrentUser,
  fetchCustomerBookings,
  createSosAlert,
  fetchUserSosAlerts,
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
} from "lucide-react";

export default function UserSosPage() {
  const router = useRouter();
  const [supabase] = useState(() => createBrowserSupabaseClient());

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeBookings, setActiveBookings] = useState<any[]>([]);
  const [sosAlerts, setSosAlerts] = useState<Tables<"sos_alerts">[]>([]);

  // Geolocation State
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [detectingLocation, setDetectingLocation] = useState(false);

  // Form State
  const [reason, setReason] = useState("Immediate Danger / Threatening Behavior");
  const [selectedBookingId, setSelectedBookingId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [triggerSuccess, setTriggerSuccess] = useState<string | null>(null);
  const [triggerError, setTriggerError] = useState<string | null>(null);

  const detectLocation = () => {
    setDetectingLocation(true);
    setGeoError(null);

    if (typeof window !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCoords({
            lat: Number(pos.coords.latitude.toFixed(6)),
            lng: Number(pos.coords.longitude.toFixed(6)),
          });
          setDetectingLocation(false);
        },
        (err) => {
          console.warn("Geolocation error:", err.message);
          setGeoError("Could not auto-detect browser GPS. Using default location coordinates.");
          setCoords({ lat: 37.7749, lng: -122.4194 });
          setDetectingLocation(false);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else {
      setGeoError("Browser does not support geolocation. Default coordinates applied.");
      setCoords({ lat: 37.7749, lng: -122.4194 });
      setDetectingLocation(false);
    }
  };

  const getFreshGpsCoordinates = async (): Promise<{ lat: number; lng: number }> => {
    if (typeof window !== "undefined" && navigator.geolocation) {
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 6000,
            maximumAge: 0,
          });
        });
        const fresh = {
          lat: Number(position.coords.latitude.toFixed(6)),
          lng: Number(position.coords.longitude.toFixed(6)),
        };
        setCoords(fresh);
        return fresh;
      } catch (err: any) {
        console.warn("Could not capture fresh GPS, falling back to state:", err?.message);
      }
    }
    if (coords && coords.lat && coords.lng) {
      return coords;
    }
    return { lat: 37.7749, lng: -122.4194 };
  };

  const loadAlerts = async () => {
    try {
      const alerts = await fetchUserSosAlerts(supabase);
      setSosAlerts(alerts);
    } catch (err) {
      console.error("Error loading user SOS alerts:", err);
    }
  };

  useEffect(() => {
    let channel: any = null;
    let isMounted = true;

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

        detectLocation();

        const [bookings, alerts] = await Promise.all([
          fetchCustomerBookings(supabase),
          fetchUserSosAlerts(supabase),
        ]);
        if (!isMounted) return;

        const inProgress = bookings.filter((b) =>
          ["accepted", "en_route", "in_progress"].includes(b.status)
        );
        setActiveBookings(inProgress);
        if (inProgress.length > 0) {
          setSelectedBookingId(inProgress[0].id);
        }
        setSosAlerts(alerts);

        // Realtime subscription for SOS alerts - chained before subscribe
        const channelName = `user-sos-${currentUser.id}-${Date.now()}`;
        channel = supabase
          .channel(channelName)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "sos_alerts",
              filter: `creator_id=eq.${currentUser.id}`,
            },
            () => {
              if (isMounted) loadAlerts();
            }
          )
          .subscribe();
      } catch (err) {
        console.error("SOS page init error:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    init();

    return () => {
      isMounted = false;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  const handleTriggerSos = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setTriggerError(null);
      setTriggerSuccess(null);

      // Acquire fresh live GPS coordinates at the moment of distress
      const liveCoords = await getFreshGpsCoordinates();

      const alert = await createSosAlert(
        {
          lat: liveCoords.lat,
          lng: liveCoords.lng,
          reason: notes.trim() ? `${reason}: ${notes.trim()}` : reason,
          bookingId: selectedBookingId || undefined,
          creatorRole: "user",
        },
        supabase
      );

      setTriggerSuccess(`EMERGENCY SOS BEACON ACTIVE (Alert #${alert.id.slice(0, 8)}). HQ Dispatch Notified!`);
      setNotes("");
      await loadAlerts();
    } catch (err: any) {
      setTriggerError(err.message || "Failed to trigger emergency alert");
    } finally {
      setSubmitting(false);
    }
  };

  const activeAlert = sosAlerts.find((a) => a.status === "active" || a.status === "dispatched");

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-8 w-8 text-rose-500 animate-spin" />
          <p className="text-sm text-slate-400">Connecting to Trust & Safety Hub...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navigation */}
      <header className="sticky top-0 z-40 border-b border-rose-950 bg-slate-900/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-800 bg-slate-800/60 hover:bg-slate-800 text-xs font-semibold text-slate-300 transition"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Portal</span>
            </Link>
            <div className="h-4 w-px bg-slate-800" />
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-600 text-white font-bold text-sm">
                <ShieldAlert className="h-4 w-4" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-white flex items-center gap-2">
                  Trust & Safety Emergency SOS
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30">
                    24/7 Monitored
                  </span>
                </h1>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="tel:911"
              className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md shadow-rose-600/30 transition animate-pulse"
            >
              <PhoneCall className="h-3.5 w-3.5" />
              <span>Call 911</span>
            </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-5xl w-full px-4 py-8 sm:px-6 space-y-8 flex-1">
        {/* Active Emergency Distress Banner */}
        {activeAlert && (
          <div className="rounded-2xl border-2 border-rose-600 bg-rose-950/70 p-6 text-white shadow-2xl shadow-rose-950/50 space-y-4 animate-in fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-rose-600 flex items-center justify-center shrink-0 animate-ping">
                  <Radio className="h-5 w-5 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-black uppercase tracking-wider">
                      BEACON ACTIVE
                    </span>
                    <h2 className="text-base font-black text-rose-200">
                      Emergency Alert #{activeAlert.id.slice(0, 8)}
                    </h2>
                  </div>
                  <p className="text-xs text-rose-300 mt-0.5">
                    Triggered at {new Date(activeAlert.created_at).toLocaleTimeString()} • HQ Dispatch & Field Supervisors Notified
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={`https://www.google.com/maps?q=${activeAlert.lat},${activeAlert.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-900/80 hover:bg-rose-800 text-xs font-semibold text-rose-100 border border-rose-700 transition"
                >
                  <MapPin className="h-3.5 w-3.5" />
                  <span>View Lat/Lng Pin</span>
                  <ExternalLink className="h-3 w-3 ml-0.5" />
                </a>
              </div>
            </div>

            <div className="rounded-xl bg-black/40 border border-rose-800/60 p-4 text-xs space-y-2">
              <p className="text-rose-200 font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                <span>Reason: {activeAlert.reason}</span>
              </p>
              <p className="text-slate-300">
                GPS Coordinates Transmitted:{" "}
                <span className="font-mono text-rose-300 font-bold">
                  {activeAlert.lat}, {activeAlert.lng}
                </span>
              </p>
              {activeAlert.notes && (
                <p className="text-slate-300 italic">Notes: "{activeAlert.notes}"</p>
              )}
            </div>

            <p className="text-[11px] text-rose-300/80 leading-relaxed">
              Dispatch agents are actively reviewing your case. If you feel your immediate physical safety is compromised, move to a secure location and telephone emergency law enforcement (911).
            </p>
          </div>
        )}

        {/* SOS Trigger Form */}
        <section className="rounded-2xl border border-rose-900/40 bg-slate-900/90 p-6 md:p-8 space-y-6 shadow-xl">
          <div>
            <div className="flex items-center gap-2 text-rose-400 text-xs font-bold uppercase tracking-wider mb-1">
              <Radio className="h-4 w-4 animate-pulse" />
              <span>Instant Dispatch Beacon</span>
            </div>
            <h2 className="text-xl font-black text-white">Trigger Emergency Distress Call</h2>
            <p className="text-xs text-slate-400 mt-1">
              Use this tool if you encounter an unsafe situation, suspicious behavior, or medical emergency during a service appointment.
            </p>
          </div>

          {triggerSuccess && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-800/80 bg-emerald-950/40 p-4 text-xs text-emerald-300">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
              <span>{triggerSuccess}</span>
            </div>
          )}

          {triggerError && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-800/80 bg-rose-950/40 p-4 text-xs text-rose-300">
              <AlertCircle className="h-5 w-5 shrink-0 text-rose-400" />
              <span>{triggerError}</span>
            </div>
          )}

          <form onSubmit={handleTriggerSos} className="space-y-5">
            {/* GPS Coordinates readout */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-rose-400" />
                  <span>Current GPS Coordinates:</span>
                </span>
                <button
                  type="button"
                  onClick={detectLocation}
                  disabled={detectingLocation}
                  className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition"
                >
                  <RefreshCw className={`h-3 w-3 ${detectingLocation ? "animate-spin" : ""}`} />
                  <span>Re-detect Location</span>
                </button>
              </div>

              {coords ? (
                <div className="flex items-center gap-3 text-xs font-mono text-slate-300">
                  <span className="px-2 py-1 rounded bg-slate-900 border border-slate-800">
                    Lat: <strong className="text-emerald-400">{coords.lat}</strong>
                  </span>
                  <span className="px-2 py-1 rounded bg-slate-900 border border-slate-800">
                    Lng: <strong className="text-emerald-400">{coords.lng}</strong>
                  </span>
                  <span className="text-[11px] text-slate-500">Ready to broadcast</span>
                </div>
              ) : (
                <p className="text-xs text-amber-400">Detecting satellite GPS coordinates...</p>
              )}

              {geoError && (
                <p className="text-[11px] text-amber-400/90">{geoError}</p>
              )}
            </div>

            {/* Emergency Reason */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                Emergency Situation / Reason
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-xs text-white focus:border-rose-500 focus:outline-none"
              >
                <option value="Immediate Danger / Threatening Behavior">
                  Immediate Danger / Threatening Behavior
                </option>
                <option value="Intruder / Unverified Provider">
                  Intruder / Unverified Provider on Site
                </option>
                <option value="Medical Emergency / Physical Injury">
                  Medical Emergency / Physical Injury
                </option>
                <option value="Severe Property Damage / Utility Hazard">
                  Severe Property Damage / Utility Hazard (Fire/Gas/Flood)
                </option>
                <option value="Other Urgent Safety Concern">
                  Other Urgent Safety Concern
                </option>
              </select>
            </div>

            {/* Associate with Active Booking */}
            {activeBookings.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  Link to Active Appointment (Optional)
                </label>
                <select
                  value={selectedBookingId}
                  onChange={(e) => setSelectedBookingId(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-xs text-white focus:border-rose-500 focus:outline-none"
                >
                  <option value="">-- No specific booking --</option>
                  {activeBookings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.service_type || b.service?.name || "Service"} ({b.status}) - {b.address}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Additional details */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                Emergency Notes / Immediate Circumstances
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Describe your current status, apartment number, or urgent instructions for dispatch..."
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:border-rose-500 focus:outline-none"
              />
            </div>

            {/* Giant SOS Button */}
            <button
              type="submit"
              disabled={submitting || !coords}
              className="w-full py-4 rounded-2xl bg-rose-600 hover:bg-rose-500 active:bg-rose-700 disabled:opacity-50 text-white font-black text-sm uppercase tracking-wider shadow-2xl shadow-rose-600/40 transition flex items-center justify-center gap-2 group"
            >
              {submitting ? (
                <>
                  <RefreshCw className="h-5 w-5 animate-spin" />
                  <span>Transmitting SOS Beacon...</span>
                </>
              ) : (
                <>
                  <ShieldAlert className="h-5 w-5 group-hover:scale-110 transition-transform" />
                  <span>TRANSMIT EMERGENCY SOS BEACON NOW</span>
                </>
              )}
            </button>
          </form>
        </section>

        {/* SOS History */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-slate-400" />
              <h2 className="text-sm font-bold text-white">Your SOS Incident History</h2>
              <span className="text-xs text-slate-500">({sosAlerts.length} logged)</span>
            </div>
            <button
              onClick={loadAlerts}
              className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition"
            >
              <RefreshCw className="h-3 w-3" />
              <span>Refresh</span>
            </button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
            {sosAlerts.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
                <ShieldCheck className="h-8 w-8 text-emerald-500/50" />
                <span>No emergency alerts filed. Your account has a clean safety record.</span>
              </div>
            ) : (
              <div className="divide-y divide-slate-800/60">
                {sosAlerts.map((alert) => (
                  <div key={alert.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-800/30 transition">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            alert.status === "active"
                              ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                              : alert.status === "dispatched"
                              ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                              : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          }`}
                        >
                          {alert.status}
                        </span>
                        <span className="text-xs font-bold text-white">
                          Incident #{alert.id.slice(0, 8)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300">{alert.reason}</p>
                      <p className="text-[11px] text-slate-500">
                        {new Date(alert.created_at).toLocaleString()} • Lat: {alert.lat}, Lng: {alert.lng}
                      </p>
                    </div>

                    {alert.status === "resolved" && (
                      <div className="text-right text-[11px] text-emerald-400">
                        Resolved {alert.resolved_at ? new Date(alert.resolved_at).toLocaleDateString() : ""}
                      </div>
                    )}
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
