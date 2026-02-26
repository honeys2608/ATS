import React, { useMemo } from "react";
import usePermissions from "../../hooks/usePermissions";

export default function CustomRoleHome() {
  const { role, permissions } = usePermissions();

  const permissionBadges = useMemo(() => {
    return Object.entries(permissions || {}).flatMap(([module, actions]) =>
      (Array.isArray(actions) ? actions : []).map(
        (action) => `${module}:${action}`,
      ),
    );
  }, [permissions]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-bold text-slate-900">Role Dashboard</h1>
        <p className="mt-2 text-slate-600">
          Logged in as:{" "}
          <span className="font-semibold text-slate-800">
            {String(role || "custom_role")}
          </span>
        </p>
      </div>

      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          Active Permissions
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {permissionBadges.length > 0 ? (
            permissionBadges.map((badge) => (
              <span
                key={badge}
                className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700"
              >
                {badge}
              </span>
            ))
          ) : (
            <span className="text-sm text-slate-500">
              No permissions assigned yet.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

