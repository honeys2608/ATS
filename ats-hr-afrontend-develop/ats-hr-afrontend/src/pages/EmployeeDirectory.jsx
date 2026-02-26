// src/pages/EmployeeDirectory.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import employeeService from "../services/employeeService";

export default function EmployeeDirectory() {
  const navigate = useNavigate();

  const [employees, setEmployees] = useState([]);
  const [filtered, setFiltered] = useState([]);

  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    loadEmployees();
  }, []);

  const normalize = (res) => {
    if (!res) return [];
    if (Array.isArray(res)) return res;
    // typical shapes: { items: [...] }, { data: [...] }, { employees: [...] }
    return res.items || res.data || res.employees || [];
  };

  const loadEmployees = async () => {
    setLoading(true);
    try {
      // prefer dedicated directory endpoint if implemented
      const fn = typeof employeeService.directory === "function" ? employeeService.directory : employeeService.list;
      const data = await fn();
      const list = normalize(data);
      setEmployees(list);
      setFiltered(list);
    } catch (err) {
      console.error("Directory load error:", err);
      setEmployees([]);
      setFiltered([]);
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------
  // APPLY FILTERS + SEARCH
  // -------------------------------
  useEffect(() => {
    let results = [...employees];

    if (search.trim()) {
      results = results.filter((emp) =>
        `${emp.full_name || ""} ${emp.email || ""} ${emp.employee_code || ""}`
          .toLowerCase()
          .includes(search.toLowerCase())
      );
    }

    if (departmentFilter) {
      results = results.filter((emp) => emp.department === departmentFilter);
    }

    if (statusFilter) {
      results = results.filter((emp) => emp.status === statusFilter);
    }

    setFiltered(results);
  }, [search, departmentFilter, statusFilter, employees]);

  const getStatusColor = (status) =>
    ({
      active: "bg-green-100 text-green-800",
      onboarding: "bg-blue-100 text-blue-800",
      on_leave: "bg-yellow-100 text-yellow-800",
      notice_period: "bg-orange-100 text-orange-800",
      exited: "bg-gray-100 text-gray-800",
    }[status] || "bg-gray-100 text-gray-800");

  const departments = [...new Set(employees.map((e) => e.department).filter(Boolean))];
  const statuses = [...new Set(employees.map((e) => e.status).filter(Boolean))];

  // -------------------------------
  // EXPORT CSV
  // -------------------------------
  const toCsv = (rows) => {
    const headers = [
      "Employee ID",
      "Full Name",
      "Employee Code",
      "Email",
      "Phone",
      "Designation",
      "Department",
      "Status",
      "Join Date",
    ];
    const lines = [headers.join(",")];

    for (const r of rows) {
      const cols = [
        r.id ?? "",
        `"${(r.full_name || "").replace(/"/g, '""')}"`,
        r.employee_code ?? "",
        r.email ?? "",
        r.phone ?? "",
        `"${(r.designation || "").replace(/"/g, '""')}"`,
        `"${(r.department || "").replace(/"/g, '""')}"`,
        r.status ?? "",
        r.join_date ? new Date(r.join_date).toISOString().split("T")[0] : "",
      ];
      lines.push(cols.join(","));
    }
    return lines.join("\n");
  };

  const exportCsv = async ({ all = false } = {}) => {
    setExporting(true);
    try {
      let rows = all ? employees : filtered;
      // if backend supports CSV export endpoint you could call it here instead
      const csv = toCsv(rows);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = all ? `employees_all_${new Date().toISOString().slice(0,10)}.csv` : `employees_filtered_${new Date().toISOString().slice(0,10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export error:", err);
      alert("Failed to export CSV");
    } finally {
      setExporting(false);
    }
  };

  if (loading) return <div className="p-8">Loading directory...</div>;

  return (
    <div className="max-w-7xl">
      <h1 className="text-3xl font-bold text-gray-800 mb-1">Employee Directory</h1>
      <p className="text-gray-600 mb-6">Browse and search all employees in the organization.</p>

      {/* FILTERS BAR */}
      <div className="bg-white p-6 rounded-lg border border-gray-200 mb-8 grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
        <input
          type="text"
          placeholder="Search by name, code or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-4 py-2 border rounded-lg col-span-1 md:col-span-2"
        />

        <select
          value={departmentFilter}
          onChange={(e) => setDepartmentFilter(e.target.value)}
          className="px-4 py-2 border rounded-lg"
        >
          <option value="">All Departments</option>
          {departments.map((dept) => (
            <option key={dept} value={dept}>
              {dept}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border rounded-lg"
        >
          <option value="">All Statuses</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <div className="flex gap-2 md:justify-end">
          <button
            className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
            onClick={() => {
              setSearch("");
              setDepartmentFilter("");
              setStatusFilter("");
            }}
          >
            Reset Filters
          </button>

          <div className="flex gap-2">
            <button
              className="px-4 py-2 bg-white border rounded-lg hover:bg-gray-50 text-sm"
              onClick={() => exportCsv({ all: false })}
              disabled={exporting || filtered.length === 0}
              title="Export filtered results"
            >
              {exporting ? "Exporting…" : `Export Filtered (${filtered.length})`}
            </button>

            <button
              className="px-4 py-2 bg-white border rounded-lg hover:bg-gray-50 text-sm"
              onClick={() => exportCsv({ all: true })}
              disabled={exporting || employees.length === 0}
              title="Export all employees"
            >
              {exporting ? "Exporting…" : `Export All (${employees.length})`}
            </button>
          </div>
        </div>
      </div>

      {/* EMPLOYEE GRID */}
      {filtered.length === 0 ? (
        <div className="text-center text-gray-500 mt-10">No employees found.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {filtered.map((emp) => (
            <div
              key={emp.id}
              className="bg-white p-6 rounded-lg shadow border border-gray-200 cursor-pointer hover:shadow-lg transition"
              onClick={() => navigate(`/employees/${emp.id}`)}
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center text-xl font-semibold text-gray-700">
                  {(emp.full_name || "U").charAt(0)}
                </div>
                <div>
                  <div className="text-lg font-semibold text-gray-800">{emp.full_name || "Unnamed"}</div>
                  <div className="text-sm text-gray-600">{emp.designation || "No designation"}</div>
                </div>
              </div>

              <p className="text-gray-500 text-sm mb-3">{emp.department || "No department"}</p>

              <div className="flex items-center justify-between">
                <span className={`inline-block px-3 py-1 text-xs rounded-full ${getStatusColor(emp.status)}`}>
                  {emp.status}
                </span>
                <div className="text-right text-xs text-gray-500">
                  <div>{emp.employee_code}</div>
                  <div>{emp.join_date ? new Date(emp.join_date).toLocaleDateString() : ""}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
