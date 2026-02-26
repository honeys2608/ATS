// src/pages/EmployeeProfile.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import employeeService from "../services/employeeService";
import documentService from "../services/documentService";

function EmployeeProfile() {
  const navigate = useNavigate();

  const [employee, setEmployee] = useState(null);
  const [employeeId, setEmployeeId] = useState(null);

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("personal");

  // Onboarding state
  // const [onboardingTasks, setOnboardingTasks] = useState([]);
  // const [onboardingProgress, setOnboardingProgress] = useState(null);

  // Document management
  const [documents, setDocuments] = useState([]);
  const [documentChecklist, setDocumentChecklist] = useState(null);

  // UI state
  const [busy, setBusy] = useState(false); // for blocking actions while requests run
  const [uploading, setUploading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0); // force refreshes when needed
  // 🔐 Reset Password Modal State
  const [showResetModal, setShowResetModal] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    loadMyEmployee(); // 🔥 pehle apna employee record lao
  }, []);

  useEffect(() => {
    if (!employeeId) return;
    loadAll(); // 🔥 ab onboarding / docs load karo
  }, [employeeId, refreshKey]);

  const loadMyEmployee = async () => {
    setLoading(true); // ⭐ yahan ADD hua
    try {
      const res = await employeeService.getMyEmployee();
      const data = res?.data ?? res;

      setEmployee(data);
      setEmployeeId(data.id); // ✅ isse loadAll() chalega
    } catch (err) {
      console.error("My employee load error:", err);
      setEmployee(null);
    } finally {
      setLoading(false); // ⭐ yahi sabse important fix hai
    }
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadEmployee(),
        loadDocuments(),
        loadDocumentChecklist(),
      ]);
    } finally {
      setLoading(false);
    }
  };

  // -------------------------
  //  LOAD EMPLOYEE
  // -------------------------
  const loadEmployee = async () => {
    try {
      const res = await employeeService.get(employeeId);
      // GET /v1/employees/{id}
      // normalize many backend shapes
      const data = res?.data ?? res?.employee ?? res;
      setEmployee(data);
    } catch (err) {
      console.error("Employee load error:", err);
      setEmployee(null);
    }
  };

  // -------------------------
  //  LOAD DOCUMENTS
  // -------------------------
  const loadDocuments = async () => {
    try {
      const res = await documentService.listForEmployee(employeeId);
      // GET /v1/documents/employees/{employee_id}
      const list = Array.isArray(res)
        ? res
        : res?.data ?? res?.items ?? res?.documents ?? [];
      setDocuments(list);
    } catch (err) {
      console.error("Document load error:", err);
      setDocuments([]);
    }
  };

  // -------------------------
  //  LOAD DOCUMENT CHECKLIST
  // -------------------------
  const loadDocumentChecklist = async () => {
    try {
      // documentService.checklist(...) -> GET /v1/documents/employees/{employee_id}/checklist
      // Some services also expose checklistForEmployee alias — handle both
      const fn =
        documentService.checklist ?? documentService.checklistForEmployee;
      if (!fn) {
        setDocumentChecklist(null);
        return;
      }
      const res = await fn(employeeId);
      const checklist = res?.data ?? res ?? null;
      setDocumentChecklist(checklist);
    } catch (err) {
      console.error("Checklist error:", err);
      setDocumentChecklist(null);
    }
  };

  // -------------------------
  //  LOAD ONBOARDING TASKS + PROGRESS
  // -------------------------
  // const loadOnboarding = async () => {
  //   try {
  //     const tasksRes = await onboardingService.getTasks(employeeId);
  //     // GET /v1/onboarding/{employee_id}
  //     const progRes = await onboardingService.getProgress(employeeId);
  //     // GET /v1/onboarding/{employee_id}/progress

  //     const tasks = Array.isArray(tasksRes)
  //       ? tasksRes
  //       : tasksRes?.data ?? tasksRes?.items ?? tasksRes?.tasks ?? [];
  //     const progress = progRes?.data ?? progRes ?? null;

  //     setOnboardingTasks(tasks);
  //     setOnboardingProgress(progress);
  //   } catch (err) {
  //     console.error("Onboarding load error:", err);
  //     setOnboardingTasks([]);
  //     setOnboardingProgress(null);
  //   }
  // };

  // -------------------------
  // START ONBOARDING
  // // -------------------------
  // const startOnboarding = async () => {
  //   if (!employee?.id) return;
  //   if (
  //     !window.confirm(
  //       `Start onboarding for ${employee.full_name || employee.employee_code}?`
  //     )
  //   )
  //     return;
  //   setBusy(true);
  //   try {
  //     await onboardingService.startOnboarding(employee.id); // POST /v1/onboarding/{employee_id}/start
  //     alert("Onboarding started");
  //     await loadOnboarding();
  //     await loadEmployee(); // refresh status if backend updates it
  //     await loadDocumentChecklist();
  //     setActiveTab("onboarding");
  //   } catch (err) {
  //     console.error("Start onboarding error:", err);
  //     alert("Failed to start onboarding");
  //   } finally {
  //     setBusy(false);
  //   }
  // };

  // -------------------------
  // COMPLETE ONBOARDING TASK
  // -------------------------
  // const completeTask = async (taskId) => {
  //   if (!taskId) return;
  //   setBusy(true);
  //   try {
  //     await onboardingService.completeTask(taskId); // PUT /v1/onboarding/{task_id}/complete
  //     await loadOnboarding();
  //     // after completing tasks, refresh employee and checklist
  //     await loadEmployee();
  //     await loadDocumentChecklist();
  //     alert("Task completed");
  //   } catch (err) {
  //     console.error("Task completion error:", err);
  //     alert("Failed to complete task");
  //   } finally {
  //     setBusy(false);
  //   }
  // };

  // -------------------------
  // DOCUMENT ACTIONS
  // -------------------------
  const handleDownload = async (documentId) => {
    try {
      await documentService.download(documentId); // GET /v1/documents/{document_id}/download
    } catch (err) {
      console.error("Download error:", err);
      alert("Failed to download document");
    }
  };

  const handleDelete = async (documentId) => {
    if (!window.confirm("Delete this document?")) return;
    setBusy(true);
    try {
      await documentService.remove(documentId); // DELETE /v1/documents/{document_id}
      await loadDocuments();
      await loadDocumentChecklist(); // refresh checklist after deletion
    } catch (err) {
      console.error("Delete error:", err);
      alert("Failed to delete document");
    } finally {
      setBusy(false);
    }
  };
  // 🔐 RESET PASSWORD
  const handleResetPassword = async () => {
    if (!newPassword || !confirmPassword) {
      alert("Both password fields are required");
      return;
    }

    if (newPassword !== confirmPassword) {
      alert("Passwords do not match");
      return;
    }

    try {
      setResetting(true);

      await employeeService.resetPassword(employee.id, {
        password: newPassword,
        confirm_password: confirmPassword,
      });

      alert("Password reset successfully");
      setShowResetModal(false);
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      alert(
        err?.response?.data?.detail ||
          err?.response?.data?.message ||
          "Failed to reset password"
      );
    } finally {
      setResetting(false);
    }
  };

  // const handleUpload = async (file) => {
  //   if (!file) return;
  //   const maxBytes = 10 * 1024 * 1024;
  //   const allowed = [
  //     "application/pdf",
  //     "application/msword",
  //     "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  //     "image/jpeg",
  //     "image/png",
  //   ];
  //   if (file.size > maxBytes) {
  //     return alert("File too large. Max 10MB allowed.");
  //   }
  //   if (!allowed.includes(file.type)) {
  //     return alert(
  //       "File type not supported. Allowed: PDF, DOC, DOCX, JPG, PNG."
  //     );
  //   }

  //   setUploading(true);
  //   try {
  //     const form = new FormData();
  //     form.append("file", file);

  //     documentService
  //       .uploadForEmployee(employeeId, doc.category, form) // ✅ FIX
  //       .then(() => {
  //         loadDocuments();
  //         loadDocumentChecklist();
  //       })
  //       .catch(() => alert("Upload failed"));
  //   } finally {
  //     setUploading(false);
  //   }
  // };

  // -------------------------
  //  Checklist helpers
  // -------------------------

  // required items may be objects with code/name or strings
  // const allPresent = required.every((req) => {
  //   if (!req) return false;
  //   if (typeof req === "string") return uploadedSet.has(req.toLowerCase());
  //   const code = (req.code || req.id || req.name || "")
  //     .toString()
  //     .toLowerCase();
  //   if (code && uploadedSet.has(code)) return true;
  //   // sometimes uploaded contains filenames; try to match by name
  //   const name = (req.name || "").toString().toLowerCase();
  //   if (name && uploadedSet.has(name)) return true;
  //   return false;
  // });

  //   return allPresent;
  // }

  //   if (documentChecklist.complete !== undefined)
  //     return Boolean(documentChecklist.complete);

  //   return false;
  // };

  const isChecklistComplete = () => {
    if (!documentChecklist?.checklist) return false;

    return documentChecklist.checklist.every(
      (doc) => doc.status === "completed"
    );
  };

  // const canMarkActive = () => {
  //   // require onboarding progress to be complete (if onboarding exists)
  //   const onboardingOK =
  //     !onboardingProgress ||
  //     (onboardingProgress.total &&
  //       onboardingProgress.completed === onboardingProgress.total);
  //   const checklistOK = isChecklistComplete();
  //   // employee not already active/exited
  //   const statusOK =
  //     employee && employee.status !== "active" && employee.status !== "exited";
  //   return onboardingOK && checklistOK && statusOK;
  // };

  // -------------------------
  // MARK ACTIVE (enforce checklist + onboarding)
  // // -------------------------
  // const markActive = async () => {
  //   if (!employee?.id) return;
  //   // re-check to be safe
  //   await loadDocumentChecklist();
  //   await loadOnboarding();
  //   if (!canMarkActive()) {
  //     alert(
  //       "Cannot mark active: onboarding or required documents are incomplete."
  //     );
  //     return;
  //   }

  //   if (
  //     !window.confirm(
  //       "Mark employee as ACTIVE? This will change their status to 'active'."
  //     )
  //   )
  //     return;
  //   setBusy(true);
  //   try {
  //     // PUT /v1/employees/{id} with status active
  //     await employeeService.update(employee.id, { status: "active" });
  //     await loadEmployee();
  //     alert("Employee marked as active.");
  //   } catch (err) {
  //     console.error("Mark active error:", err);
  //     alert("Failed to update status");
  //   } finally {
  //     setBusy(false);
  //   }
  // };

  // -------------------------
  // RENDER
  // -------------------------
  if (loading) return <div className="p-8">Loading employee profile...</div>;

  if (!employee) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <p className="text-red-800">Employee not found</p>
          <button
            onClick={() => navigate("/employees")}
            className="mt-4 text-red-600 hover:text-red-700"
          >
            ← Back to Employees
          </button>
        </div>
      </div>
    );
  }

  // helper classes
  const getEmploymentTypeColor = (type) =>
    ({
      probation: "bg-yellow-100 text-yellow-800",
      permanent: "bg-green-100 text-green-800",
      contract: "bg-blue-100 text-blue-800",
      intern: "bg-purple-100 text-purple-800",
    }[type] || "bg-gray-100 text-gray-800");

  const getStatusColor = (status) =>
    ({
      active: "bg-green-100 text-green-800",
      onboarding: "bg-blue-100 text-blue-800",
      on_leave: "bg-yellow-100 text-yellow-800",
      notice_period: "bg-orange-100 text-orange-800",
      exited: "bg-gray-100 text-gray-800",
    }[status] || "bg-gray-100 text-gray-800");

  return (
    <div className="max-w-7xl">
      {/* Back */}
      <div className="mb-4">
        <button
          onClick={() => navigate("/employees")}
          className="text-blue-600 hover:text-blue-700 flex items-center"
        >
          ← Back to Employees
        </button>
      </div>

      {/* Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {employee.full_name || "—"}
            </h2>
            <p className="text-sm text-gray-600">
              {employee.designation || "—"}
            </p>

            <p className="text-xs text-gray-500 mt-1">
              {employee.employee_code || "—"}
            </p>
          </div>
          <button
            onClick={() => setShowResetModal(true)}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Reset Password
          </button>
        </div>
      </div>

      <div className="mb-4">
        <div className="flex space-x-2">
          {["personal", "employment", "team", "documents"].map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`px-4 py-2 rounded ${
                activeTab === t
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-700 border border-gray-200"
              }`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}

          {/* <button
            onClick={loadDocumentChecklist}
            disabled={busy}
            className="ml-2 px-3 py-1 text-sm border rounded bg-white hover:bg-gray-50"
          >
            Load Document Checklist
          </button> */}

          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            className="ml-2 px-3 py-1 text-sm border rounded bg-white hover:bg-gray-50"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* CONTENT */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        {activeTab === "personal" && (
          <div>
            <h3 className="text-lg font-semibold mb-3">Personal Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Email</p>
                <p className="text-gray-900">{employee.email || "N/A"}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Phone</p>
                <p className="text-gray-900">{employee.phone || "N/A"}</p>
              </div>

              <div>
                <p className="text-sm text-gray-500">Join Date</p>
                <p className="text-gray-900">
                  {employee.join_date
                    ? new Date(employee.join_date).toLocaleDateString()
                    : "N/A"}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Location</p>
                <p className="text-gray-900">{employee.location || "N/A"}</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === "employment" && (
          <div>
            <h3 className="text-lg font-semibold mb-3">Employment Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">CTC</p>
                <p className="text-gray-900">
                  $
                  {employee.ctc ? Number(employee.ctc).toLocaleString() : "N/A"}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Probation End</p>
                <p className="text-gray-900">
                  {employee.probation_end_date
                    ? new Date(employee.probation_end_date).toLocaleDateString()
                    : "N/A"}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Reporting Manager</p>
                <p className="text-gray-900">
                  {employee.reporting_manager_name ||
                    employee.reporting_manager_id ||
                    "N/A"}
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === "team" && (
          <div>
            <h3 className="text-lg font-semibold mb-3">Team & Reporting</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Department</p>
                <p className="text-gray-900">{employee.department || "N/A"}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Team</p>
                <p className="text-gray-900">{employee.team || "N/A"}</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === "documents" && (
          <div>
            <h3 className="text-lg font-semibold mb-3">Documents</h3>

            {documentChecklist?.checklist && (
              <div className="mt-3 space-y-3">
                {documentChecklist.checklist.map((doc) => (
                  <div
                    key={doc.category}
                    className="flex items-center justify-between border p-3 rounded"
                  >
                    {/* LEFT */}
                    <div>
                      <div className="font-medium">{doc.document_name}</div>
                      <div className="text-xs text-gray-500">
                        Category: {doc.category}
                      </div>
                    </div>

                    {/* RIGHT */}
                    <div className="flex items-center space-x-3">
                      {doc.status === "completed" ? (
                        <div className="flex items-center space-x-3">
                          <span className="text-green-700 font-semibold">
                            Uploaded ✔
                          </span>

                          <button
                            className="text-blue-600 text-sm"
                            onClick={() => handleDownload(doc.document_id)}
                          >
                            Download
                          </button>

                          <button
                            className="text-red-600 text-sm"
                            onClick={() => handleDelete(doc.document_id)}
                          >
                            Delete
                          </button>
                        </div>
                      ) : (
                        <>
                          <input
                            type="file"
                            className="text-sm"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;

                              const form = new FormData();
                              form.append("file", file);

                              documentService
                                .uploadForEmployee(
                                  employeeId,
                                  doc.category, // ✅ YAHI FIX HAI
                                  form
                                )
                                .then(() => {
                                  loadDocuments();
                                  loadDocumentChecklist();
                                })
                                .catch(() => alert("Upload failed"));
                            }}
                          />

                          <span className="text-red-600 text-sm">Pending</span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {/* 🔐 RESET PASSWORD MODAL */}
        {showResetModal && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg w-96 p-6">
              <h3 className="text-lg font-semibold mb-4">Reset Password</h3>

              <div className="mb-3">
                <label className="text-sm font-medium">Email</label>
                <input
                  type="email"
                  value={employee.email}
                  disabled
                  className="w-full border p-2 rounded bg-gray-100"
                />
              </div>

              <div className="mb-3">
                <label className="text-sm font-medium">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full border p-2 rounded"
                />
              </div>

              <div className="mb-4">
                <label className="text-sm font-medium">Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full border p-2 rounded"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowResetModal(false)}
                  className="px-3 py-1 border rounded"
                >
                  Cancel
                </button>

                <button
                  onClick={handleResetPassword}
                  disabled={resetting}
                  className="px-4 py-1 bg-red-600 text-white rounded"
                >
                  {resetting ? "Resetting..." : "Reset"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default EmployeeProfile;
