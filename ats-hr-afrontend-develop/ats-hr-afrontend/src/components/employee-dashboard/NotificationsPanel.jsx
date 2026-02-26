export default function NotificationsPanel({ notifications = [] }) {
  return (
    <div className="bg-white rounded-xl p-4 border shadow-sm">
      <h3 className="font-semibold mb-3">Notifications</h3>

      {notifications.length === 0 ? (
        <p className="text-sm text-gray-400">No notifications</p>
      ) : (
        <ul className="space-y-2">
          {notifications.map((n, i) => (
            <li key={i} className="text-sm border-b pb-2">
              {n.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
