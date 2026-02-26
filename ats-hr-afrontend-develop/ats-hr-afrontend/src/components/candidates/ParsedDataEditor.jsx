import React, { useEffect, useState } from "react";
import axios from "../../api/axios";

/**
 * Props:
 *  - parsed: initial parsed object (camelCase expected)
 *  - onSave(parsedData) // optional callback; if present, used instead of performing axios request
 *  - candidateId (optional) // used if onSave not provided to determine admin vs candidate endpoint
 *  - missingFields: array of strings (optional)
 *  - saving: boolean (optional) - external saving state
 */
export default function ParsedDataEditor({
  parsed = {},
  onSave,
  candidateId = "",
  missingFields = [],
  saving = false,
}) {
  // internal form state uses camelCase keys
  const [data, setData] = useState(parsed || {});
  const [localSaving, setLocalSaving] = useState(false);

  useEffect(() => {
    setData(parsed || {});
  }, [parsed]);

  // mapping of friendly labels and canonical keys we want to show/edit
  const fields = [
    { key: "fullName", label: "Full name", fallbackKey: "full_name" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Phone" },
    { key: "skills", label: "Skills" },
    {
      key: "experienceYears",
      label: "Experience (years)",
      fallbackKey: "experience_years",
    },
    { key: "education", label: "Education" },
    {
      key: "currentEmployer",
      label: "Current employer",
      fallbackKey: "current_employer",
    },
  ];

  async function handleSave() {
    setLocalSaving(true);
    try {
      if (onSave) {
        // user-provided save handler (preferred)
        await onSave(data);
        setLocalSaving(false);
        return;
      }

      // fallback: call API directly
      // choose endpoint for saving parsed data
      const endpoint = candidateId
        ? `/candidates/${candidateId}`
        : "/v1/candidate/me";
      // backend expects parsedResume key
      await axios.put(endpoint, { parsedResume: data });
      alert("Saved");
    } catch (err) {
      console.error("Save parsed failed:", err);
      alert(err?.response?.data?.message || "Save failed");
    } finally {
      setLocalSaving(false);
    }
  }

  return (
    <div>
      {missingFields?.length > 0 && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 mb-2">
          Missing fields: {missingFields.join(", ")}
        </div>
      )}

      <div className="space-y-2">
        {fields.map(({ key, label, fallbackKey }) => (
          <div key={key}>
            <label className="text-sm block mb-1">{label}</label>
            <input
              value={data[key] ?? data[fallbackKey] ?? ""}
              onChange={(e) =>
                setData((prev) => ({ ...prev, [key]: e.target.value }))
              }
              className="w-full p-2 border rounded"
            />
          </div>
        ))}

        {/* If there are additional parsed properties, show a quick JSON editor */}
        <div>
          <label className="text-sm block mb-1">
            Raw parsed JSON (advanced)
          </label>
          <textarea
            rows={6}
            value={JSON.stringify(data, null, 2)}
            onChange={(e) => {
              try {
                const parsedJson = JSON.parse(e.target.value);
                setData(parsedJson);
              } catch {
                // ignore JSON parse errors while typing
              }
            }}
            className="w-full p-2 border rounded font-mono text-sm"
          />
          <p className="text-xs text-gray-500 mt-1">
            Edit JSON directly if you need to change nested fields.
          </p>
        </div>
      </div>

      <div className="mt-3">
        <button
          onClick={handleSave}
          disabled={localSaving || saving}
          className="bg-indigo-600 text-white px-3 py-1 rounded"
        >
          {localSaving || saving ? "Saving..." : "Save parsed"}
        </button>
      </div>
    </div>
  );
}
