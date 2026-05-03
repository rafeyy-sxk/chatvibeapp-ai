/**
 * Stripe Configuration & Client
 * Production-grade Stripe integration
 */

import Stripe from "stripe";
import { env } from "../env";

// Note: Warning is handled by env.js - no need to log here

export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2024-12-18.acacia",
      typescript: true,
    })
  : null;

// Subscription tier configuration
export const TIER_CONFIG = {
  FREE: {
    name: "Free",
    priceId: null, // No Stripe price for free tier
    monthlyPrice: 0,
    monthlyCredits: 10,
    overageRate: 0, // No overage allowed - hard stop
    maxImagesPerJob: 5,
    priority: 1,
    features: ["Basic analysis", "5 images per job", "10 jobs/month", "Community support"],
  },
  BASIC: {
    name: "Basic",
    priceId: process.env.STRIPE_PRICE_ID_BASIC || "price_basic_placeholder",
    monthlyPrice: 299, // $2.99 in cents
    monthlyCredits: 30,
    overageRate: 0, // No overage allowed - hard stop
    maxImagesPerJob: 8,
    priority: 3,
    features: [
      "30 analysis jobs/month",
      "8 images per job",
      "Standard processing",
      "Email support",
      "Export features",
    ],
  },
  PRO: {
    name: "Pro",
    priceId: process.env.STRIPE_PRICE_ID_PRO || "price_pro_placeholder",
    monthlyPrice: 599, // $5.99 in cents
    monthlyCredits: 100,
    overageRate: 0, // No overage allowed - hard stop
    maxImagesPerJob: 10,
    priority: 5,
    features: [
      "100 analysis jobs/month",
      "10 images per job",
      "Priority processing",
      "Priority support",
      "All export formats",
      "Advanced insights",
    ],
  },
};

// Get tier config by name
export function getTierConfig(tier) {
  return TIER_CONFIG[tier] || TIER_CONFIG.FREE;
}

// Convert cents to dollars
export function centsToDollars(cents) {
  return (cents / 100).toFixed(2);
}

// Convert dollars to cents
export function dollarsToCents(dollars) {
  return Math.round(dollars * 100);
}

// Re-export getUserTier from subscription module
export { getUserTier } from "./subscription";

