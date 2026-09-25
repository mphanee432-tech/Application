"use client";

import React, { useState } from "react";
import { Star, MessageSquare, ThumbsUp, X, Loader2, AlertCircle } from "lucide-react";
import { submitReview, createBrowserSupabaseClient } from "@repo/db";

interface RateCustomerModalProps {
  isOpen: boolean;
  booking: any;
  onClose: () => void;
  onSubmitSuccess: () => void;
}

const QUICK_TAGS = [
  "Clear Instructions",
  "Punctual & Ready",
  "Pleasant & Respectful",
  "Safe Work Environment",
  "Fast Payment Release",
];

export function RateCustomerModal({
  isOpen,
  booking,
  onClose,
  onSubmitSuccess,
}: RateCustomerModalProps) {
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !booking) return null;

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      setError(null);
      const supabase = createBrowserSupabaseClient();

      const combinedComment = [
        selectedTags.length > 0 ? `Tags: ${selectedTags.join(", ")}` : null,
        comment.trim() || null,
      ]
        .filter(Boolean)
        .join(" | ");

      await submitReview(
        {
          bookingId: booking.id,
          targetId: booking.customer_id,
          rating,
          comment: combinedComment || undefined,
        },
        supabase
      );

      onSubmitSuccess();
    } catch (err: any) {
      console.error("Submit review error:", err);
      setError(err.message || "Failed to submit customer review.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6 text-slate-100">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-950/80 text-blue-400 border border-blue-800/40">
              <ThumbsUp className="h-3 w-3" /> Two-Way Community Rating
            </div>
            <h3 className="text-lg font-bold text-white mt-1">Rate Your Customer</h3>
            <p className="text-xs text-slate-400">
              How was your experience with {booking.customer?.full_name || "the client"}?
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-xl text-xs text-red-300 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {/* 5-Star Rating Selector */}
        <div className="flex flex-col items-center justify-center gap-2 py-2">
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                onClick={() => setRating(star)}
                className="p-1 focus:outline-none transition-transform hover:scale-110"
              >
                <Star
                  className={`h-8 w-8 ${
                    (hoverRating || rating) >= star
                      ? "text-amber-400 fill-amber-400"
                      : "text-slate-700"
                  } transition-colors`}
                />
              </button>
            ))}
          </div>
          <span className="text-xs font-semibold text-amber-400">
            {rating === 5 && "Outstanding Customer"}
            {rating === 4 && "Great Experience"}
            {rating === 3 && "Average"}
            {rating === 2 && "Difficult Interaction"}
            {rating === 1 && "Poor Experience"}
          </span>
        </div>

        {/* Quick Feedback Tags */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-slate-300">Quick Tags</label>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_TAGS.map((tag) => {
              const active = selectedTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                    active
                      ? "bg-blue-600/30 border-blue-500/60 text-blue-300"
                      : "bg-slate-800/40 border-slate-700/50 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>

        {/* Written Comment */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
            <MessageSquare className="h-3.5 w-3.5 text-slate-400" />
            Additional Notes (Optional)
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            placeholder="Share details about the property accessibility or interaction..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        {/* Actions */}
        <div className="pt-2 border-t border-slate-800 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 rounded-xl text-xs font-medium transition-colors"
          >
            Skip Rating
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-lg shadow-blue-600/20 transition-all"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Submitting...</span>
              </>
            ) : (
              <span>Submit Rating</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
