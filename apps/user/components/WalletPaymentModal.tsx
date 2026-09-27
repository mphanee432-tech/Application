"use client";

import React, { useEffect, useState } from "react";
import {
  Wallet,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  CreditCard,
  PlusCircle,
  Lock,
  ArrowRight,
} from "lucide-react";
import {
  createBrowserSupabaseClient,
  fetchUserWallet,
  topUpDemoBalance,
  processWalletPayment,
  type Tables,
} from "@repo/db";

interface WalletPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookingData: {
    cityId: string;
    serviceId: string;
    serviceType: string;
    latitude: number;
    longitude: number;
    address: string;
    price: number;
    notes?: string;
  } | null;
  onSuccess: (booking: any) => void;
}

export function WalletPaymentModal({
  isOpen,
  onClose,
  bookingData,
  onSuccess,
}: WalletPaymentModalProps) {
  const [supabase] = useState(() => createBrowserSupabaseClient());
  const [wallet, setWallet] = useState<Tables<"wallets"> | null>(null);
  const [loadingWallet, setLoadingWallet] = useState(true);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [toppingUp, setToppingUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadWallet = async () => {
    try {
      setLoadingWallet(true);
      setError(null);
      const data = await fetchUserWallet(undefined, supabase);
      setWallet(data);
    } catch (err: any) {
      console.error("WalletPaymentModal load error:", err);
      setError(err?.message || "Failed to load wallet balance.");
    } finally {
      setLoadingWallet(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadWallet();
      setError(null);
      setSuccessMsg(null);
    }
  }, [isOpen]);

  if (!isOpen || !bookingData) return null;

  const price = Number(bookingData.price);
  const currentBalance = wallet ? Number(wallet.balance) : 0;
  const hasSufficientFunds = currentBalance >= price;
  const deficit = Math.max(0, price - currentBalance);

  const handleTopUp = async () => {
    try {
      setToppingUp(true);
      setError(null);
      const res = await topUpDemoBalance(500, supabase);
      if (res.success && typeof res.newBalance === "number") {
        setWallet((prev) => (prev ? { ...prev, balance: res.newBalance! } : null));
        setSuccessMsg("Added $500.00 Demo Credits to your wallet!");
      } else {
        setError(res.error || "Failed to top up balance.");
      }
    } catch (err: any) {
      setError(err?.message || "Top-up failed.");
    } finally {
      setToppingUp(false);
    }
  };

  const handlePayAndConfirm = async () => {
    try {
      setProcessingPayment(true);
      setError(null);
      const res = await processWalletPayment(bookingData, supabase);
      if (res.success && res.booking) {
        onSuccess(res.booking);
        onClose();
      } else {
        setError(res.error || "Payment processing failed.");
      }
    } catch (err: any) {
      console.error("Payment error:", err);
      setError(err?.message || "An unexpected error occurred during payment.");
    } finally {
      setProcessingPayment(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-5 text-slate-100 relative">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white flex items-center gap-1.5">
                <span>Payment Gateway</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 px-2 py-0.5 rounded-full">
                  Closed-Loop Demo
                </span>
              </h3>
              <p className="text-xs text-slate-400">Review & confirm order with demo credits</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={processingPayment}
            className="text-slate-400 hover:text-white transition p-1.5 rounded-lg hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800/60 text-xs text-rose-300 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-800/60 text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Order Breakdown */}
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-2.5">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400">Service:</span>
            <span className="font-semibold text-white">{bookingData.serviceType}</span>
          </div>
          <div className="flex justify-between items-start text-xs">
            <span className="text-slate-400">Location:</span>
            <span className="font-semibold text-slate-200 text-right max-w-[220px] truncate">
              {bookingData.address}
            </span>
          </div>
          <div className="pt-2 border-t border-slate-800/80 flex justify-between items-center">
            <span className="text-xs font-semibold text-slate-300">Total Order Amount:</span>
            <span className="text-base font-bold text-white">${price.toFixed(2)}</span>
          </div>
        </div>

        {/* Payment Method & Balance */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Wallet className="h-3.5 w-3.5 text-blue-400" />
              In-App Demo Wallet
            </span>
            {loadingWallet ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
            ) : (
              <span className="text-xs font-mono font-bold text-emerald-400">
                ${currentBalance.toFixed(2)} Available
              </span>
            )}
          </div>

          {/* Balance status pill */}
          {!loadingWallet && (
            <div
              className={`p-2.5 rounded-lg border text-xs flex items-center justify-between ${
                hasSufficientFunds
                  ? "bg-emerald-950/40 border-emerald-800/50 text-emerald-300"
                  : "bg-amber-950/40 border-amber-800/50 text-amber-300"
              }`}
            >
              <div className="flex items-center gap-2">
                {hasSufficientFunds ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-amber-400 shrink-0" />
                )}
                <span>
                  {hasSufficientFunds
                    ? "Sufficient demo credits for this booking"
                    : `Short by $${deficit.toFixed(2)}`}
                </span>
              </div>

              {!hasSufficientFunds && (
                <button
                  type="button"
                  onClick={handleTopUp}
                  disabled={toppingUp}
                  className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white font-bold text-[11px] flex items-center gap-1 shadow transition"
                >
                  {toppingUp ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <PlusCircle className="h-3 w-3" />
                  )}
                  <span>+ $500</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Security badge & Actions */}
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
            <Lock className="h-3 w-3 text-slate-400" />
            <span>Simulated Instant Ledger Settlement</span>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={processingPayment}
              className="flex-1 py-2.5 px-4 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handlePayAndConfirm}
              disabled={!hasSufficientFunds || processingPayment || loadingWallet}
              className="flex-2 flex-grow py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-xs font-bold text-white shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition"
            >
              {processingPayment ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Processing Payment...</span>
                </>
              ) : (
                <>
                  <span>Pay & Confirm Booking (${price.toFixed(2)})</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
