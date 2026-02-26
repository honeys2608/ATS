// src/utils/timeUtils.js

/**
 * Format a timestamp as relative time (e.g., '2 hours ago', 'Yesterday')
 * @param {string|Date} timestamp - The timestamp to format
 * @returns {string} Human-readable relative time
 */
export const formatRelativeTime = (timestamp) => {
  if (!timestamp) return "No activity yet";

  const now = new Date();
  const date = new Date(timestamp);
  const diff = now - date;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (seconds < 60) {
    return "Just now";
  } else if (minutes < 60) {
    return `${minutes} minute${minutes !== 1 ? "s" : ""} ago`;
  } else if (hours < 24) {
    return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
  } else if (days === 1) {
    return "Yesterday";
  } else if (days < 7) {
    return `${days} days ago`;
  } else if (weeks < 4) {
    return `${weeks} week${weeks !== 1 ? "s" : ""} ago`;
  } else if (months < 12) {
    return `${months} month${months !== 1 ? "s" : ""} ago`;
  } else {
    return `${years} year${years !== 1 ? "s" : ""} ago`;
  }
};

/**
 * Get activity freshness indicator
 * @param {string|Date} timestamp - The timestamp to check
 * @returns {string} 'fresh', 'recent', 'stale', or 'very-stale'
 */
export const getActivityFreshness = (timestamp) => {
  if (!timestamp) return "very-stale";

  const now = new Date();
  const date = new Date(timestamp);
  const diff = now - date;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (hours < 24) return "fresh";
  if (days <= 7) return "recent";
  if (days <= 14) return "stale";
  return "very-stale";
};

/**
 * Format activity description for display
 * @param {string} activityType - The activity type
 * @param {string} description - Optional description
 * @param {Object} metadata - Optional metadata
 * @returns {string} Formatted activity description
 */
export const formatActivityDescription = (
  activityType,
  description,
  metadata = {},
) => {
  if (description && description !== activityType) {
    return description;
  }

  // Standard descriptions for common activity types
  const descriptions = {
    "Job Created": "Job created",
    "Job Updated": "Job updated",
    "Job Published": "Job published",
    "Job Unpublished": "Job unpublished",
    "Candidate Applied": "Candidate applied",
    "Candidate Added": "Candidate added",
    "Resume Uploaded": "Resume uploaded",
    "Status Changed": metadata.new_status
      ? `Status changed to ${metadata.new_status}`
      : "Status changed",
    "Interview Scheduled": "Interview scheduled",
    "Interview Feedback Submitted": "Interview feedback submitted",
    "Offer Sent": "Offer sent",
    "Offer Accepted": "Offer accepted",
    "Offer Rejected": "Offer rejected",
  };

  return descriptions[activityType] || activityType;
};

/**
 * Get CSS classes for activity freshness styling
 * @param {string} freshness - Output from getActivityFreshness
 * @returns {string} CSS classes
 */
export const getActivityFreshnessClasses = (freshness) => {
  const classes = {
    fresh: "text-green-600 bg-green-50 border-green-200",
    recent: "text-blue-600 bg-blue-50 border-blue-200",
    stale: "text-orange-600 bg-orange-50 border-orange-200",
    "very-stale": "text-gray-500 bg-gray-50 border-gray-200",
  };

  return classes[freshness] || classes["very-stale"];
};

/**
 * Calculate days since activity for filtering/sorting
 * @param {string|Date} timestamp - The timestamp to check
 * @returns {number|null} Days since activity, or null if no timestamp
 */
export const getDaysSinceActivity = (timestamp) => {
  if (!timestamp) return null;

  const now = new Date();
  const date = new Date(timestamp);
  const diff = now - date;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
};
