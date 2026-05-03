"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export function FeedbackWidget({ analysisReportId, onFeedbackSubmitted }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [wasHelpful, setWasHelpful] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (rating === 0 && wasHelpful === null) {
      setError("Please provide feedback");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const token = sessionStorage.getItem("cv_access_token");
      if (!token) {
        setError("Please log in to submit feedback");
        setSubmitting(false);
        return;
      }

      const res = await fetch("/api/personalization/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          analysisReportId,
          rating: rating > 0 ? rating : undefined,
          comment: comment.trim() || undefined,
          wasHelpful: wasHelpful !== null ? wasHelpful : undefined,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSubmitted(true);
        if (onFeedbackSubmitted) {
          onFeedbackSubmitted(data.feedback);
        }
      } else {
        setError(data.error || "Failed to submit feedback");
      }
    } catch (err) {
      console.error("Error submitting feedback:", err);
      setError("Failed to submit feedback. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-green-500/20 border border-green-500/50 rounded-lg p-4 text-center"
      >
        <p className="text-green-200 font-semibold">
          ✓ Thank you for your feedback! It helps us improve.
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/5 border border-white/10 rounded-lg p-6"
    >
      <h3 className="text-lg font-semibold mb-4">Help us improve</h3>
      <p className="text-sm text-white/60 mb-4">
        Your feedback helps us personalize your experience
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Rating */}
        <div>
          <label className="block text-sm font-medium mb-2">
            How would you rate this analysis?
          </label>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                className={`text-2xl transition ${
                  star <= rating
                    ? "text-yellow-400"
                    : "text-white/30 hover:text-white/60"
                }`}
              >
                ★
              </button>
            ))}
          </div>
        </div>

        {/* Helpful */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Was this analysis helpful?
          </label>
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => setWasHelpful(true)}
              className={`px-4 py-2 rounded-lg transition ${
                wasHelpful === true
                  ? "bg-green-500 text-white"
                  : "bg-white/10 text-white/70 hover:bg-white/20"
              }`}
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => setWasHelpful(false)}
              className={`px-4 py-2 rounded-lg transition ${
                wasHelpful === false
                  ? "bg-red-500 text-white"
                  : "bg-white/10 text-white/70 hover:bg-white/20"
              }`}
            >
              No
            </button>
          </div>
        </div>

        {/* Comment */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Additional comments (optional)
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Tell us what you think..."
            className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white placeholder-white/40 focus:outline-none focus:border-indigo-500"
            rows={3}
          />
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-sm text-red-200">
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting || (rating === 0 && wasHelpful === null)}
          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-white/10 disabled:text-white/40 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg transition"
        >
          {submitting ? "Submitting..." : "Submit Feedback"}
        </button>
      </form>
    </motion.div>
  );
}

