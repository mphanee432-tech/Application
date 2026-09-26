"use client";
import { useState, useEffect } from "react";
import { fetchChatMessages } from "@repo/db";

interface Props {
  bookingId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function ChatTranscriptModal({ bookingId, isOpen, onClose }: Props) {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (isOpen && bookingId) {
      setLoading(true);
      fetchChatMessages(bookingId)
        .then(setMessages)
        .finally(() => setLoading(false));
    }
  }, [isOpen, bookingId]);
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden flex flex-col shadow-2xl">
        <div className="flex justify-between items-center p-4 border-b border-slate-800">
          <h3 className="text-white font-bold text-lg">Chat Transcript</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition">
            Close
          </button>
        </div>
        
        <div className="p-4 flex-1 overflow-y-auto max-h-[60vh] space-y-4">
          {loading ? (
            <div className="text-center text-slate-400 text-sm py-8">Loading transcript...</div>
          ) : messages.length === 0 ? (
            <div className="text-center text-slate-500 text-sm py-8">No messages found.</div>
          ) : (
            messages.map((msg, i) => (
              <div key={i} className="flex flex-col">
                <span className="text-xs font-semibold text-slate-400 mb-1">
                  {msg.sender_name || "User"} • {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <div className="bg-slate-800 text-slate-200 p-3 rounded-xl text-sm w-fit max-w-[85%]">
                  {msg.message}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
