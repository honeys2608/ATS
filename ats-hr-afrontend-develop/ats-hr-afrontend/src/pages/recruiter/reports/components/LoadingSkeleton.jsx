import React from "react";
export default function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-10 bg-gray-200 rounded w-1/2" />
      <div className="h-24 bg-gray-200 rounded" />
      <div className="h-8 bg-gray-200 rounded w-1/3" />
    </div>
  );
}
