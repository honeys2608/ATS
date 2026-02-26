import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import workflowService from "../services/workflowService";
import {
  ChevronLeft,
  CheckCircle,
  MapPin,
  Users,
  BadgeCheck,
} from "lucide-react";

const FINAL_STAGES = new Set([
  "selected",
  "rejected",
  "negotiation",
  "hired",
  "offer_declined",
]);

const StageBadge = ({ stage }) => {
  const label = stage ? stage.replace(/_/g, " ") : "—";
  const color = FINAL_STAGES.has(stage)
    ? "bg-gray-100 text-gray-700"
    : stage === "client_shortlisted"
      ? "bg-emerald-100 text-emerald-700"
      : stage === "interview_scheduled"
        ? "bg-blue-100 text-blue-700"
        : "bg-purple-100 text-purple-700";
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${color}`}>
      {label}
    </span>
  );
};

const NoteModal = ({
  open,
  title,
  onClose,
  onSubmit,
  fields,
  setFields,
}) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button className="text-gray-500" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium">Rating (1-5)</label>
            <input
              type="number"
              min="1"
              max="5"
              className="w-full p-2 border rounded"
              value={fields.rating}
              onChange={(e) =>
                setFields((prev) => ({ ...prev, rating: Number(e.target.value) }))
              }
            />
          </div>
          <div>
            <label className="text-sm font-medium">Strengths</label>
            <input
              className="w-full p-2 border rounded"
              value={fields.strengths}
              onChange={(e) =>
                setFields((prev) => ({ ...prev, strengths: e.target.value }))
              }
            />
          </div>
          <div className="col-span-2">
            <label className="text-sm font-medium">Concerns</label>
            <input
              className="w-full p-2 border rounded"
              value={fields.concerns}
              onChange={(e) =>
                setFields((prev) => ({ ...prev, concerns: e.target.value }))
              }
            />
          </div>
          <div className="col-span-2">
            <label className="text-sm font-medium">Notes</label>
            <textarea
              className="w-full p-2 border rounded min-h-[80px]"
              value={fields.free_text}
              onChange={(e) =>
                setFields((prev) => ({ ...prev, free_text: e.target.value }))
              }
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button className="px-4 py-2 border rounded" onClick={onClose}>
            Cancel
          </button>
          <button className="px-4 py-2 bg-blue-600 text-white rounded" onClick={onSubmit}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

const InterviewModal = ({ open, onClose, onSubmit, fields, setFields }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Schedule Interview</h3>
          <button className="text-gray-500" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium">Date</label>
            <input
              type="date"
              className="w-full p-2 border rounded"
              value={fields.interview_date}
              onChange={(e) =>
                setFields((prev) => ({ ...prev, interview_date: e.target.value }))
              }
            />
          </div>
          <div>
            <label className="text-sm font-medium">Time</label>
            <input
              type="time"
              className="w-full p-2 border rounded"
              value={fields.interview_time}
              onChange={(e) =>
                setFields((prev) => ({ ...prev, interview_time: e.target.value }))
              }
            />
          </div>
          <div>
            <label className="text-sm font-medium">Mode</label>
            <select
              className="w-full p-2 border rounded"
              value={fields.interview_mode}
              onChange={(e) =>
                setFields((prev) => ({ ...prev, interview_mode: e.target.value }))
              }
            >
              <option value="in_person">In person</option>
              <option value="video">Video</option>
              <option value="phone">Phone</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">Interviewer Name</label>
            <input
              className="w-full p-2 border rounded"
              value={fields.interviewer_name}
              onChange={(e) =>
                setFields((prev) => ({ ...prev, interviewer_name: e.target.value }))
              }
            />
          </div>
          <div className="col-span-2">
            <label className="text-sm font-medium">Location / Link</label>
            <input
              className="w-full p-2 border rounded"
              value={fields.location_or_link}
              onChange={(e) =>
                setFields((prev) => ({ ...prev, location_or_link: e.target.value }))
              }
            />
          </div>
          <div className="col-span-2">
            <label className="text-sm font-medium">Notes</label>
            <textarea
              className="w-full p-2 border rounded"
              value={fields.notes}
              onChange={(e) =>
                setFields((prev) => ({ ...prev, notes: e.target.value }))
              }
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button className="px-4 py-2 border rounded" onClick={onClose}>
            Cancel
          </button>
          <button className="px-4 py-2 bg-emerald-600 text-white rounded" onClick={onSubmit}>
            Schedule
          </button>
        </div>
      </div>
    </div>
  );
};

const RequirementDetail = () => {
  const { requirementId } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [matched, setMatched] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("matched");
  const [minScore, setMinScore] = useState(0);
  const [selectedCandidates, setSelectedCandidates] = useState(new Set());
  const [noteModal, setNoteModal] = useState({ open: false, candidate: null, mode: "call" });
  const [noteFields, setNoteFields] = useState({ rating: 4, strengths: "", concerns: "", free_text: "" });
  const [interviewModal, setInterviewModal] = useState({ open: false, submission: null });
  const [interviewFields, setInterviewFields] = useState({
    interview_date: "",
    interview_time: "",
    interview_mode: "video",
    location_or_link: "",
    interviewer_name: "",
    notes: "",
  });

  const fetchDetail = async () => {
    setLoading(true);
    try {
      const data = await workflowService.getRecruiterRequirementDetail(requirementId);
      setDetail(data);
      const subRes = await workflowService.getRecruiterSubmissions(requirementId);
      setSubmissions(subRes.submissions || []);
    } catch (err) {
      console.error("Failed to load requirement", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [requirementId]);

  const runMatch = async () => {
    try {
      const res = await workflowService.runMatch(requirementId, minScore);
      setMatched(res.candidates || []);
    } catch (err) {
      console.error("Match failed", err);
      alert("Match failed");
    }
  };

  const callNoteMap = useMemo(() => {
    const map = {};
    submissions.forEach((s) => {
      if (s.notes?.some((n) => n.note_stage === "call_feedback")) {
        map[s.candidate_id] = true;
      }
    });
    return map;
  }, [submissions]);

  const toggleCandidate = (candidateId) => {
    setSelectedCandidates((prev) => {
      const next = new Set(prev);
      if (next.has(candidateId)) {
        next.delete(candidateId);
      } else {
        next.add(candidateId);
      }
      return next;
    });
  };

  const submitToAm = async () => {
    if (selectedCandidates.size === 0) {
      alert("Select candidates with call notes");
      return;
    }
    try {
      await workflowService.submitCandidates(requirementId, {
        candidate_ids: Array.from(selectedCandidates),
      });
      setSelectedCandidates(new Set());
      fetchDetail();
    } catch (err) {
      console.error("Submit failed", err);
      alert("Submit failed");
    }
  };

  const handleAddNote = async () => {
    if (!noteModal.candidate) return;
    try {
      if (noteModal.mode === "call") {
        await workflowService.addCallNote(
          requirementId,
          noteModal.candidate.candidate_id,
          noteFields,
        );
      } else {
        await workflowService.addInterviewNotes(noteModal.candidate.id, noteFields);
      }
      setNoteModal({ open: false, candidate: null, mode: "call" });
      setNoteFields({ rating: 4, strengths: "", concerns: "", free_text: "" });
      fetchDetail();
    } catch (err) {
      console.error("Failed to add note", err);
      alert("Failed to add note");
    }
  };

  const handleScheduleInterview = async () => {
    if (!interviewModal.submission) return;
    if (!interviewFields.interview_date || !interviewFields.interview_time) {
      alert("Please provide interview date and time");
      return;
    }
    try {
      await workflowService.scheduleInterview(interviewModal.submission.id, interviewFields);
      setInterviewModal({ open: false, submission: null });
      setInterviewFields({
        interview_date: "",
        interview_time: "",
        interview_mode: "video",
        location_or_link: "",
        interviewer_name: "",
        notes: "",
      });
      fetchDetail();
    } catch (err) {
      console.error("Schedule failed", err);
      alert("Schedule failed");
    }
  };

  const requirement = detail?.requirement;
  const assignment = detail?.assignment;

  const interviewStage = submissions.filter((s) =>
    ["client_shortlisted", "interview_scheduled", "interview_completed"].includes(s.stage),
  );
  const closedStage = submissions.filter((s) => FINAL_STAGES.has(s.stage));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!requirement) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <button
          onClick={() => navigate("/recruiter/requirements")}
          className="flex items-center text-blue-600 hover:text-blue-700 mb-6"
        >
          <ChevronLeft className="h-5 w-5 mr-1" />
          Back to Requirements
        </button>
        <div className="bg-white rounded-lg shadow p-12 text-center">
          Requirement not found
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <button
          onClick={() => navigate("/recruiter/requirements")}
          className="flex items-center text-blue-600 hover:text-blue-700 mb-4"
        >
          <ChevronLeft className="h-5 w-5 mr-1" />
          Back to Requirements
        </button>

        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">
                    {requirement.title}
                  </h1>
                  <p className="text-sm text-gray-500 mt-2">
                    Client: {requirement.client_name}
                  </p>
                </div>
                <StageBadge stage={requirement.status} />
              </div>

              <div className="grid grid-cols-3 gap-4 mb-6 pb-6 border-b">
                <div>
                  <p className="text-sm text-gray-600">Positions</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {requirement.positions_count || 1}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Experience</p>
                  <p className="text-3xl font-bold text-blue-600">
                    {requirement.experience_min || 0}+
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Location</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {requirement.location_details?.city || "Any"}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">
                    Required Skills
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {(requirement.skills_mandatory || []).map((skill, idx) => (
                      <span
                        key={idx}
                        className="bg-blue-100 text-blue-800 px-4 py-2 rounded-full text-sm font-medium"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
                {requirement.description && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      Job Description
                    </h3>
                    <p className="text-gray-700 whitespace-pre-wrap">
                      {requirement.description}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex gap-2">
                {[
                  { key: "matched", label: "Matched Candidates" },
                  { key: "submissions", label: "My Submissions" },
                  { key: "interviews", label: "Interview Stage" },
                  { key: "closed", label: "Closed" },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`px-3 py-2 rounded text-sm font-medium ${
                      activeTab === tab.key
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {activeTab === "matched" && (
              <div className="bg-white rounded-lg shadow">
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      className="px-4 py-2 bg-blue-600 text-white rounded"
                      onClick={runMatch}
                    >
                      Run Match
                    </button>
                    <label className="text-sm text-gray-600">
                      Min score: {minScore}%
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={minScore}
                        onChange={(e) => setMinScore(Number(e.target.value))}
                        className="ml-2 align-middle"
                      />
                    </label>
                  </div>
                  <button
                    className="px-4 py-2 bg-emerald-600 text-white rounded"
                    onClick={submitToAm}
                  >
                    Submit to AM
                  </button>
                </div>
                {matched.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    No candidates matched yet. Click Run Match.
                  </div>
                ) : (
                  <div className="divide-y">
                    {matched.map((candidate) => (
                      <div key={candidate.candidate_id} className="p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-semibold text-gray-900">
                              {candidate.full_name || "Candidate"}
                            </h3>
                            <p className="text-xs text-gray-500">
                              {candidate.email}
                            </p>
                            {candidate.current_location && (
                              <p className="text-xs text-gray-500 flex items-center">
                                <MapPin className="h-3 w-3 mr-1" />
                                {candidate.current_location}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="inline-flex items-center bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                              <BadgeCheck className="h-4 w-4 mr-1" />
                              {candidate.match_score}%
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {(candidate.matched_skills || []).map((skill, idx) => (
                            <span
                              key={idx}
                              className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs"
                            >
                              ✓ {skill}
                            </span>
                          ))}
                          {(candidate.missing_skills || []).slice(0, 3).map((skill, idx) => (
                            <span
                              key={idx}
                              className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs"
                            >
                              ✕ {skill}
                            </span>
                          ))}
                        </div>
                        <div className="mt-4 flex items-center gap-3">
                          <button
                            className="px-3 py-1 border rounded text-xs"
                            onClick={() => {
                              setNoteModal({ open: true, candidate, mode: "call" });
                              setNoteFields({ rating: 4, strengths: "", concerns: "", free_text: "" });
                            }}
                          >
                            Add Call Notes
                          </button>
                          <label className="flex items-center gap-2 text-xs">
                            <input
                              type="checkbox"
                              checked={selectedCandidates.has(candidate.candidate_id)}
                              onChange={() => toggleCandidate(candidate.candidate_id)}
                              disabled={!callNoteMap[candidate.candidate_id]}
                            />
                            Select for submission
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "submissions" && (
              <div className="bg-white rounded-lg shadow">
                {submissions.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    No submissions yet.
                  </div>
                ) : (
                  <div className="divide-y">
                    {submissions.map((s) => (
                      <div key={s.id} className="p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-semibold text-gray-900">
                              {s.candidate_name || "Candidate"}
                            </h3>
                            <p className="text-xs text-gray-500">
                              {s.email || ""}
                            </p>
                          </div>
                          <StageBadge stage={s.stage} />
                        </div>
                        <div className="mt-2 text-sm text-gray-600">
                          Match Score: {s.match_score || 0}%
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "interviews" && (
              <div className="bg-white rounded-lg shadow">
                {interviewStage.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    No interviews scheduled yet.
                  </div>
                ) : (
                  <div className="divide-y">
                    {interviewStage.map((s) => (
                      <div key={s.id} className="p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-semibold text-gray-900">
                              {s.candidate_name || "Candidate"}
                            </h3>
                            <p className="text-xs text-gray-500">{s.email || ""}</p>
                          </div>
                          <StageBadge stage={s.stage} />
                        </div>
                        <div className="mt-3 flex gap-2">
                          {s.stage === "client_shortlisted" && (
                            <button
                              className="px-3 py-1 bg-emerald-600 text-white rounded text-xs"
                              onClick={() => {
                                setInterviewModal({ open: true, submission: s });
                                setInterviewFields({
                                  interview_date: "",
                                  interview_time: "",
                                  interview_mode: "video",
                                  location_or_link: "",
                                  interviewer_name: "",
                                  notes: "",
                                });
                              }}
                            >
                              Schedule Interview
                            </button>
                          )}
                          {s.stage === "interview_scheduled" && (
                            <button
                              className="px-3 py-1 border rounded text-xs"
                              onClick={() => {
                                setNoteModal({ open: true, candidate: s, mode: "interview" });
                                setNoteFields({ rating: 4, strengths: "", concerns: "", free_text: "" });
                              }}
                            >
                              Add Interview Notes
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "closed" && (
              <div className="bg-white rounded-lg shadow">
                {closedStage.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    No closed candidates yet.
                  </div>
                ) : (
                  <div className="divide-y">
                    {closedStage.map((s) => (
                      <div key={s.id} className="p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-semibold text-gray-900">
                              {s.candidate_name || "Candidate"}
                            </h3>
                            <p className="text-xs text-gray-500">{s.email || ""}</p>
                          </div>
                          <StageBadge stage={s.stage} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <div className="bg-white rounded-lg shadow p-6 sticky top-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Assignment Notes
              </h3>
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <p className="text-xs text-gray-600">Assigned</p>
                <p className="font-medium text-gray-900">
                  {assignment?.assigned_at
                    ? new Date(assignment.assigned_at).toLocaleDateString()
                    : "—"}
                </p>
              </div>
              {assignment?.notes ? (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-blue-800 text-sm">{assignment.notes}</p>
                </div>
              ) : (
                <p className="text-sm text-gray-500">No notes from AM.</p>
              )}
              <div className="mt-6 bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-2 text-gray-600 text-sm">
                  <Users className="h-4 w-4" />
                  {submissions.length} submissions
                </div>
                <div className="flex items-center gap-2 text-gray-600 text-sm mt-2">
                  <CheckCircle className="h-4 w-4" />
                  {interviewStage.length} in interview
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <NoteModal
        open={noteModal.open}
        title={noteModal.mode === "call" ? "Add Call Notes" : "Add Interview Notes"}
        onClose={() => setNoteModal({ open: false, candidate: null, mode: "call" })}
        onSubmit={handleAddNote}
        fields={noteFields}
        setFields={setNoteFields}
      />

      <InterviewModal
        open={interviewModal.open}
        onClose={() => setInterviewModal({ open: false, submission: null })}
        onSubmit={handleScheduleInterview}
        fields={interviewFields}
        setFields={setInterviewFields}
      />
    </div>
  );
};

export default RequirementDetail;
