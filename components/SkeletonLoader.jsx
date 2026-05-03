"use client";

import { memo, useMemo } from "react";

/**
 * Skeleton Loader Components
 * 
 * Placeholder components for loading states
 */

export const SkeletonCard = memo(function SkeletonCard() {
  return (
    <div className="bg-white/5 border border-white/10 rounded-lg p-6 animate-pulse">
      <div className="h-4 bg-white/10 rounded w-3/4 mb-4"></div>
      <div className="h-4 bg-white/10 rounded w-1/2"></div>
    </div>
  );
});

export const SkeletonChart = memo(function SkeletonChart({ height = 300 }) {
  // Generate stable heights for skeleton bars
  const barHeights = useMemo(() => {
    return Array.from({ length: 10 }, () => Math.random() * 80 + 20);
  }, []);

  return (
    <div className="bg-white/5 border border-white/10 rounded-lg p-6 animate-pulse">
      <div className="h-4 bg-white/10 rounded w-1/4 mb-4"></div>
      <div
        className="bg-white/5 rounded"
        style={{ height: `${height}px` }}
      >
        <div className="h-full flex items-end justify-around p-4">
          {barHeights.map((barHeight, i) => (
            <div
              key={i}
              className="bg-white/10 rounded-t flex-1 mx-1"
              style={{
                height: `${barHeight}%`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
});

export const SkeletonTable = memo(function SkeletonTable({ rows = 5 }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-lg p-6 animate-pulse">
      <div className="h-4 bg-white/10 rounded w-1/4 mb-4"></div>
      <div className="space-y-2">
        {[...Array(rows)].map((_, i) => (
          <div key={i} className="flex gap-4">
            <div className="h-4 bg-white/10 rounded flex-1"></div>
            <div className="h-4 bg-white/10 rounded w-24"></div>
            <div className="h-4 bg-white/10 rounded w-32"></div>
          </div>
        ))}
      </div>
    </div>
  );
});

export const SkeletonDashboard = memo(function SkeletonDashboard() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
      <SkeletonChart height={300} />
      <SkeletonChart height={300} />
    </div>
  );
});
