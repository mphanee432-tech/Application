"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createBrowserSupabaseClient,
  fetchActiveCities,
  fetchCityServices,
  createBookingWithLocation,
  fetchCustomerBookings,
  fetchCustomerAddresses,
  createCustomerAddress,
  fetchBookingAddons,
  getUnreadChatCount,
  getUnreadSupportCount,
  type Tables,
} from "@repo/db";
import { NotificationBell } from "../components/NotificationBell";
import { AddonApprovalModal } from "../components/AddonApprovalModal";
import { RateProfessionalModal } from "../components/RateProfessionalModal";
import { AddressBookModal } from "../components/AddressBookModal";
import { SupportTicketModal } from "../components/SupportTicketModal";
import { UserProfileModal } from "../components/UserProfileModal";
import { WalletPaymentModal } from "../components/WalletPaymentModal";
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
  MessageSquare,
  RefreshCw,
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
  const router = useRouter();
  const [supabase] = useState(() => createBrowserSupabaseClient());

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

  // Wallet Checkout Modal & Soft Refresh state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [checkoutPayload, setCheckoutPayload] = useState<any | null>(null);
  const [refreshing, setRefreshing] = useState(false);

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
  const [activeBookings, setActiveBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Review modal state
  const [reviewBooking, setReviewBooking] = useState<any | null>(null);
  const [reviewedBookingIds, setReviewedBookingIds] = useState<string[]>([]);

  // Add-on approval modal state
  const [pendingAddonToReview, setPendingAddonToReview] = useState<any | null>(null);
  const [bookingAddonsMap, setBookingAddonsMap] = useState<Record<string, any[]>>({});

  // Realtime badge counts
  const [unreadChatCount, setUnreadChatCount] = useState<number>(0);
  const [unreadSupportCount, setUnreadSupportCount] = useState<number>(0);

  // Load initial data
  const loadInitialData = async () => {
    try {
      setLoading(true);

      // Check current user
      const { data: authData } = await supabase.auth.getUser();
      setUser(authData.user);
      if (authData.user) {
        getUnreadChatCount(authData.user.id, supabase).then(setUnreadChatCount);
        getUnreadSupportCount(authData.user.id, "customer", supabase).then(setUnreadSupportCount);
      }

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

        const ongoingList = bookings.filter((b) =>
          ["pending", "accepted", "en_route", "arrived", "in_progress"].includes(b.status)
        );
        setActiveBookings(ongoingList);
        setActiveBooking(ongoingList[0] || null);

        // Fetch add-ons for ongoing bookings
        const addonsEntries = await Promise.all(
          ongoingList.map(async (b) => {
            const res = await fetchBookingAddons(b.id, supabase);
            const addons = res.success ? (res.data || []) : [];
            return [b.id, addons] as const;
          })
        );
        setBookingAddonsMap(Object.fromEntries(addonsEntries));

        for (const [, addons] of addonsEntries) {
          const pending = (addons as any[]).find((a: any) => a.status === "pending");
          if (pending) {
            setPendingAddonToReview(pending);
            break;
          }
        }

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
    let isMounted = true;
    loadInitialData();

    // Subscribe to auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange((_, session) => {
      if (!isMounted) return;
      setUser(session?.user || null);
      if (session?.user) {
        Promise.all([
          fetchCustomerBookings(supabase),
          fetchCustomerAddresses(supabase),
        ]).then(([bookings, addresses]) => {
          if (!isMounted) return;
          setUserBookings(bookings);
          setSavedAddresses(addresses);
          const ongoingList = bookings.filter((b) =>
            ["pending", "accepted", "en_route", "arrived", "in_progress"].includes(b.status)
          );
          setActiveBookings(ongoingList);
          setActiveBooking(ongoingList[0] || null);
        });
      }
    });

    // Realtime channel for bookings updates
    const channelName = `customer-bookings-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings" },
        () => {
          if (!isMounted) return;
          fetchCustomerBookings(supabase).then((bookings) => {
            if (!isMounted) return;
            setUserBookings(bookings);
            const ongoingList = bookings.filter((b) =>
              ["pending", "accepted", "en_route", "arrived", "in_progress"].includes(b.status)
            );
            setActiveBookings(ongoingList);
            setActiveBooking(ongoingList[0] || null);

            // If an active booking was just completed, check if we should prompt for review
            const justCompleted = bookings.find(
              (b) => b.status === "completed" && b.professional_id && !reviewedBookingIds.includes(b.id)
            );
            if (justCompleted && ongoingList.length === 0) {
              setReviewBooking(justCompleted);
            }
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "job_addons" },
        (payload: any) => {
          if (!isMounted) return;
          if (payload.new && payload.new.status === "pending") {
            setPendingAddonToReview(payload.new);
          }
          loadInitialData();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_messages" },
        () => {
          if (!isMounted) return;
          getUnreadChatCount(undefined, supabase).then(setUnreadChatCount);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ticket_replies" },
        () => {
          if (!isMounted) return;
          getUnreadSupportCount(undefined, "customer", supabase).then(setUnreadSupportCount);
        }
      );
    channel.subscribe();

    return () => {
      isMounted = false;
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

      // Open Wallet Payment & Checkout Gateway Modal
      setCheckoutPayload({
        cityId: selectedCity.id,
        serviceId: selectedService.id,
        serviceType: selectedService.name,
        latitude: pinCoords.lat,
        longitude: pinCoords.lng,
        address: `${addressText}, ${selectedCity.name}`,
        price: Number(selectedService.base_price),
        notes: jobNotes,
      });
      setShowPaymentModal(true);
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to prepare booking payment" });
    }
  };

  const handlePaymentSuccess = async (newBooking: any) => {
    setActiveBookings((prev) => [newBooking, ...prev]);
    setActiveBooking(newBooking);
    setMessage({
      type: "success",
      text: "Payment confirmed with in-app Demo Wallet! Job broadcast dispatched to specialists.",
    });

    // Refresh list
    const updated = await fetchCustomerBookings(supabase);
    setUserBookings(updated);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setActiveBooking(null);
    setActiveBookings([]);
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
            {user && (
              <div className="flex items-center gap-2">
                <NotificationBell />

                <Link
                  href="/wallet"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-xs font-semibold text-slate-300 transition"
                  title="In-App Wallet & Credits"
                >
                  <Wallet className="h-4 w-4 text-emerald-400" />
                  <span className="hidden sm:inline">Wallet</span>
                </Link>

                <button
                  onClick={() => setShowAddressModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-xs font-semibold text-slate-300 transition"
                  title="Saved Addresses"
                >
                  <Home className="h-4 w-4 text-blue-400" />
                  <span className="hidden sm:inline">Addresses</span>
                </button>

                <Link
                  href="/chat"
                  className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-xs font-semibold text-slate-300 transition"
                  title="Messages & Chat"
                >
                  <MessageSquare className="h-4 w-4 text-indigo-400" />
                  <span className="hidden sm:inline">Chat</span>
                  {unreadChatCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white shadow-md animate-pulse">
                      {unreadChatCount > 99 ? "99+" : unreadChatCount}
                    </span>
                  )}
                </Link>

                <button
                  onClick={() => setShowSupportModal(true)}
                  className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-xs font-semibold text-slate-300 transition"
                  title="Help & Support"
                >
                  <LifeBuoy className="h-4 w-4 text-blue-400" />
                  <span className="hidden sm:inline">Support</span>
                  {unreadSupportCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white shadow-md animate-pulse">
                      {unreadSupportCount > 99 ? "99+" : unreadSupportCount}
                    </span>
                  )}
                </button>

                <Link
                  href="/sos"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-800/60 bg-rose-950/60 hover:bg-rose-900/60 text-xs font-bold text-rose-300 transition"
                  title="Trust & Safety SOS"
                >
                  <ShieldAlert className="h-4 w-4 text-rose-400" />
                  <span className="hidden sm:inline">SOS</span>
                </Link>

                {/* Soft Refresh Button */}
                <button
                  type="button"
                  onClick={() => {
                    setRefreshing(true);
                    router.refresh();
                    loadInitialData().finally(() => setRefreshing(false));
                  }}
                  disabled={refreshing}
                  className="p-1.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white transition"
                  title="Soft Refresh Data"
                >
                  <RefreshCw
                    className={`h-4 w-4 text-slate-400 hover:text-white transition-transform ${
                      refreshing ? "animate-spin text-blue-400" : ""
                    }`}
                  />
                </button>
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
                {activeBookings.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wider uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    {activeBookings.length} {activeBookings.length === 1 ? "Active Job" : "Active Jobs"}
                  </span>
                )}
              </div>

              {activeBookings.length > 0 ? (
                <div className="space-y-4">
                  {activeBookings.map((b) => {
                    const order = ["pending", "accepted", "en_route", "arrived", "in_progress", "completed"];
                    const currentIdx = order.indexOf(b.status);

                    return (
                      <div
                        key={b.id}
                        className="p-4 bg-slate-800/60 border border-slate-700/60 rounded-xl space-y-3"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-xs text-slate-200">
                                {b.service_type || b.service?.name}
                              </span>
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider uppercase bg-blue-500/15 text-blue-400 border border-blue-500/30">
                                {b.status}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-1">{b.address}</p>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-bold text-emerald-400 block">
                              ${Number(b.price).toFixed(2)}
                            </span>
                            <span className="text-[9px] font-mono text-slate-500">
                              #{b.id.slice(0, 8)}
                            </span>
                          </div>
                        </div>

                        {/* Mini Lifecycle Stepper */}
                        <div className="space-y-1.5 pt-1">
                          {[
                            { status: "pending", label: "Broadcast Sent" },
                            { status: "accepted", label: "Matched" },
                            { status: "en_route", label: "En Route" },
                            { status: "arrived", label: "Arrived" },
                            { status: "in_progress", label: "In Progress" },
                            { status: "completed", label: "Completed" },
                          ].map((step, idx) => {
                            const isComplete = currentIdx >= idx;
                            const isCurrent = b.status === step.status;
                            return (
                              <div key={step.status} className="flex items-center gap-2 text-[11px]">
                                <div
                                  className={`h-4 w-4 rounded-full flex items-center justify-center shrink-0 text-[9px] font-bold ${
                                    isComplete
                                      ? "bg-emerald-600 text-white"
                                      : "bg-slate-800 text-slate-500 border border-slate-700"
                                  }`}
                                >
                                  {isComplete ? "✓" : idx + 1}
                                </div>
                                <span
                                  className={`font-medium ${
                                    isCurrent ? "text-blue-400 font-semibold" : isComplete ? "text-slate-300" : "text-slate-500"
                                  }`}
                                >
                                  {step.label}
                                </span>
                              </div>
                            );
                          })}
                        </div>

                        {/* Verified Proof-of-Work Photos (if available) */}
                        {b.proof_photos && (b.proof_photos.before || b.proof_photos.after) && (
                          <div className="p-2.5 bg-slate-950/70 border border-emerald-900/40 rounded-xl space-y-1.5">
                            <div className="flex items-center gap-1.5 text-[9px] font-bold text-emerald-400 uppercase tracking-wider">
                              <Camera className="h-3 w-3" />
                              <span>Verified Proof-of-Work</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              {b.proof_photos.before && (
                                <div>
                                  <span className="text-[9px] text-slate-400 block mb-0.5">Before</span>
                                  <img
                                    src={b.proof_photos.before}
                                    alt="Before service"
                                    className="rounded-lg h-20 w-full object-cover border border-slate-800"
                                  />
                                </div>
                              )}
                              {b.proof_photos.after && (
                                <div>
                                  <span className="text-[9px] text-slate-400 block mb-0.5">After</span>
                                  <img
                                    src={b.proof_photos.after}
                                    alt="After service"
                                    className="rounded-lg h-20 w-full object-cover border border-slate-800"
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Assigned Provider Info */}
                        {b.professional && (
                          <div className="p-2.5 bg-blue-950/30 border border-blue-800/40 rounded-xl flex items-center justify-between text-xs">
                            <div>
                              <span className="text-[9px] text-blue-400 uppercase font-bold block">Assigned Provider</span>
                              <span className="font-semibold text-slate-200">
                                {b.professional.profile?.full_name || "Certified Technician"}
                              </span>
                              <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                                <span>{b.professional.trade}</span>
                                <span>•</span>
                                <span className="text-amber-400 flex items-center gap-0.5 font-medium">
                                  <Star className="h-2.5 w-2.5 fill-amber-400" />
                                  {b.professional.rating ? Number(b.professional.rating).toFixed(1) : "5.0"}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Link
                                href="/chat"
                                className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[11px] font-medium flex items-center gap-1 transition"
                                title="Chat with Provider"
                              >
                                <MessageSquare className="h-3 w-3" />
                                <span>Chat</span>
                              </Link>
                              <button
                                onClick={() => alert(`Calling provider: ${b.professional.profile?.phone || "555-0199"}`)}
                                className="p-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
                                title="Call Provider"
                              >
                                <Phone className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Mid-Job Add-ons Section */}
                        {(() => {
                          const addons = bookingAddonsMap[b.id] || [];
                          const approved = addons.filter((a) => a.status === "approved");
                          const pending = addons.filter((a) => a.status === "pending");
                          const approvedTotal = approved.reduce(
                            (sum, a) => sum + Number(a.cost || 0),
                            0
                          );

                          if (addons.length === 0) return null;

                          return (
                            <div className="space-y-2 border-t border-slate-700/50 pt-2">
                              {pending.length > 0 && (
                                <div className="flex items-center justify-between p-2.5 rounded-xl bg-amber-950/50 border border-amber-800/70 text-xs text-amber-300">
                                  <div className="flex items-center gap-2">
                                    <Clock className="h-4 w-4 text-amber-400 animate-pulse shrink-0" />
                                    <span>
                                      <strong>Add-on Suggested (+${Number(pending[0].cost).toFixed(2)}):</strong>{" "}
                                      {pending[0].custom_description ||
                                        pending[0].service?.name ||
                                        "Additional labor/part"}
                                    </span>
                                  </div>
                                  <button
                                    onClick={() => setPendingAddonToReview(pending[0])}
                                    className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] shadow-sm transition shrink-0 ml-2"
                                  >
                                    Review & Decide
                                  </button>
                                </div>
                              )}

                              {approved.length > 0 && (
                                <div className="flex items-center justify-between text-xs text-emerald-400 bg-emerald-950/30 px-3 py-1.5 rounded-lg border border-emerald-900/50">
                                  <span>Approved Mid-Job Add-ons ({approved.length})</span>
                                  <span className="font-bold">+${approvedTotal.toFixed(2)}</span>
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {/* Drill-down Navigation & Actions */}
                        <div className="pt-2 border-t border-slate-700/50 flex items-center justify-between">
                          <Link
                            href={`/bookings/${b.id}`}
                            className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
                          >
                            <span>Drill-Down Details</span>
                            <ChevronRight className="h-3.5 w-3.5" />
                          </Link>

                          {b.status === "completed" && b.professional_id && (
                            <button
                              onClick={() => setReviewBooking(b)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-sm transition"
                            >
                              <Sparkles className="h-3.5 w-3.5" />
                              <span>{reviewedBookingIds.includes(b.id) ? "Update Review" : "Rate Provider"}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
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
                        <Link
                          href={`/bookings/${b.id}`}
                          className="text-[10px] text-blue-400 hover:underline block mt-0.5"
                        >
                          View Details →
                        </Link>
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

      {/* Mid-Job Add-on Realtime Approval Modal */}
      <AddonApprovalModal
        isOpen={Boolean(pendingAddonToReview)}
        addon={pendingAddonToReview}
        onClose={() => setPendingAddonToReview(null)}
        onResponded={(approved) => {
          setPendingAddonToReview(null);
          loadInitialData();
          setMessage({
            type: "success",
            text: approved
              ? "Add-on approved! Your final invoice has been updated."
              : "Add-on declined. Your provider has been notified.",
          });
        }}
      />

      {/* User Profile & Contact Modal */}
      <UserProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        onProfileUpdated={loadInitialData}
      />

      {/* Wallet Payment Gateway Checkout Modal */}
      <WalletPaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        bookingData={checkoutPayload}
        onSuccess={handlePaymentSuccess}
      />
    </div>
  );
}
