// src/utils/dateFormatter.js
// Centralized date formatting utility for DD-MMM-YYYY

/**
 * Formats a date value to DD-MMM-YYYY (e.g., 16-Jan-2026).
 * Handles null, invalid, and ISO/timestamp values. Timezone-safe.
 * @param {string|Date|number|null|undefined} value - The date value to format.
 * @returns {string} Formatted date or '—' for invalid/null.
 */
export function formatDate(value) {
  if (!value) return "—";
  let date;
  if (value instanceof Date) {
    date = value;
  } else if (typeof value === "string" || typeof value === "number") {
    date = new Date(value);
  } else {
    return "—";
  }
  if (isNaN(date.getTime())) return "—";
  // Use UTC to avoid timezone issues
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = date.toLocaleString("en-US", {
    month: "short",
    timeZone: "UTC",
  });
  const year = date.getUTCFullYear();
  return `${day}-${month}-${year}`;
}
