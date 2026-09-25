"use client";

import { useEffect, useState } from "react";
import {
  createBrowserSupabaseClient,
  fetchActiveCities,
  fetchActiveServices,
  submitProfessionalKycOnboarding,
  getCurrentUser,
  type Tables,
} from "@repo/db";
import { ShieldCheck, Upload, Building2, Wrench, AlertCircle, Loader2, X } from "lucide-react";

interface KycOnboardingModalProps {
  cities?: Tables<"cities">[];
  services?: Tables<"services">[];
  userId?: string;
  isOpen?: boolean;
  onClose?: () => void;
  onSuccess: () => void;
}

export default function KycOnboardingModal({
  cities: propCities,
  services: propServices,
  userId: propUserId,
  isOpen = true,
  onClose,
  onSuccess,
}: KycOnboardingModalProps) {
  const supabase = createBrowserSupabaseClient();

  const [cities, setCities] = useState<Tables<"cities">[]>(propCities || []);
  const [services, setServices] = useState<Tables<"services">[]>(propServices || []);
  const [userId, setUserId] = useState<string>(propUserId || "");
  const [selectedCityId, setSelectedCityId] = useState<string>("");
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    async function initData() {
      try {
        if (!propCities || propCities.length === 0) {
          const fetchedCities = await fetchActiveCities(supabase);
          setCities(fetchedCities);
          if (fetchedCities[0] && !selectedCityId) {
            setSelectedCityId(fetchedCities[0].id);
          }
        } else if (propCities[0] && !selectedCityId) {
          setSelectedCityId(propCities[0].id);
        }

        if (!propServices || propServices.length === 0) {
          const fetchedServices = await fetchActiveServices(supabase);
          setServices(fetchedServices);
        }

        if (!propUserId) {
          const user = await getCurrentUser(supabase);
          if (user) setUserId(user.id);
        }
      } catch (err: any) {
        console.error("Error loading KYC onboarding prerequisites:", err);
      }
    }

    if (isOpen) {
      initData();
    }
  }, [isOpen]);

  const toggleService = (id: string) => {
    setSelectedServiceIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCityId) {
      setErrorMsg("Please select your primary operating city.");
      return;
    }
    if (selectedServiceIds.length === 0) {
      setErrorMsg("Please select at least one trade or service skill.");
      return;
    }
    if (!file) {
      setErrorMsg("Please upload your trade license, ID, or certificate for verification.");
      return;
    }

    try {
      setUploading(true);
      setErrorMsg(null);

      // Upload to kyc-documents Supabase Storage bucket
      const effectiveUserId = userId || (await getCurrentUser(supabase))?.id || "pro";
      const fileExt = file.name.split(".").pop();
      const fileName = `${effectiveUserId}/${Date.now()}_kyc.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("kyc-documents")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) {
        throw new Error(`Document upload failed: ${uploadError.message}`);
      }

      const { data: publicUrlData } = supabase.storage
        .from("kyc-documents")
        .getPublicUrl(uploadData.path);

      // Submit onboarding details via @repo/db helper
      await submitProfessionalKycOnboarding(
        {
          cityId: selectedCityId,
          serviceIds: selectedServiceIds,
          documentPath: publicUrlData.publicUrl || uploadData.path,
        },
        supabase
      );

      onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to submit KYC onboarding");
    } finally {
      setUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 overflow-y-auto">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6 my-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20 font-bold">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Provider Verification & Onboarding</h2>
              <p className="text-xs text-slate-400">Complete your profile to receive live customer dispatches</p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Step 1: Operating City */}
          <div>
            <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5 mb-2">
              <Building2 className="h-4 w-4 text-emerald-400" /> 1. Select Primary Operating City
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {cities.map((city) => (
                <button
                  key={city.id}
                  type="button"
                  onClick={() => setSelectedCityId(city.id)}
                  className={`p-2.5 rounded-xl border text-xs font-semibold text-left transition-all ${
                    selectedCityId === city.id
                      ? "border-emerald-500 bg-emerald-500/20 text-emerald-300 shadow-md shadow-emerald-500/10"
                      : "border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  {city.name}
                </button>
              ))}
            </div>
          </div>

          {/* Step 2: Trade Specialization */}
          <div>
            <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5 mb-2">
              <Wrench className="h-4 w-4 text-emerald-400" /> 2. Select Your Trades & Services
            </label>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
              {services.map((svc) => {
                const isSelected = selectedServiceIds.includes(svc.id);
                return (
                  <button
                    key={svc.id}
                    type="button"
                    onClick={() => toggleService(svc.id)}
                    className={`p-2.5 rounded-xl border text-xs font-medium text-left transition-all flex items-center justify-between ${
                      isSelected
                        ? "border-emerald-500 bg-emerald-500/20 text-emerald-300 shadow-md shadow-emerald-500/10"
                        : "border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <span>{svc.name}</span>
                    <span className="font-mono text-[10px] text-slate-500">${Number(svc.base_price).toFixed(0)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 3: Government ID or Trade License Upload */}
          <div>
            <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5 mb-2">
              <Upload className="h-4 w-4 text-emerald-400" /> 3. Upload ID / Trade License (PDF, JPG, PNG)
            </label>
            <div className="border border-dashed border-slate-700 hover:border-emerald-500/60 rounded-xl p-4 text-center bg-slate-950/40 transition">
              <input
                type="file"
                id="kyc-doc-file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              <label htmlFor="kyc-doc-file" className="cursor-pointer block">
                {file ? (
                  <div className="text-xs text-emerald-400 font-semibold flex items-center justify-center gap-2">
                    <ShieldCheck className="h-4 w-4" />
                    <span>{file.name} ({(file.size / 1024).toFixed(0)} KB)</span>
                  </div>
                ) : (
                  <div>
                    <Upload className="h-6 w-6 text-slate-500 mx-auto mb-1.5" />
                    <span className="text-xs text-slate-300 font-semibold block">
                      Click to choose document or photo
                    </span>
                    <span className="text-[10px] text-slate-500">Max size 10MB</span>
                  </div>
                )}
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={uploading}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/20 transition flex items-center gap-2 disabled:opacity-50"
            >
              {uploading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>{uploading ? "Submitting Application..." : "Submit KYC Verification"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
