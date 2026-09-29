"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useRef } from "react";
import { 
  createBrowserSupabaseClient, 
  fetchActiveJobsForPro, 
  fetchChatMessages, 
  sendChatMessage,
  markChatAsRead 
} from "@repo/db";
import Link from "next/link";
import { ArrowLeft, Send, MessageSquare, Loader2, User } from "lucide-react";

export default function ChatPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const supabase = createBrowserSupabaseClient("professional");

  useEffect(() => {
    async function loadInitialData() {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      
      try {
        const activeJobs = await fetchActiveJobsForPro(supabase);
        setJobs(activeJobs);
        if (activeJobs.length > 0) {
          setSelectedJobId(activeJobs[0].id);
        }
      } catch (err) {
        console.error("Failed to load jobs", err);
      } finally {
        setLoading(false);
      }
    }
    loadInitialData();
  }, []);

  useEffect(() => {
    if (!selectedJobId) return;

    async function loadMessages(jobId: string) {
      try {
        const data = await fetchChatMessages(jobId);
        setMessages(data || []);
        scrollToBottom();
        markChatAsRead(jobId, supabase).catch(() => {});
      } catch (err) {
        console.error("Failed to load messages", err);
      }
    }
    loadMessages(selectedJobId);

    // Subscribe to new messages
    const channel = supabase.channel(`chat_${selectedJobId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `booking_id=eq.${selectedJobId}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new]);
          scrollToBottom();
          if (payload.new && (payload.new as any).sender_id !== user?.id) {
            markChatAsRead(selectedJobId, supabase).catch(() => {});
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedJobId, user?.id]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedJobId || !user) return;

    const text = newMessage;
    setNewMessage("");

    try {
      await sendChatMessage(selectedJobId, text);
    } catch (err) {
      console.error("Failed to send message", err);
    }
  };

  const selectedJob = jobs.find(j => j.id === selectedJobId);
  const isChatLocked = selectedJob?.status === "completed" || selectedJob?.status === "cancelled";

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <Loader2 className="animate-spin h-6 w-6 mr-2" /> Loading chats...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md px-4 py-3 sm:px-6">
        <div className="mx-auto max-w-6xl flex items-center gap-4">
          <Link href="/" className="text-slate-400 hover:text-white transition p-2 rounded-lg hover:bg-slate-800">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-emerald-400" />
            Customer Messages
          </h1>
        </div>
      </header>

      <main className="flex-1 mx-auto max-w-6xl w-full px-4 py-6 sm:px-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Sidebar */}
        <div className="md:col-span-1 border border-slate-800 bg-slate-900 rounded-2xl overflow-hidden flex flex-col h-[calc(100vh-120px)]">
          <div className="p-4 border-b border-slate-800">
            <h2 className="font-semibold text-white">Active Jobs</h2>
          </div>
          <div className="overflow-y-auto flex-1 p-2 space-y-1">
            {jobs.length === 0 ? (
              <p className="text-sm text-slate-500 p-4 text-center">No active jobs available for chat.</p>
            ) : (
              jobs.map(job => (
                <button
                  key={job.id}
                  onClick={() => setSelectedJobId(job.id)}
                  className={`w-full text-left p-3 rounded-xl transition ${selectedJobId === job.id ? 'bg-emerald-950/40 border border-emerald-900' : 'hover:bg-slate-800 border border-transparent'}`}
                >
                  <p className="text-sm font-semibold text-white">{job.service_type}</p>
                  <p className="text-xs text-slate-400 truncate mt-1">{job.customer?.full_name || 'Customer'}</p>
                  <span className={`text-[10px] uppercase font-bold mt-2 inline-block px-2 py-0.5 rounded-full ${
                    job.status === 'completed' ? 'bg-emerald-900 text-emerald-300' :
                    job.status === 'cancelled' ? 'bg-rose-900 text-rose-300' : 'bg-slate-800 text-slate-300'
                  }`}>
                    {job.status}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className="md:col-span-2 border border-slate-800 bg-slate-900 rounded-2xl flex flex-col h-[calc(100vh-120px)] overflow-hidden">
          {selectedJobId ? (
            <>
              <div className="p-4 border-b border-slate-800 bg-slate-900">
                <h3 className="font-bold text-white">{selectedJob?.service_type}</h3>
                <p className="text-xs text-slate-400">Order #{selectedJob?.id.slice(0,8)}</p>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-950/50">
                {messages.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-sm text-slate-500">
                    No messages yet. Send a message to the customer!
                  </div>
                ) : (
                  messages.map((msg, i) => {
                    const isMine = msg.sender_id === user?.id;
                    return (
                      <div key={i} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] rounded-2xl px-4 py-2 ${isMine ? 'bg-emerald-600 text-white rounded-br-none' : 'bg-slate-800 text-slate-200 rounded-bl-none'}`}>
                          <p className="text-sm">{msg.message}</p>
                          <span className="text-[10px] opacity-60 mt-1 block text-right">
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="p-4 border-t border-slate-800 bg-slate-900">
                {isChatLocked ? (
                  <div className="text-center text-sm text-slate-500 p-2 bg-slate-950 rounded-lg">
                    Chat is locked because this job is {selectedJob.status}.
                  </div>
                ) : (
                  <form onSubmit={handleSendMessage} className="flex gap-2">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type your message..."
                      className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                    />
                    <button
                      type="submit"
                      disabled={!newMessage.trim()}
                      className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl px-4 py-2.5 flex items-center justify-center transition"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </form>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
              <MessageSquare className="h-12 w-12 opacity-20 mb-4" />
              <p>Select a job to view chat</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
