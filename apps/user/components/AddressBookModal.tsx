"use client";

import { useEffect, useState } from "react";
import {
  createBrowserSupabaseClient,
  fetchCustomerAddresses,
  createCustomerAddress,
  updateCustomerAddress,
  deleteCustomerAddress,
  setDefaultCustomerAddress,
  type Tables,
} from "@repo/db";
import {
  MapPin,
  Plus,
  Trash2,
  Edit2,
  Check,
  Star,
  X,
  Loader2,
  AlertCircle,
  Home,
} from "lucide-react";

interface AddressBookModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAddress?: (addr: Tables<"customer_addresses">) => void;
}

export function AddressBookModal({
  isOpen,
  onClose,
  onSelectAddress,
}: AddressBookModalProps) {
  const supabase = createBrowserSupabaseClient();
  const [addresses, setAddresses] = useState<Tables<"customer_addresses">[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addressLine, setAddressLine] = useState("");
  const [landmark, setLandmark] = useState("");
  const [lat, setLat] = useState<number>(40.7128);
  const [lng, setLng] = useState<number>(-74.006);
  const [isDefault, setIsDefault] = useState(false);

  const loadAddresses = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchCustomerAddresses(supabase);
      setAddresses(data);
    } catch (err: any) {
      setError(err.message || "Failed to load addresses.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadAddresses();
      resetForm();
    }
  }, [isOpen]);

  const resetForm = () => {
    setIsEditing(false);
    setEditingId(null);
    setAddressLine("");
    setLandmark("");
    setLat(40.7128);
    setLng(-74.006);
    setIsDefault(false);
  };

  const handleStartEdit = (addr: Tables<"customer_addresses">) => {
    setIsEditing(true);
    setEditingId(addr.id);
    setAddressLine(addr.address_line1);
    setLandmark(addr.landmark || "");
    setLat(addr.lat);
    setLng(addr.lng);
    setIsDefault(Boolean(addr.is_default));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addressLine.trim()) return;

    try {
      setSaving(true);
      setError(null);

      if (editingId) {
        await updateCustomerAddress(
          editingId,
          {
            address_line1: addressLine.trim(),
            landmark: landmark.trim() || undefined,
            lat,
            lng,
            is_default: isDefault,
          },
          supabase
        );
      } else {
        await createCustomerAddress(
          {
            address_line1: addressLine.trim(),
            landmark: landmark.trim() || undefined,
            lat,
            lng,
            is_default: isDefault,
          },
          supabase
        );
      }

      resetForm();
      await loadAddresses();
    } catch (err: any) {
      setError(err.message || "Failed to save address.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this address?")) return;
    try {
      setSaving(true);
      await deleteCustomerAddress(id, supabase);
      await loadAddresses();
    } catch (err: any) {
      setError(err.message || "Failed to delete address.");
    } finally {
      setSaving(false);
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      setSaving(true);
      await setDefaultCustomerAddress(id, supabase);
      await loadAddresses();
    } catch (err: any) {
      setError(err.message || "Failed to set default address.");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-blue-600/10 p-2 text-blue-400 border border-blue-500/20">
              <Home className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Saved Addresses</h2>
              <p className="text-xs text-slate-400">Manage multiple delivery points & defaults</p>
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
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-800 bg-rose-950/40 p-3 text-xs text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          {isEditing ? (
            <form onSubmit={handleSave} className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">
                  {editingId ? "Edit Address" : "Add New Address"}
                </span>
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-[11px] text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Street Address
                </label>
                <input
                  type="text"
                  required
                  value={addressLine}
                  onChange={(e) => setAddressLine(e.target.value)}
                  placeholder="e.g. 742 Evergreen Terrace, Apt 4B"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Landmark (Optional)
                </label>
                <input
                  type="text"
                  value={landmark}
                  onChange={(e) => setLandmark(e.target.value)}
                  placeholder="e.g. Near Central Park Metro Gate 2"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    Latitude
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    required
                    value={lat}
                    onChange={(e) => setLat(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    Longitude
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    required
                    value={lng}
                    onChange={(e) => setLng(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="modalIsDefault"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                />
                <label htmlFor="modalIsDefault" className="text-xs text-slate-400 cursor-pointer">
                  Set as default address
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-3 py-1.5 rounded-lg border border-slate-700 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white disabled:opacity-50 transition flex items-center gap-1.5"
                >
                  {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                  <span>{editingId ? "Update Address" : "Save Address"}</span>
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-700 py-3 text-xs font-semibold text-blue-400 hover:border-blue-500 hover:bg-blue-600/5 transition"
            >
              <Plus className="h-4 w-4" />
              <span>Add New Saved Address</span>
            </button>
          )}

          {/* List */}
          {loading ? (
            <div className="flex items-center justify-center py-10 text-xs text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin mr-2 text-blue-400" />
              Loading addresses...
            </div>
          ) : addresses.length === 0 ? (
            <div className="rounded-xl border border-slate-800 p-8 text-center text-xs text-slate-400">
              No saved addresses found. Add one above to speed up your bookings!
            </div>
          ) : (
            <div className="space-y-3">
              {addresses.map((addr) => (
                <div
                  key={addr.id}
                  className={`rounded-xl border p-4 transition-all ${
                    addr.is_default
                      ? "border-blue-500/50 bg-blue-950/20"
                      : "border-slate-800 bg-slate-900/60 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                        <span className="font-semibold text-xs text-white">
                          {addr.address_line1}
                        </span>
                        {addr.is_default && (
                          <span className="rounded-md bg-blue-600/20 border border-blue-500/30 px-1.5 py-0.2 text-[10px] font-bold text-blue-400 flex items-center gap-0.5">
                            <Star className="h-2.5 w-2.5 fill-blue-400" /> Default
                          </span>
                        )}
                      </div>
                      {addr.landmark && (
                        <p className="text-[11px] text-slate-400 pl-5">
                          Landmark: {addr.landmark}
                        </p>
                      )}
                      <p className="text-[10px] text-slate-500 font-mono pl-5">
                        Coords: {Number(addr.lat).toFixed(4)}, {Number(addr.lng).toFixed(4)}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {onSelectAddress && (
                        <button
                          onClick={() => {
                            onSelectAddress(addr);
                            onClose();
                          }}
                          className="px-2 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600/40 text-[11px] font-bold text-blue-400 transition"
                        >
                          Select
                        </button>
                      )}
                      {!addr.is_default && (
                        <button
                          onClick={() => handleSetDefault(addr.id)}
                          title="Set as Default"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition"
                        >
                          <Star className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => handleStartEdit(addr)}
                        title="Edit"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(addr.id)}
                        title="Delete"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
