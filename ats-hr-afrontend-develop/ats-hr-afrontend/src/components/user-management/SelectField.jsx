import React from "react";

export default function SelectField({
  label,
  value,
  onChange,
  options = [],
  error,
  required = false,
  disabled = false,
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">
        {label} {required ? <span className="text-red-600">*</span> : null}
      </span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`w-full rounded-md border px-3 py-2 text-sm outline-none transition ${
          error ? "border-red-400 focus:ring-2 focus:ring-red-200" : "border-slate-300 focus:ring-2 focus:ring-indigo-200"
        } ${disabled ? "bg-slate-100 text-slate-500" : "bg-white"}`}
      >
        <option value="">Select</option>
        {options.map((item) => (
          <option key={String(item.value)} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </label>
  );
}
