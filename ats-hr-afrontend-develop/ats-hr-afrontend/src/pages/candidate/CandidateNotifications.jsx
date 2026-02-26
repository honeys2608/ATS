import React, { useEffect, useState } from "react";
import api from "../../api/axios";

export default function CandidateNotifications() {
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    api
      .get("/v1/candidate/me/notifications")
      .then((res) => setNotifications(res.data || []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading notifications...</div>;

  if (!notifications.length)
    return <div className="text-gray-500">No notifications yet</div>;

  return (
    <div className="bg-white rounded shadow divide-y">
      {notifications.map((n) => (
        <div key={n.id} className="p-4">
          <p className="font-medium">{n.title || "Notification"}</p>
          {n.message && <p className="text-sm text-gray-600">{n.message}</p>}
          <p className="text-xs text-gray-400 mt-1">
            {new Date(n.created_at).toLocaleString()}
          </p>
        </div>
      ))}
    </div>
  );
}
