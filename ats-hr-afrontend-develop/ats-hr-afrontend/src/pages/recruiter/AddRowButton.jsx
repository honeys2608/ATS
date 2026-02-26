import React from "react";
import { Plus } from "lucide-react";

export default function AddRowButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition text-sm font-semibold"
    >
      <Plus size={16} />
      Add Row
    </button>
  );
}
