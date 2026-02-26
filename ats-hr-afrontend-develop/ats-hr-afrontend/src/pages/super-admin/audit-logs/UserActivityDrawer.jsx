import React from "react";
import { X } from "lucide-react";
import { chipClass, label, rel } from "./utils";

export default function UserActivityDrawer({ user, logs, onClose, onViewFull }) {
  if (!user) return null;
  const scoped = logs.filter((r) =>
    `${r.actor_id} ${r.actor_name} ${r.actor_email}`
      .toLowerCase()
      .includes((user.actor_id || user.actor_name || user.actor_email || "").toLowerCase()),
  );

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/30">
      <div className="h-full w-full max-w-md overflow-y-auto bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">User Activity</h3>
          <button onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="rounded border p-3">
          <p className="font-semibold">{user.actor_name}</p>
          <p className="text-xs text-slate-600">{user.actor_email || "--"}</p>
          <p
            className={`mt-1 inline-flex rounded px-2 py-0.5 text-xs ${chipClass.role(
              (user.actor_role || "").toLowerCase(),
            )}`}
          >
            {label(user.actor_role)}
          </p>
        </div>
        <div className="mt-4 space-y-2">
          {scoped.slice(0, 12).map((r) => (
            <div key={r.id} className="rounded border p-2">
              <p className="text-sm font-semibold">{r.action_label}</p>
              <p className="text-xs text-slate-600">
                {rel(r.timestamp)} - {label(r.module)}
              </p>
            </div>
          ))}
        </div>
        <button
          onClick={() => onViewFull(user)}
          className="mt-4 w-full rounded bg-indigo-600 px-3 py-2 text-sm font-semibold text-white"
        >
          View Full Logs
        </button>
      </div>
    </div>
  );
}
