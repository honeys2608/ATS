import React, { useEffect, useRef } from "react";

export default function AutoResizeTextarea({
  value,
  onChange,
  onKeyDown,
  error,
  placeholder = "",
  maxHeight = 200,
  className = "",
}) {
  const ref = useRef(null);

  // Auto-resize on value change
  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = "auto";
      ref.current.style.height = ref.current.scrollHeight + "px";
    }
  }, [value]);

  // Initial resize on mount
  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = "auto";
      ref.current.style.height = ref.current.scrollHeight + "px";
    }
  }, []);

  const classes = `w-full resize-none overflow-hidden whitespace-pre-wrap break-words px-2 py-1 border rounded text-xs focus:outline-none focus:ring-2 transition-colors ${
    error
      ? "border-red-400 bg-red-50 focus:ring-red-300"
      : "border-gray-300 bg-white focus:ring-blue-300"
  } ${className}`;

  return (
    <div className="flex flex-col w-full">
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        rows={1}
        className={classes}
        style={{
          minHeight: "32px",
          maxHeight: `${maxHeight}px`,
          lineHeight: "1.4",
        }}
      />
      {error && <div className="text-xs text-red-500 mt-0.5 px-1">{error}</div>}
    </div>
  );
}
