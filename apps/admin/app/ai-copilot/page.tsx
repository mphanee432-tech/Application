"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Sparkles,
  Bot,
  Send,
  Save,
  RotateCcw,
  RefreshCw,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Loader2,
  MessageSquare,
  Settings2,
  Trash2,
  Copy,
  Check,
  Zap,
  TrendingUp,
  Briefcase,
  Headphones,
  Sliders,
} from "lucide-react";
import {
  getCopilotConfigAction,
  updateCopilotPromptAction,
  chatWithCopilotAction,
} from "../actions";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

const DEFAULT_PROMPT =
  "You are the Universal Admin AI Copilot for the Home Services Platform (HomeServe). Your job is to assist platform operations admins with real-time operational insights, booking dispatch summaries, payout oversight, customer dispute analysis, and drafting professional customer support responses. When providing financial figures, format them using Indian Rupees (₹). Always be precise, professional, concise, and helpful.";

const QUICK_PROMPT_CHIPS = [
  {
    label: "📊 Operations Briefing",
    prompt: "Provide a quick summary of today's bookings, active dispatches, and emergency status.",
    icon: TrendingUp,
  },
  {
    label: "❌ Cancelled Jobs & Reasons",
    prompt: "Summarize recent cancelled bookings and their reported reasons.",
    icon: AlertCircle,
  },
  {
    label: "🎫 Open Support Tickets",
    prompt: "Review open customer support tickets and highlight any urgent disputes.",
    icon: Headphones,
  },
  {
    label: "💰 Payouts & 80/20 Cash Flow",
    prompt: "Check pending professional payout requests under the 80/20 platform ledger.",
    icon: Briefcase,
  },
  {
    label: "✍️ Draft Ticket Refund Apology",
    prompt: "Draft an empathetic response for support ticket regarding an overcharged repair and authorize a ₹250 wallet credit.",
    icon: MessageSquare,
  },
];

