"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  createBrowserSupabaseClient,
  fetchChatMessages,
  sendChatMessage,
  getCurrentUser,
  markChatAsRead,
} from "@repo/db";
import {
  ArrowLeft,
  Send,
  MessageSquare,
  Shield,
  User as UserIcon,
  Clock,
  AlertCircle,
  Wrench,
  Headphones,
  CheckCircle2,
} from "lucide-react";

export default function CustomerChatPage() {
  const [supabase] = useState(() => createBrowserSupabaseClient());
  const [userId, setUserId] = useState<string | null>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<"professional" | "admin">("professional");
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load User & Bookings
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        setLoading(true);
        const user = await getCurrentUser(supabase);
        if (!user) return;
        if (!isMounted) return;
        setUserId(user.id);

        const { data, error } = await supabase
          .from("bookings")
          .select(`
            *,
            service:services(name, icon),
            professional:professionals(
              id,
              full_name,
              trade,
              rating,
              profile:profiles(full_name, phone)
            )
          `)
          .eq("customer_id", user.id)
          .in("status", ["pending", "accepted", "en_route", "arrived", "in_progress", "completed", "cancelled"])
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Error loading chat bookings:", error);
          return;
        }

        if (isMounted) {
          setBookings(data || []);
          if (data && data.length > 0) {
            setSelectedBooking(data[0]);
          }
        }
      } catch (err) {
        console.error("Chat init error:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [supabase]);

  // Load Messages & Setup Realtime for selected booking + channel
  useEffect(() => {
    if (!selectedBooking) return;
    let isMounted = true;
    let channel: any = null;

    const loadMessages = async () => {
      try {
        const msgs = await fetchChatMessages(selectedBooking.id, activeTab, supabase);
        if (isMounted) {
          setMessages(msgs || []);
          scrollToBottom();
          markChatAsRead(selectedBooking.id, supabase).catch(() => {});
        }
      } catch (err) {
        console.error("Failed to load messages:", err);
      }
    };

    loadMessages();

    const channelName = `chat-${selectedBooking.id}-${activeTab}-${Date.now()}`;
    channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `booking_id=eq.${selectedBooking.id}`,
        },
        (payload) => {
          if (!isMounted) return;
          const newMsg = payload.new as any;
          // Filter to active tab if channel_type is specified
          if (!newMsg.channel_type || newMsg.channel_type === activeTab) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
            scrollToBottom();
            if (newMsg.sender_id !== userId) {
              markChatAsRead(selectedBooking.id, supabase).catch(() => {});
            }
          }
        }
      );
    channel.subscribe();

    return () => {
      isMounted = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [selectedBooking, activeTab, supabase]);

  const scrollToBottom = () => {
    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !userId || !selectedBooking || sending) return;

    const text = newMessage.trim();
    setNewMessage("");
    setSending(true);

    try {
      await sendChatMessage(selectedBooking.id, text, {
        channelType: activeTab,
        participantRole: "customer",
        isAdmin: false,
      }, supabase);
      scrollToBottom();
    } catch (err: any) {
      console.error("Failed to send message:", err);
      alert(err.message || "Failed to send message. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const isChatLocked =
    selectedBooking?.status === "completed" || selectedBooking?.status === "cancelled";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 transition"
              title="Return to Dashboard"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-base font-bold text-white flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-blue-400" />
                Service Coordination Chat
              </h1>
              <p className="text-xs text-slate-400">
                Direct messaging with assigned providers & 24/7 admin support
              </p>
            </div>
          </div>

          {selectedBooking && (
            <div className="hidden sm:flex items-center gap-2">
              <span className="text-xs text-slate-400">Booking:</span>
              <span className="font-mono text-xs text-blue-400 font-semibold bg-blue-950/50 border border-blue-800/40 px-2 py-0.5 rounded-md">
                #{selectedBooking.id.slice(0, 8)}
              </span>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6 flex flex-col">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <Clock className="h-8 w-8 text-blue-500 animate-spin" />
              <p className="text-xs text-slate-400">Loading conversation channels...</p>
            </div>
          </div>
        ) : bookings.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center p-8 bg-slate-900/60 border border-slate-800 rounded-2xl max-w-md">
              <MessageSquare className="h-12 w-12 text-slate-600 mx-auto mb-3" />
              <h3 className="font-semibold text-slate-200 mb-1">No Active Conversations</h3>
              <p className="text-xs text-slate-400 mb-4">
                You do not have any active bookings yet. Broadcast a service request to start chatting with technicians and support.
              </p>
              <Link
                href="/"
                className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold transition"
              >
                Go to Service Catalog
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 h-[calc(100vh-140px)]">
            {/* Left Sidebar: Booking Selection */}
            <div className="lg:col-span-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 backdrop-blur-sm shadow-xl flex flex-col overflow-hidden">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Select Booking
                </span>
                <span className="text-xs font-mono text-slate-500">
                  {bookings.length} {bookings.length === 1 ? "order" : "orders"}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {bookings.map((b) => {
                  const isSelected = selectedBooking?.id === b.id;
                  const proName =
                    b.professional?.profile?.full_name ||
                    b.professional?.full_name ||
                    (b.status === "pending" ? "Searching for Pro..." : "Assigned Provider");

                  return (
                    <button
                      key={b.id}
                      onClick={() => setSelectedBooking(b)}
                      className={`w-full text-left p-3 rounded-xl border transition-all ${
                        isSelected
                          ? "bg-blue-600/15 border-blue-500 text-white shadow-md shadow-blue-500/10"
                          : "bg-slate-800/40 border-slate-800 hover:border-slate-700 text-slate-300"
                      }`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-semibold text-xs text-slate-100 flex items-center gap-1.5">
                          <Wrench className="h-3 w-3 text-blue-400" />
                          {b.service_type || b.service?.name || "Service Request"}
                        </span>
                        <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/40">
                          ${Number(b.price).toFixed(2)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span className="truncate max-w-[150px]">{proName}</span>
                        <span className="font-mono text-[9px] uppercase px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700">
                          {b.status}
                        </span>
                      </div>

                      <div className="mt-1 text-[10px] text-slate-500 font-mono">
                        #{b.id.slice(0, 8)} • {new Date(b.created_at).toLocaleDateString()}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right Panel: Chat Interface with Multi-Party Tab Switcher */}
            <div className="lg:col-span-8 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm shadow-xl flex flex-col overflow-hidden">
              {selectedBooking ? (
                <>
                  {/* Top Bar with Channel Switcher Tabs */}
                  <div className="p-3 border-b border-slate-800 bg-slate-900/80">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-slate-200">
                            {selectedBooking.service_type || selectedBooking.service?.name}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            {selectedBooking.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {selectedBooking.address}
                        </p>
                      </div>

                      {/* Tab Switcher */}
                      <div className="flex items-center bg-slate-950/80 border border-slate-800 p-1 rounded-xl">
                        <button
                          type="button"
                          onClick={() => setActiveTab("professional")}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                            activeTab === "professional"
                              ? "bg-blue-600 text-white shadow-sm shadow-blue-500/20"
                              : "text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          <UserIcon className="h-3.5 w-3.5" />
                          <span>Provider</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setActiveTab("admin")}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                            activeTab === "admin"
                              ? "bg-indigo-600 text-white shadow-sm shadow-indigo-500/20"
                              : "text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          <Headphones className="h-3.5 w-3.5" />
                          <span>Support & Admin</span>
                        </button>
                      </div>
                    </div>

                    {/* Active Channel Context Banner */}
                    <div className="mt-2.5 px-3 py-1.5 bg-slate-950/50 border border-slate-800/80 rounded-lg flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-2">
                        {activeTab === "professional" ? (
                          <>
                            <span className="text-blue-400 font-semibold flex items-center gap-1">
                              <UserIcon className="h-3 w-3" /> Provider Channel:
                            </span>
                            <span className="text-slate-300">
                              {selectedBooking.professional?.profile?.full_name ||
                                selectedBooking.professional?.full_name ||
                                "Awaiting assigned technician"}
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="text-indigo-400 font-semibold flex items-center gap-1">
                              <Shield className="h-3 w-3" /> Platform Support Channel:
                            </span>
                            <span className="text-slate-300">
                              Operations desk & escalation specialists
                            </span>
                          </>
                        )}
                      </div>

                      <Link
                        href={`/bookings/${selectedBooking.id}`}
                        className="text-blue-400 hover:underline text-[10px]"
                      >
                        Order Details →
                      </Link>
                    </div>
                  </div>

                  {/* Messages Feed */}
                  <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-950/40">
                    {messages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-slate-500 text-xs text-center py-12">
                        <MessageSquare className="h-8 w-8 text-slate-600 mb-2 opacity-50" />
                        <p className="font-semibold text-slate-400 mb-1">
                          No messages yet in {activeTab === "professional" ? "Provider" : "Admin"} channel.
                        </p>
                        <p className="text-[11px] text-slate-500 max-w-xs">
                          {activeTab === "professional"
                            ? "Use this channel to clarify directions, parking instructions, or job access."
                            : "Use this channel if you need urgent dispatch assistance or price adjustments."}
                        </p>
                      </div>
                    ) : (
                      messages.map((msg) => {
                        const isMe = msg.sender_id === userId;
                        const isAdminMsg = msg.is_admin || msg.participant_role === "admin";
                        const isProMsg = msg.participant_role === "professional" || (!isAdminMsg && !isMe);

                        return (
                          <div
                            key={msg.id}
                            className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                          >
                            <div className="flex items-center gap-1.5 mb-1 px-1">
                              <span className="text-[10px] font-semibold text-slate-400">
                                {isMe
                                  ? "You"
                                  : isAdminMsg
                                  ? "Support Admin"
                                  : msg.sender?.full_name || "Provider"}
                              </span>
                              {isAdminMsg && (
                                <span className="text-[8px] uppercase tracking-wider font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1 rounded">
                                  Support
                                </span>
                              )}
                              {isProMsg && !isMe && (
                                <span className="text-[8px] uppercase tracking-wider font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 px-1 rounded">
                                  Pro
                                </span>
                              )}
                              <span className="text-[9px] text-slate-500">
                                {new Date(msg.created_at).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>

                            <div
                              className={`max-w-[75%] px-3.5 py-2 rounded-2xl text-xs leading-relaxed shadow-sm ${
                                isMe
                                  ? "bg-blue-600 text-white rounded-br-sm"
                                  : isAdminMsg
                                  ? "bg-indigo-950/80 text-indigo-100 border border-indigo-700/60 rounded-bl-sm"
                                  : "bg-slate-800 text-slate-100 border border-slate-700 rounded-bl-sm"
                              }`}
                            >
                              {msg.message}
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={bottomRef} />
                  </div>

                  {/* Message Input Footer */}
                  <div className="p-3 border-t border-slate-800 bg-slate-900/80">
                    {isChatLocked ? (
                      <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                        <AlertCircle className="h-4 w-4 text-slate-500" />
                        <span>This service request has been concluded. Direct messaging is archived.</span>
                      </div>
                    ) : (
                      <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          placeholder={`Message ${activeTab === "professional" ? "Provider" : "Support Team"}...`}
                          disabled={sending}
                          className="flex-1 bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                        />
                        <button
                          type="submit"
                          disabled={!newMessage.trim() || sending}
                          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-sm ${
                            activeTab === "professional"
                              ? "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/25"
                              : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/25"
                          } disabled:opacity-50`}
                        >
                          <Send className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Send</span>
                        </button>
                      </form>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-slate-500 text-xs">
                  Select a booking on the left to begin coordination.
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
