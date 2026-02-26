// src/components/ui/index.jsx
import React from "react";

// Button
export function Button({ children, variant = "primary", className = "", ...props }) {
  const base = "px-4 py-2 rounded transition";
  const variants = {
    primary: "bg-blue-600 text-white hover:bg-blue-700",
    outline: "bg-white border text-gray-700 hover:bg-gray-50",
    ghost: "bg-transparent text-gray-700",
  };
  return (
    <button className={`${base} ${variants[variant] ?? variants.primary} ${className}`} {...props}>
      {children}
    </button>
  );
}

// Input
export function Input(props) {
  return (
    <input
      {...props}
      className={`border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 ${props.className ?? ""}`}
    />
  );
}

// Select
export function Select({ children, className = "", ...props }) {
  return (
    <select
      {...props}
      className={`border rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 ${className}`}
    >
      {children}
    </select>
  );
}

// Modal (simple)
export function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black opacity-40" onClick={onClose} />
      <div role="dialog" aria-modal="true" className="bg-white rounded shadow-lg z-10 max-w-lg w-full p-4">
        {title && <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="text-gray-500 hover:text-gray-700">✕</button>
        </div>}
        <div>{children}</div>
      </div>
    </div>
  );
}

export default {
  Button,
  Input,
  Select,
  Modal,
};
