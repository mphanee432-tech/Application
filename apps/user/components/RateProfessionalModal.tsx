"use client";

import React, { useState } from "react";
import { Star, MessageSquare, ShieldCheck, X, Loader2, AlertCircle, Sparkles } from "lucide-react";
import { submitReview, createBrowserSupabaseClient } from "@repo/db";

interface RateProfessionalModalProps {
  isOpen: boolean;
  booking: any;
  onClose: () => void;
  onSubmitSuccess: () => void;
}

const FEEDBACK_TAGS = [
  "High Quality Work",
  "Punctual & Fast",
  "Courteous & Professional",
  "Clean & Tidy",
  "Transparent Communication",
  "Fair Pricing",
];

export function RateProfessionalModal({
  isOpen,
  booking,
  onClose,
  onSubmitSuccess,
}: RateProfessionalModalProps) {
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !booking) return null;

  const proName =
    booking.professional?.profile?.full_name ||
    booking.professional?.trade ||
    "your Service Professional";

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = async () => {
    if (!booking.professional_id) {
      setError("No professional is associated with this booking to rate.");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const supabase = createBrowserSupabaseClient();

      const combinedComment = [
        selectedTags.length > 0 ? `Highlights: ${selectedTags.join(", ")}` : null,
        comment.trim() || null,
      ]
        .filter(Boolean)
        .join(" | ");

      await submitReview(
        {
          bookingId: booking.id,
          targetId: booking.professional_id,
          rating,
          comment: combinedComment || undefined,
        },
        supabase
      );

      onSubmitSuccess();
    } catch (err: any) {
      console.error("Submit review error:", err);
      setError(err.message || "Failed to submit review.");
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
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-800/40">
              <Sparkles className="h-3 w-3" /> Service Review
            </div>
            <h3 className="text-lg font-bold text-white mt-1">Rate {proName}</h3>
            <p className="text-xs text-slate-400">
              Your feedback maintains the verified quality of our local service community.
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

        {/* 5-Star Interactive Rating */}
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
            {rating === 5 && "★★★★★ Exceptional Service"}
            {rating === 4 && "★★★★☆ Great Job"}
            {rating === 3 && "★★★☆☆ Average Service"}
            {rating === 2 && "★★☆☆☆ Below Expectations (Dispute Alert)"}
            {rating === 1 && "★☆☆☆☆ Unacceptable (Dispute Alert)"}
          </span>
        </div>

        {/* Quality Highlights Tags */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-slate-300">Service Highlights</label>
          <div className="flex flex-wrap gap-1.5">
            {FEEDBACK_TAGS.map((tag) => {
              const active = selectedTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                    active
                      ? "bg-emerald-600/30 border-emerald-500/60 text-emerald-300"
                      : "bg-slate-800/40 border-slate-700/50 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>

        {/* Written Review */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
            <MessageSquare className="h-3.5 w-3.5 text-slate-400" />
            Detailed Review (Optional)
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            placeholder="Describe the technician's professionalism, cleanliness, and speed..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
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
            Later
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Submitting Review...</span>
              </>
            ) : (
              <span>Submit Review</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
