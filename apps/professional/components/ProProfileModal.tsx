"use client";

import { useEffect, useState } from "react";
import {
  createBrowserSupabaseClient,
  updateProfessionalProfile,
  getCurrentUser,
  fetchCurrentProfessional,
} from "@repo/db";
import {
  User,
  Phone,
  Mail,
  Briefcase,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
} from "lucide-react";

interface ProProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProfileUpdated?: () => void;
}

export function ProProfileModal({
  isOpen,
  onClose,
  onProfileUpdated,
}: ProProfileModalProps) {
  const supabase = createBrowserSupabaseClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [trade, setTrade] = useState("HVAC Technician");

  const loadProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(false);

      const user = await getCurrentUser(supabase);
      if (!user) throw new Error("No authenticated provider session.");

      setEmail(user.email || "");

      const proRes = await fetchCurrentProfessional(supabase);
      const proData = proRes.success ? proRes.data : null;
      if (proData) {
        setFullName(proData.profile?.full_name || (user.user_metadata?.full_name ?? ""));
        setMobile(proData.profile?.mobile || proData.profile?.phone || "");
        setTrade(proData.trade || "Certified Specialist");
      } else {
        setFullName(user.user_metadata?.full_name || "");
      }
    } catch (err: any) {
      setError(err.message || "Failed to load provider profile.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadProfile();
    }
  }, [isOpen]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      await updateProfessionalProfile(
        {
          full_name: fullName.trim(),
          mobile: mobile.trim(),
          trade: trade.trim(),
        },
        supabase
      );

      // Also update auth user_metadata so header updates immediately
      await supabase.auth.updateUser({
        data: { full_name: fullName.trim() },
      });

      setSuccess(true);
      if (onProfileUpdated) onProfileUpdated();
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      setError(err.message || "Failed to update professional profile.");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm text-slate-100">
      <div className="flex w-full max-w-md flex-col rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-emerald-600/10 p-2 text-emerald-400 border border-emerald-500/20">
              <User className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Provider Profile</h2>
              <p className="text-xs text-slate-400">Trade discipline & emergency contact</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-800 bg-rose-950/40 p-3 text-xs text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-800 bg-emerald-950/40 p-3 text-xs text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>Provider details updated!</span>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-8 text-xs text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin mr-2 text-emerald-400" />
              Loading profile details...
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Full Name / Legal Name
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. John Miller"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
                  <input
                    type="email"
                    disabled
                    value={email}
                    className="w-full pl-9 pr-3 py-2 bg-slate-950/50 border border-slate-800 rounded-xl text-xs text-slate-400 cursor-not-allowed"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Primary Mobile Number
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
                  <input
                    type="tel"
                    required
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    placeholder="+1 (555) 234-5678"
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Customers use this number to contact you when you are en route.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Trade / Service Specialty
                </label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
                  <input
                    type="text"
                    required
                    value={trade}
                    onChange={(e) => setTrade(e.target.value)}
                    placeholder="e.g. Master Electrician, Plumbing Expert"
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl border border-slate-700 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white disabled:opacity-50 transition flex items-center gap-1.5"
                >
                  {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>Save Profile</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
