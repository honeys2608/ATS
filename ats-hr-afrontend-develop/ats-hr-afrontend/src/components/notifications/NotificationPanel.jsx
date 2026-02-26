import React, { forwardRef } from "react";
import {
  X,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Eye,
  Calendar,
} from "lucide-react";

const NotificationPanel = forwardRef(
  (
    {
      notifications,
      loading,
      unreadCount,
      onMarkAsRead,
      onMarkAllAsRead,
      onNotificationClick,
      onClose,
    },
    ref,
  ) => {
    const formatTimeAgo = (dateString) => {
      const now = new Date();
      const date = new Date(dateString);
      const diffInHours = Math.floor((now - date) / (1000 * 60 * 60));

      if (diffInHours < 1) {
        const diffInMinutes = Math.floor((now - date) / (1000 * 60));
        return `${diffInMinutes}m ago`;
      }
      if (diffInHours < 24) {
        return `${diffInHours}h ago`;
      }
      const diffInDays = Math.floor(diffInHours / 24);
      return `${diffInDays}d ago`;
    };

    const getPriorityIcon = (priority) => {
      switch (priority) {
        case "urgent":
          return <AlertTriangle className="w-4 h-4 text-red-500" />;
        case "high":
          return <AlertTriangle className="w-4 h-4 text-amber-500" />;
        default:
          return <Clock className="w-4 h-4 text-blue-500" />;
      }
    };

    const getPriorityBorder = (priority, isRead) => {
      if (isRead) return "border-l-4 border-gray-300";

      switch (priority) {
        case "urgent":
          return "border-l-4 border-red-500";
        case "high":
          return "border-l-4 border-amber-500";
        default:
          return "border-l-4 border-blue-500";
      }
    };

    const getNotificationActionType = (notification) =>
      String(notification?.action?.type || "").trim().toLowerCase();

    const isNotificationActionable = (notification) => {
      const actionType = getNotificationActionType(notification);
      if (actionType === "view_interview_calendar") return true;
      if (actionType !== "schedule_interview") return false;
      return Boolean(
        notification?.action?.candidate_id ||
          notification?.candidate?.id ||
          notification?.reference_id,
      );
    };

    const getNotificationActionLabel = (notification) => {
      const actionType = getNotificationActionType(notification);
      if (actionType === "view_interview_calendar") return "Open calendar";
      if (actionType === "schedule_interview") return "Open scheduling";
      return "";
    };

    const getNotificationTypeIcon = (notification) => {
      if (isNotificationActionable(notification)) {
        return <Calendar className="w-5 h-5 text-violet-600" />;
      }
      if (notification?.type === "passive_requirement") {
        return <AlertTriangle className="w-5 h-5 text-amber-600" />;
      }
      return <Clock className="w-5 h-5 text-blue-600" />;
    };

    if (loading) {
      return (
        <div
          ref={ref}
          className="absolute right-0 top-12 w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50"
        >
          <div className="p-4">
            <div className="flex items-center justify-center h-20">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div
        ref={ref}
        className="absolute right-0 top-12 w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-96 flex flex-col"
      >
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-gray-50 rounded-t-lg">
          <div className="flex items-center space-x-2">
            <h3 className="text-sm font-medium text-gray-900">Notifications</h3>
            {unreadCount > 0 && (
              <span className="bg-red-100 text-red-800 text-xs px-2 py-0.5 rounded-full">
                {unreadCount} unread
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {unreadCount > 0 && (
              <button
                onClick={onMarkAllAsRead}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                Mark all read
              </button>
            )}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto max-h-80">
          {notifications.length === 0 ? (
            <div className="p-6 text-center">
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <p className="text-sm text-gray-500">All caught up!</p>
              <p className="text-xs text-gray-400 mt-1">
                No notifications to show
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {notifications.map((notification) => {
                const actionable = isNotificationActionable(notification);
                const actionLabel = getNotificationActionLabel(notification);
                return (
                  <div
                    key={notification.id}
                    onClick={() => {
                      if (actionable && onNotificationClick) {
                        onNotificationClick(notification);
                      }
                    }}
                    className={`p-3 hover:bg-gray-50 transition-colors ${getPriorityBorder(
                      notification.priority,
                      notification.is_read,
                    )} ${notification.is_read ? "bg-white" : "bg-blue-50"} ${
                      actionable ? "cursor-pointer" : ""
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 mt-0.5">
                        {getNotificationTypeIcon(notification)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900 mb-1">
                              {notification.title}
                            </p>
                            <p className="text-xs text-gray-600 leading-relaxed">
                              {notification.message}
                            </p>

                            {notification.candidate && (
                              <div className="mt-2 text-xs text-gray-600">
                                Candidate:{" "}
                                <span className="font-medium text-gray-800">
                                  {notification.candidate.full_name ||
                                    notification.candidate.public_id ||
                                    notification.candidate.id}
                                </span>
                              </div>
                            )}

                            {notification.requirement && (
                              <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                                <p className="font-medium text-gray-700">
                                  Req: {notification.requirement.code || "N/A"}
                                </p>
                                <p className="text-gray-600 truncate">
                                  {notification.requirement.title}
                                </p>
                                {notification.requirement.last_activity_at && (
                                  <p className="text-gray-500 mt-1">
                                    Last activity:{" "}
                                    {formatTimeAgo(
                                      notification.requirement.last_activity_at,
                                    )}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center space-x-1 ml-2">
                            {getPriorityIcon(notification.priority)}
                            {!notification.is_read && (
                              <button
                                onClick={(event) => {
                                  event.stopPropagation();
                                  onMarkAsRead(notification.id);
                                }}
                                className="p-1 hover:bg-blue-100 rounded"
                                title="Mark as read"
                              >
                                <Eye className="w-3 h-3 text-blue-600" />
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs text-gray-400">
                            {formatTimeAgo(notification.created_at)}
                          </span>

                          {notification.is_read && notification.read_at && (
                            <span className="text-xs text-green-600 flex items-center">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Read
                            </span>
                          )}
                          {actionable && actionLabel && (
                            <span className="text-xs text-violet-600 font-medium">
                              {actionLabel}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {notifications.length > 0 && (
          <div className="px-4 py-2 border-t border-gray-200 bg-gray-50 rounded-b-lg">
            <p className="text-xs text-center text-gray-500">
              Showing {notifications.length} recent notifications
            </p>
          </div>
        )}
      </div>
    );
  },
);

NotificationPanel.displayName = "NotificationPanel";

export default NotificationPanel;
