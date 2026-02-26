import React from "react";
import ActivityFeedItem from "./ActivityFeedItem";

export default function ActivityFeed({ items = [], loading = false, emptyText = "No activity found." }) {
  if (loading) {
    return <div className="text-sm text-gray-500">Loading activity...</div>;
  }

  if (!items?.length) {
    return <div className="rounded-md border border-dashed border-gray-300 p-4 text-sm text-gray-500">{emptyText}</div>;
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <ActivityFeedItem key={item.id || `${item.action}-${item.created_at}`} item={item} />
      ))}
    </div>
  );
}