export default function AiCopilotPage() {
  const [activeTab, setActiveTab] = useState<"editor" | "chat">("chat");

  // System Prompt Editor State
  const [systemPrompt, setSystemPrompt] = useState<string>("");
  const [model, setModel] = useState<string>("gemini-1.5-pro");
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [configLoading, setConfigLoading] = useState<boolean>(true);
  const [savingConfig, setSavingConfig] = useState<boolean>(false);
  const [configSuccessMsg, setConfigSuccessMsg] = useState<string | null>(null);
  const [configErrorMsg, setConfigErrorMsg] = useState<string | null>(null);

  // Live Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome-1",
      role: "assistant",
      content:
        "👋 **Welcome to the HomeServe Operations AI Copilot!**\n\nI have real-time access to the platform database. You can ask me to:\n- 📊 Summarize today's bookings, dispatch statuses, and field operations\n- ❌ Analyze recent cancellations and customer feedback\n- 🎫 Inspect open support tickets & draft resolution responses\n- 💰 Audit professional payouts under the 80/20 split\n\n*How can I assist operations today?*",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [inputMessage, setInputMessage] = useState<string>("");
  const [chatLoading, setChatLoading] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (activeTab === "chat") {
      scrollToBottom();
    }
  }, [messages, chatLoading, activeTab]);

  // Load Prompt Config from Server Action
  const loadConfig = async () => {
    setConfigLoading(true);
    setConfigErrorMsg(null);
    try {
      const res = await getCopilotConfigAction();
      if (res.success && res.data) {
        setSystemPrompt(res.data.system_prompt || DEFAULT_PROMPT);
        setModel(res.data.model || "gemini-1.5-pro");
        setLastUpdated(res.data.updated_at ? new Date(res.data.updated_at).toLocaleString() : null);
      } else {
        setSystemPrompt(DEFAULT_PROMPT);
      }
    } catch (err: any) {
      console.error("Failed loading copilot config:", err);
      setConfigErrorMsg("Could not fetch active configuration. Using defaults.");
      setSystemPrompt(DEFAULT_PROMPT);
    } finally {
      setConfigLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  // Save Prompt Config via Server Action
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!systemPrompt.trim()) return;

    setSavingConfig(true);
    setConfigSuccessMsg(null);
    setConfigErrorMsg(null);

    try {
      const res = await updateCopilotPromptAction(systemPrompt.trim());
      if (res.success) {
        setConfigSuccessMsg("System prompt updated successfully! All future Copilot queries will use these instructions.");
        setLastUpdated(new Date().toLocaleString());
        setTimeout(() => setConfigSuccessMsg(null), 5000);
      } else {
        setConfigErrorMsg(res.error || "Failed to update system prompt.");
      }
    } catch (err: any) {
      setConfigErrorMsg(err.message || "An unexpected error occurred.");
    } finally {
      setSavingConfig(false);
    }
  };

  // Reset to Default Prompt
  const handleResetDefaultPrompt = () => {
    setSystemPrompt(DEFAULT_PROMPT);
    setConfigSuccessMsg("Restored default system prompt. Click 'Save Instructions' to apply.");
    setTimeout(() => setConfigSuccessMsg(null), 4000);
  };

  // Send Chat Message via Server Action
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend ?? inputMessage).trim();
    if (!text || chatLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInputMessage("");
    setChatLoading(true);

    try {
      // Map history for server action
      const payloadMessages = nextMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await chatWithCopilotAction(payloadMessages);

      if (res.success && (res.reply || (res as any).data?.reply)) {
        const replyText = res.reply || (res as any).data?.reply || "";
        const assistantMsg: ChatMessage = {
          id: `bot-${Date.now()}`,
          role: "assistant",
          content: replyText,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } else {
        const errorMsg: ChatMessage = {
          id: `bot-err-${Date.now()}`,
          role: "assistant",
          content: `⚠️ **Copilot Error:** ${res.error || "Failed to generate response. Please check server logs."}`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };
        setMessages((prev) => [...prev, errorMsg]);
      }
    } catch (err: any) {
      console.error("Chat action error:", err);
      const errorMsg: ChatMessage = {
        id: `bot-err-${Date.now()}`,
        role: "assistant",
        content: `⚠️ **Connection Error:** ${err.message || "Could not reach the Copilot service."}`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClearChat = () => {
    if (confirm("Clear current conversation history?")) {
      setMessages([
        {
          id: "welcome-reset",
          role: "assistant",
          content: "🧹 Conversation cleared. How can I assist platform operations now?",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Header */}
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-xs font-semibold text-slate-300 transition"
              title="Return to Command Center"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Command Center</span>
            </Link>

            <div className="h-5 w-px bg-slate-800" />

            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-500/20 font-bold">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-sm font-bold text-white">Operations AI Copilot</h1>
                  <span className="rounded-md bg-purple-950/80 border border-purple-800 px-2 py-0.5 text-[10px] font-semibold text-purple-300 flex items-center gap-1">
                    <Zap className="h-2.5 w-2.5" />
                    Live Ops Telemetry
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">Dispatch queries, dispute resolution & prompt governance</p>
              </div>
            </div>
          </div>

          {/* Two-Tab Navigation */}
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab("editor")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                activeTab === "editor"
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Sliders className="h-3.5 w-3.5" />
              <span>System Prompt Editor</span>
            </button>
            <button
              onClick={() => setActiveTab("chat")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                activeTab === "chat"
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span>Live Chat</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 mx-auto max-w-7xl w-full px-4 py-6 sm:px-6 flex flex-col">
        {/* TAB 1: SYSTEM PROMPT EDITOR */}
        {activeTab === "editor" && (
          <div className="max-w-4xl mx-auto w-full space-y-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-2">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Settings2 className="h-4 w-4 text-purple-400" />
                    System Prompt Governance
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Configure the core instructions that guide the Admin AI Copilot. Real-time platform data (bookings, tickets, payouts) is automatically injected alongside this prompt.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 font-mono">
                    Model: {model}
                  </span>
                  {lastUpdated && (
                    <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">
                      Saved: {lastUpdated}
                    </span>
                  )}
                </div>
              </div>

              {configSuccessMsg && (
                <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-800/80 bg-emerald-950/40 p-3.5 text-xs text-emerald-300">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                  <span>{configSuccessMsg}</span>
                </div>
              )}

              {configErrorMsg && (
                <div className="mt-4 flex items-center gap-2 rounded-xl border border-rose-800/80 bg-rose-950/40 p-3.5 text-xs text-rose-300">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                  <span>{configErrorMsg}</span>
                </div>
              )}

              <form onSubmit={handleSaveConfig} className="mt-5 space-y-5">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      Active System Prompt
                    </label>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {systemPrompt.length} characters
                    </span>
                  </div>

                  {configLoading ? (
                    <div className="h-64 rounded-xl border border-slate-800 bg-slate-950/60 flex items-center justify-center text-xs text-slate-500">
                      <Loader2 className="h-5 w-5 animate-spin mr-2 text-purple-400" />
                      Loading active configuration...
                    </div>
                  ) : (
                    <textarea
                      rows={10}
                      value={systemPrompt}
                      onChange={(e) => setSystemPrompt(e.target.value)}
                      placeholder="Enter system prompt for Admin Copilot..."
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 p-4 text-xs font-mono text-slate-200 placeholder-slate-600 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 transition leading-relaxed resize-y"
                    />
                  )}
                </div>

                <div className="rounded-xl border border-purple-900/40 bg-purple-950/20 p-4 text-xs text-purple-300 space-y-1.5">
                  <p className="font-semibold flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-purple-400" />
                    Built-in Real-Time Operations Augmentation
                  </p>
                  <p className="text-[11px] text-slate-400">
                    You do not need to hardcode live booking IDs or transaction numbers in the prompt. Every time an Admin chats with the Copilot, the backend queries the database and injects:
                  </p>
                  <ul className="list-disc list-inside text-[11px] text-slate-400 space-y-0.5 ml-1">
                    <li>Recent bookings, field statuses (pending, en-route, completed, cancelled), and cancellation reasons</li>
                    <li>Open customer support tickets, categories, and customer profiles</li>
                    <li>Pending professional payout requests under the 80/20 platform ledger</li>
                    <li>Active emergency SOS distress signals</li>
                  </ul>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={handleResetDefaultPrompt}
                    disabled={savingConfig}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-xs font-medium text-slate-300 hover:text-white transition disabled:opacity-50"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Reset to Default</span>
                  </button>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={loadConfig}
                      disabled={savingConfig || configLoading}
                      className="p-2 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition disabled:opacity-50"
                      title="Reload from database"
                    >
                      <RefreshCw className={`h-4 w-4 ${configLoading ? "animate-spin text-purple-400" : ""}`} />
                    </button>

                    <button
                      type="submit"
                      disabled={savingConfig || !systemPrompt.trim()}
                      className="flex items-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-500 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-purple-600/30 transition disabled:opacity-50"
                    >
                      {savingConfig ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <>
                          <Save className="h-3.5 w-3.5" />
                          <span>Save Instructions</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* TAB 2: LIVE CHAT */}
        {activeTab === "chat" && (
          <div className="flex-1 flex flex-col h-[calc(100vh-140px)] rounded-2xl border border-slate-800 bg-slate-900 shadow-xl overflow-hidden">
            {/* Chat Sub-header */}
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3 bg-slate-900/80">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-bold text-slate-200">Copilot Operational Assistant</span>
                <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">
                  • Backed by Live Supabase Telemetry
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleClearChat}
                  className="flex items-center gap-1 px-2.5 py-1 text-[11px] rounded-lg border border-slate-800 bg-slate-950/60 hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition"
                  title="Clear conversation"
                >
                  <Trash2 className="h-3 w-3" />
                  <span className="hidden sm:inline">Clear Chat</span>
                </button>
              </div>
            </div>

            {/* Chat Messages Feed */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              {messages.map((msg) => {
                const isUser = msg.role === "user";
                return (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}
                  >
                    {/* Avatar */}
                    <div
                      className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold ${
                        isUser
                          ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                          : "bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-600/30"
                      }`}
                    >
                      {isUser ? "AD" : <Bot className="h-4 w-4" />}
                    </div>

                    {/* Bubble */}
                    <div className={`max-w-[85%] sm:max-w-[75%] space-y-1 ${isUser ? "items-end" : "items-start"}`}>
                      <div
                        className={`rounded-2xl px-4 py-3 text-xs leading-relaxed ${
                          isUser
                            ? "bg-indigo-600 text-white rounded-tr-none shadow-md shadow-indigo-600/20"
                            : "bg-slate-950 border border-slate-800 text-slate-200 rounded-tl-none shadow-sm"
                        }`}
                      >
                        <div className="whitespace-pre-wrap break-words font-sans space-y-1.5">
                          {msg.content}
                        </div>
                      </div>

                      {/* Timestamp & Copy button */}
                      <div
                        className={`flex items-center gap-2 px-1 text-[10px] text-slate-500 ${
                          isUser ? "justify-end" : "justify-start"
                        }`}
                      >
                        <span>{msg.timestamp}</span>
                        {!isUser && (
                          <button
                            onClick={() => handleCopy(msg.content, msg.id)}
                            className="hover:text-slate-300 transition p-0.5"
                            title="Copy message"
                          >
                            {copiedId === msg.id ? (
                              <Check className="h-3 w-3 text-emerald-400" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Typing Loader */}
              {chatLoading && (
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-600/30">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="rounded-2xl rounded-tl-none border border-slate-800 bg-slate-950 px-4 py-3 text-xs text-slate-400 flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-purple-400" />
                    <span>Querying real-time platform operations and thinking...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick Prompt Chips */}
            <div className="border-t border-slate-800/80 bg-slate-900/60 px-4 py-2.5 overflow-x-auto">
              <div className="flex items-center gap-2 min-w-max">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Quick Prompts:
                </span>
                {QUICK_PROMPT_CHIPS.map((chip, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(chip.prompt)}
                    disabled={chatLoading}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-800 bg-slate-950/80 hover:bg-slate-800 hover:border-purple-600/50 text-[11px] text-slate-300 hover:text-white transition disabled:opacity-50 shrink-0"
                  >
                    <span>{chip.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Input Form */}
            <div className="p-3 sm:p-4 border-t border-slate-800 bg-slate-900">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder="Ask about operations, cancelled jobs, or draft support replies..."
                  disabled={chatLoading}
                  className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 transition disabled:opacity-50"
                />

                <button
                  type="submit"
                  disabled={chatLoading || !inputMessage.trim()}
                  className="flex items-center justify-center h-10 w-10 rounded-xl bg-purple-600 hover:bg-purple-500 text-white transition shadow-md shadow-purple-600/30 disabled:opacity-50 shrink-0"
                  title="Send query"
                >
                  {chatLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </button>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

