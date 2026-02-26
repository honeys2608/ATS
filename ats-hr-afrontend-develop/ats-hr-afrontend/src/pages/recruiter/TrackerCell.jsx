import React, { useEffect, useRef } from "react";
import AutoResizeTextarea from "./AutoResizeTextarea";

const MONTHS = [
  "",
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export default function TrackerCell({
  value,
  col,
  rowIdx,
  colIdx,
  onChange,
  error,
  onKeyDown,
  inputRef,
}) {
  const ref = useRef();

  useEffect(() => {
    if (inputRef) inputRef(ref.current);
  }, [inputRef]);

  let inputType = "text";
  if (col === "Date" || col === "Notice Period (LWD)") inputType = "date";
  if (
    col === "C.CTC" ||
    col === "E.CTC" ||
    col === "Exp in Field" ||
    col === "T.Exp" ||
    col === "R.Exp"
  )
    inputType = "number";
  if (col === "Email ID") inputType = "email";

  // Auto-growing textarea for text-heavy fields
  if (
    col === "Comment" ||
    col === "Skills" ||
    col === "Certifications" ||
    col === "Clients" ||
    col === "SPOC / HM" ||
    col === "Client TA / BU" ||
    col === "Candidate Name"
  ) {
    return (
      <AutoResizeTextarea
        value={value}
        onChange={(newValue) => onChange(rowIdx, col, newValue)}
        onKeyDown={onKeyDown}
        error={error?.[col] || error}
        placeholder={`Enter ${col.toLowerCase()}`}
        maxHeight={200}
      />
    );
  }

  if (col === "Month") {
    return (
      <div className="flex flex-col">
        <select
          ref={ref}
          className={`border rounded px-2 py-1 w-full text-xs focus:ring-2 focus:outline-none ${
            error ? "border-red-400 bg-red-50" : "border-gray-300"
          }`}
          value={value}
          onChange={(e) => onChange(rowIdx, col, e.target.value)}
          onKeyDown={onKeyDown}
        >
          {MONTHS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        {error && <div className="text-xs text-red-500 mt-0.5">{error}</div>}
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <input
        ref={ref}
        type={inputType}
        className={`border rounded px-2 py-1 w-full text-xs focus:ring-2 focus:outline-none ${
          error ? "border-red-400 bg-red-50" : "border-gray-300"
        }`}
        value={value}
        onChange={(e) => onChange(rowIdx, col, e.target.value)}
        onKeyDown={onKeyDown}
      />
      {error && <div className="text-xs text-red-500 mt-0.5">{error}</div>}
    </div>
  );
}
