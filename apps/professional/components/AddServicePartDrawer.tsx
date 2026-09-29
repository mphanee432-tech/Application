"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Plus,
  Camera,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  Loader2,
  Trash2,
  Wrench,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import {
  createBrowserSupabaseClient,
  createBookingAddon,
  fetchBookingAddons,
  type Tables,
} from "@repo/db";
import { deleteJobAddonAction } from "../app/actions";

interface AddServicePartDrawerProps {
  isOpen: boolean;
  booking: any;
  onClose: () => void;
  onAddonCreated?: () => void;
}

export function AddServicePartDrawer({
  isOpen,
  booking,
  onClose,
  onAddonCreated,
}: AddServicePartDrawerProps) {
  const [supabase] = useState(() => createBrowserSupabaseClient("professional"));
  const [mode, setMode] = useState<"catalog" | "custom">("custom");
  const [catalogServices, setCatalogServices] = useState<any[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<string>("");
  const [customDescription, setCustomDescription] = useState("");
  const [cost, setCost] = useState<string>("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const [addons, setAddons] = useState<any[]>([]);
  const [loadingAddons, setLoadingAddons] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingAddonId, setDeletingAddonId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Load catalog services and current booking addons
  useEffect(() => {
    if (!isOpen || !booking) return;

    let isMounted = true;

    async function loadData() {
      try {
        setLoadingAddons(true);
        const [svcsRes, addonsRes] = await Promise.all([
          supabase.from("services").select("id, name, base_price, icon").eq("is_active", true),
          fetchBookingAddons(booking.id, supabase),
        ]);

        if (isMounted) {
          setCatalogServices(svcsRes.data || []);
          setAddons(addonsRes.success ? (addonsRes.data || []) : []);
        }
      } catch (err: any) {
        console.error("Error loading addon drawer data:", err);
      } finally {
        if (isMounted) setLoadingAddons(false);
      }
    }

    loadData();

    // Realtime subscription for status changes on addons
    const channelName = `pro-addons-${booking.id}-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "job_addons",
          filter: `booking_id=eq.${booking.id}`,
        },
        async (payload: any) => {
          if (!isMounted) return;
          if (payload.eventType === "INSERT" && payload.new) {
            setAddons((prev) => [payload.new, ...prev.filter((a) => a.id !== payload.new.id)]);
          } else if (payload.eventType === "UPDATE" && payload.new) {
            setAddons((prev) => prev.map((a) => (a.id === payload.new.id ? { ...a, ...payload.new } : a)));
          } else if (payload.eventType === "DELETE" && payload.old) {
            setAddons((prev) => prev.filter((a) => a.id !== payload.old.id));
          }
          onAddonCreated?.();

          // Sync full join records asynchronously in background
          const res = await fetchBookingAddons(booking.id, supabase);
          if (isMounted && res.success && Array.isArray(res.data)) {
            setAddons(res.data);
          }
        }
      );
    channel.subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [isOpen, booking, supabase]);

  if (!isOpen || !booking) return null;

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setPhotoFile(file);
    if (file) {
      setPhotoPreview(URL.createObjectURL(file));
    } else {
      setPhotoPreview(null);
    }
  };

  const handleCatalogSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const svcId = e.target.value;
    setSelectedServiceId(svcId);
    const svc = catalogServices.find((s) => s.id === svcId);
    if (svc) {
      setCost(String(svc.base_price || ""));
      setCustomDescription(svc.name);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const numericCost = parseFloat(cost);
    if (isNaN(numericCost) || numericCost <= 0) {
      setError("Please specify a valid add-on price greater than ₹0.");
      return;
    }

    const description = mode === "catalog"
      ? catalogServices.find((s) => s.id === selectedServiceId)?.name || customDescription
      : customDescription;

    if (!description.trim()) {
      setError("Please provide a description or select a service.");
      return;
    }

    try {
      setSubmitting(true);
      const res = await createBookingAddon(
        {
          bookingId: booking.id,
          serviceId: mode === "catalog" ? selectedServiceId || undefined : undefined,
          customDescription: description.trim(),
          cost: numericCost,
          photoFileOrUrl: photoFile || undefined,
        },
        supabase
      );

      if (!res.success) {
        throw new Error(res.error || "Failed to submit add-on proposal.");
      }

      setSuccessMsg(`Add-on "${description}" sent to customer for approval!`);
      // Reset form
      setCustomDescription("");
      setCost("");
      setSelectedServiceId("");
      setPhotoFile(null);
      setPhotoPreview(null);

      // Refresh list
      const refreshed = await fetchBookingAddons(booking.id, supabase);
      setAddons(refreshed.success ? (refreshed.data || []) : []);
      onAddonCreated?.();
    } catch (err: any) {
      console.error("Submit addon error:", err);
      setError(err.message || "Failed to submit add-on.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAddon = async (addonId: string) => {
    try {
      setDeletingAddonId(addonId);
      setError(null);
      const res = await deleteJobAddonAction(addonId);
      if (!res.success) {
        throw new Error(res.error || "Failed to delete add-on.");
      }
      setSuccessMsg("Pending add-on deleted successfully.");
      const refreshed = await fetchBookingAddons(booking.id, supabase);
      setAddons(refreshed.success ? (refreshed.data || []) : []);
      onAddonCreated?.();
    } catch (err: any) {
      console.error("Delete addon error:", err);
      setError(err?.message || "Failed to delete add-on.");
    } finally {
      setDeletingAddonId(null);
    }
  };

  const pendingCount = addons.filter((a) => a.status === "pending").length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-5 text-slate-100 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-start border-b border-slate-800 pb-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-800/40">
              <Sparkles className="h-3.5 w-3.5" /> Mid-Job Upsell & Material Add-on
            </div>
            <h3 className="text-lg font-bold text-white mt-1">
              Propose Add-on for Order #{booking.id.slice(0, 8)}
            </h3>
            <p className="text-xs text-slate-400">
              Suggest extra labor or parts. The customer must approve before it is added to the invoice.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Status Alerts */}
        {error && (
          <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-xl text-xs text-red-300 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        {pendingCount > 0 && (
          <div className="p-3 bg-amber-950/40 border border-amber-800/60 rounded-xl text-xs text-amber-300 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 shrink-0 text-amber-400 animate-pulse" />
              <span>
                <strong>{pendingCount} Add-on Pending Customer Approval:</strong> Job completion is locked until the customer decides.
              </span>
            </div>
          </div>
        )}

        {/* Existing Addons for Booking */}
        {addons.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Booking Add-ons & Upsell History ({addons.length})
            </h4>
            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {addons.map((a) => (
                <div
                  key={a.id}
                  className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    {a.photo_url ? (
                      <a
                        href={a.photo_url}
                        target="_blank"
                        rel="noreferrer"
                        className="h-10 w-10 rounded-lg overflow-hidden border border-slate-700 shrink-0 block"
                        title="View photo proof"
                      >
                        <img src={a.photo_url} alt="Proof" className="w-full h-full object-cover" />
                      </a>
                    ) : (
                      <div className="h-10 w-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                        <Wrench className="h-4 w-4 text-slate-500" />
                      </div>
                    )}
                    <div>
                      <p className="font-semibold text-white">
                        {a.custom_description || a.service?.name || "Additional Service"}
                      </p>
                      <p className="text-[11px] text-slate-400 font-mono">
                        ₹{Number(a.cost || 0).toFixed(2)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {a.status === "approved" ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        <CheckCircle2 className="h-3 w-3" />
                        Approved
                      </span>
                    ) : a.status === "declined" ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                        <XCircle className="h-3 w-3" />
                        Declined
                      </span>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse">
                          <Clock className="h-3 w-3" />
                          Pending Approval
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteAddon(a.id)}
                          disabled={deletingAddonId === a.id}
                          className="p-1.5 rounded-lg bg-red-950/60 hover:bg-red-900 border border-red-800/80 text-red-300 hover:text-white transition disabled:opacity-50"
                          title="Delete pending add-on"
                        >
                          {deletingAddonId === a.id ? (
                            <Loader2 className="h-3 w-3 animate-spin text-red-400" />
                          ) : (
                            <Trash2 className="h-3 w-3 text-red-400" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Suggest Add-on Form */}
        <form onSubmit={handleSubmit} className="space-y-4 pt-2 border-t border-slate-800">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-200">Propose New Add-on</h4>
            <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[11px]">
              <button
                type="button"
                onClick={() => setMode("custom")}
                className={`px-2.5 py-1 rounded-md transition ${
                  mode === "custom"
                    ? "bg-emerald-600 text-white font-semibold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Custom Work / Parts
              </button>
              <button
                type="button"
                onClick={() => setMode("catalog")}
                className={`px-2.5 py-1 rounded-md transition ${
                  mode === "catalog"
                    ? "bg-emerald-600 text-white font-semibold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Catalog Item
              </button>
            </div>
          </div>

          {mode === "catalog" ? (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Select Catalog Service
              </label>
              <select
                value={selectedServiceId}
                onChange={handleCatalogSelect}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                required
              >
                <option value="">-- Choose catalog service --</option>
                {catalogServices.map((svc) => (
                  <option key={svc.id} value={svc.id}>
                    {svc.name} (₹{Number(svc.base_price || 0).toFixed(2)})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Add-on Description & Scope
              </label>
              <input
                type="text"
                value={customDescription}
                onChange={(e) => setCustomDescription(e.target.value)}
                placeholder="e.g., Heavy oil degreasing, Copper pipe replacement, Extra room"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                required
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Add-on Cost (₹ INR)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-500">₹</span>
              <input
                type="number"
                step="0.01"
                min="1"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 pl-9 pr-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                required
              />
            </div>
          </div>

          {/* Photo Evidence Upload */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Photo Evidence (Proof of Need / Dirty condition)
            </label>
            <div className="flex items-center gap-3">
              <label className="flex-1 cursor-pointer border border-dashed border-slate-700 hover:border-emerald-500 bg-slate-950/60 rounded-xl p-3 flex flex-col items-center justify-center text-xs text-slate-400 transition">
                <Camera className="h-5 w-5 text-emerald-400 mb-1" />
                <span>{photoFile ? photoFile.name : "Attach photo from device/camera"}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoSelect}
                  className="hidden"
                />
              </label>
              {photoPreview && (
                <div className="h-14 w-14 rounded-xl overflow-hidden border border-emerald-500/50 shrink-0">
                  <img src={photoPreview} alt="Preview" className="h-full w-full object-cover" />
                </div>
              )}
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              Uploaded directly to the secure proof-of-work vault for customer and admin verification.
            </p>
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !cost || (!customDescription && !selectedServiceId)}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-xs font-bold text-white shadow-lg shadow-emerald-950 flex items-center gap-2 transition"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Transmitting Proposal...</span>
                </>
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5" />
                  <span>Send Add-on Proposal</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddServicePartDrawer;

