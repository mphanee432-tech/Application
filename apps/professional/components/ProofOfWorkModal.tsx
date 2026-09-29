"use client";

import React, { useState } from "react";
import { Camera, CheckCircle2, AlertCircle, UploadCloud, X, Loader2 } from "lucide-react";
import { uploadProofOfWork, createBrowserSupabaseClient } from "@repo/db";

interface ProofOfWorkModalProps {
  isOpen: boolean;
  booking: any;
  onClose: () => void;
  onSuccess: (updatedBooking: any) => void;
}

export function ProofOfWorkModal({
  isOpen,
  booking,
  onClose,
  onSuccess,
}: ProofOfWorkModalProps) {
  const [beforeFile, setBeforeFile] = useState<File | null>(null);
  const [afterFile, setAfterFile] = useState<File | null>(null);
  const [beforePreview, setBeforePreview] = useState<string | null>(null);
  const [afterPreview, setAfterPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !booking) return null;

  const handleFileChange = (type: "before" | "after", file: File | null) => {
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    if (type === "before") {
      setBeforeFile(file);
      setBeforePreview(previewUrl);
    } else {
      setAfterFile(file);
      setAfterPreview(previewUrl);
    }
    setError(null);
  };

  const handleUploadAndComplete = async () => {
    if (!beforeFile || !afterFile) {
      setError("Both 'Before' and 'After' service photos are mandatory to finalize this order.");
      return;
    }

    try {
      setUploading(true);
      setError(null);
      const supabase = createBrowserSupabaseClient("professional");
      const updatedBooking = await uploadProofOfWork(booking.id, beforeFile, afterFile, supabase);
      onSuccess(updatedBooking);
    } catch (err: any) {
      console.error("Proof of work upload error:", err);
      setError(err.message || "Failed to upload proof of work. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6 text-slate-100">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-800/40">
              <Camera className="h-3.5 w-3.5" /> Quality Assurance Gate
            </div>
            <h3 className="text-lg font-bold text-white">Upload Proof-of-Work</h3>
            <p className="text-xs text-slate-400">
              Upload clear before and after photos of your work for #{booking.id.slice(0, 8)} to release client payment.
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={uploading}
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

        {/* Photo Upload Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* 1. Before Photo */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span>1. Before Service</span>
              {beforeFile && <span className="text-[10px] text-emerald-400 font-normal">Photo Added</span>}
            </span>

            {beforePreview ? (
              <div className="relative aspect-video rounded-xl overflow-hidden border border-emerald-500/40 bg-slate-950 group">
                <img
                  src={beforePreview}
                  alt="Before service"
                  className="w-full h-full object-cover"
                />
                <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center cursor-pointer transition-opacity text-xs font-medium text-white">
                  <UploadCloud className="h-5 w-5 mb-1" /> Change Photo
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFileChange("before", e.target.files?.[0] || null)}
                  />
                </label>
              </div>
            ) : (
              <label className="border-2 border-dashed border-slate-700 hover:border-emerald-500/50 bg-slate-950/40 hover:bg-slate-950/80 rounded-xl aspect-video flex flex-col items-center justify-center p-4 text-center cursor-pointer transition-all">
                <Camera className="h-7 w-7 text-slate-500 mb-2" />
                <span className="text-xs font-medium text-slate-300">Take or Select Photo</span>
                <span className="text-[10px] text-slate-500 mt-1">Initial condition of site</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFileChange("before", e.target.files?.[0] || null)}
                />
              </label>
            )}
          </div>

          {/* 2. After Photo */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span>2. After Service</span>
              {afterFile && <span className="text-[10px] text-emerald-400 font-normal">Photo Added</span>}
            </span>

            {afterPreview ? (
              <div className="relative aspect-video rounded-xl overflow-hidden border border-emerald-500/40 bg-slate-950 group">
                <img
                  src={afterPreview}
                  alt="After service"
                  className="w-full h-full object-cover"
                />
                <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center cursor-pointer transition-opacity text-xs font-medium text-white">
                  <UploadCloud className="h-5 w-5 mb-1" /> Change Photo
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFileChange("after", e.target.files?.[0] || null)}
                  />
                </label>
              </div>
            ) : (
              <label className="border-2 border-dashed border-slate-700 hover:border-emerald-500/50 bg-slate-950/40 hover:bg-slate-950/80 rounded-xl aspect-video flex flex-col items-center justify-center p-4 text-center cursor-pointer transition-all">
                <CheckCircle2 className="h-7 w-7 text-slate-500 mb-2" />
                <span className="text-xs font-medium text-slate-300">Take or Select Photo</span>
                <span className="text-[10px] text-slate-500 mt-1">Finished result</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFileChange("after", e.target.files?.[0] || null)}
                />
              </label>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="pt-2 border-t border-slate-800 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 rounded-xl text-xs font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleUploadAndComplete}
            disabled={uploading || !beforeFile || !afterFile}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Uploading & Verifying...</span>
              </>
            ) : (
              <>
                <UploadCloud className="h-4 w-4" />
                <span>Submit Proof & Complete</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
