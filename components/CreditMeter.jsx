"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";

/**
 * Credit Meter Component
 * Shows remaining credits with visual indicator
 */
export function CreditMeter({ accessToken, compact = false }) {
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!accessToken) return;

    const fetchUsage = async () => {
      try {
        const res = await fetch("/api/billing/usage", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (res.ok) {
          const data = await res.json();
          setUsage(data);
        } else {
          setError("Failed to load usage");
        }
      } catch (err) {
        setError("Failed to load usage");
      } finally {
        setLoading(false);
      }
    };

    fetchUsage();
    // Refresh every 30 seconds
    const interval = setInterval(fetchUsage, 30000);
    return () => clearInterval(interval);
  }, [accessToken]);

  if (loading) {
    return (
      <div className={`flex items-center gap-2 ${compact ? "text-sm" : ""}`}>
        <div className="h-2 w-20 rounded-full bg-white/10 animate-pulse" />
      </div>
    );
  }

  if (error || !usage) {
    return null;
  }

  const { creditsRemaining, monthlyAllowance } = usage.usage || {};
  const percentage = monthlyAllowance > 0 ? (creditsRemaining / monthlyAllowance) * 100 : 0;
  const isLow = percentage < 20;
  const isCritical = percentage < 5;

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-16 rounded-full bg-white/10 overflow-hidden">
            <motion.div
              className={`h-full ${
                isCritical ? "bg-red-500" : isLow ? "bg-amber-500" : "bg-green-500"
              }`}
              initial={{ width: 0 }}
              animate={{ width: `${percentage}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          <span className="text-white/70 text-xs">
            {creditsRemaining}/{monthlyAllowance}
          </span>
        </div>
        {isLow && (
          <Link
            href="/billing?upgrade=true"
            aria-label="Upgrade your plan to get more credits"
            className="text-xs text-amber-400 hover:text-amber-300 underline"
          >
            Upgrade
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4" role="region" aria-label="Credit usage">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-white/80">Credits Remaining</span>
        <span 
          className={`text-lg font-bold ${isCritical ? "text-red-400" : isLow ? "text-amber-400" : "text-green-400"}`}
          aria-label={`${creditsRemaining} credits remaining out of ${monthlyAllowance}`}
        >
          {creditsRemaining}
        </span>
      </div>
      <div 
        className="h-3 w-full rounded-full bg-white/10 overflow-hidden mb-2"
        role="progressbar"
        aria-valuenow={creditsRemaining}
        aria-valuemin={0}
        aria-valuemax={monthlyAllowance}
        aria-label={`Credit usage: ${creditsRemaining} of ${monthlyAllowance} credits remaining`}
      >
        <motion.div
          className={`h-full ${
            isCritical ? "bg-gradient-to-r from-red-500 to-red-600" : 
            isLow ? "bg-gradient-to-r from-amber-500 to-amber-600" : 
            "bg-gradient-to-r from-green-500 to-green-600"
          }`}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>
      <div className="flex items-center justify-between text-xs text-white/60">
        <span>{usage.tierName} Plan</span>
        <span>{monthlyAllowance} credits/month</span>
      </div>
      {isLow && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100"
        >
          {isCritical ? (
            <p>
              ⚠️ You&apos;re running low on credits!{" "}
              <Link href="/billing?upgrade=true" className="underline font-semibold">
                Upgrade now
              </Link>{" "}
              to continue.
            </p>
          ) : (
            <p>
              Running low on credits.{" "}
              <Link href="/billing?upgrade=true" className="underline">
                Upgrade
              </Link>{" "}
              for more.
            </p>
          )}
        </motion.div>
      )}
    </div>
  );
}

