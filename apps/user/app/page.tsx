"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  createBrowserSupabaseClient,
  fetchActiveCities,
  fetchCityServices,
  createBookingWithLocation,
  fetchCustomerBookings,
  fetchCustomerAddresses,
  createCustomerAddress,
  type Tables,
} from "@repo/db";
import { SupabaseStatusBadge } from "../components/SupabaseStatusBadge";
import { RateProfessionalModal } from "../components/RateProfessionalModal";
import { AddressBookModal } from "../components/AddressBookModal";
import { SupportTicketModal } from "../components/SupportTicketModal";
import { UserProfileModal } from "../components/UserProfileModal";
import {
  MapPin,
  Wrench,
  Sparkles,
  Clock,
  ChevronRight,
  Phone,
  Navigation,
  Building2,
  Calendar,
  AlertCircle,
  LogOut,
  User,
  Camera,
  Star,
  Home,
  LifeBuoy,
  Wallet,
  ShieldAlert,
} from "lucide-react";

// Dynamically import Draggable Map to disable SSR for Leaflet
const DraggableAddressMap = dynamic(
  () => import("../components/DraggableAddressMap"),
  {
    ssr: false,
    loading: () => (
      <div className="h-56 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-center text-xs text-slate-500">
        Loading Interactive Map...
      </div>
    ),
  }
);

