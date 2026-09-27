"use client";

import React, { useEffect, useState } from "react";
import {
  MessageSquare,
  Send,
  CheckCircle2,
  Clock,
  User,
  Briefcase,
  Shield,
  Loader2,
  RefreshCw,
  Search,
  Filter,
  X,
  Phone,
  Mail,
  AlertCircle,
} from "lucide-react";
import {
  createBrowserSupabaseClient,
  fetchAllTicketsAdmin,
  fetchTicketThread,
  createTicketReply,
  updateTicketStatusAdmin,
  markTicketAsRead,
} from "@repo/db";

export function SupportHub() {
  const supabase = createBrowserSupabaseClient();

  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  // Selected ticket for conversation thread
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [activeThread, setActiveThread] = useState<any | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replying, setReplying] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadTickets = async () => {
    try {
      setLoading(true);
      const data = await fetchAllTicketsAdmin(supabase);
      setTickets(data);
    } catch (err: any) {
      console.error("Error loading tickets:", err);
      setMessage({ type: "error", text: err.message || "Failed to load support tickets." });
    } finally {
      setLoading(false);
    }
  };

  const loadThread = async (ticketId: string) => {
    try {
      setThreadLoading(true);
      setSelectedTicketId(ticketId);
      const thread = await fetchTicketThread(ticketId, supabase);
      setActiveThread(thread);
      markTicketAsRead(ticketId, supabase).catch(() => {});
    } catch (err: any) {
      console.error("Error loading ticket thread:", err);
      setMessage({ type: "error", text: "Failed to load ticket thread." });
    } finally {
      setThreadLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();

    // Subscribe to realtime updates for support_tickets and ticket_replies
    const channel = supabase
      .channel("admin-support-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, () => {
        loadTickets();
        if (selectedTicketId) loadThread(selectedTicketId);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "ticket_replies" }, () => {
        if (selectedTicketId) loadThread(selectedTicketId);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedTicketId]);

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedTicketId) return;

    try {
      setReplying(true);
      await createTicketReply(
        {
          ticketId: selectedTicketId,
          message: replyText.trim(),
          senderRole: "admin",
        },
        supabase
      );
      setReplyText("");
      await loadThread(selectedTicketId);
    } catch (err: any) {
      console.error("Reply error:", err);
      setMessage({ type: "error", text: err.message || "Failed to post reply." });
    } finally {
      setReplying(false);
    }
  };

  const handleToggleTicketStatus = async () => {
    if (!activeThread) return;
    const newStatus = activeThread.status === "open" ? "resolved" : "open";
    try {
      await updateTicketStatusAdmin(activeThread.id, newStatus, supabase);
      setActiveThread((prev: any) => ({ ...prev, status: newStatus }));
      setMessage({
        type: "success",
        text: `Ticket #${activeThread.id.slice(0, 8)} marked as ${newStatus}!`,
      });
      await loadTickets();
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Status toggle failed." });
    }
  };

  // Filtered tickets
  const filteredTickets = tickets.filter((t) => {
    const q = search.toLowerCase();
    const subjectMatch = (t.subject || "").toLowerCase().includes(q);
    const creatorMatch = (t.creator?.full_name || "").toLowerCase().includes(q);
    const emailMatch = (t.creator?.email || "").toLowerCase().includes(q);

    const matchesQuery = subjectMatch || creatorMatch || emailMatch;
    const matchesStatus = statusFilter === "all" || t.status === statusFilter;
    const matchesRole = roleFilter === "all" || t.creator_role === roleFilter;

    return matchesQuery && matchesStatus && matchesRole;
  });

  const openTicketsCount = tickets.filter((t) => t.status === "open").length;
  const resolvedTicketsCount = tickets.filter((t) => t.status === "resolved").length;

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Total Support Inquiries</span>
            <MessageSquare className="h-4 w-4 text-indigo-400" />
          </div>
          <p className="mt-2 text-2xl font-black text-white">{tickets.length}</p>
          <p className="mt-1 text-[11px] text-slate-400">Platform-wide customer & pro tickets</p>
        </div>

        <div className="rounded-2xl border border-amber-800/60 bg-amber-950/20 p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-amber-300">Open & In-Progress Tickets</span>
            <Clock className="h-4 w-4 text-amber-400 animate-pulse" />
          </div>
          <p className="mt-2 text-2xl font-black text-amber-400">{openTicketsCount}</p>
          <p className="mt-1 text-[11px] text-slate-400">Awaiting administrative response</p>
        </div>

        <div className="rounded-2xl border border-emerald-800/60 bg-emerald-950/20 p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-emerald-300">Successfully Resolved</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </div>
          <p className="mt-2 text-2xl font-black text-emerald-400">{resolvedTicketsCount}</p>
          <p className="mt-1 text-[11px] text-slate-400">Issues addressed and finalized</p>
        </div>
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

      {/* Main Support Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Tickets Feed (col-5) */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-800 bg-slate-900 p-5 space-y-4">
          <div className="flex flex-col gap-3 border-b border-slate-800 pb-3">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-sm text-white">Tickets Feed</h3>
              <button
                onClick={loadTickets}
                className="text-xs text-indigo-400 hover:underline flex items-center gap-1 font-semibold"
              >
                <RefreshCw className="h-3 w-3" />
                <span>Refresh</span>
              </button>
            </div>

            {/* Filter controls */}
            <div className="flex flex-wrap gap-2">
              <div className="relative flex-1 min-w-[140px]">
                <Search className="h-3 w-3 text-slate-500 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter subject, user..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-[11px] rounded-lg pl-7 pr-2 py-1.5 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-[11px] rounded-lg px-2 py-1.5 text-slate-300 font-semibold focus:outline-none focus:border-indigo-500"
              >
                <option value="all">All Status</option>
                <option value="open">Open</option>
                <option value="resolved">Resolved</option>
              </select>

              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-[11px] rounded-lg px-2 py-1.5 text-slate-300 font-semibold focus:outline-none focus:border-indigo-500"
              >
                <option value="all">All Roles</option>
                <option value="user">Customers</option>
                <option value="professional">Pros</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center p-12 text-xs text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin mr-2 text-indigo-400" />
              Loading tickets...
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="text-center py-12 text-xs text-slate-500">
              No support tickets found matching your filter criteria.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
              {filteredTickets.map((t) => {
                const isSelected = selectedTicketId === t.id;
                const isResolved = t.status === "resolved";

                return (
                  <div
                    key={t.id}
                    onClick={() => loadThread(t.id)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? "bg-indigo-950/40 border-indigo-500 shadow-md shadow-indigo-600/10"
                        : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-bold text-xs text-slate-100 truncate max-w-[200px]">
                        {t.subject}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${
                          isResolved
                            ? "bg-emerald-950 border border-emerald-800 text-emerald-300"
                            : "bg-amber-950 border border-amber-800 text-amber-300"
                        }`}
                      >
                        {isResolved ? (
                          <CheckCircle2 className="h-2.5 w-2.5" />
                        ) : (
                          <Clock className="h-2.5 w-2.5" />
                        )}
                        <span>{t.status}</span>
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-400 line-clamp-2 mb-2">{t.message}</p>

                    <div className="flex justify-between items-center text-[10px] text-slate-500">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase ${
                            t.creator_role === "professional"
                              ? "bg-emerald-950/80 text-emerald-400 border border-emerald-800/40"
                              : "bg-blue-950/80 text-blue-400 border border-blue-800/40"
                          }`}
                        >
                          {t.creator_role === "professional" ? "Provider" : "Customer"}
                        </span>
                        <span className="truncate max-w-[120px] font-medium text-slate-300">
                          {t.creator?.full_name || t.creator?.email || "Member"}
                        </span>
                      </div>
                      <span className="font-mono">{t.reply_count || 0} replies</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Active Ticket Thread (col-7) */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-800 bg-slate-900 p-5 flex flex-col justify-between min-h-[500px]">
          {threadLoading ? (
            <div className="flex flex-col items-center justify-center flex-1 text-xs text-slate-400 py-20">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-400 mb-2" />
              <span>Loading conversation thread...</span>
            </div>
          ) : !activeThread ? (
            <div className="flex flex-col items-center justify-center flex-1 text-xs text-slate-500 py-20">
              <MessageSquare className="h-10 w-10 text-slate-700 mb-3" />
              <p className="font-semibold text-slate-400">Select a Ticket from the Feed</p>
              <p className="text-slate-600 mt-1">Review inquiries, chat with customers/pros, and mark issues resolved.</p>
            </div>
          ) : (
            <div className="flex flex-col h-full space-y-4">
              {/* Thread Header */}
              <div className="border-b border-slate-800 pb-4 flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-indigo-400 font-bold">
                      #{activeThread.id.slice(0, 8)}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        activeThread.status === "resolved"
                          ? "bg-emerald-950 border border-emerald-800 text-emerald-300"
                          : "bg-amber-950 border border-amber-800 text-amber-300"
                      }`}
                    >
                      {activeThread.status}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-white mt-1">{activeThread.subject}</h3>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-1.5 font-mono">
                    <span className="flex items-center gap-1 text-slate-300">
                      <User className="h-3 w-3 text-indigo-400" />
                      {activeThread.creator?.full_name || "Member"} ({activeThread.creator_role})
                    </span>
                    <span className="flex items-center gap-1 text-slate-400">
                      <Mail className="h-3 w-3" /> {activeThread.creator?.email}
                    </span>
                    {activeThread.creator?.mobile && (
                      <span className="flex items-center gap-1 text-slate-400">
                        <Phone className="h-3 w-3" /> {activeThread.creator?.mobile}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={handleToggleTicketStatus}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                    activeThread.status === "open"
                      ? "bg-emerald-950/80 border-emerald-800 text-emerald-300 hover:bg-emerald-900/60"
                      : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  {activeThread.status === "open" ? "Mark Resolved" : "Reopen Ticket"}
                </button>
              </div>

              {/* Conversation Messages Thread */}
              <div className="flex-1 space-y-3 overflow-y-auto max-h-[420px] p-2 pr-3">
                {/* Initial Ticket Message */}
                <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl space-y-1.5">
                  <div className="flex justify-between items-center text-[10px] text-slate-500">
                    <span className="font-semibold text-slate-300">
                      {activeThread.creator?.full_name || "Creator"} (Initial Inquiry)
                    </span>
                    <span>{new Date(activeThread.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-slate-200 whitespace-pre-wrap">{activeThread.message}</p>
                </div>

                {/* Conversation Replies */}
                {activeThread.replies?.map((reply: any) => {
                  const isAdmin = reply.sender_role === "admin";
                  return (
                    <div
                      key={reply.id}
                      className={`p-3.5 rounded-xl border space-y-1.5 ${
                        isAdmin
                          ? "bg-indigo-950/30 border-indigo-800/60 ml-6"
                          : "bg-slate-950/60 border-slate-800 mr-6"
                      }`}
                    >
                      <div className="flex justify-between items-center text-[10px]">
                        <span className={`font-semibold flex items-center gap-1 ${isAdmin ? "text-indigo-400" : "text-slate-300"}`}>
                          {isAdmin && <Shield className="h-3 w-3" />}
                          {isAdmin ? "HomeServe Support (Admin)" : reply.sender?.full_name || "Member"}
                        </span>
                        <span className="text-slate-500">{new Date(reply.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p className="text-xs text-slate-200 whitespace-pre-wrap">{reply.message}</p>
                    </div>
                  );
                })}
              </div>

              {/* Admin Reply Form */}
              <form onSubmit={handleSendReply} className="pt-3 border-t border-slate-800 flex gap-2">
                <input
                  type="text"
                  placeholder="Type an official admin response to resolve this issue..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="submit"
                  disabled={replying || !replyText.trim()}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition"
                >
                  {replying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  <span>Reply</span>
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
