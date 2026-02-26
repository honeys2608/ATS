import React from "react";

export default function InterviewDetail({
  interview,
  onStatusChange,
  onFeedback,
}) {
  if (!interview) return null;
  return (
    <div className="max-w-xl mx-auto bg-white p-6 rounded shadow">
      <h2 className="text-xl font-bold mb-2">Interview Details</h2>
      <div className="mb-2">
        <b>Job:</b> {interview.jobName}
      </div>
      <div className="mb-2">
        <b>Candidate:</b> {interview.candidateName}
      </div>
      <div className="mb-2">
        <b>Type:</b> {interview.type}
      </div>
      <div className="mb-2">
        <b>Scheduled Time:</b> {interview.scheduledTimeFormatted}
      </div>
      <div className="mb-2">
        <b>Status:</b> {interview.status}
      </div>
      {interview.type === "Video Interview" && (
        <div className="mb-2">
          <b>Meeting Link:</b>{" "}
          <a
            href={interview.meetingLink}
            className="text-blue-600 underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Join
          </a>
        </div>
      )}
      {interview.type === "In-Person Interview" && (
        <div className="mb-2">
          <b>Address:</b> {interview.address}
        </div>
      )}
      <div className="mb-2">
        <b>Notes:</b> {interview.notes}
      </div>
      <div className="mb-2">
        <b>Update Status:</b>
        <select
          value={interview.status}
          onChange={(e) => onStatusChange(interview.id, e.target.value)}
          className="border rounded px-2 py-1 ml-2"
        >
          <option>Scheduled</option>
          <option>Completed</option>
          <option>Cancelled</option>
          <option>Rescheduled</option>
        </select>
      </div>
      {interview.status === "Completed" && (
        <div className="mt-4">
          <b>Recruiter Feedback:</b>
          <textarea
            className="border rounded px-2 py-1 w-full mt-1"
            value={interview.feedback || ""}
            onChange={(e) => onFeedback(interview.id, e.target.value)}
          />
        </div>
      )}
    </div>
  );
}
