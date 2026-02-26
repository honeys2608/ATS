import React, { useEffect, useState } from "react";
import api from "../../api/axios";
import { Calendar, Clock, CheckCircle, XCircle } from "lucide-react";

export default function TimesheetsPage() {
  const [loading, setLoading] = useState(true);
  const [timesheets, setTimesheets] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState({});

  const loadTimesheets = async () => {
    try {
      const res = await api.get("/v1/am/pending-timesheets");
      setTimesheets(res.data.pending_timesheets || []);
    } catch (err) {
      console.error("Failed to load timesheets:", err);
      alert("Failed to fetch timesheets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTimesheets();
  }, []);

  const approveTimesheet = async (tsId) => {
    if (!window.confirm("Approve this timesheet?")) return;

    try {
      await api.post(`/v1/am/timesheets/${tsId}/approve`);
      alert("Timesheet approved successfully");
      loadTimesheets();
    } catch (err) {
      alert("Failed to approve: " + err.response?.data?.detail);
    }
  };

  const rejectTimesheet = async (tsId) => {
    const reason = window.prompt(
      "Enter rejection reason:",
      rejectionReason[tsId] || "",
    );
    if (reason === null) return;

    try {
      await api.post(
        `/v1/am/timesheets/${tsId}/reject?reason=${encodeURIComponent(reason)}`,
      );
      alert("Timesheet rejected");
      loadTimesheets();
    } catch (err) {
      alert("Failed to reject: " + err.response?.data?.detail);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center text-gray-500">Loading timesheets...</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          Timesheet Approvals
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Review and approve consultant timesheets
        </p>
      </div>

      {/* Pending Count */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-blue-900">
          <span className="font-semibold">{timesheets.length}</span> timesheet
          {timesheets.length !== 1 ? "s" : ""} pending approval
        </p>
      </div>

      {/* Timesheets List */}
      <div className="space-y-4">
        {timesheets.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center text-gray-500">
            <Clock className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-lg font-medium">No pending timesheets</p>
            <p className="text-sm mt-2">
              All timesheets have been approved or are waiting for submission
            </p>
          </div>
        ) : (
          timesheets.map((ts) => (
            <div
              key={ts.timesheet_id}
              className="bg-white rounded-lg shadow hover:shadow-md transition"
            >
              {/* Header Row */}
              <button
                onClick={() =>
                  setExpandedId(
                    expandedId === ts.timesheet_id ? null : ts.timesheet_id,
                  )
                }
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50"
              >
                <div className="text-left">
                    <p className="font-semibold text-gray-900">
                      {ts.consultant_name || "—"}
                    </p>
                  <div className="flex gap-4 mt-2 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      <span>
                        {ts.period_type === "weekly" ? "Weekly" : "Monthly"} •{" "}
                        {new Date(ts.period_start).toLocaleDateString()} to{" "}
                        {new Date(ts.period_end).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      <span>{ts.total_hours} hours</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Submitted</p>
                    <p className="text-sm font-medium">
                      {ts.submitted_at
                        ? new Date(ts.submitted_at).toLocaleDateString()
                        : "—"}
                    </p>
                  </div>
                  <div
                    className={`transform transition ${
                      expandedId === ts.timesheet_id ? "rotate-180" : ""
                    }`}
                  >
                    <span className="text-gray-400">▼</span>
                  </div>
                </div>
              </button>

              {/* Expanded Details */}
              {expandedId === ts.timesheet_id && (
                <div className="px-6 py-4 border-t bg-gray-50 space-y-4">
                  {/* Timesheet Summary */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Total Hours</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {ts.total_hours}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Period Type</p>
                      <p className="text-lg font-medium text-gray-900">
                        {ts.period_type === "weekly" ? "Weekly" : "Monthly"}
                      </p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={() => approveTimesheet(ts.timesheet_id)}
                      className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Approve
                    </button>
                    <button
                      onClick={() => rejectTimesheet(ts.timesheet_id)}
                      className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center justify-center gap-2"
                    >
                      <XCircle className="w-4 h-4" />
                      Reject
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