export default function UserPortal() {
  const supabase = createBrowserSupabaseClient();

  // Dynamic catalog state
  const [cities, setCities] = useState<Tables<"cities">[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [selectedCityId, setSelectedCityId] = useState<string>("");
  const [selectedServiceId, setSelectedServiceId] = useState<string>("");

  // Saved addresses state
  const [savedAddresses, setSavedAddresses] = useState<Tables<"customer_addresses">[]>([]);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Location & Form state
  const [pinCoords, setPinCoords] = useState<{ lat: number; lng: number }>({
    lat: 40.7128,
    lng: -74.006,
  });
  const [addressText, setAddressText] = useState("742 Evergreen Terrace, Sector 4");
  const [jobNotes, setJobNotes] = useState("");
  const [saveToAddressBook, setSaveToAddressBook] = useState(false);

  // User session & Booking lifecycle state
  const [user, setUser] = useState<any>(null);
  const [userBookings, setUserBookings] = useState<any[]>([]);
  const [activeBooking, setActiveBooking] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Review modal state
  const [reviewBooking, setReviewBooking] = useState<any | null>(null);
  const [reviewedBookingIds, setReviewedBookingIds] = useState<string[]>([]);

  // Load initial data
  const loadInitialData = async () => {
    try {
      setLoading(true);

      // Check current user
      const { data: authData } = await supabase.auth.getUser();
      setUser(authData.user);

      // Fetch dynamic active cities
      const fetchedCities = await fetchActiveCities(supabase);
      setCities(fetchedCities);

      const activeCityId = selectedCityId || (fetchedCities[0] ? fetchedCities[0].id : "");
      if (activeCityId && !selectedCityId) {
        setSelectedCityId(activeCityId);
      }

      // Fetch city-specific services (with custom price overrides)
      if (activeCityId) {
        const citySvcs = await fetchCityServices(activeCityId, supabase);
        setServices(citySvcs);
        if (citySvcs.length > 0 && !selectedServiceId && citySvcs[0]) {
          setSelectedServiceId(citySvcs[0].id);
        }
      }

      // If user is logged in, fetch their bookings and saved addresses
      if (authData.user) {
        const [bookings, addresses] = await Promise.all([
          fetchCustomerBookings(supabase),
          fetchCustomerAddresses(supabase),
        ]);
        setUserBookings(bookings);
        setSavedAddresses(addresses);

        const ongoing = bookings.find((b) =>
          ["pending", "accepted", "en_route", "arrived", "in_progress"].includes(b.status)
        );
        setActiveBooking(ongoing || null);

        // Pre-fill from default address if available
        const defaultAddr = addresses.find((a) => a.is_default);
        if (defaultAddr) {
          setAddressText(defaultAddr.address_line1);
          setPinCoords({ lat: defaultAddr.lat, lng: defaultAddr.lng });
        }
      }
    } catch (err: any) {
      console.error("Error loading customer portal data:", err);
    } finally {
      setLoading(false);
    }
  };

  // Re-fetch services whenever city changes to apply city-specific prices
  useEffect(() => {
    if (!selectedCityId) return;
    fetchCityServices(selectedCityId, supabase)
      .then((citySvcs) => {
        setServices(citySvcs);
        if (citySvcs.length > 0 && (!selectedServiceId || !citySvcs.some((s) => s.id === selectedServiceId))) {
          if (citySvcs[0]) {
            setSelectedServiceId(citySvcs[0].id);
          }
        }
      })
      .catch((err) => console.error("Error fetching city services:", err));
  }, [selectedCityId]);

  useEffect(() => {
    loadInitialData();

    // Subscribe to auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user || null);
      if (session?.user) {
        Promise.all([
          fetchCustomerBookings(supabase),
          fetchCustomerAddresses(supabase),
        ]).then(([bookings, addresses]) => {
          setUserBookings(bookings);
          setSavedAddresses(addresses);
          const ongoing = bookings.find((b) =>
            ["pending", "accepted", "en_route", "arrived", "in_progress"].includes(b.status)
          );
          setActiveBooking(ongoing || null);
        });
      }
    });

    // Realtime channel for bookings updates
    const channel = supabase
      .channel("customer-bookings-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings" },
        () => {
          fetchCustomerBookings(supabase).then((bookings) => {
            setUserBookings(bookings);
            const ongoing = bookings.find((b) =>
              ["pending", "accepted", "en_route", "arrived", "in_progress"].includes(b.status)
            );
            setActiveBooking(ongoing || null);

            // If an active booking was just completed, check if we should prompt for review
            const justCompleted = bookings.find(
              (b) => b.status === "completed" && b.professional_id && !reviewedBookingIds.includes(b.id)
            );
            if (justCompleted && !ongoing) {
              setReviewBooking(justCompleted);
            }
          });
        }
      )
      .subscribe();

    return () => {
      authListener.subscription.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [reviewedBookingIds]);

  const selectedService = services.find((s) => s.id === selectedServiceId);
  const selectedCity = cities.find((c) => c.id === selectedCityId);

  // Submit dynamic booking
  const handleCreateBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setMessage({ type: "error", text: "Please sign in or create an account to book a service." });
      return;
    }
    if (!selectedService || !selectedCity) {
      setMessage({ type: "error", text: "Please select an operating city and service." });
      return;
    }

    try {
      setSubmitting(true);
      setMessage(null);

      // Save to customer_addresses if requested
      if (saveToAddressBook) {
        try {
          await createCustomerAddress(
            {
              address_line1: addressText,
              lat: pinCoords.lat,
              lng: pinCoords.lng,
              is_default: savedAddresses.length === 0,
            },
            supabase
          );
          const updatedAddrs = await fetchCustomerAddresses(supabase);
          setSavedAddresses(updatedAddrs);
        } catch (addrErr) {
          console.warn("Could not save address to book:", addrErr);
        }
      }

      // Create booking row using city-specific price!
      const newBooking = await createBookingWithLocation(
        {
          cityId: selectedCity.id,
          serviceId: selectedService.id,
          serviceType: selectedService.name,
          latitude: pinCoords.lat,
          longitude: pinCoords.lng,
          address: `${addressText}, ${selectedCity.name}`,
          price: Number(selectedService.base_price),
          notes: jobNotes,
        },
        supabase
      );

      setActiveBooking(newBooking);
      setMessage({ type: "success", text: "Job broadcast created! Searching for nearby professionals..." });

      // Refresh list
      const updated = await fetchCustomerBookings(supabase);
      setUserBookings(updated);
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to create booking" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setActiveBooking(null);
    setUserBookings([]);
    setSavedAddresses([]);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navigation */}
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20 font-bold text-lg">
              H
            </div>
            <div>
              <span className="text-xs font-semibold tracking-wider text-blue-400 uppercase">
                Customer Portal
              </span>
              <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                HomeEase Dispatch
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  Live DB
                </span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <SupabaseStatusBadge />

            {user && (
              <div className="flex items-center gap-1.5">
                <Link
                  href="/wallet"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-xs font-semibold text-slate-300 transition"
                  title="In-App Wallet & Credits"
                >
                  <Wallet className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="hidden sm:inline">Wallet</span>
                </Link>

                <button
                  onClick={() => setShowAddressModal(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-xs font-semibold text-slate-300 transition"
                  title="Saved Addresses"
                >
                  <Home className="h-3.5 w-3.5 text-blue-400" />
                  <span className="hidden sm:inline">Addresses</span>
                </button>

                <button
                  onClick={() => setShowSupportModal(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-xs font-semibold text-slate-300 transition"
                  title="Help & Support"
                >
                  <LifeBuoy className="h-3.5 w-3.5 text-blue-400" />
                  <span className="hidden sm:inline">Support</span>
                </button>

                <Link
                  href="/sos"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-rose-800/60 bg-rose-950/60 hover:bg-rose-900/60 text-xs font-bold text-rose-300 transition"
                  title="Trust & Safety SOS"
                >
                  <ShieldAlert className="h-3.5 w-3.5 text-rose-400" />
                  <span className="hidden sm:inline">SOS</span>
                </Link>
              </div>
            )}

            {user ? (
              <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700/80 px-3 py-1.5 rounded-xl text-xs">
                <button
                  onClick={() => setShowProfileModal(true)}
                  className="flex items-center gap-1.5 hover:text-white transition group text-left"
                  title="Edit Profile & Contact Details"
                >
                  <User className="h-3.5 w-3.5 text-blue-400 group-hover:scale-110 transition-transform" />
                  <span className="text-slate-300 font-medium truncate max-w-[130px] group-hover:text-blue-300">
                    {user.user_metadata?.full_name || user.email}
                  </span>
                </button>
                <button
                  onClick={handleSignOut}
                  title="Sign Out"
                  className="ml-1 text-slate-400 hover:text-rose-400 transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-md shadow-blue-600/20"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        {message && (
          <div
            className={`mb-6 p-4 rounded-xl border flex items-center justify-between text-xs ${
              message.type === "success"
                ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300"
                : "bg-rose-950/40 border-rose-500/40 text-rose-300"
            }`}
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{message.text}</span>
            </div>
            <button
              onClick={() => setMessage(null)}
              className="text-xs font-bold opacity-70 hover:opacity-100"
            >
              ✕
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Left Column: Dynamic Catalog & Booking Form */}
          <div className="lg:col-span-7 space-y-6">
            {/* Step 1: Select City */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-sm shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600/20 text-xs font-bold text-blue-400">
                    1
                  </span>
                  <h2 className="font-semibold text-sm text-slate-100 flex items-center gap-1.5">
                    <Building2 className="h-4 w-4 text-blue-400" /> Operating City
                  </h2>
                </div>
                <span className="text-xs text-slate-400 font-mono">
                  {cities.length} active service zones
                </span>
              </div>

              {cities.length === 0 ? (
                <div className="text-xs text-slate-400 p-3 bg-slate-800/40 rounded-xl">
                  Loading service cities from database...
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {cities.map((city) => (
                    <button
                      key={city.id}
                      type="button"
                      onClick={() => setSelectedCityId(city.id)}
                      className={`px-3 py-2 text-xs rounded-xl font-medium border text-left transition-all ${
                        selectedCityId === city.id
                          ? "bg-blue-600/20 border-blue-500 text-blue-300 shadow-sm shadow-blue-500/10 font-semibold"
                          : "bg-slate-800/50 border-slate-700/60 text-slate-300 hover:border-slate-600"
                      }`}
                    >
                      {city.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Step 2: Dynamic Services Selection */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-sm shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600/20 text-xs font-bold text-blue-400">
                    2
                  </span>
                  <h2 className="font-semibold text-sm text-slate-100 flex items-center gap-1.5">
                    <Wrench className="h-4 w-4 text-blue-400" /> Select Service
                  </h2>
                </div>
                <span className="text-xs text-slate-400 font-mono">Dynamic Catalog</span>
              </div>

              {services.length === 0 ? (
                <div className="text-xs text-slate-400 p-3 bg-slate-800/40 rounded-xl">
                  Loading active services from database...
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {services.map((svc) => (
                    <button
                      key={svc.id}
                      type="button"
                      onClick={() => setSelectedServiceId(svc.id)}
                      className={`p-3.5 rounded-xl border text-left transition-all relative ${
                        selectedServiceId === svc.id
                          ? "bg-blue-600/15 border-blue-500 text-white shadow-md shadow-blue-500/10"
                          : "bg-slate-800/40 border-slate-700/60 text-slate-300 hover:border-slate-600"
                      }`}
                    >
                      <div className="flex justify-between items-start mb-1.5">
                        <span className="font-semibold text-sm text-slate-100">{svc.name}</span>
                        <span className="text-xs font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-800/50">
                          ${Number(svc.base_price).toFixed(2)}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Instant live dispatch across {selectedCity?.name || "Metro"}.
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Step 3: Service Location & Interactive Geolocation Pin */}
            <form onSubmit={handleCreateBooking} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-sm shadow-xl space-y-4">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600/20 text-xs font-bold text-blue-400">
                  3
                </span>
                <h2 className="font-semibold text-sm text-slate-100 flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-blue-400" /> Service Location & Pinpoint Geolocation
                </h2>
              </div>

              {/* Interactive Draggable Map */}
              <DraggableAddressMap
                initialCoords={pinCoords}
                onLocationChange={(coords) => setPinCoords(coords)}
              />

              {/* Quick Saved Address Pills */}
              {savedAddresses.length > 0 && (
                <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
                      <Home className="h-3 w-3 text-blue-400" /> Saved Delivery Points
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowAddressModal(true)}
                      className="text-[10px] text-blue-400 hover:underline font-semibold"
                    >
                      Manage ({savedAddresses.length})
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {savedAddresses.map((addr) => {
                      const isSelected = addressText === addr.address_line1;
                      return (
                        <button
                          key={addr.id}
                          type="button"
                          onClick={() => {
                            setAddressText(addr.address_line1);
                            setPinCoords({ lat: addr.lat, lng: addr.lng });
                          }}
                          className={`px-2.5 py-1 rounded-lg text-xs border flex items-center gap-1.5 transition ${
                            isSelected
                              ? "bg-blue-600/25 border-blue-500 text-blue-300 font-semibold shadow-sm shadow-blue-500/10"
                              : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700"
                          }`}
                        >
                          <MapPin className="h-3 w-3 text-blue-400 shrink-0" />
                          <span className="truncate max-w-[140px]">{addr.address_line1}</span>
                          {addr.is_default && (
                            <span className="rounded bg-blue-500/20 px-1 py-0.2 text-[9px] font-bold text-blue-300">
                              Default
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Street Address & Landmark
                </label>
                <input
                  type="text"
                  required
                  value={addressText}
                  onChange={(e) => setAddressText(e.target.value)}
                  placeholder="e.g. 742 Evergreen Terrace, Apt 4B"
                  className="w-full px-3 py-2 bg-slate-800/90 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Special Instructions / Problem Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={jobNotes}
                  onChange={(e) => setJobNotes(e.target.value)}
                  placeholder="e.g. Leak is under bathroom sink; please call upon arrival."
                  className="w-full px-3 py-2 bg-slate-800/90 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="saveAddress"
                  checked={saveToAddressBook}
                  onChange={(e) => setSaveToAddressBook(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                />
                <label htmlFor="saveAddress" className="text-xs text-slate-400 cursor-pointer">
                  Save this location to my saved addresses
                </label>
              </div>

              <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-400 block">Total Estimated Price</span>
                  <span className="text-base font-bold text-white">
                    ${selectedService ? Number(selectedService.base_price).toFixed(2) : "0.00"}
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-lg shadow-blue-600/25 transition-all"
                >
                  {submitting ? "Broadcasting Job..." : "Broadcast Service Request"}
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </form>
          </div>

          {/* Right Column: Live Booking Lifecycle Tracker & History */}
          <div className="lg:col-span-5 space-y-6">
            {/* Active Job Tracker */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-sm shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-sm text-slate-100 flex items-center gap-1.5">
                  <Navigation className="h-4 w-4 text-blue-400" /> Live Dispatch Tracker
                </h3>
                {activeBooking && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wider uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    {activeBooking.status}
                  </span>
                )}
              </div>

              {activeBooking ? (
                <div className="space-y-4">
                  <div className="p-3 bg-slate-800/60 border border-slate-700/60 rounded-xl">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-semibold text-xs text-slate-200">
                        {activeBooking.service_type || activeBooking.service?.name}
                      </span>
                      <span className="text-xs font-bold text-emerald-400">
                        ${Number(activeBooking.price).toFixed(2)}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">{activeBooking.address}</p>
                    <div className="mt-2 text-[10px] font-mono text-slate-500">
                      ID: {activeBooking.id.slice(0, 8)}... | Geolocation: {Number(activeBooking.latitude || activeBooking.lat).toFixed(4)}, {Number(activeBooking.longitude || activeBooking.lng).toFixed(4)}
                    </div>
                  </div>

                  {/* Stepper (6 Stages) */}
                  <div className="space-y-2.5 pt-1">
                    {[
                      { status: "pending", label: "Broadcast Sent", desc: "Waiting for nearby professional to accept" },
                      { status: "accepted", label: "Professional Matched", desc: "Assigned provider claimed your dispatch" },
                      { status: "en_route", label: "En Route to Location", desc: "Provider is navigating using GPS coordinates" },
                      { status: "arrived", label: "Provider Arrived", desc: "Technician has arrived on site" },
                      { status: "in_progress", label: "Work Underway", desc: "Service repairs actively in progress" },
                      { status: "completed", label: "Job Completed", desc: "Work order finished and verified with proof photos" },
                    ].map((step, idx) => {
                      const order = ["pending", "accepted", "en_route", "arrived", "in_progress", "completed"];
                      const currentIdx = order.indexOf(activeBooking.status);
                      const isComplete = currentIdx >= idx;
                      const isCurrent = activeBooking.status === step.status;

                      return (
                        <div key={step.status} className="flex items-start gap-3 text-xs">
                          <div
                            className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold ${
                              isComplete
                                ? "bg-emerald-600 text-white"
                                : "bg-slate-800 text-slate-500 border border-slate-700"
                            }`}
                          >
                            {isComplete ? "✓" : idx + 1}
                          </div>
                          <div>
                            <span
                              className={`font-semibold ${
                                isCurrent ? "text-blue-400" : isComplete ? "text-slate-200" : "text-slate-500"
                              }`}
                            >
                              {step.label}
                            </span>
                            <p className="text-[11px] text-slate-400">{step.desc}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Verified Proof-of-Work Photos (if completed or available) */}
                  {activeBooking.proof_photos &&
                    (activeBooking.proof_photos.before || activeBooking.proof_photos.after) && (
                      <div className="p-3 bg-slate-950/70 border border-emerald-900/40 rounded-xl space-y-2">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                          <Camera className="h-3.5 w-3.5" />
                          <span>Verified Proof-of-Work Audit</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {activeBooking.proof_photos.before && (
                            <div>
                              <span className="text-[9px] text-slate-400 block mb-1">Before Service</span>
                              <img
                                src={activeBooking.proof_photos.before}
                                alt="Before service"
                                className="rounded-lg h-24 w-full object-cover border border-slate-800"
                              />
                            </div>
                          )}
                          {activeBooking.proof_photos.after && (
                            <div>
                              <span className="text-[9px] text-slate-400 block mb-1">After Service</span>
                              <img
                                src={activeBooking.proof_photos.after}
                                alt="After service"
                                className="rounded-lg h-24 w-full object-cover border border-slate-800"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                  {/* Professional Card if Matched */}
                  {activeBooking.professional && (
                    <div className="mt-3 p-3 bg-blue-950/30 border border-blue-800/40 rounded-xl flex items-center justify-between text-xs">
                      <div>
                        <span className="text-[10px] text-blue-400 uppercase font-bold block">Assigned Provider</span>
                        <span className="font-semibold text-slate-200">
                          {activeBooking.professional.profile?.full_name || "Certified Technician"}
                        </span>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <span>{activeBooking.professional.trade}</span>
                          <span>•</span>
                          <span className="text-amber-400 flex items-center gap-0.5 font-medium">
                            <Star className="h-3 w-3 fill-amber-400" />
                            {activeBooking.professional.rating ? Number(activeBooking.professional.rating).toFixed(1) : "5.0"}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => alert(`Calling provider: ${activeBooking.professional.profile?.phone || "555-0199"}`)}
                        className="p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
                      >
                        <Phone className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Completed Booking Review Action */}
                  {activeBooking.status === "completed" && activeBooking.professional_id && (
                    <button
                      onClick={() => setReviewBooking(activeBooking)}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all"
                    >
                      <Sparkles className="h-4 w-4" />
                      <span>
                        {reviewedBookingIds.includes(activeBooking.id)
                          ? "Update Review for Provider"
                          : "Rate Your Service Provider"}
                      </span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-xs text-slate-500">
                  <Clock className="h-8 w-8 text-slate-600 mx-auto mb-2 opacity-50" />
                  No active dispatches. Select a service on the left to broadcast a job.
                </div>
              )}
            </div>

            {/* Booking History */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-sm shadow-xl">
              <h3 className="font-semibold text-sm text-slate-100 mb-3 flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-blue-400" /> Recent Bookings
              </h3>

              {userBookings.length === 0 ? (
                <p className="text-xs text-slate-500">No booking history yet.</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {userBookings.map((b) => (
                    <div
                      key={b.id}
                      className="p-3 bg-slate-800/40 border border-slate-700/50 rounded-xl text-xs flex justify-between items-center"
                    >
                      <div>
                        <div className="font-medium text-slate-200">{b.service_type || b.service?.name}</div>
                        <div className="text-[10px] text-slate-400">{new Date(b.created_at).toLocaleDateString()}</div>
                        {b.status === "completed" && b.professional_id && (
                          <button
                            onClick={() => setReviewBooking(b)}
                            className="mt-1 px-2 py-0.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded text-[10px] font-medium flex items-center gap-1 transition-colors"
                          >
                            <Star className="h-2.5 w-2.5 fill-amber-400" />
                            <span>{reviewedBookingIds.includes(b.id) ? "Reviewed" : "Rate Provider"}</span>
                          </button>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-emerald-400 text-xs">${Number(b.price).toFixed(2)}</span>
                        <div className="text-[10px] font-mono text-slate-400 uppercase">{b.status}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Two-Way Rate Professional Modal */}
      <RateProfessionalModal
        isOpen={Boolean(reviewBooking)}
        booking={reviewBooking}
        onClose={() => setReviewBooking(null)}
        onSubmitSuccess={() => {
          if (reviewBooking) {
            setReviewedBookingIds((prev) => [...prev, reviewBooking.id]);
          }
          setReviewBooking(null);
          setMessage({
            type: "success",
            text: "Your review has been published! Thank you for rating your service provider.",
          });
        }}
      />

      {/* Address Book Modal */}
      <AddressBookModal
        isOpen={showAddressModal}
        onClose={() => setShowAddressModal(false)}
        onSelectAddress={(addr) => {
          setAddressText(addr.address_line1);
          setPinCoords({ lat: addr.lat, lng: addr.lng });
        }}
      />

      {/* Customer Support Desk Modal */}
      <SupportTicketModal
        isOpen={showSupportModal}
        onClose={() => setShowSupportModal(false)}
      />

      {/* User Profile & Contact Modal */}
      <UserProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        onProfileUpdated={loadInitialData}
      />
    </div>
  );
}
