// src/components/employees/EmployeeSearch.jsx
import React, { useEffect, useState } from "react";
import employeeService from "../../services/employeeService";

export default function EmployeeSearch({ onSelect }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async (query = "") => {
    setLoading(true);
    try {
      const data = await employeeService.list();
      const list = Array.isArray(data) ? data : data?.items ?? data?.employees ?? [];
      const filtered = list.filter((e) =>
        (e.full_name || "").toLowerCase().includes(query.toLowerCase()) ||
        (e.employee_code || "").toLowerCase().includes(query.toLowerCase()) ||
        (e.designation || "").toLowerCase().includes(query.toLowerCase())
      );
      setResults(filtered);
    } catch (err) {
      console.error(err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div>
      <div className="flex gap-2">
        <input
          className="border p-2 rounded flex-1"
          placeholder="Search by name, code or designation"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button className="bg-blue-600 text-white px-3 rounded" onClick={() => load(q)}>
          Search
        </button>
      </div>

      <div className="mt-3 max-h-48 overflow-auto">
        {loading ? <div className="p-2">Loading...</div> :
          results.map((r) => (
            <div
              key={r.id}
              onClick={() => onSelect?.(r)}
              className="p-2 hover:bg-gray-50 cursor-pointer border-b"
            >
              <div className="font-medium">{r.full_name}</div>
              <div className="text-xs text-gray-500">{r.designation} • {r.department}</div>
            </div>
          ))
        }
      </div>
    </div>
  );
}
