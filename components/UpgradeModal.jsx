"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import Link from "next/link";

/**
 * Upgrade Modal Component
 * Shows upgrade options when credits are exhausted
 */
export function UpgradeModal({ isOpen, onClose, currentTier = "FREE", accessToken }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [selectedTier, setSelectedTier] = useState(null);
  const [paymentsEnabled, setPaymentsEnabled] = useState(true);
  const [error, setError] = useState(null);

  const tiers = [
    {
      id: "BASIC",
      name: "Basic",
      price: "$2.99",
      credits: 30,
      features: [
        "30 analysis jobs/month",
        "8 images per job",
        "Standard processing",
        "Email support",
        "Export features",
      ],
    },
    {
      id: "PRO",
      name: "Pro",
      price: "$5.99",
      credits: 100,
      popular: true,
      features: [
        "100 analysis jobs/month",
        "10 images per job",
        "Priority processing",
        "Priority support",
        "All export formats",
        "Advanced insights",
      ],
    },
  ];

  // Check if payments are enabled on mount
  useEffect(() => {
    if (!isOpen) return;
    
    // Check payments status (this is just for UX - backend enforces it)
    fetch("/api/billing/status")
      .then((res) => res.json())
      .then((data) => {
        setPaymentsEnabled(data.paymentsEnabled !== false);
        setError(null);
      })
      .catch(() => {
        // If endpoint doesn't exist, assume enabled (backward compatibility)
        setPaymentsEnabled(true);
      });
  }, [isOpen]);

  const handleUpgrade = async (tier) => {
    if (!paymentsEnabled) {
      setError("Payments are currently unavailable. We're working on enabling them soon!");
      return;
    }

    setLoading(true);
    setSelectedTier(tier);
    setError(null);

    try {
      const successUrl = `${window.location.origin}/billing?success=true&tier=${tier}`;
      const cancelUrl = `${window.location.origin}/billing?canceled=true`;

      const res = await fetch(
        `/api/billing/subscribe?success_url=${encodeURIComponent(successUrl)}&cancel_url=${encodeURIComponent(cancelUrl)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ tier }),
        }
      );

      if (res.ok) {
        const data = await res.json();
        if (data.checkoutUrl) {
          // Redirect to Stripe Checkout
          window.location.href = data.checkoutUrl;
        } else if (data.subscriptionId) {
          // Subscription created directly
          router.push(`/billing?subscription=${data.subscriptionId}`);
        }
      } else {
        const errorData = await res.json();
        if (errorData.paymentsEnabled === false) {
          setPaymentsEnabled(false);
          setError("Payments are currently unavailable in your region. We're working on enabling them soon!");
        } else {
          setError(errorData.error || errorData.message || "Failed to start upgrade process. Please try again.");
        }
        setLoading(false);
      }
    } catch (err) {
      setError("Failed to start upgrade process. Please try again.");
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="upgrade-modal-title"
        aria-describedby="upgrade-modal-description"
      >
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          aria-hidden="true"
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-4xl rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-800 p-8 shadow-2xl"
        >
          <button
            onClick={onClose}
            aria-label="Close upgrade modal"
            className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="text-center mb-8">
            <h2 id="upgrade-modal-title" className="text-3xl font-bold text-white mb-2">Upgrade Your Plan</h2>
            <p id="upgrade-modal-description" className="text-white/70">
              {currentTier === "FREE"
                ? "You've used all your free credits. Upgrade to continue analyzing conversations."
                : "Upgrade to get more credits and unlock premium features."}
            </p>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-red-200 text-sm"
                role="alert"
                aria-live="assertive"
              >
                {error}
              </motion.div>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-6">
            {tiers.map((tier) => (
              <motion.div
                key={tier.id}
                whileHover={{ scale: 1.02 }}
                className={`relative rounded-2xl border-2 p-6 ${
                  tier.popular
                    ? "border-indigo-500 bg-indigo-500/10"
                    : "border-white/10 bg-white/5"
                }`}
              >
                {tier.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-indigo-500 text-xs font-semibold text-white">
                    Most Popular
                  </div>
                )}

                <div className="text-center mb-4">
                  <h3 className="text-xl font-bold text-white mb-1">{tier.name}</h3>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-3xl font-bold text-white">{tier.price}</span>
                    <span className="text-white/60">/month</span>
                  </div>
                  <p className="text-sm text-white/70 mt-1">{tier.credits} credits/month</p>
                </div>

                <ul className="space-y-2 mb-6">
                  {tier.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-white/80">
                      <svg
                        className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                {!paymentsEnabled ? (
                  <div className="w-full rounded-xl px-4 py-3 text-center bg-amber-500/20 border border-amber-500/30 text-amber-200">
                    <p className="text-sm font-semibold">Coming Soon</p>
                    <p className="text-xs mt-1 opacity-80">Payments will be available soon</p>
                  </div>
                ) : (
                  <button
                    onClick={() => handleUpgrade(tier.id)}
                    disabled={loading && selectedTier === tier.id}
                    aria-busy={loading && selectedTier === tier.id}
                    aria-label={`Upgrade to ${tier.name} plan`}
                    className={`w-full rounded-xl px-4 py-3 font-semibold transition-all ${
                      tier.popular
                        ? "bg-indigo-500 hover:bg-indigo-600 text-white"
                        : "bg-white/10 hover:bg-white/20 text-white"
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {loading && selectedTier === tier.id ? "Processing..." : `Upgrade to ${tier.name}`}
                  </button>
                )}
              </motion.div>
            ))}
          </div>

          <p className="text-center text-xs text-white/50">
            All plans include secure payment processing via Stripe. Cancel anytime.
          </p>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

