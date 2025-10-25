import React from 'react';

interface PostCardSkeletonProps {
  compact?: boolean;
}

export function PostCardSkeleton({ compact = false }: PostCardSkeletonProps) {
  return (
    <div className={`bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden ${compact ? 'mb-3' : 'mb-4'}`}>
      {/* Header skeleton */}
      <div className="p-4 flex items-center gap-3">
        {/* Profile picture skeleton */}
        <div className="w-10 h-10 rounded-full bg-gray-700 animate-pulse" />
        
        <div className="flex-1">
          {/* Page name skeleton */}
          <div className="h-4 bg-gray-700 rounded w-32 mb-2 animate-pulse" />
          {/* Timestamp skeleton */}
          <div className="h-3 bg-gray-700 rounded w-20 animate-pulse" />
        </div>
      </div>

      {/* Message skeleton */}
      <div className="px-4 pb-3 space-y-2">
        <div className="h-3 bg-gray-700 rounded w-full animate-pulse" />
        <div className="h-3 bg-gray-700 rounded w-5/6 animate-pulse" />
        <div className="h-3 bg-gray-700 rounded w-4/6 animate-pulse" />
      </div>

      {/* Image skeleton */}
      <div className="w-full h-64 bg-gray-700 animate-pulse" />

      {/* Footer skeleton */}
      <div className="p-4 flex items-center gap-6">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-gray-700 animate-pulse" />
          <div className="h-3 bg-gray-700 rounded w-12 animate-pulse" />
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-gray-700 animate-pulse" />
          <div className="h-3 bg-gray-700 rounded w-12 animate-pulse" />
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-gray-700 animate-pulse" />
          <div className="h-3 bg-gray-700 rounded w-12 animate-pulse" />
        </div>
      </div>
    </div>
  );
}

export function PostCardSkeletonList({ count = 3, compact = false }: { count?: number; compact?: boolean }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <PostCardSkeleton key={i} compact={compact} />
      ))}
    </>
  );
}

