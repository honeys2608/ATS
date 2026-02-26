import React, { useEffect, useMemo, useState } from "react";
import api from "../../api/axios";
import {
  normalizeText,
  validateDescription,
  validateFeatureName,
} from "../../utils/recruiterValidations";

export default function SystemSettings() {
  const [flags, setFlags] = useState([]);
  const [busyKey, setBusyKey] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    api
      .get("/v1/super-admin/feature-flags")
      .then((res) => {
        const rows = Array.isArray(res.data) ? res.data : [];
        setFlags(
          rows.map((row) => ({
            key: normalizeText(row.key),
            enabled: Boolean(row.enabled),
            description: normalizeText(row.description || ""),
            isDirty: false,
          })),
        );
      })
      .catch(() => setFlags([]));
  }, []);

  const dirtyCount = useMemo(() => flags.filter((f) => f.isDirty).length, [flags]);

  const onToggleFlag = (flagKey) => {
    setMessage("");
    setFlags((prev) =>
      prev.map((flag) =>
        flag.key === flagKey
          ? { ...flag, enabled: !flag.enabled, isDirty: true }
          : flag,
      ),
    );
  };

  const onSaveFlag = async (flag) => {
    const trimmedKey = normalizeText(flag.key);
    const trimmedDescription = normalizeText(flag.description);
    const featureError = validateFeatureName(trimmedKey, "Feature name", {
      pattern: /^[A-Za-z0-9_. -]+$/,
      patternMessage:
        "Feature name can only contain letters, numbers, spaces, underscores, hyphens, and dots.",
    });
    if (featureError) {
      setMessage(featureError);
      return;
    }
    const descriptionError = validateDescription(trimmedDescription, {
      minLength: 20,
      required: true,
    });
    if (descriptionError) {
      setMessage(descriptionError);
      return;
    }
    const duplicateFeatureName = flags.some(
      (item) =>
        item.key !== flag.key &&
        normalizeText(item.key).toLowerCase() === trimmedKey.toLowerCase(),
    );
    if (duplicateFeatureName) {
      setMessage("Duplicate Feature name under the same Sub-Category is not allowed.");
      return;
    }

    setBusyKey(flag.key);
    setMessage("");
    try {
      await api.put("/v1/super-admin/feature-flags", {
        key: trimmedKey,
        enabled: Boolean(flag.enabled),
        description: trimmedDescription || null,
      });
      setFlags((prev) =>
        prev.map((row) =>
          row.key === flag.key
            ? { ...row, key: trimmedKey, description: trimmedDescription, isDirty: false }
            : row,
        ),
      );
      setMessage(`Saved ${flag.key}`);
    } catch (_error) {
      setMessage(`Failed to save ${flag.key}`);
    } finally {
      setBusyKey("");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-500">Control feature flags and platform configuration.</div>
        <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
          Dirty Flags: {dirtyCount}
        </div>
      </div>

      {message && (
        <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3">
        {flags.map((flag) => {
          const isBusy = busyKey === flag.key;
          return (
            <div
              key={flag.key}
              className="flex items-center justify-between rounded-lg border border-slate-200 p-4"
            >
              <div>
                <div className="font-medium text-slate-900">{flag.key}</div>
                <input
                  value={flag.description}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setFlags((prev) =>
                      prev.map((item) =>
                        item.key === flag.key
                          ? { ...item, description: nextValue, isDirty: true }
                          : item,
                      ),
                    );
                    setMessage("");
                  }}
                  onBlur={(event) => {
                    const nextValue = normalizeText(event.target.value);
                    setFlags((prev) =>
                      prev.map((item) =>
                        item.key === flag.key
                          ? { ...item, description: nextValue, isDirty: true }
                          : item,
                      ),
                    );
                  }}
                  placeholder="Feature description (min 20 chars)"
                  className="mt-1 w-80 max-w-full rounded border border-slate-300 px-2 py-1 text-xs text-slate-700"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onToggleFlag(flag.key)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                    flag.enabled
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {flag.enabled ? "Enabled" : "Disabled"}
                </button>
                <button
                  disabled={isBusy || !flag.isDirty}
                  onClick={() => onSaveFlag(flag)}
                  className="rounded-md bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {isBusy ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          );
        })}
        {flags.length === 0 && (
          <div className="text-sm text-slate-500">No feature flags configured.</div>
        )}
      </div>
    </div>
  );
}
