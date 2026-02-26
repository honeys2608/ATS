import React from "react";

export default function ActivityFilters({
  value,
  onChange,
  showResourceFilter = true,
  showSearch = true,
}) {
  const update = (patch) => onChange?.({ ...(value || {}), ...patch });

  return (
    <div className="mb-4 grid grid-cols-1 gap-2 md:grid-cols-4">
      <select
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        value={value?.period || "month"}
        onChange={(e) => update({ period: e.target.value })}
      >
        <option value="today">Today</option>
        <option value="week">This Week</option>
        <option value="month">This Month</option>
      </select>

      <input
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        placeholder="Action (e.g., am.sent_to_client)"
        value={value?.action || ""}
        onChange={(e) => update({ action: e.target.value })}
      />

      {showResourceFilter ? (
        <input
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          placeholder="Resource type (candidate/job/submission)"
          value={value?.resource_type || ""}
          onChange={(e) => update({ resource_type: e.target.value })}
        />
      ) : (
        <div />
      )}

      {showSearch ? (
        <input
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          placeholder="Search by actor or candidate"
          value={value?.search || ""}
          onChange={(e) => update({ search: e.target.value })}
        />
      ) : (
        <div />
      )}
    </div>
  );
}
