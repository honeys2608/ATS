import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import workflowService from "../../services/workflowService";
import api from "../../api/axios";
import { formatStatus } from "../../utils/formatStatus";

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
      : stage === "am_shortlisted"
        ? "bg-blue-100 text-blue-700"
        : "bg-purple-100 text-purple-700";
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${color}`}
    >
      {label}
    </span>
  );
};

export default function RequirementReview() {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);
  const [activeTab, setActiveTab] = useState("submissions");
  const [recruiters, setRecruiters] = useState([]);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignSelection, setAssignSelection] = useState([]);
  const [assignNotes, setAssignNotes] = useState("");
  const [noteModal, setNoteModal] = useState({
    open: false,
    submissionId: null,
    stage: "",
    title: "",
  });
  const [noteFields, setNoteFields] = useState({
    rating: 4,
    strengths: "",
    concerns: "",
    free_text: "",
  });
  const [decisionModal, setDecisionModal] = useState({
    open: false,
    submissionId: null,
  });
  const [decisionStage, setDecisionStage] = useState("selected");
  const [decisionNote, setDecisionNote] = useState("");

  const fetchDetail = async () => {
    setLoading(true);
    try {
      const data = await workflowService.getAmRequirementDetail(id);
      setDetail(data);
    } catch (err) {
      console.error(
        "Failed to load from workflow API, trying job-management...",
        err,
      );
      // Fallback: try to load from job-management endpoint
      try {
        const jobRes = await api.get(`/v1/job-management/requirements/${id}`);
        const job = jobRes.data?.job || jobRes.data;
        if (job) {
          // Transform job data to requirement format
          setDetail({
            requirement: {
              id: job.id,
              title: job.title || job.job_title,
              description: job.description || job.jd_text,
              client_name: job.client_name || null,
              client_contact: job.client_ta,
              status: job.status,
              skills_mandatory: job.skills || [],
              skills_good_to_have: [],
              experience_min: job.min_experience || 0,
              experience_max: job.max_experience,
              location_details: { city: job.location, type: job.mode },
              positions_count: job.no_of_positions || 1,
              budget: job.budget,
              duration: job.duration,
              work_timings: job.work_timings,
              joining_preference: job.joining_preference,
              notes_for_recruiter: job.notes_for_recruiter,
              mode: job.mode,
              jd_text: job.jd_text || job.description,
              created_at: job.created_at,
              updated_at: job.updated_at,
            },
            assignments: job.assignments || [],
            submissions: [],
          });
        }
      } catch (fallbackErr) {
        console.error("Fallback also failed:", fallbackErr);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchRecruiters = async () => {
    try {
      const res = await api.get("/v1/am/recruiters");
      setRecruiters(res.data || []);
    } catch (err) {
      console.error("Failed to load recruiters", err);
    }
  };

  useEffect(() => {
    fetchDetail();
    fetchRecruiters();
  }, []);

  const requirement = detail?.requirement;
  const submissions = detail?.submissions || [];
  const assignments = detail?.assignments || [];

  const recruiterSubmissions = useMemo(
    () =>
      submissions.filter((s) =>
        [
          "recruiter_review",
          "sent_to_am",
          "am_shortlisted",
          "am_rejected",
        ].includes(s.stage),
      ),
    [submissions],
  );
  const sentToClient = useMemo(
    () =>
      submissions.filter((s) =>
        ["sent_to_client", "client_shortlisted", "client_rejected"].includes(
          s.stage,
        ),
      ),
    [submissions],
  );
  const interviewStage = useMemo(
    () =>
      submissions.filter((s) =>
        [
          "client_shortlisted",
          "interview_scheduled",
          "interview_completed",
        ].includes(s.stage),
      ),
    [submissions],
  );
  const closedStage = useMemo(
    () => submissions.filter((s) => FINAL_STAGES.has(s.stage)),
    [submissions],
  );

  const openNote = (submissionId, stage, title) => {
    setNoteModal({ open: true, submissionId, stage, title });
    setNoteFields({ rating: 4, strengths: "", concerns: "", free_text: "" });
  };

  const submitNote = async () => {
    if (!noteModal.submissionId) return;
    try {
      await workflowService.updateSubmissionStage(noteModal.submissionId, {
        stage: noteModal.stage,
        ...noteFields,
      });
      setNoteModal({ open: false, submissionId: null, stage: "", title: "" });
      fetchDetail();
    } catch (err) {
      console.error("Failed to add note", err);
      alert("Failed to add note");
    }
  };

  const updateStage = async (submissionId, stage) => {
    try {
      await workflowService.updateSubmissionStage(submissionId, { stage });
      fetchDetail();
    } catch (err) {
      console.error("Stage update failed", err);
      alert("Stage update failed");
    }
  };

  const submitDecision = async () => {
    if (!decisionModal.submissionId) return;
    try {
      await workflowService.updateSubmissionStage(decisionModal.submissionId, {
        stage: decisionStage,
        free_text: decisionNote || undefined,
        rating: decisionNote ? 4 : undefined,
      });
      setDecisionModal({ open: false, submissionId: null });
      setDecisionNote("");
      fetchDetail();
    } catch (err) {
      console.error("Failed to update decision", err);
      alert("Failed to update decision");
    }
  };

  const handleAssign = async () => {
    if (assignSelection.length === 0) return;
    try {
      await workflowService.assignRecruiters(id, {
        recruiter_ids: assignSelection,
        notes: assignNotes,
      });
      setAssignSelection([]);
      setAssignNotes("");
      setAssignOpen(false);
      fetchDetail();
    } catch (err) {
      console.error("Failed to assign recruiter", err);
      alert("Failed to assign recruiter");
    }
  };

  const latestNote = (notes, stage) => {
    const filtered = notes.filter((n) => n.note_stage === stage);
    return filtered.length ? filtered[filtered.length - 1] : null;
  };

  if (loading) return <p>Loading requirement...</p>;

  if (!requirement) {
    return <p>Requirement not found</p>;
  }

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded shadow">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Requirement Info
            </h3>
            <div className="mt-3 space-y-2 text-sm">
              <p>
                <span className="font-medium text-gray-600 dark:text-gray-400">
                  Title:
                </span>{" "}
                <span className="text-gray-900 dark:text-white">
                  {requirement.title}
                </span>
              </p>
              <p>
                <span className="font-medium text-gray-600 dark:text-gray-400">
                  Client:
                </span>{" "}
                <span className="text-gray-900 dark:text-white">
                  {requirement.client_name || "—"}
                </span>
              </p>
              {requirement.client_contact && (
                <p>
                  <span className="font-medium text-gray-600 dark:text-gray-400">
                    Client TA:
                  </span>{" "}
                  <span className="text-gray-900 dark:text-white">
                    {requirement.client_contact}
                  </span>
                </p>
              )}
              <p>
                <span className="font-medium text-gray-600 dark:text-gray-400">
                  Status:
                </span>{" "}
                <span className="text-gray-900 dark:text-white">
                  {formatStatus(requirement.status)}
                </span>
              </p>
              {requirement.mode && (
                <p>
                  <span className="font-medium text-gray-600 dark:text-gray-400">
                    Mode:
                  </span>{" "}
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 rounded text-xs uppercase">
                    {requirement.mode}
                  </span>
                </p>
              )}
              <p>
                <span className="font-medium text-gray-600 dark:text-gray-400">
                  Experience:
                </span>{" "}
                <span className="text-gray-900 dark:text-white">
                  {requirement.experience_min || 0} -{" "}
                  {requirement.experience_max || "∞"} yrs
                </span>
              </p>
              <p>
                <span className="font-medium text-gray-600 dark:text-gray-400">
                  Location:
                </span>{" "}
                <span className="text-gray-900 dark:text-white">
                  {requirement.location_details?.city ||
                    requirement.location_details ||
                    "—"}
                </span>
              </p>
              <p>
                <span className="font-medium text-gray-600 dark:text-gray-400">
                  Positions:
                </span>{" "}
                <span className="text-gray-900 dark:text-white font-medium">
                  {requirement.positions_count || 1}
                </span>
              </p>
              {requirement.budget && (
                <p>
                  <span className="font-medium text-gray-600 dark:text-gray-400">
                    Budget:
                  </span>{" "}
                  <span className="text-green-600 dark:text-green-400 font-medium">
                    {requirement.budget}
                  </span>
                </p>
              )}
              {(requirement.ctc_min || requirement.ctc_max) && (
                <p>
                  <span className="font-medium text-gray-600 dark:text-gray-400">
                    CTC Range:
                  </span>{" "}
                  <span className="text-gray-900 dark:text-white">
                    {requirement.ctc_min || "—"} - {requirement.ctc_max || "—"}
                  </span>
                </p>
              )}
              {requirement.duration && (
                <p>
                  <span className="font-medium text-gray-600 dark:text-gray-400">
                    Duration:
                  </span>{" "}
                  <span className="text-gray-900 dark:text-white">
                    {requirement.duration}
                  </span>
                </p>
              )}
              {requirement.work_timings && (
                <p>
                  <span className="font-medium text-gray-600 dark:text-gray-400">
                    Work Timings:
                  </span>{" "}
                  <span className="text-gray-900 dark:text-white">
                    {requirement.work_timings}
                  </span>
                </p>
              )}
              {(requirement.urgency || requirement.joining_preference) && (
                <p>
                  <span className="font-medium text-gray-600 dark:text-gray-400">
                    Joining:
                  </span>{" "}
                  <span className="text-gray-900 dark:text-white">
                    {requirement.joining_preference || requirement.urgency}
                  </span>
                </p>
              )}
            </div>

            {/* Skills */}
            <div className="mt-4">
              <span className="font-medium text-gray-600 dark:text-gray-400 text-sm">
                Skills:
              </span>
              <div className="flex flex-wrap gap-1 mt-1">
                {(requirement.skills_mandatory || []).map((skill, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300 rounded-full text-xs"
                  >
                    {typeof skill === "string" ? skill : skill?.name || skill}
                  </span>
                ))}
                {(requirement.skills_good_to_have || []).map((skill, i) => (
                  <span
                    key={`gth-${i}`}
                    className="px-2 py-0.5 bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded-full text-xs"
                  >
                    {typeof skill === "string" ? skill : skill?.name || skill}
                  </span>
                ))}
              </div>
            </div>

            {/* Job Description */}
            {(requirement.description || requirement.jd_text) && (
              <div className="mt-4">
                <span className="font-medium text-gray-600 dark:text-gray-400 text-sm">
                  Job Description:
                </span>
                <p className="mt-1 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg whitespace-pre-wrap">
                  {requirement.jd_text || requirement.description}
                </p>
              </div>
            )}

            {/* Notes for Recruiter */}
            {requirement.notes_for_recruiter && (
              <div className="mt-4">
                <span className="font-medium text-gray-600 dark:text-gray-400 text-sm">
                  Notes for Recruiter:
                </span>
                <p className="mt-1 text-sm text-gray-700 dark:text-gray-300 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg border border-amber-200 dark:border-amber-800">
                  {requirement.notes_for_recruiter}
                </p>
              </div>
            )}
          </div>
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Assignments
              </h3>
              <button
                className="text-sm text-blue-600 dark:text-blue-400"
                onClick={() => setAssignOpen(true)}
              >
                Assign Recruiter
              </button>
            </div>
            <div className="mt-3 space-y-2 text-sm">
              {assignments.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400">
                  No recruiters assigned
                </p>
              ) : (
                assignments.map((a) => (
                  <div
                    key={a.id}
                    className="border border-gray-200 dark:border-gray-700 rounded p-2"
                  >
                    <p className="font-medium text-gray-900 dark:text-white">
                      {a.recruiter_name || "Recruiter"}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Assigned: {new Date(a.assigned_at).toLocaleDateString()}
                    </p>
                    {a.notes && (
                      <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                        {a.notes}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="flex gap-2 mb-4">
            {[
              { key: "submissions", label: "Recruiter Submissions" },
              { key: "client", label: "Sent to Client" },
              { key: "interviews", label: "Interview Stage" },
              { key: "closed", label: "Closed" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-3 py-2 rounded text-sm font-medium ${
                  activeTab === tab.key
                    ? "bg-purple-600 text-white"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === "submissions" && (
            <div className="space-y-3">
              {recruiterSubmissions.length === 0 ? (
                <p className="text-gray-500">No submissions yet.</p>
              ) : (
                recruiterSubmissions.map((s) => {
                  const callNote = latestNote(s.notes, "call_feedback");
                  return (
                    <div key={s.id} className="border rounded-lg p-4">
                      <div className="flex justify-between">
                        <div>
                          <p className="font-semibold">
                            {s.candidate_name || "Candidate"}
                          </p>
                          <p className="text-xs text-gray-500">
                            Match: {s.match_score || 0}%
                          </p>
                        </div>
                        <StageBadge stage={s.stage} />
                      </div>
                      {callNote && (
                        <div className="mt-3 bg-gray-50 p-3 rounded text-sm">
                          <p className="font-medium">Recruiter Call Feedback</p>
                          <p className="text-xs text-gray-500">
                            Rating: {callNote.rating || "—"}
                          </p>
                          <p className="mt-1">{callNote.free_text}</p>
                        </div>
                      )}
                      <div className="mt-4 flex flex-wrap gap-2">
                        {s.stage === "recruiter_review" ||
                        s.stage === "sent_to_am" ? (
                          <>
                            <button
                              className="px-3 py-1 bg-blue-600 text-white rounded text-xs"
                              onClick={() =>
                                updateStage(s.id, "am_shortlisted")
                              }
                            >
                              AM Shortlist
                            </button>
                            <button
                              className="px-3 py-1 bg-red-600 text-white rounded text-xs"
                              onClick={() => updateStage(s.id, "am_rejected")}
                            >
                              AM Reject
                            </button>
                          </>
                        ) : null}
                        <button
                          className="px-3 py-1 border rounded text-xs"
                          onClick={() =>
                            openNote(s.id, s.stage, "Add AM Feedback")
                          }
                        >
                          Add AM Feedback
                        </button>
                        {s.stage === "am_shortlisted" && (
                          <button
                            className="px-3 py-1 bg-emerald-600 text-white rounded text-xs"
                            onClick={() => updateStage(s.id, "sent_to_client")}
                          >
                            Send to Client
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {activeTab === "client" && (
            <div className="space-y-3">
              {sentToClient.length === 0 ? (
                <p className="text-gray-500">
                  No candidates sent to client yet.
                </p>
              ) : (
                sentToClient.map((s) => (
                  <div key={s.id} className="border rounded-lg p-4">
                    <div className="flex justify-between">
                      <div>
                        <p className="font-semibold">
                          {s.candidate_name || "Candidate"}
                        </p>
                        <p className="text-xs text-gray-500">
                          Match: {s.match_score || 0}%
                        </p>
                      </div>
                      <StageBadge stage={s.stage} />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {s.stage === "sent_to_client" && (
                        <>
                          <button
                            className="px-3 py-1 bg-emerald-600 text-white rounded text-xs"
                            onClick={() =>
                              updateStage(s.id, "client_shortlisted")
                            }
                          >
                            Client Shortlisted
                          </button>
                          <button
                            className="px-3 py-1 bg-red-600 text-white rounded text-xs"
                            onClick={() => updateStage(s.id, "client_rejected")}
                          >
                            Client Rejected
                          </button>
                        </>
                      )}
                      <button
                        className="px-3 py-1 border rounded text-xs"
                        onClick={() =>
                          openNote(s.id, s.stage, "Add Client Feedback")
                        }
                      >
                        Add Client Feedback
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === "interviews" && (
            <div className="space-y-3">
              {interviewStage.length === 0 ? (
                <p className="text-gray-500">
                  No candidates in interview stage.
                </p>
              ) : (
                interviewStage.map((s) => {
                  const interview = s.interviews?.[0];
                  return (
                    <div key={s.id} className="border rounded-lg p-4">
                      <div className="flex justify-between">
                        <div>
                          <p className="font-semibold">
                            {s.candidate_name || "Candidate"}
                          </p>
                          <p className="text-xs text-gray-500">
                            Match: {s.match_score || 0}%
                          </p>
                        </div>
                        <StageBadge stage={s.stage} />
                      </div>
                      {interview && (
                        <div className="mt-3 text-sm text-gray-600">
                          Scheduled: {interview.interview_date}{" "}
                          {interview.interview_time} ({interview.interview_mode}
                          )
                        </div>
                      )}
                      <div className="mt-4 flex flex-wrap gap-2">
                        {interview && !interview.client_informed && (
                          <button
                            className="px-3 py-1 bg-blue-600 text-white rounded text-xs"
                            onClick={() =>
                              workflowService
                                .markClientInformed(interview.id)
                                .then(fetchDetail)
                            }
                          >
                            Mark Client Informed
                          </button>
                        )}
                        <button
                          className="px-3 py-1 border rounded text-xs"
                          onClick={() =>
                            setDecisionModal({ open: true, submissionId: s.id })
                          }
                        >
                          Enter Final Decision
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {activeTab === "closed" && (
            <div className="space-y-3">
              {closedStage.length === 0 ? (
                <p className="text-gray-500">No closed candidates yet.</p>
              ) : (
                closedStage.map((s) => (
                  <div key={s.id} className="border rounded-lg p-4">
                    <div className="flex justify-between">
                      <div>
                        <p className="font-semibold">
                          {s.candidate_name || "Candidate"}
                        </p>
                        <p className="text-xs text-gray-500">Final Stage</p>
                      </div>
                      <StageBadge stage={s.stage} />
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {assignOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Assign Recruiters</h3>
              <button
                className="text-gray-500"
                onClick={() => setAssignOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-auto border rounded p-2">
              {recruiters.map((recruiter) => (
                <label
                  key={recruiter.id}
                  className="flex items-center gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={assignSelection.includes(recruiter.id)}
                    onChange={() =>
                      setAssignSelection((prev) =>
                        prev.includes(recruiter.id)
                          ? prev.filter((id) => id !== recruiter.id)
                          : [...prev, recruiter.id],
                      )
                    }
                  />
                  {recruiter.full_name || recruiter.email}
                </label>
              ))}
            </div>
            <textarea
              className="w-full p-2 border rounded mt-3"
              placeholder="Notes for recruiter"
              value={assignNotes}
              onChange={(e) => setAssignNotes(e.target.value)}
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                className="px-4 py-2 border rounded"
                onClick={() => setAssignOpen(false)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-purple-600 text-white rounded"
                onClick={handleAssign}
              >
                Assign
              </button>
            </div>
          </div>
        </div>
      )}

      {noteModal.open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">{noteModal.title}</h3>
              <button
                className="text-gray-500"
                onClick={() =>
                  setNoteModal({
                    open: false,
                    submissionId: null,
                    stage: "",
                    title: "",
                  })
                }
              >
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
                  value={noteFields.rating}
                  onChange={(e) =>
                    setNoteFields((prev) => ({
                      ...prev,
                      rating: Number(e.target.value),
                    }))
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium">Strengths</label>
                <input
                  className="w-full p-2 border rounded"
                  value={noteFields.strengths}
                  onChange={(e) =>
                    setNoteFields((prev) => ({
                      ...prev,
                      strengths: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium">Concerns</label>
                <input
                  className="w-full p-2 border rounded"
                  value={noteFields.concerns}
                  onChange={(e) =>
                    setNoteFields((prev) => ({
                      ...prev,
                      concerns: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium">Notes</label>
                <textarea
                  className="w-full p-2 border rounded min-h-[80px]"
                  value={noteFields.free_text}
                  onChange={(e) =>
                    setNoteFields((prev) => ({
                      ...prev,
                      free_text: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                className="px-4 py-2 border rounded"
                onClick={() =>
                  setNoteModal({
                    open: false,
                    submissionId: null,
                    stage: "",
                    title: "",
                  })
                }
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded"
                onClick={submitNote}
              >
                Save Note
              </button>
            </div>
          </div>
        </div>
      )}

      {decisionModal.open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Final Decision</h3>
              <button
                className="text-gray-500"
                onClick={() =>
                  setDecisionModal({ open: false, submissionId: null })
                }
              >
                Close
              </button>
            </div>
            <label className="text-sm font-medium">Decision</label>
            <select
              className="w-full p-2 border rounded mt-1"
              value={decisionStage}
              onChange={(e) => setDecisionStage(e.target.value)}
            >
              <option value="selected">Selected</option>
              <option value="rejected">Rejected</option>
              <option value="negotiation">Negotiation</option>
              <option value="hired">Hired</option>
              <option value="offer_declined">Offer Declined</option>
            </select>
            <label className="text-sm font-medium mt-3 block">Notes</label>
            <textarea
              className="w-full p-2 border rounded min-h-[80px]"
              value={decisionNote}
              onChange={(e) => setDecisionNote(e.target.value)}
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                className="px-4 py-2 border rounded"
                onClick={() =>
                  setDecisionModal({ open: false, submissionId: null })
                }
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-emerald-600 text-white rounded"
                onClick={submitDecision}
              >
                Save Decision
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
