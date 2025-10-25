import React from 'react';

export function RedditPostSkeleton() {
  return (
    <div className="bg-gray-800/50 rounded-lg border border-gray-700">
      <div className="p-4">
        <div className="flex gap-3">
          {/* Upvote section skeleton */}
          <div className="flex flex-col items-center gap-1 flex-shrink-0">
            <div className="w-4 h-4 rounded bg-gray-700 animate-pulse" />
            <div className="h-4 bg-gray-700 rounded w-8 animate-pulse" />
            <div className="w-4 h-4 rounded bg-gray-700 animate-pulse" />
          </div>

          {/* Content skeleton */}
          <div className="flex-1">
            {/* Subreddit and author skeleton */}
            <div className="flex items-center gap-2 mb-2">
              <div className="h-3 bg-gray-700 rounded w-24 animate-pulse" />
              <div className="h-3 bg-gray-700 rounded w-20 animate-pulse" />
            </div>

            {/* Title skeleton */}
            <div className="space-y-2 mb-3">
              <div className="h-4 bg-gray-700 rounded w-full animate-pulse" />
              <div className="h-4 bg-gray-700 rounded w-4/5 animate-pulse" />
            </div>

            {/* Image skeleton (optional, 40% chance) */}
            {Math.random() > 0.6 && (
              <div className="w-full h-40 bg-gray-700 rounded-lg animate-pulse mb-3" />
            )}

            {/* Footer skeleton */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-gray-700 animate-pulse" />
                <div className="h-3 bg-gray-700 rounded w-16 animate-pulse" />
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-gray-700 animate-pulse" />
                <div className="h-3 bg-gray-700 rounded w-12 animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function RedditPostSkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <RedditPostSkeleton key={i} />
      ))}
    </div>
  );
}

