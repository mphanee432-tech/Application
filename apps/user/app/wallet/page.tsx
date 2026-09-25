"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createBrowserSupabaseClient,
  getCurrentUser,
  fetchUserWallet,
  depositWalletFunds,
  redeemPromoCode,
  fetchUserTransactions,
  VALID_PROMO_CODES,
  type Tables,
} from "@repo/db";
import {
  Wallet,
  CreditCard,
  ArrowUpRight,
  Gift,
  Sparkles,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  DollarSign,
  PlusCircle,
  RefreshCw,
  Tag,
} from "lucide-react";

export default function UserWalletPage() {
  const router = useRouter();
  const supabase = createBrowserSupabaseClient();

  const [user, setUser] = useState<any>(null);
  const [wallet, setWallet] = useState<Tables<"wallets"> | null>(null);
  const [transactions, setTransactions] = useState<Tables<"transactions">[]>([]);
  const [loading, setLoading] = useState(true);

  // Deposit Form State
  const [depositAmount, setDepositAmount] = useState<string>("50");
  const [depositing, setDepositing] = useState(false);
  const [depositSuccess, setDepositSuccess] = useState<string | null>(null);
  const [depositError, setDepositError] = useState<string | null>(null);

  // Promo Code State
  const [promoCode, setPromoCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [promoSuccess, setPromoSuccess] = useState<string | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);

  const loadWalletData = async (userId: string) => {
    try {
      const [walletData, txList] = await Promise.all([
        fetchUserWallet(userId, supabase),
        fetchUserTransactions(userId, supabase),
      ]);
      setWallet(walletData);
      setTransactions(txList);
    } catch (err: any) {
      console.error("Failed to load wallet data:", err);
    }
  };

  useEffect(() => {
    let channel: any = null;

    async function init() {
      try {
        setLoading(true);
        const currentUser = await getCurrentUser(supabase);
        if (!currentUser) {
          router.push("/login?redirect=/wallet");
          return;
        }
        setUser(currentUser);
        await loadWalletData(currentUser.id);

        // Realtime sync on wallets and transactions
        channel = supabase
          .channel(`user-wallet-${currentUser.id}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "wallets",
              filter: `user_id=eq.${currentUser.id}`,
            },
            () => loadWalletData(currentUser.id)
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "transactions",
              filter: `user_id=eq.${currentUser.id}`,
            },
            () => loadWalletData(currentUser.id)
          )
          .subscribe();
      } catch (err) {
        console.error("Error in wallet init:", err);
      } finally {
        setLoading(false);
      }
    }

    init();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(depositAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setDepositError("Please enter a valid amount greater than $0");
      return;
    }

    try {
      setDepositing(true);
      setDepositError(null);
      setDepositSuccess(null);

      const res = await depositWalletFunds(amountNum, supabase);
      setWallet(res.wallet);
      setDepositSuccess(`Successfully added $${amountNum.toFixed(2)} to your wallet!`);
      if (user) await loadWalletData(user.id);
    } catch (err: any) {
      setDepositError(err.message || "Failed to process deposit");
    } finally {
      setDepositing(false);
    }
  };

  const handleRedeemPromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoCode.trim()) return;

    try {
      setRedeeming(true);
      setPromoError(null);
      setPromoSuccess(null);

      const res = await redeemPromoCode(promoCode.trim(), supabase);
      setWallet(res.wallet);
      setPromoSuccess(`🎉 Success! +$${res.amount.toFixed(2)} bonus credits added to your wallet.`);
      setPromoCode("");
      if (user) await loadWalletData(user.id);
    } catch (err: any) {
      setPromoError(err.message || "Failed to redeem code");
    } finally {
      setRedeeming(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-8 w-8 text-blue-500 animate-spin" />
          <p className="text-sm text-slate-400">Loading wallet & credit balance...</p>
        </div>
      </div>
    );
  }

  const balance = Number(wallet?.balance || 0);
  const promoCredits = Number(wallet?.promo_credits || 0);
  const totalPurchasingPower = balance + promoCredits;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navigation */}
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-800 bg-slate-800/60 hover:bg-slate-800 text-xs font-semibold text-slate-300 transition"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Portal</span>
            </Link>
            <div className="h-4 w-px bg-slate-800" />
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white font-bold text-sm">
                <Wallet className="h-4 w-4" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-white flex items-center gap-2">
                  Customer Wallet & Credits
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    Live Balance
                  </span>
                </h1>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>{user?.email}</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-6xl w-full px-4 py-8 sm:px-6 space-y-8 flex-1">
        {/* Wallet Balance Cards */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Total Purchasing Power */}
          <div className="relative overflow-hidden rounded-2xl border border-blue-500/30 bg-gradient-to-br from-blue-950/60 via-slate-900 to-slate-900 p-6 shadow-xl">
            <div className="flex items-center justify-between text-blue-300">
              <span className="text-xs font-semibold uppercase tracking-wider">Total Available</span>
              <Sparkles className="h-5 w-5 text-blue-400" />
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-4xl font-extrabold text-white">
                ${totalPurchasingPower.toFixed(2)}
              </span>
              <span className="text-xs font-bold text-blue-400">{wallet?.currency || "USD"}</span>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Auto-applied at checkout: cash balance + promotional credits.
            </p>
          </div>

          {/* Cash Balance */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Cash Balance</span>
              <DollarSign className="h-5 w-5 text-emerald-400" />
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-emerald-400">
                ${balance.toFixed(2)}
              </span>
              <span className="text-xs text-slate-500">Deposited funds</span>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Never expires. Usable for any home service on the platform.
            </p>
          </div>

          {/* Promo Credits */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Promo Credits</span>
              <Gift className="h-5 w-5 text-amber-400" />
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-amber-400">
                ${promoCredits.toFixed(2)}
              </span>
              <span className="text-xs text-slate-500">Bonus credits</span>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Promotional voucher credits redeemed from coupon codes.
            </p>
          </div>
        </section>

        {/* Deposit and Promo Forms */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Quick Deposit Card */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-bold text-white mb-2">
                <CreditCard className="h-4 w-4 text-blue-400" />
                <span>Instant Wallet Top-Up</span>
              </div>
              <p className="text-xs text-slate-400 mb-5">
                Load funds into your account for one-click service dispatch with zero checkout friction.
              </p>

              {depositSuccess && (
                <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-800/80 bg-emerald-950/40 p-3 text-xs text-emerald-300">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                  <span>{depositSuccess}</span>
                </div>
              )}

              {depositError && (
                <div className="mb-4 flex items-center gap-2 rounded-xl border border-rose-800/80 bg-rose-950/40 p-3 text-xs text-rose-300">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                  <span>{depositError}</span>
                </div>
              )}

              {/* Preset Chips */}
              <div className="grid grid-cols-4 gap-2 mb-4">
                {["20", "50", "100", "200"].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setDepositAmount(amt)}
                    className={`py-2 rounded-xl text-xs font-bold border transition ${
                      depositAmount === amt
                        ? "border-blue-500 bg-blue-600 text-white shadow-md shadow-blue-600/30"
                        : "border-slate-800 bg-slate-800/70 text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    +${amt}
                  </button>
                ))}
              </div>

              {/* Amount Input */}
              <div className="relative mb-4">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                  $
                </span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="Custom amount"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 pl-8 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <button
              onClick={handleDeposit}
              disabled={depositing}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 py-3 text-xs font-bold text-white shadow-lg shadow-blue-600/25 transition"
            >
              {depositing ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Processing Deposit...</span>
                </>
              ) : (
                <>
                  <PlusCircle className="h-4 w-4" />
                  <span>Deposit ${depositAmount || "0"} to Wallet</span>
                </>
              )}
            </button>
          </div>

          {/* Promo Code Redemption Card */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-bold text-white mb-2">
                <Tag className="h-4 w-4 text-amber-400" />
                <span>Redeem Promo Code</span>
              </div>
              <p className="text-xs text-slate-400 mb-4">
                Enter your promotional code or referral voucher to unlock instant platform bonus credits.
              </p>

              {promoSuccess && (
                <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-800/80 bg-emerald-950/40 p-3 text-xs text-emerald-300">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                  <span>{promoSuccess}</span>
                </div>
              )}

              {promoError && (
                <div className="mb-4 flex items-center gap-2 rounded-xl border border-rose-800/80 bg-rose-950/40 p-3 text-xs text-rose-300">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                  <span>{promoError}</span>
                </div>
              )}

              {/* Sample Promo Codes */}
              <div className="mb-4">
                <p className="text-[11px] font-semibold text-slate-400 mb-2">Available Coupons to Try:</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(VALID_PROMO_CODES).map(([code, details]) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => setPromoCode(code)}
                      className="px-2.5 py-1 rounded-lg border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-xs font-mono font-bold transition flex items-center gap-1.5"
                    >
                      <span>{code}</span>
                      <span className="text-[10px] text-amber-300/80">(+${details.credits})</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Promo Input */}
              <form onSubmit={handleRedeemPromo} className="flex gap-2">
                <input
                  type="text"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                  placeholder="e.g. WELCOME25"
                  className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm uppercase text-white font-mono placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={redeeming || !promoCode.trim()}
                  className="px-5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 py-2.5 text-xs font-bold text-white transition flex items-center gap-1.5 shrink-0"
                >
                  {redeeming ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}
                  <span>Apply</span>
                </button>
              </form>
            </div>

            <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-[11px] text-slate-400 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-400 shrink-0" />
              <span>Promo credits can only be redeemed once per account.</span>
            </div>
          </div>
        </section>

        {/* Real-Time Transaction Ledger */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-slate-400" />
              <h2 className="text-sm font-bold text-white">Wallet Transaction History</h2>
              <span className="text-xs text-slate-500">({transactions.length} records)</span>
            </div>
            <button
              onClick={() => user && loadWalletData(user.id)}
              className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition"
            >
              <RefreshCw className="h-3 w-3" />
              <span>Refresh Ledger</span>
            </button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
            {transactions.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No transactions recorded yet. Deposit funds or redeem a promo code above!
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-800 bg-slate-900 text-slate-400">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Type</th>
                      <th className="px-4 py-3 font-semibold">Description</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Date & Time</th>
                      <th className="px-4 py-3 text-right font-semibold">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {transactions.map((tx) => {
                      const isCredit =
                        tx.type === "deposit" ||
                        tx.type === "promo_credit" ||
                        tx.type === "refund";
                      const amt = Number(tx.amount);

                      return (
                        <tr key={tx.id} className="hover:bg-slate-800/40 transition">
                          <td className="px-4 py-3.5">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                tx.type === "deposit"
                                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                  : tx.type === "promo_credit"
                                  ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                  : tx.type === "booking_payment"
                                  ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                                  : "bg-slate-800 text-slate-300"
                              }`}
                            >
                              {tx.type.replace("_", " ")}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 font-medium text-slate-200">
                            {tx.description || "In-app wallet transaction"}
                          </td>
                          <td className="px-4 py-3.5">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                tx.status === "completed"
                                  ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                                  : "bg-amber-950 text-amber-400 border border-amber-800"
                              }`}
                            >
                              {tx.status}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-slate-400">
                            {new Date(tx.created_at).toLocaleString()}
                          </td>
                          <td
                            className={`px-4 py-3.5 text-right font-mono font-bold text-sm ${
                              isCredit ? "text-emerald-400" : "text-slate-100"
                            }`}
                          >
                            {isCredit ? `+` : `-`}${amt.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
