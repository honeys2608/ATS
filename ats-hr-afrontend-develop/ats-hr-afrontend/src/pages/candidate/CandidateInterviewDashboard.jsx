import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "../../api/axios";

export default function CandidateInterviewDashboard() {
  const navigate = useNavigate();
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedInterview, setSelectedInterview] = useState(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackData, setFeedbackData] = useState({
    rating: 5,
    experience_feedback: "",
    ease_of_use: 5,
    comments: "",
  });

  const normalizeStatus = (status) => {
    const raw = String(status || "")
      .toLowerCase()
      .replace(/\s+/g, "_");
    if (raw === "interview_scheduled" || raw === "interview") return "scheduled";
    return raw;
  };

  const formatStatus = (status) => {
    switch (normalizeStatus(status)) {
      case "interview_scheduled":
        return "Interview Scheduled";
      case "in_progress":
        return "Interview In Progress";
      case "completed":
        return "Interview Completed";
      case "scheduled":
        return "Interview Scheduled";
      case "cancelled":
        return "Cancelled";
      case "no_show":
        return "No-show";
      default:
        return status || "Unknown";
    }
  };

  useEffect(() => {
    loadCandidateInterviews();
  }, []);

  async function loadCandidateInterviews() {
    try {
      setLoading(true);
      const res = await axios.get("/v1/interviews");
      setInterviews(res.data || []);
    } catch (err) {
      console.error("Failed to load interviews", err);
    } finally {
      setLoading(false);
    }
  }

  async function submitFeedback() {
    if (!selectedInterview) return;

    try {
      await axios.post(
        `/v1/interviews/${selectedInterview.id}/feedback`,
        feedbackData,
      );
      alert("Thank you for your feedback!");
      setShowFeedbackModal(false);
      setFeedbackData({
        rating: 5,
        experience_feedback: "",
        ease_of_use: 5,
        comments: "",
      });
      loadCandidateInterviews();
    } catch (err) {
      alert("Failed to submit feedback: " + err.response?.data?.detail);
    }
  }

  async function joinInterview(interview) {
    try {
      await axios.post(`/v1/interviews/${interview.id}/join`);
    } catch (err) {
      console.error("Join interview failed", err);
    }
  }

  const getRemainingTime = (scheduledAt) => {
    const now = new Date();
    const scheduled = new Date(scheduledAt);
    const diff = scheduled - now;

    if (diff < 0) return "Interview passed";

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `in ${days} day${days !== 1 ? "s" : ""}`;
    }
    return `in ${hours}h ${minutes}m`;
  };

  const getStatusBadge = (status) => {
    const statusStyles = {
      scheduled: "bg-yellow-100 text-yellow-800",
      in_progress: "bg-blue-100 text-blue-800",
      completed: "bg-green-100 text-green-800",
      cancelled: "bg-red-100 text-red-800",
      no_show: "bg-red-100 text-red-800",
    };
    return statusStyles[normalizeStatus(status)] || "bg-gray-100 text-gray-800";
  };

  const formatDateTime = (value) => {
    if (!value) return "Not Scheduled";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Not Scheduled";
    return date.toLocaleString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const withinStartWindow = (scheduledAt) => {
    if (!scheduledAt) return false;
    const date = new Date(scheduledAt);
    if (Number.isNaN(date.getTime())) return false;
    const now = new Date();
    const earlyMs = 15 * 60 * 1000;
    const graceMs = 30 * 60 * 1000;
    return (
      now.getTime() >= date.getTime() - earlyMs &&
      now.getTime() <= date.getTime() + graceMs
    );
  };

  const isExpiredWindow = (scheduledAt) => {
    if (!scheduledAt) return false;
    const date = new Date(scheduledAt);
    if (Number.isNaN(date.getTime())) return false;
    const now = new Date();
    const graceMs = 30 * 60 * 1000;
    return now.getTime() > date.getTime() + graceMs;
  };

  const [startLoadingId, setStartLoadingId] = useState(null);
  const [modal, setModal] = useState(null);

  const handleStart = async (interview) => {
    setStartLoadingId(interview.id);
    try {
      await axios.post(`/v1/interviews/${interview.id}/start`);
      navigate(`/interviews/${interview.id}`);
    } catch (error) {
      const msg =
        error?.response?.data?.detail ||
        "Your interview is not available yet.";
      setModal({
        title: "Interview Not Available",
        message: msg,
        scheduledAt: interview.scheduled_at,
      });
    } finally {
      setStartLoadingId(null);
    }
  };

  const getTypeIcon = (type) => {
    const icons = {
      ai_chat: "💬",
      video: "📹",
      in_person: "👤",
    };
    return icons[type] || "📋";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-xl text-gray-600">Loading your interviews...</p>
      </div>
    );
  }

  return (
    <div className="candidate-interviews p-6 bg-gray-50 min-h-screen">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            My Interviews
          </h1>
          <p className="text-gray-600">
            View and manage your scheduled interviews
          </p>
        </div>

        {interviews.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <p className="text-gray-600 text-lg mb-4">
              No interviews scheduled yet
            </p>
            <p className="text-gray-500">
              You will see your scheduled interviews here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {interviews.map((interview) => (
              <div
                key={interview.id}
                className="bg-white rounded-lg shadow-md hover:shadow-lg transition p-6"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {/* Interview Type & Status */}
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-3xl">
                        {getTypeIcon(interview.mode)}
                      </span>
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">
                          {interview.submission?.job?.title || "Interview"}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {interview.mode?.replace(/_/g, " ")} Interview
                        </p>
                      </div>
                    </div>

                    {/* Interview Details */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 my-4">
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase">
                          Scheduled Date
                        </p>
                        <p className="text-gray-900 font-semibold">
                          {new Date(
                            interview.scheduled_at,
                          ).toLocaleDateString()}
                        </p>
                        <p className="text-sm text-gray-600">
                          {new Date(interview.scheduled_at).toLocaleTimeString(
                            [],
                            {
                              hour: "2-digit",
                              minute: "2-digit",
                            },
                          )}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase">
                          Status
                        </p>
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${getStatusBadge(
                            interview.status,
                          )} mt-1`}
                        >
                          {formatStatus(interview.status)}
                        </span>
                      </div>

                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase">
                          Time Left
                        </p>
                        <p className="text-gray-900 font-semibold">
                          {getRemainingTime(interview.scheduled_at)}
                        </p>
                      </div>

                      {interview.mode === "video" && interview.meeting_link && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase">
                            Meeting Link
                          </p>
                          <a
                            href={interview.meeting_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-700 font-semibold break-all"
                          >
                            Join Meeting →
                          </a>
                        </div>
                      )}

                      {interview.mode === "in_person" &&
                        (interview.location || interview.notes) && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase">
                            Location
                          </p>
                          <p className="text-gray-900 font-semibold">
                            {interview.location || interview.notes}
                          </p>
                          {interview.contact_person && (
                            <p className="text-xs text-gray-600 mt-1">
                              Contact: {interview.contact_person}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Interview Notes */}
                    {interview.notes && interview.mode !== "in_person" && (
                      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 my-4 rounded">
                        <p className="text-xs font-semibold text-blue-700 uppercase">
                          Instructions
                        </p>
                        <p className="text-gray-700 mt-1">{interview.notes}</p>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="ml-4 flex flex-col gap-2">
                    {normalizeStatus(interview.status) === "scheduled" && (() => {
                      const scheduledAt = interview.scheduled_at
                        ? new Date(interview.scheduled_at)
                        : null;
                      const now = new Date();
                      const isTooEarly =
                        scheduledAt &&
                        !withinStartWindow(interview.scheduled_at) &&
                        now.getTime() < scheduledAt.getTime();
                      const isExpired =
                        scheduledAt && isExpiredWindow(interview.scheduled_at);
                      const disabled = isTooEarly || isExpired;
                      const label = isTooEarly
                        ? `Starts on ${formatDateTime(interview.scheduled_at)}`
                        : isExpired
                        ? "Interview Window Expired"
                        : "Start Interview";

                      return (
                      <>
                        {interview.mode === "ai_chat" && (
                          <button
                            onClick={async () => {
                              if (disabled) return;
                              await handleStart(interview);
                            }}
                            className={`px-4 py-2 font-semibold rounded-lg transition whitespace-nowrap ${
                              disabled
                                ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                                : "bg-green-600 text-white hover:bg-green-700"
                            }`}
                          >
                            {startLoadingId === interview.id
                              ? "Checking interview availability..."
                              : label}
                          </button>
                        )}
                        {interview.mode === "video" && (
                          <a
                            href={disabled ? undefined : interview.meeting_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => {
                              if (disabled) return;
                              joinInterview(interview);
                            }}
                            className={`px-4 py-2 font-semibold rounded-lg transition text-center ${
                              disabled
                                ? "bg-gray-300 text-gray-600 cursor-not-allowed pointer-events-none"
                                : "bg-blue-600 text-white hover:bg-blue-700"
                            }`}
                          >
                            {label}
                          </a>
                        )}
                        {interview.mode === "in_person" && (
                          <button
                            onClick={() => {
                              if (disabled) return;
                              joinInterview(interview);
                            }}
                            className={`px-4 py-2 font-semibold rounded-lg transition whitespace-nowrap ${
                              disabled
                                ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                                : "bg-blue-600 text-white hover:bg-blue-700"
                            }`}
                          >
                            {label}
                          </button>
                        )}
                      </>
                      );
                    })()}

                    {normalizeStatus(interview.status) === "in_progress" &&
                      interview.mode === "ai_chat" && (
                        <button
                          onClick={() => navigate(`/interviews/${interview.id}`)}
                          className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition whitespace-nowrap"
                        >
                          Resume Interview
                        </button>
                      )}

                    {normalizeStatus(interview.status) === "completed" &&
                      !interview.feedback && (
                        <button
                          onClick={() => {
                            setSelectedInterview(interview);
                            setShowFeedbackModal(true);
                          }}
                          className="px-4 py-2 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition whitespace-nowrap"
                        >
                          Give Feedback
                        </button>
                      )}

                    {interview.feedback && (
                      <button
                        onClick={() => {
                          setSelectedInterview(interview);
                          setShowFeedbackModal(true);
                        }}
                        className="px-4 py-2 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-700 transition whitespace-nowrap"
                      >
                        View Feedback
                      </button>
                    )}

                    <button
                      onClick={() => setSelectedInterview(interview)}
                      className="px-4 py-2 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition whitespace-nowrap"
                    >
                      Details
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Feedback Modal */}
        {showFeedbackModal && selectedInterview && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
              <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6 text-white flex justify-between items-center">
                <h2 className="text-xl font-bold">Interview Feedback</h2>
                <button
                  onClick={() => {
                    setShowFeedbackModal(false);
                    setSelectedInterview(null);
                  }}
                  className="text-2xl hover:text-gray-200"
                >
                  ✕
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  submitFeedback();
                }}
                className="p-6 space-y-4"
              >
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    How would you rate this interview? (1-5)
                  </label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() =>
                          setFeedbackData({ ...feedbackData, rating: star })
                        }
                        className={`text-3xl transition ${
                          feedbackData.rating >= star
                            ? "text-yellow-400"
                            : "text-gray-300"
                        }`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Your Experience Feedback
                  </label>
                  <textarea
                    value={feedbackData.experience_feedback}
                    onChange={(e) =>
                      setFeedbackData({
                        ...feedbackData,
                        experience_feedback: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                    placeholder="Tell us about your interview experience..."
                    rows="3"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Ease of Use of Portal (1-5)
                  </label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() =>
                          setFeedbackData({
                            ...feedbackData,
                            ease_of_use: star,
                          })
                        }
                        className={`text-3xl transition ${
                          feedbackData.ease_of_use >= star
                            ? "text-blue-400"
                            : "text-gray-300"
                        }`}
                      >
                        ◆
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Additional Comments
                  </label>
                  <textarea
                    value={feedbackData.comments}
                    onChange={(e) =>
                      setFeedbackData({
                        ...feedbackData,
                        comments: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                    placeholder="Any additional feedback..."
                    rows="2"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700"
                  >
                    Submit Feedback
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowFeedbackModal(false);
                      setSelectedInterview(null);
                    }}
                    className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-400"
                  >
                    Close
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {modal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-bold mb-2">{modal.title}</h3>
              <p className="text-sm text-gray-600 mb-4">{modal.message}</p>
              {modal.scheduledAt && (
                <div className="text-sm text-gray-700 mb-4">
                  Available from:{" "}
                  <span className="font-semibold">
                    {formatDateTime(modal.scheduledAt)}
                  </span>
                </div>
              )}
              <div className="flex justify-end">
                <button
                  onClick={() => setModal(null)}
                  className="px-4 py-2 bg-gray-800 text-white rounded"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
