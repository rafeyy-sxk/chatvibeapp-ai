"use client";

import { Suspense, useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CreditMeter } from "@/components/CreditMeter";
import { UpgradeModal } from "@/components/UpgradeModal";

function BillingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [accessToken, setAccessToken] = useState("");
  const [usage, setUsage] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const token = sessionStorage.getItem("cv_access_token") || "";
      setAccessToken(token);
      if (!token) {
        router.push("/login");
        return;
      }

      // Check if upgrade modal should be shown
      if (searchParams.get("upgrade") === "true") {
        setShowUpgradeModal(true);
      }
    }
  }, [router, searchParams]);

  useEffect(() => {
    if (!accessToken) return;

    const fetchData = async () => {
      try {
        const [usageRes, paymentsRes] = await Promise.all([
          fetch("/api/billing/usage", {
            headers: { Authorization: `Bearer ${accessToken}` },
          }),
          fetch("/api/billing/payments/history?limit=10", {
            headers: { Authorization: `Bearer ${accessToken}` },
          }),
        ]);

        if (usageRes.ok) {
          const usageData = await usageRes.json();
          setUsage(usageData);
        }

        if (paymentsRes.ok) {
          const paymentsData = await paymentsRes.json();
          setPayments(paymentsData.payments || []);
        }
      } catch (err) {
        setError("Failed to load billing information");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [accessToken]);

  const handlePortalClick = async () => {
    try {
      const res = await fetch("/api/billing/portal", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (res.ok) {
        const data = await res.json();
        window.location.href = data.url;
      } else {
        alert("Failed to open billing portal");
      }
    } catch (error) {
      alert("Failed to open billing portal");
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="animate-pulse space-y-8">
          <div className="h-8 w-64 bg-white/10 rounded" />
          <div className="h-64 bg-white/10 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-red-100">
          {error}
        </div>
      </div>
    );
  }

  const { tier, tierName, subscription, usage: usageData } = usage || {};

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="space-y-8"
      >
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-white">Billing & Usage</h1>
            <p className="text-sm text-white/70 mt-1">Manage your subscription and view usage</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowUpgradeModal(true)}
              className="rounded-2xl border border-indigo-500 bg-indigo-500/10 px-5 py-2 text-sm font-semibold text-indigo-200 hover:bg-indigo-500/20"
            >
              Upgrade Plan
            </button>
            {subscription && (
              <button
                onClick={handlePortalClick}
                className="rounded-2xl border border-white/20 px-5 py-2 text-sm font-semibold text-white/80 hover:border-white/40"
              >
                Manage Subscription
              </button>
            )}
          </div>
        </div>

        {/* Credit Meter */}
        {usageData && (
          <CreditMeter accessToken={accessToken} />
        )}

        {/* Current Plan */}
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Current Plan</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-white">{tierName || "Free"}</p>
              {subscription && (
                <p className="text-sm text-white/60 mt-1">
                  {subscription.status === "ACTIVE" ? (
                    <>
                      Renews on {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                    </>
                  ) : (
                    <>
                      {subscription.status === "PAST_DUE" && "⚠️ Payment failed. "}
                      {subscription.cancelAtPeriodEnd
                        ? `Cancels on ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`
                        : `Status: ${subscription.status}`}
                    </>
                  )}
                </p>
              )}
            </div>
            {tier === "FREE" && (
              <button
                onClick={() => setShowUpgradeModal(true)}
                className="rounded-xl bg-indigo-500 px-6 py-2 font-semibold text-white hover:bg-indigo-600"
              >
                Upgrade
              </button>
            )}
          </div>
        </div>

        {/* Usage Statistics */}
        {usageData && (
          <div className="grid gap-6 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-white/50 mb-2">Total Jobs</p>
              <p className="text-3xl font-bold text-white">{usageData.totalJobs || 0}</p>
              <p className="text-xs text-white/60 mt-1">This billing period</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-white/50 mb-2">Included</p>
              <p className="text-3xl font-bold text-white">{usageData.includedJobs || 0}</p>
              <p className="text-xs text-white/60 mt-1">Within monthly allowance</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-white/50 mb-2">Overage</p>
              <p className="text-3xl font-bold text-white">{usageData.overageJobs || 0}</p>
              <p className="text-xs text-white/60 mt-1">
                ${usageData.totalCost?.toFixed(2) || "0.00"} charged
              </p>
            </div>
          </div>
        )}

        {/* Payment History */}
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Payment History</h2>
          {payments.length === 0 ? (
            <p className="text-white/60">No payment history available.</p>
          ) : (
            <div className="space-y-3">
              {payments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 p-4"
                >
                  <div>
                    <p className="font-semibold text-white">
                      ${payment.amount.toFixed(2)} {payment.currency.toUpperCase()}
                    </p>
                    <p className="text-xs text-white/60 mt-1">
                      {payment.paidAt ? new Date(payment.paidAt).toLocaleDateString() : "Pending"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        payment.status === "paid"
                          ? "bg-green-500/20 text-green-400"
                          : payment.status === "open"
                          ? "bg-amber-500/20 text-amber-400"
                          : "bg-red-500/20 text-red-400"
                      }`}
                    >
                      {payment.status}
                    </span>
                    {payment.invoiceUrl && (
                      <a
                        href={payment.invoiceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-indigo-400 hover:text-indigo-300 underline"
                      >
                        View Invoice
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>

      {/* Upgrade Modal */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        currentTier={tier || "FREE"}
        accessToken={accessToken}
      />
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="animate-pulse space-y-8">
          <div className="h-8 w-64 bg-white/10 rounded" />
          <div className="h-64 bg-white/10 rounded-2xl" />
        </div>
      </div>
    }>
      <BillingContent />
    </Suspense>
  );
}

