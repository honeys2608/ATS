import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getAllJobSubmissions,
  getRecruiterJobCandidates,
} from "../../services/jobService";
import api from "../../api/axios";
import { ChevronDown, ChevronUp, Clock, User, FileText } from "lucide-react";

export default function JobSubmissions() {
  const { id } = useParams(); // recruiter job id
  const navigate = useNavigate();
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedTimeline, setExpandedTimeline] = useState(null);
  const [timelineData, setTimelineData] = useState({});
  const [timelineLoading, setTimelineLoading] = useState({});

  const loadSubmissions = async () => {
    try {
      setLoading(true);
      let res;

      if (id) {
        console.log("Recruiter Page → Loading ONLY this job:", id);
        res = await getRecruiterJobCandidates(id);

        setCandidates(res.data?.candidates || []);
      } else {
        console.log("Admin Page → Loading ALL submissions");
        res = await getAllJobSubmissions();
        setCandidates(res.data?.candidates || []);
      }

      setError("");
    } catch (err) {
      console.error(err);
      setError("Could not load applied candidates");
      setCandidates([]);
    } finally {
      setLoading(false);
    }
  };

  const loadTimeline = async (candidateId) => {
    if (timelineData[candidateId]) return; // Already loaded

    setTimelineLoading((prev) => ({ ...prev, [candidateId]: true }));
    try {
      let res;
      try {
        res = await api.get(`/v1/workflow/candidates/${candidateId}/timeline`);
      } catch {
        res = await api.get(`/v1/candidates/${candidateId}/timeline`);
      }
      const data = res.data?.timeline || res.data?.data || res.data || [];
      // Normalize timeline items
      const normalized = (data || []).map((it) => ({
        status: it.status || it.event || "updated",
        by: it.by || it.actor || it.user || "",
        at: it.at || it.timestamp || it.created_at || it.createdAt || "",
        note: it.note || it.message || "",
        role: it.role || it.actor_role || "",
        ...it,
      }));
      setTimelineData((prev) => ({ ...prev, [candidateId]: normalized }));
    } catch (err) {
      console.error("Failed to load timeline:", err);
      setTimelineData((prev) => ({ ...prev, [candidateId]: [] }));
    } finally {
      setTimelineLoading((prev) => ({ ...prev, [candidateId]: false }));
    }
  };

  const toggleTimeline = (candidateId) => {
    if (expandedTimeline === candidateId) {
      setExpandedTimeline(null);
    } else {
      setExpandedTimeline(candidateId);
      loadTimeline(candidateId);
    }
  };

  useEffect(() => {
    loadSubmissions();
  }, [id]);

  const openCandidateProfile = (candidateId) => {
    if (!candidateId) return;
    if (window.location.pathname.includes("/recruiter/")) {
      navigate(`/recruiter/candidate-profile/${candidateId}`);
      return;
    }
    navigate(`/candidates/${candidateId}`);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {id ? "Job Submissions" : "Applied Candidates"}
        </h1>
        <p className="text-sm text-gray-500">
          {id
            ? "Candidates submitted for this requirement with workflow timeline"
            : "All candidates who have applied to jobs"}
        </p>
      </div>

      {loading && (
        <div className="bg-white p-6 rounded shadow text-center">
          Loading applied candidates...
        </div>
      )}

      {!loading && error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded">
          {error}
        </div>
      )}

      {!loading && candidates.length === 0 && (
        <div className="bg-purple-50 border border-purple-100 text-purple-700 p-6 rounded text-center">
          No candidates have applied yet.
        </div>
      )}

      {!loading && candidates.length > 0 && (
        <div className="bg-white rounded shadow overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-purple-50">
              <tr>
                <th className="px-4 py-3 text-left">S. No.</th>
                <th className="px-4 py-3 text-left">Candidate</th>
                <th className="px-4 py-3 text-left">Contact</th>
                <th className="px-4 py-3 text-left">Status</th>
                {id && <th className="px-4 py-3 text-left">Sent to AM Date</th>}
                <th className="px-4 py-3 text-left">Timeline</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y">
              {candidates.map((c, index) => {
                const candidateId = c.candidate_id || c.id;
                const timelineKey =
                  candidateId || c.public_id || `${c.application_id}-${index}`;
                const isExpanded = expandedTimeline === timelineKey;
                const timeline = timelineData[timelineKey] || [];
                const isLoadingTimeline = timelineLoading[timelineKey];

                return (
                  <React.Fragment
                    key={c.application_id || `${timelineKey}-${index}`}
                  >
                    <tr className={isExpanded ? "bg-purple-50" : ""}>
                      <td className="px-4 py-3 font-medium">{index + 1}</td>

                      <td className="px-4 py-3">
                        <div className="font-medium">
                          {c.full_name || "Unnamed"}
                        </div>
                        <div className="text-xs text-gray-500">
                          ID: {c.public_id || c.candidate_id}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div>{c.email || "—"}</div>
                        <div className="text-xs text-gray-500">
                          {c.phone || ""}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        {(() => {
                          const status = c.status || "applied";
                          const getStatusStyle = (status) => {
                            switch (status.toLowerCase()) {
                              case "applied":
                                return "bg-blue-100 text-blue-800";
                              case "sent_to_client":
                                return "bg-purple-100 text-purple-800";
                              case "called":
                                return "bg-indigo-100 text-indigo-800";
                              case "feedback_added":
                                return "bg-violet-100 text-violet-800";
                              case "hold_revisit":
                              case "client_hold":
                                return "bg-amber-100 text-amber-800";
                              case "interview":
                                return "bg-orange-100 text-orange-800";
                              case "rejected":
                                return "bg-red-100 text-red-800";
                              case "rejected_by_recruiter":
                              case "am_rejected":
                              case "client_rejected":
                                return "bg-rose-100 text-rose-800";
                              case "selected":
                              case "hired":
                                return "bg-green-100 text-green-800";
                              case "on_hold":
                              case "pending":
                                return "bg-yellow-100 text-yellow-800";
                              case "withdrawn":
                                return "bg-gray-100 text-gray-800";
                              case "client_shortlisted":
                                return "bg-emerald-100 text-emerald-800";
                              case "am_shortlisted":
                                return "bg-teal-100 text-teal-800";
                              case "am_hold":
                                return "bg-yellow-100 text-yellow-800";
                              case "sent_to_am":
                                return "bg-indigo-100 text-indigo-800";
                              case "am_viewed":
                                return "bg-cyan-100 text-cyan-800";
                              default:
                                return "bg-indigo-100 text-indigo-800";
                            }
                          };

                          const formatStatus = (status) => {
                            return status
                              .split("_")
                              .map(
                                (word) =>
                                  word.charAt(0).toUpperCase() + word.slice(1),
                              )
                              .join(" ");
                          };

                          return (
                            <span
                              className={`px-3 py-1 rounded text-xs font-medium ${getStatusStyle(status)}`}
                            >
                              {formatStatus(status)}
                            </span>
                          );
                        })()}
                      </td>

                      {id && (
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {c.sent_to_am_at ||
                          c.sent_to_client_at ||
                          c.applied_at
                            ? (() => {
                                const sentAt =
                                  c.sent_to_am_at ||
                                  c.sent_to_client_at ||
                                  c.applied_at;
                                const dt = new Date(sentAt);

                                const time = dt
                                  .toLocaleTimeString("en-IN", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    hour12: true,
                                  })
                                  .toUpperCase();

                                const date = dt
                                  .toLocaleDateString("en-IN", {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                  })
                                  .toUpperCase();

                                return `${time} | ${date}`;
                              })()
                            : "—"}
                        </td>
                      )}

                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleTimeline(timelineKey)}
                          disabled={!candidateId}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-purple-100 text-purple-700 hover:bg-purple-200 rounded transition-colors"
                        >
                          <Clock className="w-3 h-3" />
                          {isExpanded ? "Hide" : "View"} Timeline
                          {isExpanded ? (
                            <ChevronUp className="w-3 h-3" />
                          ) : (
                            <ChevronDown className="w-3 h-3" />
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => openCandidateProfile(candidateId)}
                          disabled={!candidateId}
                          className="px-3 py-1.5 text-xs font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 rounded transition-colors disabled:opacity-60"
                        >
                          View Profile
                        </button>
                      </td>
                    </tr>

                    {/* Expanded Timeline Row */}
                    {isExpanded && (
                      <tr className="bg-purple-50/50">
                        <td colSpan={id ? 7 : 6} className="px-4 py-4">
                          <div className="bg-white rounded-lg border border-purple-200 p-4">
                            <h4 className="font-semibold text-purple-800 mb-3 flex items-center gap-2">
                              <Clock className="w-4 h-4" />
                              Activity Timeline - All Status Updates
                            </h4>

                            {isLoadingTimeline ? (
                              <div className="text-center py-4 text-gray-500">
                                <div className="animate-spin w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                                Loading timeline...
                              </div>
                            ) : timeline.length === 0 ? (
                              <div className="text-center py-4 text-gray-500">
                                <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                No timeline events recorded yet.
                              </div>
                            ) : (
                              <div className="space-y-3 max-h-80 overflow-y-auto">
                                {[...timeline]
                                  .sort(
                                    (a, b) => new Date(b.at) - new Date(a.at),
                                  )
                                  .map((event, idx) => (
                                    <div key={idx} className="flex gap-3">
                                      <div className="flex-shrink-0">
                                        <div
                                          className={`w-3 h-3 rounded-full mt-1 ${
                                            event.role
                                              ?.toLowerCase()
                                              ?.includes("am") ||
                                            event.role
                                              ?.toLowerCase()
                                              ?.includes("account")
                                              ? "bg-orange-500"
                                              : event.role
                                                    ?.toLowerCase()
                                                    ?.includes("recruiter")
                                                ? "bg-blue-500"
                                                : "bg-purple-500"
                                          }`}
                                        />
                                        {idx < timeline.length - 1 && (
                                          <div className="w-px h-8 bg-gray-200 mx-auto mt-1" />
                                        )}
                                      </div>

                                      <div className="flex-1 pb-2">
                                        <div className="flex items-center justify-between">
                                          <span className="text-sm font-semibold capitalize text-gray-900">
                                            {(
                                              event.status || "Updated"
                                            ).replace(/_/g, " ")}
                                          </span>
                                          <div className="flex items-center gap-2">
                                            {event.role && (
                                              <span
                                                className={`text-xs px-2 py-0.5 rounded ${
                                                  event.role
                                                    ?.toLowerCase()
                                                    ?.includes("am") ||
                                                  event.role
                                                    ?.toLowerCase()
                                                    ?.includes("account")
                                                    ? "bg-orange-100 text-orange-700"
                                                    : event.role
                                                          ?.toLowerCase()
                                                          ?.includes(
                                                            "recruiter",
                                                          )
                                                      ? "bg-blue-100 text-blue-700"
                                                      : "bg-gray-100 text-gray-700"
                                                }`}
                                              >
                                                {event.role}
                                              </span>
                                            )}
                                            {event.by && (
                                              <span className="text-xs text-gray-500 flex items-center gap-1">
                                                <User className="w-3 h-3" />
                                                {event.by}
                                              </span>
                                            )}
                                          </div>
                                        </div>

                                        <div className="text-xs text-gray-500 mt-0.5">
                                          {event.at
                                            ? new Date(
                                                event.at,
                                              ).toLocaleString()
                                            : ""}
                                        </div>

                                        {event.note && (
                                          <div className="mt-1 text-sm text-gray-700 bg-gray-50 p-2 rounded">
                                            {event.note}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
