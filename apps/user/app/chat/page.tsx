"use client";
import { useState, useEffect, useRef } from "react";
import { createBrowserSupabaseClient, fetchChatMessages, sendChatMessage } from "@repo/db";
import Link from "next/link";

export default function ChatPage() {
  const [supabase] = useState(() => createBrowserSupabaseClient());
  const [userId, setUserId] = useState<string | null>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchUserAndBookings = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        const { data, error } = await supabase
          .from("bookings")
          .select("*, service:services(name), professional:profiles!bookings_professional_id_fkey(full_name)")
          .eq("user_id", user.id)
          .in("status", ["pending", "confirmed", "in_progress", "completed", "cancelled"])
          .order("created_at", { ascending: false });
        if (!error && data) {
          setBookings(data);
          if (data.length > 0) {
            setSelectedBooking(data[0]);
          }
        }
      }
      setLoading(false);
    };
    fetchUserAndBookings();
  }, [supabase]);

  useEffect(() => {
    if (!selectedBooking) return;

    const loadMessages = async () => {
      try {
        const msgs = await fetchChatMessages(selectedBooking.id);
        setMessages(msgs || []);
        scrollToBottom();
      } catch (err) {
        console.error("Failed to load messages", err);
      }
    };
    loadMessages();

    const channel = supabase
      .channel(`chat_${selectedBooking.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `booking_id=eq.${selectedBooking.id}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new]);
          scrollToBottom();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedBooking, supabase]);

  const scrollToBottom = () => {
    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !userId || !selectedBooking) return;

    const msgText = newMessage;
    setNewMessage("");

    try {
      await sendChatMessage(selectedBooking.id, msgText);
    } catch (err) {
      console.error("Failed to send message", err);
    }
  };

  const isChatLocked =
    selectedBooking?.status === "completed" || selectedBooking?.status === "cancelled";

  if (loading) {
    return <div className="p-8 text-center">Loading chat...</div>;
  }

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto p-4 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Messages</h1>
        <Link href="/dashboard" className="text-blue-600 hover:underline">
          Back to Dashboard
        </Link>
      </div>

      <div className="flex flex-col md:flex-row gap-6 h-[calc(100vh-140px)]">
        {/* Bookings Sidebar */}
        <div className="w-full md:w-1/3 border rounded-lg p-4 bg-white overflow-y-auto space-y-2">
          <h2 className="font-semibold text-lg mb-4">Active Bookings</h2>
          {bookings.length === 0 && <p className="text-gray-500">No bookings found.</p>}
          {bookings.map((b) => (
            <button
              key={b.id}
              onClick={() => setSelectedBooking(b)}
              className={`w-full text-left p-3 rounded-lg border transition-colors ${
                selectedBooking?.id === b.id
                  ? "bg-blue-50 border-blue-200"
                  : "hover:bg-gray-50 border-gray-200"
              }`}
            >
              <div className="font-medium">{b.service?.name || "Service"}</div>
              <div className="text-sm text-gray-500">
                {b.professional?.full_name || "Assigning..."}
              </div>
              <div className="text-xs text-gray-400 mt-1 capitalize">Status: {b.status}</div>
            </button>
          ))}
        </div>

        {/* Chat Area */}
        <div className="w-full md:w-2/3 flex flex-col border rounded-lg bg-white overflow-hidden">
          {selectedBooking ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b bg-gray-50">
                <div className="font-semibold">
                  {selectedBooking.service?.name}
                </div>
                <div className="text-sm text-gray-500">
                  With: {selectedBooking.professional?.full_name || "Pending Provider"}
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 p-4 overflow-y-auto bg-gray-50">
                {messages.length === 0 ? (
                  <div className="text-center text-gray-400 mt-10">No messages yet.</div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((msg, idx) => {
                      const isMe = msg.sender_id === userId;
                      return (
                        <div
                          key={idx}
                          className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                        >
                          <div
                            className={`max-w-[75%] px-4 py-2 rounded-2xl ${
                              isMe
                                ? "bg-blue-600 text-white rounded-br-none"
                                : "bg-gray-200 text-gray-800 rounded-bl-none"
                            }`}
                          >
                            {msg.content}
                          </div>
                          <span className="text-xs text-gray-400 mt-1">
                            {new Date(msg.created_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      );
                    })}
                    <div ref={bottomRef} />
                  </div>
                )}
              </div>

              {/* Input Area */}
              <div className="p-4 border-t bg-white">
                {isChatLocked ? (
                  <div className="text-center text-gray-500 p-2 bg-gray-100 rounded">
                    This conversation has ended
                  </div>
                ) : (
                  <form onSubmit={handleSendMessage} className="flex gap-2">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type your message..."
                      className="flex-1 border rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
                    />
                    <button
                      type="submit"
                      disabled={!newMessage.trim()}
                      className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      Send
                    </button>
                  </form>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              Select a booking to start chatting
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
