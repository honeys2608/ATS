// src/pages/Onboarding.jsx
import React, { useState, useEffect } from "react";
import employeeService from "../services/employeeService";
import onboardingService from "../services/onboardingService";

export default function Onboarding() {
  const [tasks, setTasks] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false); // for marking complete / start onboarding

  useEffect(() => {
    loadData();
  }, []);

  const normalizeList = (res) => {
    // Accept either array or { data: [...] } or { items: [...] }
    if (!res) return [];
    if (Array.isArray(res)) return res;
    if (res.data && Array.isArray(res.data)) return res.data;
    if (res.items && Array.isArray(res.items)) return res.items;
    if (res.employees && Array.isArray(res.employees)) return res.employees;
    return [];
  };

  const loadData = async () => {
    setLoading(true);
    try {
      // GET /v1/employees via service
      const empRes = await employeeService.list();
      const emps = normalizeList(empRes);
      setEmployees(emps);

      if (emps.length > 0) {
        const firstId = emps[0].id ?? emps[0]._id ?? emps[0].employee_id;
        setSelectedEmployee(firstId);
        await loadTasksForEmployee(firstId);
      } else {
        setTasks([]);
      }
    } catch (err) {
      console.error("Error loading data:", err);
      setEmployees([]);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  const loadTasksForEmployee = async (employeeId) => {
    if (!employeeId) {
      setTasks([]);
      return;
    }
    setLoading(true);
    try {
      // GET /v1/onboarding/{employee_id}
      const res = await onboardingService.getTasks(employeeId);
      const t = Array.isArray(res) ? res : res?.data ?? res?.tasks ?? [];
      setTasks(t);
    } catch (err) {
      console.error("Error loading tasks:", err);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  const handleEmployeeChange = async (employeeId) => {
    setSelectedEmployee(employeeId);
    await loadTasksForEmployee(employeeId);
  };

  const markComplete = async (taskId) => {
    if (!taskId) return;
    if (!selectedEmployee) return alert("Select an employee first.");
    setBusy(true);
    try {
      // PUT /v1/onboarding/{task_id}/complete
      await onboardingService.completeTask(taskId);
      await loadTasksForEmployee(selectedEmployee);
    } catch (err) {
      console.error("Error completing task:", err);
      alert("Failed to mark task complete.");
    } finally {
      setBusy(false);
    }
  };

  const startOnboardingForEmployee = async (employeeId) => {
    if (!employeeId) return;
    if (!window.confirm("Start onboarding for this employee?")) return;
    setBusy(true);
    try {
      // POST /v1/onboarding/{employee_id}/start
      await onboardingService.startOnboarding(employeeId);
      await loadTasksForEmployee(employeeId);
      alert("Onboarding started.");
    } catch (err) {
      console.error("Error starting onboarding:", err);
      alert("Failed to start onboarding.");
    } finally {
      setBusy(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      completed: "bg-green-100 text-green-800",
      in_progress: "bg-blue-100 text-blue-800",
      pending: "bg-yellow-100 text-yellow-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  const getStatusIcon = (status) => {
    if (status === "completed") {
      return (
        <svg
          className="w-5 h-5 text-green-600"
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
      );
    }
    if (status === "in_progress") {
      return (
        <svg
          className="w-5 h-5 text-blue-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3"
          />
        </svg>
      );
    }
    return (
      <svg
        className="w-5 h-5 text-yellow-600"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4m0 4h.01"
        />
      </svg>
    );
  };

  if (loading) return <div className="p-8">Loading onboarding data...</div>;

  const completedTasks = tasks.filter((t) => t.status === "completed").length;
  const totalTasks = tasks.length;
  const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  return (
    <div className="max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          Onboarding Management
        </h1>
        <p className="text-gray-600">
          Track and manage employee onboarding tasks
        </p>
      </div>

      {employees.length === 0 ? (
        <div className="bg-white rounded-lg p-12 border border-gray-200 text-center">
          <p className="text-gray-600 text-lg">No employees to onboard</p>
          <p className="text-gray-500 text-sm mt-2">
            Hire employees to start the onboarding process
          </p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-lg p-6 border border-gray-200 mb-6 flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Employee
              </label>
              <select
                value={selectedEmployee ?? ""}
                onChange={(e) => handleEmployeeChange(e.target.value)}
                className="w-full md:w-96 px-4 py-2 border border-gray-300 rounded-lg"
              >
                {employees.map((emp) => {
                  const id = emp.id ?? emp._id ?? emp.employee_id;
                  return (
                    <option key={id} value={id}>
                      {emp.employee_code ?? id} -{" "}
                      {emp.full_name ?? emp.designation ?? "No name"} (
                      {emp.status})
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="flex items-end gap-2">
              <button
                onClick={() => startOnboardingForEmployee(selectedEmployee)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60"
                disabled={busy}
              >
                Start Onboarding
              </button>
              <button
                onClick={() => loadTasksForEmployee(selectedEmployee)}
                className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
                disabled={busy}
              >
                Refresh
              </button>
            </div>
          </div>

          {totalTasks > 0 && (
            <div className="bg-white rounded-lg p-6 border border-gray-200 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Onboarding Progress</h3>
                <span className="text-sm text-gray-600">
                  {completedTasks} of {totalTasks} tasks completed
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-gradient-to-r from-blue-600 to-purple-600 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-sm text-gray-600 mt-2">
                {progress.toFixed(0)}% Complete
              </p>
            </div>
          )}

          <div className="bg-white rounded-lg border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold">Onboarding Tasks</h2>
            </div>

            {tasks.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-gray-600">
                  No onboarding tasks found for this employee
                </p>
                <p className="text-gray-500 text-sm mt-2">
                  Tasks will appear once onboarding is initiated
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {tasks.map((task) => (
                  <div
                    key={task.id ?? task._id}
                    className="p-6 hover:bg-gray-50 transition flex items-start justify-between"
                  >
                    <div className="flex items-start space-x-4 flex-1">
                      <div className="mt-1">{getStatusIcon(task.status)}</div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {task.title ?? task.name}
                        </h3>
                        {/* ================= DOCUMENTS FOR THIS TASK ================= */}
                        {task.documents && task.documents.length > 0 && (
                          <div className="mt-3 space-y-2">
                            <p className="text-sm font-medium text-gray-700">
                              Uploaded Documents:
                            </p>

                            {task.documents.map((doc) => (
                              <div
                                key={doc.id}
                                className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded"
                              >
                                <div className="text-sm text-gray-700">
                                  {doc.category} — {doc.filename}
                                </div>

                                <button
                                  className="text-blue-600 text-sm hover:underline"
                                  onClick={() =>
                                    window.open(
                                      `/v1/documents/${doc.id}/download`,
                                      "_blank"
                                    )
                                  }
                                >
                                  View
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        {/* ===== NO DOCUMENT UPLOADED STATE ===== */}
                        {(!task.documents || task.documents.length === 0) && (
                          <div className="mt-3 text-sm text-red-500 italic">
                            No document uploaded yet
                          </div>
                        )}

                        {task.description && (
                          <p className="text-gray-600 mt-1">
                            {task.description}
                          </p>
                        )}
                        <div className="flex items-center space-x-4 mt-3">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                              task.status
                            )}`}
                          >
                            {(task.status ?? "pending").replace("_", " ")}
                          </span>
                          {task.task_type && (
                            <span className="text-sm text-gray-500">
                              Type: {task.task_type}
                            </span>
                          )}
                          {task.due_date && (
                            <span className="text-sm text-gray-500">
                              Due:{" "}
                              {new Date(task.due_date).toLocaleDateString()}
                            </span>
                          )}
                          {task.completed_at && (
                            <span className="text-sm text-green-600">
                              ✓ Completed{" "}
                              {new Date(task.completed_at).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="ml-4">
                      {task.status !== "completed" ? (
                        <button
                          onClick={() => markComplete(task.id ?? task._id)}
                          className="ml-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                          disabled={busy}
                        >
                          {busy ? "..." : "Mark Complete"}
                        </button>
                      ) : (
                        <span className="text-green-600 font-semibold">
                          Completed
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
