// src/components/ActivityIndicator.jsx

import React from "react";
import {
  formatRelativeTime,
  formatActivityDescription,
  getActivityFreshness,
  getActivityFreshnessClasses,
} from "../utils/timeUtils";

/**
 * Activity Indicator Component
 * Displays last activity information with relative time and visual indicators
 */
const ActivityIndicator = ({
  lastActivityAt,
  lastActivityType,
  description,
  metadata,
  showIcon = true,
  size = "sm",
  className = "",
}) => {
  if (!lastActivityAt) {
    return (
      <div className={`flex items-center text-gray-400 ${className}`}>
        {showIcon && (
          <div className="w-2 h-2 rounded-full bg-gray-300 mr-2"></div>
        )}
        <span className="text-sm">No activity yet</span>
      </div>
    );
  }

  const relativeTime = formatRelativeTime(lastActivityAt);
  const activityDescription = formatActivityDescription(
    lastActivityType,
    description,
    metadata,
  );
  const freshness = getActivityFreshness(lastActivityAt);
  const freshnessClasses = getActivityFreshnessClasses(freshness);

  const sizeClasses = {
    xs: "text-xs",
    sm: "text-sm",
    base: "text-base",
    lg: "text-lg",
  };

  return (
    <div className={`flex items-center ${sizeClasses[size]} ${className}`}>
      {showIcon && (
        <div
          className={`w-2 h-2 rounded-full mr-2 ${
            freshness === "fresh"
              ? "bg-green-500"
              : freshness === "recent"
                ? "bg-blue-500"
                : freshness === "stale"
                  ? "bg-orange-500"
                  : "bg-gray-400"
          }`}
          title={`Activity freshness: ${freshness}`}
        ></div>
      )}
      <div className="flex flex-col">
        <span className="font-medium text-gray-900 truncate">
          {activityDescription}
        </span>
        <span className="text-gray-500">{relativeTime}</span>
      </div>
    </div>
  );
};

/**
 * Activity Badge Component
 * Compact badge showing just relative time with freshness color
 */
export const ActivityBadge = ({
  lastActivityAt,
  lastActivityType,
  description,
  metadata,
  className = "",
}) => {
  if (!lastActivityAt) {
    return (
      <span
        className={`px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-500 ${className}`}
      >
        No activity
      </span>
    );
  }

  const relativeTime = formatRelativeTime(lastActivityAt);
  const activityDescription = formatActivityDescription(
    lastActivityType,
    description,
    metadata,
  );
  const freshness = getActivityFreshness(lastActivityAt);

  const badgeClasses = {
    fresh: "bg-green-100 text-green-800 border border-green-200",
    recent: "bg-blue-100 text-blue-800 border border-blue-200",
    stale: "bg-orange-100 text-orange-800 border border-orange-200",
    "very-stale": "bg-gray-100 text-gray-600 border border-gray-200",
  };

  return (
    <span
      className={`px-2 py-1 text-xs rounded-full ${badgeClasses[freshness]} ${className}`}
      title={`${activityDescription} · ${relativeTime}`}
    >
      {relativeTime}
    </span>
  );
};

/**
 * Activity Summary Component
 * Shows full activity description with time in a tooltip-friendly format
 */
export const ActivitySummary = ({
  lastActivityAt,
  lastActivityType,
  lastActivityRelative, // Pre-computed relative time from backend
  description,
  metadata,
  className = "",
}) => {
  if (!lastActivityAt) {
    return (
      <span className={`text-gray-400 text-sm ${className}`}>
        No activity yet
      </span>
    );
  }

  // Use backend-provided relative time if available, otherwise compute it
  const relativeTime =
    lastActivityRelative || formatRelativeTime(lastActivityAt);
  const activityDescription = formatActivityDescription(
    lastActivityType,
    description,
    metadata,
  );
  const exactDate = new Date(lastActivityAt).toLocaleString();

  return (
    <div
      className={`text-sm ${className}`}
      title={`${activityDescription} on ${exactDate}`}
    >
      <span className="text-gray-900">{activityDescription}</span>
      <span className="text-gray-500"> · {relativeTime}</span>
    </div>
  );
};

/**
 * Stale Activity Warning Component
 * Shows warning for entities with old activity
 */
export const StaleActivityWarning = ({
  lastActivityAt,
  thresholdDays = 14,
  className = "",
}) => {
  if (!lastActivityAt) return null;

  const now = new Date();
  const activityDate = new Date(lastActivityAt);
  const daysSince = Math.floor((now - activityDate) / (1000 * 60 * 60 * 24));

  if (daysSince < thresholdDays) return null;

  return (
    <div
      className={`flex items-center text-orange-600 bg-orange-50 border border-orange-200 rounded-md px-2 py-1 text-xs ${className}`}
    >
      <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
          clipRule="evenodd"
        ></path>
      </svg>
      Stale ({daysSince} days)
    </div>
  );
};

export default ActivityIndicator;
