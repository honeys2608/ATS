/**
 * Notifications System UI
 * In-app notifications, email triggers, preferences
 */

import React, { useState, useEffect } from "react";
import axios from "../../api/axios";

function NotificationBadge({ count }) {
  if (count === 0) return null;
  return (
    <div className="absolute top-0 right-0 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
      {count > 9 ? "9+" : count}
    </div>
  );
}

function NotificationItem({ notification, onMarkRead, onDelete }) {
  const getIcon = (type) => {
    const icons = {
      application: "📝",
      interview: "🎤",
      offer: "🎉",
      submission: "📤",
      message: "💬",
      task: "✓",
      alert: "⚠️",
    };
    return icons[type] || "🔔";
  };

  const getColor = (type) => {
    switch (type) {
      case "application":
        return "blue";
      case "interview":
        return "purple";
      case "offer":
        return "green";
      case "submission":
        return "orange";
      case "alert":
        return "red";
      default:
        return "gray";
    }
  };

  const isNew = !notification.is_read;
  const color = getColor(notification.type);

  return (
    <div
      className={`p-4 border-l-4 border-${color}-500 ${
        isNew ? `bg-${color}-50` : "bg-white"
      } flex justify-between items-start hover:shadow transition`}
    >
      <div className="flex gap-3 flex-1">
        <div className="text-2xl">{getIcon(notification.type)}</div>
        <div className="flex-1">
          <h4
            className={`font-semibold text-gray-900 ${!isNew && "text-gray-600"}`}
          >
            {notification.title}
          </h4>
          <p className="text-sm text-gray-600">{notification.message}</p>
          <p className="text-xs text-gray-500 mt-1">
            {new Date(notification.created_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
      </div>

      <div className="flex gap-2 ml-2">
        {isNew && (
          <button
            onClick={() => onMarkRead(notification.id)}
            className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200"
            title="Mark as read"
          >
            ✓
          </button>
        )}
        <button
          onClick={() => onDelete(notification.id)}
          className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded hover:bg-red-200"
          title="Delete"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

function NotificationDropdown({ notifications, onClose, onMarkAllRead }) {
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="fixed inset-0 z-40" onClick={onClose}>
      <div
        className="absolute top-16 right-4 bg-white rounded-lg shadow-2xl w-96 max-h-96 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="bg-gray-50 p-4 border-b flex justify-between items-center">
          <div>
            <h3 className="font-bold text-gray-900">Notifications</h3>
            <p className="text-xs text-gray-600">{unreadCount} unread</p>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={() => onMarkAllRead()}
              className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded hover:bg-blue-200"
            >
              Mark all as read
            </button>
          )}
        </div>

        {/* NOTIFICATIONS LIST */}
        <div className="overflow-y-auto flex-1 space-y-1">
          {notifications.length > 0 ? (
            notifications
              .slice(0, 10)
              .map((notif) => (
                <NotificationItem
                  key={notif.id}
                  notification={notif}
                  onMarkRead={() => {}}
                  onDelete={() => {}}
                />
              ))
          ) : (
            <div className="p-8 text-center text-gray-500">
              <p>No notifications</p>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="bg-gray-50 p-3 border-t text-center">
          <a
            href="/notifications"
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            View all notifications →
          </a>
        </div>
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [preferences, setPreferences] = useState({
    email_enabled: true,
    sms_enabled: false,
    interview_reminders: true,
    submission_updates: true,
    offer_notifications: true,
    daily_digest: true,
  });
  const [showDropdown, setShowDropdown] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);

  useEffect(() => {
    loadNotifications();
    loadPreferences();
  }, []);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const res = await axios.get("/v1/notifications");
      setNotifications(
        Array.isArray(res.data) ? res.data : res.data?.data || [],
      );
    } catch (err) {
      console.error("Failed to load notifications:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadPreferences = async () => {
    try {
      const res = await axios.get("/v1/notifications/preferences");
      setPreferences(res.data?.data || preferences);
    } catch (err) {
      console.error("Failed to load preferences:", err);
    }
  };

  const handleMarkRead = async (notificationId) => {
    try {
      await axios.put(`/v1/notifications/${notificationId}/read`);
      setNotifications(
        notifications.map((n) =>
          n.id === notificationId ? { ...n, is_read: true } : n,
        ),
      );
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await axios.post("/v1/notifications/mark-all-read");
      setNotifications(notifications.map((n) => ({ ...n, is_read: true })));
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    }
  };

  const handleDeleteNotification = async (notificationId) => {
    try {
      await axios.delete(`/v1/notifications/${notificationId}`);
      setNotifications(notifications.filter((n) => n.id !== notificationId));
    } catch (err) {
      console.error("Failed to delete notification:", err);
    }
  };

  const handleSavePreferences = async () => {
    try {
      setSavingPrefs(true);
      await axios.post("/v1/notifications/preferences", preferences);
      alert("Preferences saved!");
    } catch (err) {
      alert("Error saving preferences: " + err.message);
    } finally {
      setSavingPrefs(false);
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    if (filter === "unread") return !n.is_read;
    if (filter === "application") return n.type === "application";
    if (filter === "interview") return n.type === "interview";
    if (filter === "offer") return n.type === "offer";
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  if (loading)
    return <div className="p-6 text-center">Loading notifications...</div>;

  return (
    <div>
      {/* DROPDOWN VERSION (Sidebar/Header) */}
      {showDropdown && (
        <NotificationDropdown
          notifications={notifications}
          onClose={() => setShowDropdown(false)}
          onMarkAllRead={handleMarkAllRead}
        />
      )}

      {/* FULL PAGE VERSION */}
      <div className="p-6 max-w-4xl mx-auto">
        {/* HEADER */}
        <div className="mb-6 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Notifications</h1>
            <p className="text-gray-600 mt-1">
              Manage your notification center
            </p>
          </div>
          <button
            onClick={() => setShowPreferences(true)}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 font-medium"
          >
            ⚙️ Preferences
          </button>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <p className="text-xs text-blue-600 font-semibold">Total</p>
            <p className="text-2xl font-bold text-blue-600">
              {notifications.length}
            </p>
          </div>
          <div className="bg-red-50 p-4 rounded-lg border border-red-200">
            <p className="text-xs text-red-600 font-semibold">Unread</p>
            <p className="text-2xl font-bold text-red-600">{unreadCount}</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <p className="text-xs text-green-600 font-semibold">Read</p>
            <p className="text-2xl font-bold text-green-600">
              {notifications.length - unreadCount}
            </p>
          </div>
        </div>

        {/* FILTERS & ACTIONS */}
        <div className="bg-white p-4 rounded-lg shadow mb-6 flex gap-4 flex-wrap">
          <button
            onClick={() => setFilter("all")}
            className={`px-4 py-2 rounded text-sm font-medium ${
              filter === "all"
                ? "bg-blue-600 text-white"
                : "border border-gray-300 text-gray-700 hover:bg-gray-50"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter("unread")}
            className={`px-4 py-2 rounded text-sm font-medium ${
              filter === "unread"
                ? "bg-red-600 text-white"
                : "border border-gray-300 text-gray-700 hover:bg-gray-50"
            }`}
          >
            Unread
          </button>
          <button
            onClick={() => setFilter("interview")}
            className={`px-4 py-2 rounded text-sm font-medium ${
              filter === "interview"
                ? "bg-purple-600 text-white"
                : "border border-gray-300 text-gray-700 hover:bg-gray-50"
            }`}
          >
            Interviews
          </button>
          <button
            onClick={() => setFilter("offer")}
            className={`px-4 py-2 rounded text-sm font-medium ${
              filter === "offer"
                ? "bg-green-600 text-white"
                : "border border-gray-300 text-gray-700 hover:bg-gray-50"
            }`}
          >
            Offers
          </button>

          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="ml-auto px-4 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-sm font-medium"
            >
              Mark all as read
            </button>
          )}
        </div>

        {/* NOTIFICATIONS LIST */}
        <div className="bg-white rounded-lg shadow divide-y">
          {filteredNotifications.length > 0 ? (
            <div className="space-y-0">
              {filteredNotifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkRead={handleMarkRead}
                  onDelete={handleDeleteNotification}
                />
              ))}
            </div>
          ) : (
            <div className="p-12 text-center">
              <p className="text-gray-600 text-lg">No notifications</p>
              <p className="text-gray-400 text-sm mt-2">
                You're all caught up!
              </p>
            </div>
          )}
        </div>
      </div>

      {/* PREFERENCES MODAL */}
      {showPreferences && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-2xl font-bold mb-6">
              Notification Preferences
            </h2>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <div>
                  <p className="font-medium text-gray-900">
                    Email Notifications
                  </p>
                  <p className="text-xs text-gray-600">Get updates via email</p>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.email_enabled}
                  onChange={(e) =>
                    setPreferences({
                      ...preferences,
                      email_enabled: e.target.checked,
                    })
                  }
                  className="w-5 h-5"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <div>
                  <p className="font-medium text-gray-900">SMS Notifications</p>
                  <p className="text-xs text-gray-600">Get updates via SMS</p>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.sms_enabled}
                  onChange={(e) =>
                    setPreferences({
                      ...preferences,
                      sms_enabled: e.target.checked,
                    })
                  }
                  className="w-5 h-5"
                />
              </div>

              <hr />

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <div>
                  <p className="font-medium text-gray-900">
                    Interview Reminders
                  </p>
                  <p className="text-xs text-gray-600">
                    Remind before interviews
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.interview_reminders}
                  onChange={(e) =>
                    setPreferences({
                      ...preferences,
                      interview_reminders: e.target.checked,
                    })
                  }
                  className="w-5 h-5"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <div>
                  <p className="font-medium text-gray-900">
                    Submission Updates
                  </p>
                  <p className="text-xs text-gray-600">
                    Client submission status
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.submission_updates}
                  onChange={(e) =>
                    setPreferences({
                      ...preferences,
                      submission_updates: e.target.checked,
                    })
                  }
                  className="w-5 h-5"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <div>
                  <p className="font-medium text-gray-900">
                    Offer Notifications
                  </p>
                  <p className="text-xs text-gray-600">Get offer alerts</p>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.offer_notifications}
                  onChange={(e) =>
                    setPreferences({
                      ...preferences,
                      offer_notifications: e.target.checked,
                    })
                  }
                  className="w-5 h-5"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <div>
                  <p className="font-medium text-gray-900">Daily Digest</p>
                  <p className="text-xs text-gray-600">Summary at 9 AM</p>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.daily_digest}
                  onChange={(e) =>
                    setPreferences({
                      ...preferences,
                      daily_digest: e.target.checked,
                    })
                  }
                  className="w-5 h-5"
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => setShowPreferences(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePreferences}
                disabled={savingPrefs}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {savingPrefs ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
