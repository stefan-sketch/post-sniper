import React from 'react';

export function TwitterPostSkeleton() {
  return (
    <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-4">
      {/* Header skeleton */}
      <div className="flex items-start gap-3 mb-3">
        {/* Profile picture skeleton */}
        <div className="w-10 h-10 rounded-full bg-gray-700 animate-pulse flex-shrink-0" />
        
        <div className="flex-1">
          {/* Name and handle skeleton */}
          <div className="flex items-center gap-2 mb-1">
            <div className="h-4 bg-gray-700 rounded w-24 animate-pulse" />
            <div className="h-3 bg-gray-700 rounded w-20 animate-pulse" />
          </div>
          {/* Timestamp skeleton */}
          <div className="h-3 bg-gray-700 rounded w-16 animate-pulse" />
        </div>
      </div>

      {/* Tweet text skeleton */}
      <div className="space-y-2 mb-3">
        <div className="h-3 bg-gray-700 rounded w-full animate-pulse" />
        <div className="h-3 bg-gray-700 rounded w-4/5 animate-pulse" />
        <div className="h-3 bg-gray-700 rounded w-3/5 animate-pulse" />
      </div>

      {/* Image skeleton (optional, 50% chance) */}
      {Math.random() > 0.5 && (
        <div className="w-full h-48 bg-gray-700 rounded-lg animate-pulse mb-3" />
      )}

      {/* Engagement stats skeleton */}
      <div className="flex items-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-gray-700 animate-pulse" />
          <div className="h-3 bg-gray-700 rounded w-12 animate-pulse" />
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-gray-700 animate-pulse" />
          <div className="h-3 bg-gray-700 rounded w-12 animate-pulse" />
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-gray-700 animate-pulse" />
          <div className="h-3 bg-gray-700 rounded w-12 animate-pulse" />
        </div>
      </div>
    </div>
  );
}

export function TwitterPostSkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <TwitterPostSkeleton key={i} />
      ))}
    </div>
  );
}

