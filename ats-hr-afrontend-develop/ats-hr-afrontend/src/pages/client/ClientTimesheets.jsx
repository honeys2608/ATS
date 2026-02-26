import React, { useEffect, useState } from "react";
import {
  getClientTimesheets,
  approveTimesheetByClient,
  rejectTimesheet,
} from "../../services/timesheetService";

/* ================= STATUS BADGE COLORS ================= */
const statusStyle = {
  submitted: "bg-blue-100 text-blue-700",
  am_approved: "bg-yellow-100 text-yellow-800",
  client_approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

const statusLabel = {
  submitted: "Submitted",
  am_approved: "AM Approved",
  client_approved: "Client Approved",
  rejected: "Rejected",
};

export default function ClientTimesheets() {
  const [timesheets, setTimesheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rejectId, setRejectId] = useState(null);
  const [reason, setReason] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [reasonError, setReasonError] = useState("");

  /* ================= LOAD DATA ================= */
  const loadTimesheets = async () => {
    try {
      setLoading(true);
      const res = await getClientTimesheets();
      const pending = (res?.timesheets || []).filter(
        (t) => t.status === "am_approved",
      );

      setTimesheets(pending);
    } catch (err) {
      console.error(err);
      alert("Failed to load timesheets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTimesheets();
  }, []);

  /* ================= VALIDATION ================= */
  const validateReason = (text) => {
    if (!text.trim()) {
      return "Rejection reason is required";
    }
    if (text.trim().length < 10) {
      return "Reason must be at least 10 characters";
    }
    if (text.trim().length > 500) {
      return "Reason must not exceed 500 characters";
    }
    return "";
  };

  const handleReasonChange = (e) => {
    const value = e.target.value;
    setReason(value);
    if (reasonError) {
      setReasonError(validateReason(value));
    }
  };

  /* ================= ACTIONS ================= */
  const handleApprove = async (id) => {
    if (!window.confirm("Approve this timesheet?")) return;
    try {
      await approveTimesheetByClient(id);
      alert("Timesheet approved successfully!");
      loadTimesheets();
    } catch (err) {
      alert("Failed to approve timesheet");
    }
  };

  const handleReject = async () => {
    const error = validateReason(reason);
    if (error) {
      setReasonError(error);
      return;
    }

    setRejecting(true);
    try {
      await rejectTimesheet(rejectId, reason.trim());
      alert("Timesheet rejected successfully!");
      setRejectId(null);
      setReason("");
      setReasonError("");
      loadTimesheets();
    } catch (err) {
      alert("Failed to reject timesheet");
    } finally {
      setRejecting(false);
    }
  };

  const handleCloseModal = () => {
    setRejectId(null);
    setReason("");
    setReasonError("");
  };

  if (loading) {
    return <p className="text-gray-500">Loading timesheets...</p>;
  }

  return (
    <div className="space-y-6">
      {/* ================= PAGE HEADER ================= */}
      <div>
        <h2 className="text-3xl font-bold mb-2 text-gray-900">
          Pending Timesheets
        </h2>
        <p className="text-gray-600">
          Review and approve timesheets submitted by consultants
        </p>
      </div>

      {timesheets.length === 0 && (
        <div className="mt-6 border-2 border-dashed border-gray-200 rounded-xl p-16 text-center bg-white">
          <div className="flex justify-center mb-4">
            <span className="text-6xl">📁</span>
          </div>

          <h3 className="text-lg font-semibold text-gray-800">
            No Pending Timesheets
          </h3>

          <p className="text-sm text-gray-500 mt-1">
            All submitted timesheets have been reviewed.
            <br />
            New submissions will appear here.
          </p>
        </div>
      )}

      {/* ================= TIMESHEET CARDS ================= */}
      {timesheets.map((t) => (
        <div
          key={t.id}
          className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 max-w-4xl hover:shadow-md transition-shadow"
        >
          {/* -------- TOP ROW -------- */}
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-lg font-bold text-gray-900">
                {t.consultant_name || "Consultant"}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {t.period_start} → {t.period_end}
              </p>
            </div>

            <span
              className={`px-3 py-1 text-xs rounded-full font-semibold uppercase ${
                statusStyle[t.status] || "bg-gray-100 text-gray-600"
              }`}
            >
              {statusLabel[t.status] || t.status}
            </span>
          </div>

          {/* -------- HOURS SUMMARY -------- */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-blue-600 font-medium">Total Hours</p>
            <p className="text-2xl font-bold text-blue-700">
              {t.total_hours} hrs
            </p>
          </div>

          {/* -------- ENTRIES -------- */}
          <div className="mb-4">
            <p className="font-semibold text-gray-900 mb-3">
              Timesheet Entries
            </p>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {t.entries?.length > 0 ? (
                t.entries.map((e) => (
                  <div
                    key={e.id}
                    className="flex justify-between items-start text-sm bg-gray-50 px-3 py-2 rounded border border-gray-200"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{e.work_date}</p>
                      <p className="text-gray-600 text-xs mt-1 truncate max-w-md">
                        {e.description || "No description"}
                      </p>
                    </div>
                    <span className="font-semibold text-gray-900 whitespace-nowrap ml-2">
                      {e.hours} hrs
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-sm">No entries</p>
              )}
            </div>
          </div>

          {/* -------- ACTIONS (ONLY AM APPROVED) -------- */}
          {t.status === "am_approved" && (
            <div className="flex gap-3 pt-4 border-t border-gray-200">
              <button
                onClick={() => handleApprove(t.id)}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
              >
                ✓ Approve
              </button>

              <button
                onClick={() => setRejectId(t.id)}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
              >
                ✕ Reject
              </button>
            </div>
          )}
        </div>
      ))}

      {/* ================= REJECT MODAL ================= */}
      {rejectId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              Reject Timesheet
            </h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Rejection Reason *
              </label>
              <textarea
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 resize-none ${
                  reasonError
                    ? "border-red-500 ring-2 ring-red-200"
                    : "border-gray-300"
                }`}
                placeholder="Please provide a detailed reason for rejection (10-500 characters)"
                value={reason}
                onChange={handleReasonChange}
                rows="4"
              />
              {reasonError && (
                <p className="text-red-600 text-sm mt-1">{reasonError}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                {reason.length}/500 characters
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleReject}
                disabled={rejecting || reasonError !== "" || !reason.trim()}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {rejecting ? "Rejecting..." : "Confirm Reject"}
              </button>
              <button
                onClick={handleCloseModal}
                disabled={rejecting}
                className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg disabled:opacity-50 transition-colors"
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
