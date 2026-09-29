"use client";

import { useEffect, useState } from "react";
import {
  createBrowserSupabaseClient,
  fetchUserTickets,
  fetchTicketThread,
  createSupportTicket,
  createTicketReply,
  markTicketAsRead,
  type Tables,
} from "@repo/db";
import {
  LifeBuoy,
  MessageSquare,
  Plus,
  Send,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowLeft,
  User,
  Shield,
  Briefcase,
} from "lucide-react";

interface SupportTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SupportTicketModal({ isOpen, onClose }: SupportTicketModalProps) {
  const supabase = createBrowserSupabaseClient("user");
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // View state: 'list' | 'create' | 'thread'
  const [view, setView] = useState<"list" | "create" | "thread">("list");
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [threadData, setThreadData] = useState<any | null>(null);
  const [loadingThread, setLoadingThread] = useState(false);

  // Create form state
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Reply form state
  const [replyText, setReplyText] = useState("");
  const [replying, setReplying] = useState(false);

  const loadTickets = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchUserTickets(supabase);
      setTickets(data);
    } catch (err: any) {
      setError(err.message || "Failed to load support tickets.");
    } finally {
      setLoading(false);
    }
  };

  const loadThread = async (ticketId: string) => {
    try {
      setLoadingThread(true);
      setError(null);
      const data = await fetchTicketThread(ticketId, supabase);
      setThreadData(data);
      markTicketAsRead(ticketId, supabase).catch(() => {});
    } catch (err: any) {
      setError(err.message || "Failed to load ticket thread.");
    } finally {
      setLoadingThread(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadTickets();
      setView("list");
      setSelectedTicketId(null);
      setThreadData(null);
    }
  }, [isOpen]);

  // Realtime subscription for replies and status changes
  useEffect(() => {
    if (!isOpen) return;

    const channel = supabase
      .channel("user-support-channel")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ticket_replies" },
        (payload) => {
          if (selectedTicketId && payload.new && (payload.new as any).ticket_id === selectedTicketId) {
            loadThread(selectedTicketId);
          }
          loadTickets();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "support_tickets" },
        () => {
          loadTickets();
          if (selectedTicketId) {
            loadThread(selectedTicketId);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOpen, selectedTicketId]);

  const handleOpenThread = (ticketId: string) => {
    setSelectedTicketId(ticketId);
    setView("thread");
    loadThread(ticketId);
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return;

    try {
      setSubmitting(true);
      setError(null);
      const created = await createSupportTicket(
        {
          subject: subject.trim(),
          message: message.trim(),
          creatorRole: "user",
        },
        supabase
      );

      setSubject("");
      setMessage("");
      await loadTickets();
      handleOpenThread(created.id);
    } catch (err: any) {
      setError(err.message || "Failed to create support ticket.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicketId || !replyText.trim()) return;

    try {
      setReplying(true);
      setError(null);
      await createTicketReply(
        {
          ticketId: selectedTicketId,
          message: replyText.trim(),
          senderRole: "user",
        },
        supabase
      );

      setReplyText("");
      await loadThread(selectedTicketId);
    } catch (err: any) {
      setError(err.message || "Failed to post reply.");
    } finally {
      setReplying(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="flex h-[90vh] w-full max-w-2xl flex-col rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div className="flex items-center gap-2">
            {view !== "list" && (
              <button
                onClick={() => setView("list")}
                className="mr-1 rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <div className="rounded-xl bg-blue-600/10 p-2 text-blue-400 border border-blue-500/20">
              <LifeBuoy className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                {view === "thread"
                  ? "Support Conversation"
                  : view === "create"
                  ? "Raise Support Ticket"
                  : "Customer Help & Support"}
              </h2>
              <p className="text-xs text-slate-400">Direct real-time communication with Dispatch HQ</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="m-4 flex items-center gap-2 rounded-xl border border-rose-800 bg-rose-950/40 p-3 text-xs text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* View 1: Ticket List */}
        {view === "list" && (
          <div className="flex-1 flex flex-col overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300">Your Tickets ({tickets.length})</span>
              <button
                onClick={() => setView("create")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white shadow-md shadow-blue-600/20 transition"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>New Ticket</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3">
              {loading ? (
                <div className="flex items-center justify-center py-12 text-xs text-slate-400">
                  <Loader2 className="h-5 w-5 animate-spin mr-2 text-blue-400" />
                  Loading your tickets...
                </div>
              ) : tickets.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-800 p-12 text-center text-xs text-slate-400">
                  <p className="font-semibold text-slate-300">No support tickets found</p>
                  <p className="mt-1 text-slate-500">
                    Need help with a booking or account? Click "New Ticket" to chat directly with Ops.
                  </p>
                </div>
              ) : (
                tickets.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => handleOpenThread(t.id)}
                    className="cursor-pointer rounded-xl border border-slate-800 bg-slate-950/50 p-4 hover:border-slate-700 hover:bg-slate-900/80 transition space-y-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="text-xs font-bold text-white flex items-center gap-2">
                          <span>{t.subject}</span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              t.status === "resolved"
                                ? "bg-emerald-950/80 text-emerald-400 border border-emerald-800/60"
                                : "bg-amber-950/80 text-amber-400 border border-amber-800/60"
                            }`}
                          >
                            {t.status}
                          </span>
                        </h4>
                        <p className="text-[11px] text-slate-400 line-clamp-1 mt-1">
                          {t.message}
                        </p>
                      </div>

                      <div className="text-right text-[10px] text-slate-500 shrink-0">
                        {new Date(t.created_at).toLocaleDateString()}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-900">
                      <span className="flex items-center gap-1 font-mono text-[10px]">
                        ID: #{t.id.slice(0, 8)}
                      </span>
                      <span className="flex items-center gap-1 text-blue-400 font-semibold">
                        <MessageSquare className="h-3 w-3" />
                        {t.reply_count} {t.reply_count === 1 ? "reply" : "replies"}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* View 2: Create Ticket */}
        {view === "create" && (
          <form onSubmit={handleCreateTicket} className="flex-1 overflow-y-auto p-6 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Subject
              </label>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Question regarding Booking #4f12 or invoice inquiry"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Explain your issue
              </label>
              <textarea
                required
                rows={6}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Provide as much detail as possible so our dispatch team can quickly assist you."
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <button
                type="button"
                onClick={() => setView("list")}
                className="px-4 py-2 rounded-xl border border-slate-700 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white disabled:opacity-50 transition flex items-center gap-2"
              >
                {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>Submit Ticket</span>
              </button>
            </div>
          </form>
        )}

        {/* View 3: Conversation Thread */}
        {view === "thread" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {loadingThread ? (
              <div className="flex-1 flex items-center justify-center text-xs text-slate-400">
                <Loader2 className="h-5 w-5 animate-spin mr-2 text-blue-400" />
                Loading conversation thread...
              </div>
            ) : !threadData ? (
              <div className="flex-1 p-6 text-xs text-slate-400">Ticket not found.</div>
            ) : (
              <>
                {/* Thread Overview */}
                <div className="border-b border-slate-800 bg-slate-950/40 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-white">{threadData.subject}</h3>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Opened on {new Date(threadData.created_at).toLocaleString()} • Ticket #{threadData.id.slice(0, 8)}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        threadData.status === "resolved"
                          ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                          : "bg-amber-950 text-amber-400 border border-amber-800"
                      }`}
                    >
                      {threadData.status}
                    </span>
                  </div>
                </div>

                {/* Messages scroll area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {/* Original message */}
                  <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <div className="flex items-center gap-1.5 font-semibold text-blue-400">
                        <User className="h-3 w-3" />
                        <span>You (Initial Message)</span>
                      </div>
                      <span>{new Date(threadData.created_at).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-xs text-slate-200 whitespace-pre-wrap leading-relaxed">
                      {threadData.message}
                    </p>
                  </div>

                  {/* Replies */}
                  {threadData.replies && threadData.replies.length > 0 ? (
                    threadData.replies.map((r: any) => {
                      const isAdmin = r.sender_role === "admin";
                      const isSelf = r.sender_role === "user";
                      return (
                        <div
                          key={r.id}
                          className={`rounded-xl border p-4 space-y-2 ${
                            isAdmin
                              ? "border-indigo-800/80 bg-indigo-950/30 ml-4"
                              : "border-slate-800 bg-slate-950/70 mr-4"
                          }`}
                        >
                          <div className="flex items-center justify-between text-[11px]">
                            <div className="flex items-center gap-1.5">
                              {isAdmin ? (
                                <span className="flex items-center gap-1 font-bold text-indigo-400">
                                  <Shield className="h-3 w-3" /> Admin Support Team
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 font-semibold text-blue-400">
                                  <User className="h-3 w-3" /> You
                                </span>
                              )}
                            </div>
                            <span className="text-slate-500 text-[10px]">
                              {new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-xs text-slate-200 whitespace-pre-wrap leading-relaxed">
                            {r.message}
                          </p>
                        </div>
                      );
                    })
                  ) : (
                    <div className="py-4 text-center text-[11px] text-slate-500">
                      No replies yet. An admin from dispatch will respond shortly.
                    </div>
                  )}
                </div>

                {/* Reply Form */}
                <form
                  onSubmit={handleSendReply}
                  className="border-t border-slate-800 bg-slate-900/90 p-4 flex gap-2 items-center"
                >
                  <input
                    type="text"
                    required
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Type your message to Ops..."
                    className="flex-1 px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    type="submit"
                    disabled={replying || !replyText.trim()}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white disabled:opacity-50 transition flex items-center gap-1.5 shrink-0"
                  >
                    {replying ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                    <span>Send</span>
                  </button>
                </form>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
