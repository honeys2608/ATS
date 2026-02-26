import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../../api/axios";
import { Send } from "lucide-react";
import { formatStatus } from "../../utils/formatStatus";

const VALID_SUBMISSION_FILTERS = new Set([
  "all",
  "applied",
  "sent_to_client",
  "hired",
  "direct_hire",
  "rejected",
]);

const normalizeSubmissionFilter = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  return VALID_SUBMISSION_FILTERS.has(normalized) ? normalized : "all";
};

export default function SubmissionsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [submissions, setSubmissions] = useState([]);
  const [filter, setFilter] = useState(
    normalizeSubmissionFilter(searchParams.get("status")),
  );

  const loadSubmissions = async () => {
    try {
      setLoading(true);
      const res = await api.get("/v1/am/submissions");
      setSubmissions(res.data.submissions || []);
    } catch (err) {
      console.error("Failed to load submissions:", err);
      alert("Failed to fetch submissions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubmissions();
  }, []);

  useEffect(() => {
    setFilter(normalizeSubmissionFilter(searchParams.get("status")));
  }, [searchParams]);

  const handleFilterChange = (nextFilter) => {
    const normalized = normalizeSubmissionFilter(nextFilter);
    setFilter(normalized);

    const params = new URLSearchParams(searchParams);
    if (normalized === "all") {
      params.delete("status");
    } else {
      params.set("status", normalized);
    }
    setSearchParams(params, { replace: true });
  };

  const getFiltered = () => {
    if (filter === "all") return submissions;
    return submissions.filter(
      (submission) =>
        submission.status?.toString().toLowerCase() === filter,
    );
  };

  const sendToClient = async (appId) => {
    if (!window.confirm("Send this candidate to client?")) return;

    try {
      await api.post("/v1/am/send-to-client", {
        job_id: submissions.find((s) => s.application_id === appId)?.job_id,
        application_ids: [appId],
      });
      alert("Candidate sent to client successfully");
      loadSubmissions();
    } catch (err) {
      alert("Failed to send to client: " + err.response?.data?.detail);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center text-gray-500">Loading submissions...</div>
      </div>
    );
  }

  const statusCount = (key) =>
    submissions.filter(
      (submission) =>
        submission.status?.toString().toLowerCase() === key,
    ).length;

  const filtered = getFiltered();

  const tabDefinitions = [
    { key: "all", label: `All (${submissions.length})` },
    { key: "applied", label: `Pending (${statusCount("applied")})` },
    {
      key: "sent_to_client",
      label: `Sent to Client (${statusCount("sent_to_client")})`,
    },
    { key: "hired", label: `Hired (${statusCount("hired")})` },
    { key: "direct_hire", label: `Direct Hire (${statusCount("direct_hire")})` },
    { key: "rejected", label: `Rejected (${statusCount("rejected")})` },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          Recruiter Submissions
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Review and manage candidate submissions from recruiters
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b">
        {tabDefinitions.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleFilterChange(tab.key)}
            className={`px-4 py-2 font-medium text-sm ${
              filter === tab.key
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Submissions Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <p className="text-lg font-medium">No submissions found</p>
            <p className="text-sm mt-2">
              Submissions from recruiters will appear here
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Candidate
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Job
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Match
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Submitted
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y">
                {filtered.map((submission) => {
                  const statusKey = submission.status
                    ? submission.status.toString().toLowerCase()
                    : "";
                  return (
                    <tr
                      key={submission.application_id}
                      className="hover:bg-gray-50"
                    >
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-gray-900">
                            {submission.candidate_name}
                          </p>
                          <p className="text-sm text-gray-500">
                            {submission.email}
                          </p>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-sm text-gray-600">
                        {submission.job_title}
                      </td>

                      <td className="px-6 py-4">
                        <SubmissionStatusBadge status={submission.status} />
                      </td>

                      <td className="px-6 py-4">
                        {submission.match_score ? (
                          <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-green-600"
                              style={{
                                width: `${Math.min(submission.match_score, 100)}%`,
                              }}
                            />
                          </div>
                        ) : (
                          <span className="text-sm text-gray-500">—</span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-sm text-gray-500">
                        {submission.submitted_at
                          ? new Date(submission.submitted_at).toLocaleDateString()
                          : "—"}
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                          {statusKey === "applied" && (
                            <button
                              onClick={() =>
                                sendToClient(submission.application_id)
                              }
                              className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                              title="Send to Client"
                            >
                              <Send className="w-4 h-4 inline" />
                            </button>
                          )}

                          {statusKey === "sent_to_client" && (
                            <span className="text-xs text-gray-500">
                              Waiting for client feedback...
                            </span>
                          )}

                          {statusKey === "hired" && (
                            <span className="text-xs text-green-600 font-medium">
                              Hired by client
                            </span>
                          )}

                          {statusKey === "direct_hire" && (
                            <span className="text-xs text-indigo-600 font-medium">
                              Direct hire recorded
                            </span>
                          )}

                          {statusKey === "rejected" && (
                            <span className="text-xs text-red-600 font-medium">
                              ✗ Rejected
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function SubmissionStatusBadge({ status }) {
  const normalized = status?.toString().toLowerCase() || "";
  const statusMap = {
    applied: {
      label: "Pending",
      className: "bg-yellow-100 text-yellow-800",
    },
    sent_to_client: {
      label: "Sent to Client",
      className: "bg-blue-100 text-blue-800",
    },
    hired: {
      label: "Hired",
      className: "bg-green-100 text-green-800",
    },
    rejected: {
      label: "Rejected",
      className: "bg-red-100 text-red-800",
    },
    selected: {
      label: "Selected",
      className: "bg-indigo-100 text-indigo-800",
    },
    scheduled: {
      label: "Scheduled",
      className: "bg-cyan-100 text-cyan-800",
    },
    in_progress: {
      label: "In Progress",
      className: "bg-cyan-100 text-cyan-800",
    },
    direct_hire: {
      label: "Direct Hire",
      className: "bg-purple-100 text-purple-800",
    },
  };

  const fallbackLabel = formatStatus(status);
  const entry = statusMap[normalized] || {
    label: fallbackLabel === "—" ? "Pending" : fallbackLabel,
    className: "bg-gray-100 text-gray-800",
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${entry.className}`}
    >
      {entry.label}
    </span>
  );
}
