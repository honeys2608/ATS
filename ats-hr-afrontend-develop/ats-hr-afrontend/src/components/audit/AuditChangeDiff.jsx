import React from "react";

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function toDisplay(value) {
  if (value === null || value === undefined || value === "") return "--";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function hasMeaningfulValue(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim() !== "";
  if (Array.isArray(value)) return value.length > 0;
  if (isPlainObject(value)) return Object.keys(value).length > 0;
  return true;
}

function shallowDiff(oldValue, newValue) {
  if (!isPlainObject(oldValue) || !isPlainObject(newValue)) return null;

  const keys = new Set([...Object.keys(oldValue), ...Object.keys(newValue)]);
  const changes = [];

  keys.forEach((key) => {
    const oldEntry = oldValue[key];
    const newEntry = newValue[key];
    const oldStr = JSON.stringify(oldEntry);
    const newStr = JSON.stringify(newEntry);
    if (oldStr !== newStr) {
      changes.push({
        key,
        oldValue: oldEntry,
        newValue: newEntry,
      });
    }
  });

  return changes;
}

export default function AuditChangeDiff({ oldValue, newValue, actionType, moduleName, endpoint, entityType }) {
  const action = String(actionType || "").toLowerCase();
  const moduleLower = String(moduleName || "").toLowerCase();
  const endpointLower = String(endpoint || "").toLowerCase();
  const entityTypeLower = String(entityType || "").toLowerCase();
  const isLoginEvent =
    action.includes("login") ||
    moduleLower.includes("auth") ||
    endpointLower.includes("/auth/login") ||
    entityTypeLower === "login";
  if (isLoginEvent) return null;

  const hasAny = hasMeaningfulValue(oldValue) || hasMeaningfulValue(newValue);
  if (!hasAny) return null;

  const changes = shallowDiff(oldValue, newValue);

  if (changes && changes.length > 0) {
    return (
      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-900">Changes</h4>
          <span className="text-xs text-slate-500">
            {changes.length} field{changes.length > 1 ? "s" : ""} changed
          </span>
        </div>

        <div className="overflow-hidden rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-4 py-3">Field</th>
                <th className="px-4 py-3">Old</th>
                <th className="px-4 py-3">New</th>
              </tr>
            </thead>
            <tbody>
              {changes.map((change) => (
                <tr key={change.key} className="border-t">
                  <td className="px-4 py-3 align-top font-medium text-slate-900">{change.key}</td>
                  <td className="px-4 py-3 align-top">
                    <div className="whitespace-pre-wrap rounded-md bg-red-50 px-3 py-2 text-red-700">
                      {toDisplay(change.oldValue)}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="whitespace-pre-wrap rounded-md bg-emerald-50 px-3 py-2 text-emerald-700">
                      {toDisplay(change.newValue)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <h4 className="text-sm font-semibold text-slate-900">Changes</h4>
      <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-lg border bg-white p-3">
          <div className="text-xs font-semibold text-slate-500">Old Value</div>
          <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-slate-50 p-3 text-xs text-slate-800">
            {toDisplay(oldValue)}
          </pre>
        </div>
        <div className="rounded-lg border bg-white p-3">
          <div className="text-xs font-semibold text-slate-500">New Value</div>
          <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-slate-50 p-3 text-xs text-slate-800">
            {toDisplay(newValue)}
          </pre>
        </div>
      </div>
    </div>
  );
}
