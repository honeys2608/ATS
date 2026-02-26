import React from "react";
export default function EmptyState() {
  return (
    <div className="text-center text-gray-400 py-12">
      <div className="text-5xl mb-2">📊</div>
      <div className="font-semibold">
        No data available for the selected filters.
      </div>
    </div>
  );
}
