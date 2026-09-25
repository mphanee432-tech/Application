"use client";

import React, { useEffect, useState } from "react";
import {
  Building2,
  Wrench,
  DollarSign,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Loader2,
  RefreshCw,
  Power,
  Layers,
} from "lucide-react";
import {
  createBrowserSupabaseClient,
  fetchAllCities,
  fetchAllServices,
  fetchAllCityServicesAdmin,
  createCityAdmin,
  updateCityAdmin,
  deleteCityAdmin,
  createServiceAdmin,
  updateServiceAdmin,
  deleteServiceAdmin,
  upsertCityServiceAdmin,
  type Tables,
} from "@repo/db";

export function CatalogManager() {
  const supabase = createBrowserSupabaseClient();

  const [catalogTab, setCatalogTab] = useState<"cities" | "services" | "pricing">("pricing");
  const [cities, setCities] = useState<Tables<"cities">[]>([]);
  const [services, setServices] = useState<Tables<"services">[]>([]);
  const [cityServices, setCityServices] = useState<any[]>([]);
  const [selectedCityId, setSelectedCityId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // New item states
  const [newCityName, setNewCityName] = useState("");
  const [showAddCity, setShowAddCity] = useState(false);

  const [newServiceName, setNewServiceName] = useState("");
  const [newServicePrice, setNewServicePrice] = useState("");
  const [showAddService, setShowAddService] = useState(false);

  // Editing state
  const [editingCity, setEditingCity] = useState<{ id: string; name: string } | null>(null);
  const [editingService, setEditingService] = useState<{ id: string; name: string; base_price: string } | null>(null);
  const [pricingEdits, setPricingEdits] = useState<{ [serviceId: string]: { price: string; is_active: boolean } }>({});

  const loadCatalogData = async () => {
    try {
      setLoading(true);
      const [fetchedCities, fetchedServices, fetchedCityServices] = await Promise.all([
        fetchAllCities(supabase),
        fetchAllServices(supabase),
        fetchAllCityServicesAdmin(supabase),
      ]);

      setCities(fetchedCities);
      setServices(fetchedServices);
      setCityServices(fetchedCityServices);

      if (fetchedCities[0] && !selectedCityId) {
        setSelectedCityId(fetchedCities[0].id);
      }
    } catch (err: any) {
      console.error("Error loading catalog data:", err);
      setMessage({ type: "error", text: err.message || "Failed to load catalog." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCatalogData();
  }, []);

  // Update pricingEdits state whenever selectedCityId or services change
  useEffect(() => {
    if (!selectedCityId) return;

    const initialPricing: { [serviceId: string]: { price: string; is_active: boolean } } = {};
    services.forEach((s) => {
      const match = cityServices.find((cs) => cs.city_id === selectedCityId && cs.service_id === s.id);
      initialPricing[s.id] = {
        price: match ? String(match.price) : String(s.base_price),
        is_active: match ? Boolean(match.is_active) : Boolean(s.is_active),
      };
    });
    setPricingEdits(initialPricing);
  }, [selectedCityId, services, cityServices]);

  // Handle City Actions
  const handleCreateCity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCityName.trim()) return;
    try {
      setSaving(true);
      await createCityAdmin(newCityName.trim(), supabase);
      setNewCityName("");
      setShowAddCity(false);
      setMessage({ type: "success", text: "City added and auto-seeded with services!" });
      await loadCatalogData();
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Could not create city." });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateCity = async (id: string) => {
    if (!editingCity || !editingCity.name.trim()) return;
    try {
      setSaving(true);
      await updateCityAdmin(id, { name: editingCity.name.trim() }, supabase);
      setEditingCity(null);
      setMessage({ type: "success", text: "City updated successfully." });
      await loadCatalogData();
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Could not update city." });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCity = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete ${name}? All associated bookings and city services will be affected.`)) return;
    try {
      setSaving(true);
      await deleteCityAdmin(id, supabase);
      setMessage({ type: "success", text: `City ${name} removed.` });
      await loadCatalogData();
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Could not delete city." });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleCityStatus = async (city: Tables<"cities">) => {
    try {
      await updateCityAdmin(city.id, { is_active: !city.is_active }, supabase);
      await loadCatalogData();
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Status toggle failed." });
    }
  };

  // Handle Service Actions
  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newServiceName.trim() || !newServicePrice) return;
    try {
      setSaving(true);
      await createServiceAdmin(newServiceName.trim(), Number(newServicePrice), supabase);
      setNewServiceName("");
      setNewServicePrice("");
      setShowAddService(false);
      setMessage({ type: "success", text: "Service added and matrix updated across all cities!" });
      await loadCatalogData();
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Could not create service." });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateService = async (id: string) => {
    if (!editingService || !editingService.name.trim()) return;
    try {
      setSaving(true);
      await updateServiceAdmin(
        id,
        {
          name: editingService.name.trim(),
          base_price: Number(editingService.base_price),
        },
        supabase
      );
      setEditingService(null);
      setMessage({ type: "success", text: "Service updated successfully." });
      await loadCatalogData();
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Could not update service." });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteService = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete ${name}?`)) return;
    try {
      setSaving(true);
      await deleteServiceAdmin(id, supabase);
      setMessage({ type: "success", text: `Service ${name} removed.` });
      await loadCatalogData();
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Could not delete service." });
    } finally {
      setSaving(false);
    }
  };

  // Save City-Wise Pricing Override
  const handleSaveCityPrice = async (serviceId: string) => {
    const config = pricingEdits[serviceId];
    if (!config || !selectedCityId) return;

    try {
      setSaving(true);
      await upsertCityServiceAdmin(
        selectedCityId,
        serviceId,
        Number(config.price),
        config.is_active,
        supabase
      );
      setMessage({ type: "success", text: "City-specific price override saved!" });
      await loadCatalogData();
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to update city pricing." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Sub-Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="flex gap-2">
          <button
            onClick={() => setCatalogTab("pricing")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
              catalogTab === "pricing"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
            }`}
          >
            <DollarSign className="h-3.5 w-3.5" />
            <span>City-Wise Pricing Matrix</span>
          </button>
          <button
            onClick={() => setCatalogTab("cities")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
              catalogTab === "cities"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
            }`}
          >
            <Building2 className="h-3.5 w-3.5" />
            <span>Operating Cities ({cities.length})</span>
          </button>
          <button
            onClick={() => setCatalogTab("services")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
              catalogTab === "services"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
            }`}
          >
            <Wrench className="h-3.5 w-3.5" />
            <span>Service Catalog ({services.length})</span>
          </button>
        </div>

        <button
          onClick={loadCatalogData}
          disabled={loading}
          className="text-xs text-indigo-400 hover:underline flex items-center gap-1 font-semibold"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh Catalog</span>
        </button>
      </div>

      {message && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex justify-between items-center ${
            message.type === "success"
              ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300"
              : "bg-rose-950/40 border-rose-500/40 text-rose-300"
          }`}
        >
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-xs font-bold opacity-70 hover:opacity-100">
            ✕
          </button>
        </div>
      )}

      {/* 1. CITY-WISE PRICING MATRIX */}
      {catalogTab === "pricing" && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-bold text-white">City-Wise Pricing Configurations</h3>
              <p className="text-xs text-slate-400">
                Custom rates set here dictate what customers pay when booking within each specific operating city.
              </p>
            </div>

            {/* City Selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-semibold">Select City:</span>
              <select
                value={selectedCityId}
                onChange={(e) => setSelectedCityId(e.target.value)}
                className="bg-slate-950 border border-slate-700 text-slate-100 text-xs rounded-xl px-3 py-2 font-semibold focus:outline-none focus:border-indigo-500"
              >
                {cities.map((city) => (
                  <option key={city.id} value={city.id}>
                    {city.name} {city.is_active ? "" : "(Inactive)"}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center p-12 text-xs text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin mr-2 text-indigo-400" />
              Loading city price matrix...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="pb-3 font-semibold">Service Name</th>
                    <th className="pb-3 font-semibold">Base Price</th>
                    <th className="pb-3 font-semibold">City Custom Price ($)</th>
                    <th className="pb-3 font-semibold">City Availability</th>
                    <th className="pb-3 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {services.map((service) => {
                    const edit = pricingEdits[service.id] || {
                      price: String(service.base_price),
                      is_active: service.is_active,
                    };
                    const isDifferent = Number(edit.price) !== Number(service.base_price);

                    return (
                      <tr key={service.id} className="hover:bg-slate-800/30">
                        <td className="py-4 font-bold text-white">{service.name}</td>
                        <td className="py-4 text-slate-400">${Number(service.base_price).toFixed(2)}</td>
                        <td className="py-4">
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-500">$</span>
                            <input
                              type="number"
                              step="0.01"
                              value={edit.price}
                              onChange={(e) =>
                                setPricingEdits((prev) => ({
                                  ...prev,
                                  [service.id]: { ...edit, price: e.target.value },
                                }))
                              }
                              className="w-24 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
                            />
                            {isDifferent && (
                              <span className="text-[10px] text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/40">
                                Override
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-4">
                          <button
                            type="button"
                            onClick={() =>
                              setPricingEdits((prev) => ({
                                ...prev,
                                [service.id]: { ...edit, is_active: !edit.is_active },
                              }))
                            }
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition ${
                              edit.is_active
                                ? "bg-emerald-950/80 border-emerald-800 text-emerald-300"
                                : "bg-slate-800 border-slate-700 text-slate-500"
                            }`}
                          >
                            <Power className="h-2.5 w-2.5" />
                            <span>{edit.is_active ? "Offered in City" : "Disabled"}</span>
                          </button>
                        </td>
                        <td className="py-4 text-right">
                          <button
                            onClick={() => handleSaveCityPrice(service.id)}
                            disabled={saving}
                            className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-sm transition"
                          >
                            Save Rate
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 2. OPERATING CITIES */}
      {catalogTab === "cities" && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-5">
          <div className="flex justify-between items-center border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-bold text-white">Operating Service Cities</h3>
              <p className="text-xs text-slate-400">
                Cities where customer requests are dispatched and professionals can register.
              </p>
            </div>
            <button
              onClick={() => setShowAddCity(true)}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add City</span>
            </button>
          </div>

          {showAddCity && (
            <form onSubmit={handleCreateCity} className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
              <h4 className="text-xs font-bold text-white">Create New City Zone</h4>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. San Francisco, CA"
                  value={newCityName}
                  onChange={(e) => setNewCityName(e.target.value)}
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="submit"
                  disabled={saving || !newCityName.trim()}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-sm transition"
                >
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddCity(false)}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-xl text-xs"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="pb-3 font-semibold">City Name</th>
                  <th className="pb-3 font-semibold">Status</th>
                  <th className="pb-3 font-semibold">Added On</th>
                  <th className="pb-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {cities.map((city) => (
                  <tr key={city.id} className="hover:bg-slate-800/30">
                    <td className="py-4 font-bold text-white">
                      {editingCity?.id === city.id ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={editingCity.name}
                            onChange={(e) => setEditingCity({ ...editingCity, name: e.target.value })}
                            className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                          />
                          <button
                            onClick={() => handleUpdateCity(city.id)}
                            className="p-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded"
                          >
                            <Check className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => setEditingCity(null)}
                            className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        city.name
                      )}
                    </td>
                    <td className="py-4">
                      <button
                        onClick={() => handleToggleCityStatus(city)}
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition ${
                          city.is_active
                            ? "bg-emerald-950/80 border-emerald-800 text-emerald-300"
                            : "bg-slate-800 border-slate-700 text-slate-500"
                        }`}
                      >
                        <Power className="h-2.5 w-2.5" />
                        <span>{city.is_active ? "Active" : "Disabled"}</span>
                      </button>
                    </td>
                    <td className="py-4 text-slate-400 text-[11px]">
                      {new Date(city.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-4 text-right">
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => setEditingCity({ id: city.id, name: city.name })}
                          className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                          title="Edit Name"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteCity(city.id, city.name)}
                          className="p-1.5 text-rose-400 hover:text-rose-300 rounded-lg hover:bg-rose-950/40 transition"
                          title="Delete City"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. SERVICE CATALOG */}
      {catalogTab === "services" && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-5">
          <div className="flex justify-between items-center border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-bold text-white">Platform Services Catalog</h3>
              <p className="text-xs text-slate-400">
                Core home service categories offered across the ecosystem.
              </p>
            </div>
            <button
              onClick={() => setShowAddService(true)}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Service</span>
            </button>
          </div>

          {showAddService && (
            <form onSubmit={handleCreateService} className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
              <h4 className="text-xs font-bold text-white">Create New Service Offering</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  placeholder="Service Name (e.g. Electrical Rewiring)"
                  value={newServiceName}
                  onChange={(e) => setNewServiceName(e.target.value)}
                  className="sm:col-span-2 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Base Price ($)"
                  value={newServicePrice}
                  onChange={(e) => setNewServicePrice(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddService(false)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !newServiceName.trim() || !newServicePrice}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-sm transition"
                >
                  Create Service
                </button>
              </div>
            </form>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="pb-3 font-semibold">Service</th>
                  <th className="pb-3 font-semibold">Default Base Price</th>
                  <th className="pb-3 font-semibold">Status</th>
                  <th className="pb-3 font-semibold">Added On</th>
                  <th className="pb-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {services.map((service) => (
                  <tr key={service.id} className="hover:bg-slate-800/30">
                    <td className="py-4 font-bold text-white">
                      {editingService?.id === service.id ? (
                        <input
                          type="text"
                          value={editingService.name}
                          onChange={(e) => setEditingService({ ...editingService, name: e.target.value })}
                          className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                        />
                      ) : (
                        service.name
                      )}
                    </td>
                    <td className="py-4 font-semibold text-emerald-400">
                      {editingService?.id === service.id ? (
                        <input
                          type="number"
                          step="0.01"
                          value={editingService.base_price}
                          onChange={(e) => setEditingService({ ...editingService, base_price: e.target.value })}
                          className="w-20 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                        />
                      ) : (
                        `$${Number(service.base_price).toFixed(2)}`
                      )}
                    </td>
                    <td className="py-4">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          service.is_active
                            ? "bg-emerald-950 border border-emerald-800 text-emerald-300"
                            : "bg-slate-800 border border-slate-700 text-slate-500"
                        }`}
                      >
                        {service.is_active ? "Active" : "Disabled"}
                      </span>
                    </td>
                    <td className="py-4 text-slate-400 text-[11px]">
                      {new Date(service.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-4 text-right">
                      <div className="flex justify-end gap-1.5">
                        {editingService?.id === service.id ? (
                          <>
                            <button
                              onClick={() => handleUpdateService(service.id)}
                              className="p-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded"
                            >
                              <Check className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => setEditingService(null)}
                              className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() =>
                                setEditingService({
                                  id: service.id,
                                  name: service.name,
                                  base_price: String(service.base_price),
                                })
                              }
                              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                              title="Edit Service"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteService(service.id, service.name)}
                              className="p-1.5 text-rose-400 hover:text-rose-300 rounded-lg hover:bg-rose-950/40 transition"
                              title="Delete Service"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
