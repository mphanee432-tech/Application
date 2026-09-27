"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createBrowserSupabaseClient,
  getCurrentUser,
  fetchCurrentProfessional,
  fetchCitiesAndServices,
  fetchProfessionalSkills,
  updateProfessionalCity,
  updateProfessionalSkills,
  setProfessionalOnlineStatus,
  type Tables,
} from "@repo/db";
import { saveProfessionalSettingsAction } from "../actions";
import {
  ArrowLeft,
  Settings,
  User,
  MapPin,
  Wrench,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Save,
  Power,
  LogOut,
  ShieldCheck,
  Building,
} from "lucide-react";

export default function ProfessionalSettingsPage() {
  const router = useRouter();
  const supabase = createBrowserSupabaseClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingCity, setSavingCity] = useState(false);
  const [savingSkills, setSavingSkills] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [proRecord, setProRecord] = useState<any>(null);

  // Form State
  const [cities, setCities] = useState<Tables<"cities">[]>([]);
  const [services, setServices] = useState<Tables<"services">[]>([]);
  const [selectedCityId, setSelectedCityId] = useState<string>("");
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([]);
  const [isOnline, setIsOnline] = useState<boolean>(true);

  // Feedback State
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  async function loadData() {
    setLoading(true);
    setFeedback(null);
    try {
      const currentUser = await getCurrentUser(supabase);
      if (!currentUser) {
        router.push("/login");
        return;
      }
      setUser(currentUser);

      const [proResponse, catalog, currentSkills] = await Promise.all([
        fetchCurrentProfessional(supabase),
        fetchCitiesAndServices(supabase),
        fetchProfessionalSkills(currentUser.id, supabase),
      ]);

      if (!proResponse.success) {
        setFeedback({
          type: "error",
          message: proResponse.error || "Failed to load professional account data.",
        });
      } else if (proResponse.data) {
        setProRecord(proResponse.data);
        setSelectedCityId(proResponse.data.city_id || "");
        setIsOnline(proResponse.data.is_online !== false);
      }

      setCities(catalog.cities || []);
      setServices(catalog.services || []);
      setSelectedSkillIds(currentSkills || []);
    } catch (err: any) {
      console.error("Error loading settings data:", err);
      setFeedback({
        type: "error",
        message: err.message || "Failed to load settings.",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleSkill = (serviceId: string) => {
    setSelectedSkillIds((prev) =>
      prev.includes(serviceId)
        ? prev.filter((id) => id !== serviceId)
        : [...prev, serviceId]
    );
  };

  const handleSave = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    const selectedCity = selectedCityId;
    const selectedSkills = selectedSkillIds;
    console.log("Save button clicked! Payload:", { city_id: selectedCity, services: selectedSkills });

    if (!user) {
      setFeedback({ type: "error", message: "User session not found. Please log in." });
      return;
    }
    if (!selectedCity) {
      setFeedback({ type: "error", message: "Please select an operating city." });
      return;
    }

    setSaving(true);
    setSavingCity(true);
    setSavingSkills(true);
    setFeedback(null);

    try {
      const res = await saveProfessionalSettingsAction({
        professionalId: user.id,
        city_id: selectedCity,
        services: selectedSkills,
      });

      if (!res.success) {
        setFeedback({
          type: "error",
          message: res.error || "Failed to update professional settings.",
        });
      } else {
        setFeedback({
          type: "success",
          message: "Operating city and trade skills saved successfully!",
        });
        await loadData();
        router.refresh();
      }
    } catch (err: any) {
      console.error("Save settings error:", err);
      setFeedback({
        type: "error",
        message: err?.message || "An unexpected error occurred while saving.",
      });
    } finally {
      setSaving(false);
      setSavingCity(false);
      setSavingSkills(false);
    }
  };

  const handleSaveCity = handleSave;
  const handleSaveSkills = handleSave;

  const handleToggleOnlineStatus = async () => {
    if (!user || !proRecord) return;
    const newStatus = !isOnline;
    setIsOnline(newStatus);
    try {
      const res = await setProfessionalOnlineStatus(user.id, newStatus, supabase);
      if (!res.success) {
        setIsOnline(!newStatus);
      }
    } catch (err) {
      console.error("Failed to toggle online status:", err);
      setIsOnline(!newStatus);
    }
  };

  const handleSignOut = async () => {
    if (user) {
      try {
        await setProfessionalOnlineStatus(user.id, false, supabase);
      } catch (err) {
        console.error("Failed setting offline on logout:", err);
      }
    }
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
        <p className="text-sm">Loading professional settings & catalog...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Sticky Header */}
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-800 text-xs font-semibold text-slate-300 hover:text-white transition"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Dashboard</span>
            </Link>
            <div className="h-4 w-px bg-slate-800" />
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-emerald-400" />
              <h1 className="text-base font-bold text-white">Settings & Profile Configuration</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-3.5 py-1.5 text-xs font-bold text-white shadow-md shadow-emerald-600/20 disabled:opacity-50 transition"
              title="Save City & Skills"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              <span>Save Settings</span>
            </button>
            <button
              onClick={handleToggleOnlineStatus}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition ${
                isOnline
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                  : "bg-slate-800 text-slate-400 border border-slate-700"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${isOnline ? "bg-emerald-400 animate-pulse" : "bg-slate-500"}`} />
              <span>{isOnline ? "Online" : "Offline"}</span>
            </button>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-rose-400 hover:text-rose-300 transition"
              title="Sign Out"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Form */}
      <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 space-y-8 flex-1">
        {feedback && (
          <div
            className={`rounded-2xl border p-4 text-xs font-medium flex items-center justify-between ${
              feedback.type === "success"
                ? "border-emerald-800 bg-emerald-950/60 text-emerald-300"
                : "border-rose-800 bg-rose-950/60 text-rose-300"
            }`}
          >
            <div className="flex items-center gap-2">
              {feedback.type === "success" ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              )}
              <span>{feedback.message}</span>
            </div>
            <button
              onClick={() => setFeedback(null)}
              className="text-xs opacity-70 hover:opacity-100 ml-4 font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* 1. Account & KYC Overview Card */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30">
              <User className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Professional Account</h2>
              <p className="text-xs text-slate-400">{user?.email}</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className="rounded-md bg-slate-800 border border-slate-700 px-2.5 py-1 text-xs font-bold text-slate-300 uppercase">
                {proRecord?.trade || "General Pro"}
              </span>
              <span className="rounded-md bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-1 text-xs font-bold text-emerald-400 uppercase flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5" />
                {proRecord?.status || "active"}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 text-xs">
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <span className="text-slate-500 block mb-1">Full Name</span>
              <p className="font-semibold text-slate-200">{proRecord?.profile?.full_name || "Not specified"}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <span className="text-slate-500 block mb-1">Contact Phone</span>
              <p className="font-semibold text-slate-200">{proRecord?.profile?.phone || proRecord?.profile?.mobile || "Not specified"}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <span className="text-slate-500 block mb-1">Experience</span>
              <p className="font-semibold text-slate-200">{proRecord?.experience_years ? `${proRecord.experience_years} Years` : "Verified"}</p>
            </div>
          </div>
        </section>

        {/* 2. Operating City Configuration */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
                <MapPin className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Operating City & Dispatch Zone</h2>
                <p className="text-xs text-slate-400">
                  Select the metropolitan region where you accept broadcast jobs and navigate.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                Assigned Operating City
              </label>
              <select
                value={selectedCityId}
                onChange={(e) => setSelectedCityId(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition"
              >
                <option value="">-- Select Your Active City --</option>
                {cities.map((city: any) => (
                  <option key={city.id} value={city.id}>
                    {city.name} {city.state ? `(${city.state})` : ""} {city.id === proRecord?.city_id ? "• Current" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !selectedCityId}
                className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Saving Settings...</span>
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    <span>Save City & Skills</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </section>

        {/* 3. Service Skills & Trade Specialties */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30">
                <Wrench className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Offered Services & Trade Skills</h2>
                <p className="text-xs text-slate-400">
                  Select which job categories you are qualified to perform. Only jobs matching your skills will appear in your live feed.
                </p>
              </div>
            </div>
            <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 text-xs font-bold text-emerald-400">
              {selectedSkillIds.length} Selected
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {services.map((service: any) => {
              const isSelected = selectedSkillIds.includes(service.id);
              return (
                <div
                  key={service.id}
                  onClick={() => handleToggleSkill(service.id)}
                  className={`cursor-pointer rounded-xl border p-4 transition flex flex-col justify-between ${
                    isSelected
                      ? "border-emerald-500 bg-emerald-950/40 text-white shadow-md shadow-emerald-950/30"
                      : "border-slate-800 bg-slate-950/60 text-slate-300 hover:border-slate-700 hover:bg-slate-950"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{service.icon || "🔧"}</span>
                      <strong className="text-sm font-semibold block">{service.name}</strong>
                    </div>
                    <div
                      className={`h-5 w-5 rounded-md border flex items-center justify-center shrink-0 transition ${
                        isSelected
                          ? "border-emerald-500 bg-emerald-500 text-slate-950 font-black"
                          : "border-slate-700 bg-slate-900"
                      }`}
                    >
                      {isSelected && "✓"}
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800/60">
                    <span>Base Payout</span>
                    <span className="font-bold text-emerald-400">${Number(service.base_price).toFixed(2)}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            <p className="text-xs text-slate-400">
              * Changes to your trade skills update the realtime job matching broadcast queue immediately.
            </p>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Saving Settings...</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  <span>Save City & Skills</span>
                </>
              )}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
