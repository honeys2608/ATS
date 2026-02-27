import React, { useState, useEffect, useRef } from "react";
import { Bell, BellRing } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { apiService } from "../../api/axios";
import NotificationPanel from "./NotificationPanel";

const AlarmIcon = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [hasUrgent, setHasUrgent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notificationsForbidden, setNotificationsForbidden] = useState(false);
  const panelRef = useRef(null);
  const iconRef = useRef(null);

  const apiGetWithFallback = async (primaryPath, fallbackPath, config = {}) => {
    try {
      return await apiService.get(primaryPath, config);
    } catch (error) {
      if (error?.response?.status === 404 && fallbackPath) {
        return apiService.get(fallbackPath, config);
      }
      throw error;
    }
  };

  const apiPostWithFallback = async (primaryPath, fallbackPath, payload = {}) => {
    try {
      return await apiService.post(primaryPath, payload);
    } catch (error) {
      if (error?.response?.status === 404 && fallbackPath) {
        return apiService.post(fallbackPath, payload);
      }
      throw error;
    }
  };

  // Fetch notification summary
  const fetchNotificationSummary = async () => {
    if (notificationsForbidden) return;
    try {
      const response = await apiGetWithFallback(
        "/api/notifications/summary",
        "/v1/notifications/summary",
      );
      const data = response.data;

      setUnreadCount(Number(data?.total_unread || 0));
      setHasUrgent(Boolean(data?.has_urgent));
      setNotificationsForbidden(false);

      // If panel is open, fetch full notifications
      if (isOpen) {
        await fetchNotifications();
      }
    } catch (error) {
      if (error?.response?.status === 403) {
        setNotificationsForbidden(true);
        setUnreadCount(0);
        setHasUrgent(false);
        setNotifications([]);
        return;
      }
      console.error("Failed to fetch notification summary:", error);
    }
  };

  // Fetch full notifications list
  const fetchNotifications = async () => {
    if (notificationsForbidden) return;
    setLoading(true);
    try {
      const response = await apiGetWithFallback("/api/notifications", "/v1/notifications", {
        params: {
          limit: 50,
          unread_only: false,
        },
      });
      const list = response?.data?.notifications || response?.data?.data || response?.data || [];
      setNotifications(Array.isArray(list) ? list : []);
    } catch (error) {
      if (error?.response?.status === 403) {
        setNotificationsForbidden(true);
        setNotifications([]);
        return;
      }
      console.error("Failed to fetch notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  // Mark notification as read
  const markAsRead = async (notificationId) => {
    try {
      await apiPostWithFallback(
        `/api/notifications/${notificationId}/mark-read`,
        `/v1/notifications/${notificationId}/mark-read`,
      );

      // Update local state
      setNotifications((prev) =>
        prev.map((notif) =>
          notif.id === notificationId
            ? { ...notif, is_read: true, read_at: new Date().toISOString() }
            : notif,
        ),
      );

      // Refresh summary
      await fetchNotificationSummary();
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  };

  // Mark all notifications as read
  const markAllAsRead = async () => {
    try {
      await apiPostWithFallback(
        "/api/notifications/mark-all-read",
        "/v1/notifications/mark-all-read",
      );

      // Update local state
      setNotifications((prev) =>
        prev.map((notif) => ({
          ...notif,
          is_read: true,
          read_at: new Date().toISOString(),
        })),
      );

      setUnreadCount(0);
      setHasUrgent(false);
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error);
    }
  };

  // Handle alarm icon click
  const handleAlarmClick = () => {
    setIsOpen(!isOpen);
  };

  const buildCalendarRoute = (notification, baseRoute) => {
    const params = new URLSearchParams();

    const candidateId =
      notification?.action?.candidate_id ||
      notification?.candidate?.id ||
      notification?.reference_id;
    if (candidateId) params.set("candidate_id", String(candidateId));

    const requirementId =
      notification?.action?.requirement_id || notification?.requirement?.id;
    if (requirementId) params.set("requirement_id", String(requirementId));

    const recruiterName = notification?.action?.recruiter_name;
    if (recruiterName) params.set("recruiter_name", String(recruiterName));

    const query = params.toString();
    return query ? `${baseRoute}?${query}` : baseRoute;
  };

  const buildNotificationRoute = (notification) => {
    if (!notification || typeof notification !== "object") return "";

    const actionType = notification.action?.type;
    if (actionType === "view_interview_calendar") {
      const calendarRoute = location.pathname.startsWith("/account-manager")
        ? "/account-manager/interview-calendar"
        : "/recruiter/interviews/calendar";
      return buildCalendarRoute(notification, calendarRoute);
    }

    if (actionType !== "schedule_interview") return "";

    if (location.pathname.startsWith("/account-manager")) {
      return buildCalendarRoute(notification, "/account-manager/interview-calendar");
    }

    const candidateId =
      notification.action?.candidate_id ||
      notification.candidate?.id ||
      notification.reference_id;
    if (!candidateId) return "";

    const params = new URLSearchParams();
    params.set("candidate_id", String(candidateId));

    const workflowJobId =
      notification.action?.job_id ||
      notification.requirement?.job_id ||
      notification.action?.requirement_id ||
      notification.requirement?.id;
    if (workflowJobId) params.set("jobId", String(workflowJobId));

    const candidateName = notification.candidate?.full_name;
    if (candidateName) params.set("candidate_name", String(candidateName));

    const requirementTitle = notification.requirement?.title;
    if (requirementTitle) params.set("jobTitle", String(requirementTitle));

    const requirementCode = notification.requirement?.code;
    if (requirementCode) params.set("requirement_code", String(requirementCode));

    params.set("tab", "client_shortlisted");

    return `/recruiter/candidate-workflow?${params.toString()}`;
  };

  const handleNotificationClick = async (notification) => {
    if (!notification) return;

    if (!notification.is_read && notification.id) {
      await markAsRead(notification.id);
    }

    const route = buildNotificationRoute(notification);
    if (route) {
      setIsOpen(false);
      navigate(route);
    }
  };

  // Close panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target) &&
        iconRef.current &&
        !iconRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Fetch notifications when panel opens
  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen, notificationsForbidden]);

  // Real-time polling every 60 seconds
  useEffect(() => {
    if (notificationsForbidden) return undefined;

    // Initial fetch
    fetchNotificationSummary();

    // Set up polling
    const interval = setInterval(fetchNotificationSummary, 60000); // 60 seconds

    return () => clearInterval(interval);
  }, [notificationsForbidden]);

  const getAlarmIconClass = () => {
    let baseClass =
      "relative p-2 rounded-lg transition-all duration-200 cursor-pointer ";

    if (hasUrgent) {
      return baseClass + "text-red-500 hover:bg-red-50 animate-pulse";
    } else if (unreadCount > 0) {
      return baseClass + "text-amber-500 hover:bg-amber-50";
    } else {
      return baseClass + "text-gray-400 hover:bg-gray-100";
    }
  };

  return (
    <div className="relative">
      {/* Alarm Icon */}
      <div
        ref={iconRef}
        onClick={handleAlarmClick}
        className={getAlarmIconClass()}
        title={`${unreadCount} unread notifications`}
      >
        {/* Use BellRing for urgent/active, Bell for normal */}
        {hasUrgent ? (
          <BellRing className="w-6 h-6" />
        ) : (
          <Bell className="w-6 h-6" />
        )}

        {/* Badge showing unread count */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-medium">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </div>

      {/* Notification Panel */}
      {isOpen && (
        <NotificationPanel
          ref={panelRef}
          notifications={notifications}
          loading={loading}
          unreadCount={unreadCount}
          onMarkAsRead={markAsRead}
          onMarkAllAsRead={markAllAsRead}
          onNotificationClick={handleNotificationClick}
          onClose={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};

export default AlarmIcon;
