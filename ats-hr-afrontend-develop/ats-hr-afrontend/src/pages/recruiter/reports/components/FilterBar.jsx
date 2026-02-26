import React from "react";

export default function FilterBar() {
  return (
    <div className="flex flex-wrap gap-4 items-center bg-white p-4 rounded shadow mb-6">
      <select className="border rounded px-3 py-2 text-sm">
        <option>All Recruiters</option>
        <option>Recruiter 1</option>
        <option>Recruiter 2</option>
      </select>
      <input type="date" className="border rounded px-3 py-2 text-sm" />
      <span>-</span>
      <input type="date" className="border rounded px-3 py-2 text-sm" />
      <button className="ml-auto bg-blue-600 text-white px-4 py-2 rounded font-semibold hover:bg-blue-700 transition">
        Download Report
      </button>
    </div>
  );
}
