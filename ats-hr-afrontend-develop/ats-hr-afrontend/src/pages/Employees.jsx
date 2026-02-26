// src/pages/Employees.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import employeeService from "../services/employeeService";
import onboardingService from "../services/onboardingService";
import PaginatedCardGrid from "../components/common/PaginatedCardGrid";
import usePersistedPagination from "../hooks/usePersistedPagination";

/**
 * Employees page
 * - uses APIs:
 *   GET    /v1/employees                 -> employeeService.list()
 *   POST   /v1/onboarding/{employee_id}/start -> onboardingService.startOnboarding()
 *   POST   /v1/employees/{employee_id}/exit  -> employeeService.exit()
 *   POST   /v1/employees/from-candidate/{candidate_id} -> employeeService.convertFromCandidate()
 *
 * Extra features:
 * - Export CSV (filtered / all)
 * - Convert candidate -> employee (if employee.candidate_id exists)
 */

function Employees() {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showExitModal, setShowExitModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [submitting, setSubmitting] = useState(false); // blocks actions while API running
  const [exitData, setExitData] = useState({
    exit_reason: "",
    feedback: "",
    would_rehire: true,
    would_recommend: true,
  });
  const [errorMsg, setErrorMsg] = useState(null);
  const [query, setQuery] = useState(""); // quick client-side search
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalRecords: 0,
  });
  const {
    page,
    setPage,
    limit,
    setLimit,
    pageSizeOptions,
  } = usePersistedPagination("employees:listing");

  useEffect(() => {
    loadEmployees();
  }, [page, limit, query]);

  const loadEmployees = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await employeeService.list({
        page,
        limit,
        search: query || undefined,
      });
      const payload = Array.isArray(data) ? { data } : (data ?? {});
      const list = Array.isArray(payload.data)
        ? payload.data
        : (payload.items ?? payload.employees ?? []);
      const totalRecords =
        payload.totalRecords ?? payload.total ?? (Array.isArray(list) ? list.length : 0);
      const totalPages =
        payload.totalPages ??
        Math.max(1, Math.ceil((totalRecords || 0) / Math.max(1, limit)));
      const currentPage = payload.currentPage ?? page;

      setEmployees(list);
      setPagination({
        currentPage,
        totalPages,
        totalRecords,
      });
    } catch (error) {
      console.error("Error loading employees:", error);
      setErrorMsg("Failed to load employees");
      setEmployees([]);
      setPagination({
        currentPage: 1,
        totalPages: 1,
        totalRecords: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExitClick = (employee, e) => {
    e.stopPropagation();
    setSelectedEmployee(employee);
    setExitData({
      exit_reason: "",
      feedback: "",
      would_rehire: true,
      would_recommend: true,
    });
    setShowExitModal(true);
  };

  const submitExit = async () => {
    if (!selectedEmployee) return;

    // Input validation
    if (!exitData.exit_reason) {
      alert("Please select an exit reason");
      return;
    }

    if (!exitData.feedback || exitData.feedback.trim().length < 10) {
      alert("Please provide detailed feedback (at least 10 characters)");
      return;
    }

    setSubmitting(true);
    try {
      // POST /v1/employees/{employee_id}/exit
      await employeeService.exit(selectedEmployee.id, exitData);
      setShowExitModal(false);
      alert(`${selectedEmployee.full_name || "Employee"} has been exited.`);
      setSelectedEmployee(null);
      await loadEmployees();
    } catch (error) {
      console.error("Error processing exit:", error);
      alert("Error processing employee exit");
    } finally {
      setSubmitting(false);
    }
  };

  const startOnboarding = async (employee) => {
    if (!employee || !employee.id) return;
    if (
      !confirm(
        `Start onboarding for ${
          employee.full_name || employee.employee_code || "this employee"
        }?`,
      )
    )
      return;
    setSubmitting(true);
    try {
      // POST /v1/onboarding/{employee_id}/start
      await onboardingService.startOnboarding(employee.id);
      alert(
        `Onboarding started for ${
          employee.full_name || employee.employee_code || "employee"
        }.`,
      );
      await loadEmployees();
      // optionally navigate to onboarding page:
      // navigate(`/onboarding/${employee.id}`)
    } catch (err) {
      console.error("Error starting onboarding:", err);
      alert("Failed to start onboarding");
    } finally {
      setSubmitting(false);
    }
  };

  const convertFromCandidate = async (candidateId) => {
    if (!candidateId) return;
    if (!confirm("Convert candidate to employee?")) return;
    setSubmitting(true);
    try {
      // POST /v1/employees/from-candidate/{candidate_id}
      await employeeService.convertFromCandidate(candidateId);
      alert("Candidate converted to employee successfully.");
      await loadEmployees();
    } catch (err) {
      console.error("Conversion error:", err);
      alert("Failed to convert candidate");
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      active: "bg-emerald-100 text-emerald-800 border-emerald-200",
      onboarding: "bg-blue-100 text-blue-800 border-blue-200",
      pending_documents: "bg-amber-100 text-amber-800 border-amber-200",
      on_leave: "bg-yellow-100 text-yellow-800 border-yellow-200",
      notice_period: "bg-orange-100 text-orange-800 border-orange-200",
      exited: "bg-gray-100 text-gray-800 border-gray-200",
    };
    return colors[status] || "bg-slate-100 text-slate-800 border-slate-200";
  };

  const formatStatus = (status) => {
    const statusMap = {
      active: "Active",
      onboarding: "Onboarding",
      pending_documents: "Pending Documents",
      on_leave: "On Leave",
      notice_period: "Notice Period",
      exited: "Exited",
    };
    return (
      statusMap[status] ||
      status
        ?.split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ") ||
      "Unknown"
    );
  };

  const filtered = employees;

  // ---------- CSV Export helpers ----------
  const toCSV = (rows) => {
    if (!rows || rows.length === 0) return "";
    const columns = [
      "id",
      "employee_code",
      "full_name",
      "email",
      "designation",
      "department",
      "status",
      "join_date",
      "ctc",
      "location",
    ];
    const header = columns.join(",") + "\n";
    const lines = rows.map((r) =>
      columns
        .map((c) => {
          let val = r[c];
          if (val === null || val === undefined) return "";
          if (typeof val === "string") {
            // escape quotes and wrap
            const escaped = val.replace(/"/g, '""');
            return `"${escaped}"`;
          }
          return `${val}`;
        })
        .join(","),
    );
    return header + lines.join("\n");
  };

  const downloadCSV = (filename, data) => {
    const blob = new Blob([data], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleExportFiltered = () => {
    const csv = toCSV(filtered);
    if (!csv) {
      alert("No data to export");
      return;
    }
    downloadCSV(
      `employees_filtered_${new Date().toISOString().slice(0, 10)}.csv`,
      csv,
    );
  };

  const handleExportAll = () => {
    const csv = toCSV(employees);
    if (!csv) {
      alert("No data to export");
      return;
    }
    downloadCSV(
      `employees_all_${new Date().toISOString().slice(0, 10)}.csv`,
      csv,
    );
  };

  return (
    <div className="max-w-7xl">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">
            Employee Management
          </h1>
          <p className="text-gray-600">
            Manage your organization's employees and their lifecycle
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search by name, code, email or designation"
            className="px-3 py-2 border rounded text-sm"
          />
          <button
            onClick={loadEmployees}
            disabled={loading}
            className="px-3 py-2 bg-gray-100 rounded hover:bg-gray-200 text-sm"
          >
            Refresh
          </button>

          <div className="relative inline-block">
            <button
              onClick={handleExportFiltered}
              className="px-3 py-2 bg-white border rounded text-sm hover:bg-gray-50"
              title="Export filtered list as CSV"
            >
              Export (filtered)
            </button>
            <button
              onClick={handleExportAll}
              className="ml-2 px-3 py-2 bg-white border rounded text-sm hover:bg-gray-50"
              title="Export all employees as CSV"
            >
              Export (all)
            </button>
          </div>

          <button
            onClick={() => navigate("/employees/directory")}
            className="ml-2 px-3 py-2 bg-blue-50 text-blue-700 border rounded text-sm hover:bg-blue-100"
          >
            Directory
          </button>
        </div>
      </div>

      {errorMsg && <div className="mb-4 text-sm text-red-600">{errorMsg}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Employees</p>
              <p className="text-3xl font-bold text-gray-800 mt-1">
                {pagination.totalRecords || employees.length}
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg
                className="w-6 h-6 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1z"
                />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active</p>
              <p className="text-3xl font-bold text-green-600 mt-1">
                {employees.filter((e) => e.status === "active").length}
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <svg
                className="w-6 h-6 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4"
                />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Onboarding</p>
              <p className="text-3xl font-bold text-blue-600 mt-1">
                {employees.filter((e) => e.status === "onboarding").length}
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg
                className="w-6 h-6 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <PaginatedCardGrid
        items={filtered}
        totalPages={pagination.totalPages}
        currentPage={pagination.currentPage}
        onPageChange={setPage}
        totalRecords={pagination.totalRecords}
        pageSize={limit}
        onPageSizeChange={(nextLimit) => {
          setLimit(nextLimit);
          setPage(1);
        }}
        pageSizeOptions={pageSizeOptions}
        loading={loading}
        error={errorMsg}
        onRetry={loadEmployees}
        emptyMessage="No employees match your search"
        renderCard={(employee) => (
          <article
            className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm hover:shadow-md transition"
            onClick={() => navigate(`/employees/${employee.id}`)}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {employee.full_name || "N/A"}
                </h3>
                <p className="text-sm text-gray-600">
                  {employee.designation || "Designation not set"}
                </p>
              </div>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(
                  employee.status,
                )}`}
              >
                {formatStatus(employee.status)}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-gray-700">
              <div>
                <span className="text-gray-500">Code:</span>{" "}
                <span className="font-mono">{employee.employee_code || "N/A"}</span>
              </div>
              <div>
                <span className="text-gray-500">Department:</span>{" "}
                {employee.department || "N/A"}
              </div>
              <div>
                <span className="text-gray-500">Join Date:</span>{" "}
                {employee.join_date
                  ? new Date(employee.join_date).toLocaleDateString()
                  : "N/A"}
              </div>
              <div>
                <span className="text-gray-500">CTC:</span>{" "}
                {employee.ctc ? `$${Number(employee.ctc).toLocaleString()}` : "N/A"}
              </div>
              <div className="col-span-2 text-gray-600 truncate">
                {employee.email || employee.location || "N/A"}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {employee.status !== "onboarding" && employee.status !== "exited" ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    startOnboarding(employee);
                  }}
                  className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg text-white bg-green-500 hover:bg-green-600 shadow-sm transition-colors disabled:bg-gray-300 disabled:text-gray-500"
                  disabled={submitting}
                >
                  Start Onboarding
                </button>
              ) : null}

              {employee.status !== "exited" ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleExitClick(employee, e);
                  }}
                  className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg text-white bg-red-500 hover:bg-red-600 shadow-sm transition-colors disabled:bg-gray-300 disabled:text-gray-500"
                  disabled={submitting}
                >
                  Exit
                </button>
              ) : (
                <span className="inline-flex items-center px-2.5 py-1.5 text-xs font-medium text-gray-500 bg-gray-100 rounded-lg border">
                  Exited
                </span>
              )}
            </div>
          </article>
        )}
      />

      {showExitModal && selectedEmployee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-4 text-red-600">
              Exit Employee
            </h2>
            <p className="text-gray-600 mb-4">
              Processing exit for: <strong>{selectedEmployee.full_name}</strong>
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1 text-red-600">
                  Exit Reason *
                </label>
                <select
                  value={exitData.exit_reason}
                  onChange={(e) =>
                    setExitData({ ...exitData, exit_reason: e.target.value })
                  }
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  required
                >
                  <option value="">Select Reason</option>
                  <option value="resignation">Resignation</option>
                  <option value="termination">Termination</option>
                  <option value="retirement">Retirement</option>
                  <option value="contract_end">Contract End</option>
                  <option value="relocation">Relocation</option>
                  <option value="personal_reasons">Personal Reasons</option>
                  <option value="better_opportunity">Better Opportunity</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1 text-red-600">
                  Exit Interview Feedback *
                </label>
                <textarea
                  value={exitData.feedback}
                  onChange={(e) =>
                    setExitData({ ...exitData, feedback: e.target.value })
                  }
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  rows="4"
                  placeholder="Please provide detailed feedback (minimum 10 characters)"
                  required
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={exitData.would_rehire}
                  onChange={(e) =>
                    setExitData({ ...exitData, would_rehire: e.target.checked })
                  }
                  className="mr-2"
                />
                <label className="text-sm">
                  Would you rehire this employee?
                </label>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={exitData.would_recommend}
                  onChange={(e) =>
                    setExitData({
                      ...exitData,
                      would_recommend: e.target.checked,
                    })
                  }
                  className="mr-2"
                />
                <label className="text-sm">
                  Would employee recommend this company?
                </label>
              </div>

              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                <p className="text-yellow-800 text-sm">
                  ⚠️ This will mark the employee as exited and automatically add
                  them to the Alumni network.
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={submitExit}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                disabled={submitting}
              >
                {submitting ? "Processing..." : "Confirm Exit"}
              </button>
              <button
                onClick={() => setShowExitModal(false)}
                className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
                disabled={submitting}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Employees;
