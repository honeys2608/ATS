import React from "react";
import { getRoleLabel, renderTemplate, formatRelative } from "../../constants/activityTemplates";

const ROLE_COLOR = {
  admin: "bg-purple-100 text-purple-700",
  am: "bg-blue-100 text-blue-700",
  account_manager: "bg-blue-100 text-blue-700",
  recruiter: "bg-green-100 text-green-700",
  candidate: "bg-amber-100 text-amber-700",
  system: "bg-gray-100 text-gray-700",
};

export default function ActivityFeedItem({ item }) {
  const roleKey = String(item?.actor_role || "system").toLowerCase();
  const roleChip = ROLE_COLOR[roleKey] || ROLE_COLOR.system;
  const statusChange = item?.old_status || item?.new_status;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <div className="mb-1 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-900">{item?.actor_name || "System"}</span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${roleChip}`}>
            {getRoleLabel(item?.actor_role)}
          </span>
        </div>
        <span className="text-xs text-gray-500" title={item?.created_at || ""}>
          {formatRelative(item?.created_at)}
        </span>
      </div>

      <div className="text-sm text-gray-800">{renderTemplate(item || {})}</div>

      {statusChange ? (
        <div className="mt-2 text-xs text-gray-600">
          Status: {item?.old_status || "--"} {"->"} {item?.new_status || "--"}
        </div>
      ) : null}
    </div>
  );
}
