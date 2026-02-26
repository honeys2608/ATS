import api from "../api/axios";

/**
 * Helper to normalize API responses
 * Supports:
 * - res.data
 * - res.data.data
 */
function unwrap(res) {
  return res?.data?.data ?? res?.data;
}

/* =========================
   Notifications
   ========================= */

/**
 * getNotifications
 * - Fetch notifications for logged-in user
 * - Backend decides scope based on JWT
 */
export async function getNotifications(params = {}) {
  const res = await api.get("/v1/notifications", {
    params,
  });
  return unwrap(res);
}

/**
 * markNotificationRead
 * - Mark a single notification as read
 */
export async function markNotificationRead(notificationId) {
  if (!notificationId) {
    throw new Error("notificationId is required");
  }

  const res = await api.patch(`/v1/notifications/${notificationId}/read`);
  return unwrap(res);
}

/**
 * markAllNotificationsRead
 * - Convenience method
 * - Optional backend support
 */
export async function markAllNotificationsRead() {
  const res = await api.patch("/v1/notifications/read-all");
  return unwrap(res);
}
