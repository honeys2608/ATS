import React from "react";

export default function ReadyForAssignmentCard({
  application,
  onAssignConsultant,
  onRecordDirectHire,
}) {
  const candidateName =
    application.candidate_name || application.consultant_name || "—";
  const jobTitle = application.job_title || application.title || "—";
  const clientName = application.client_name || application.clientName || "—";
  const isHiredByClient = application.client_decision === "hired_by_client";

  return (
    <div className="border rounded-lg p-4 shadow-sm bg-white flex justify-between items-center">
      {/* LEFT */}
      <div>
        <h3 className="text-lg font-semibold">{candidateName}</h3>

        <p className="text-sm text-gray-600">{jobTitle}</p>

        <p className="text-sm text-gray-500">Client: {clientName}</p>

        {application.job_id && (
          <p className="text-xs uppercase tracking-wide text-gray-400">
            Job ID: {application.job_id}
          </p>
        )}

        <p className="text-sm text-gray-500">
          Email: {application.email || "—"}
        </p>

        <div className="flex flex-wrap gap-2 mt-2">
          <span className="inline-block px-2 py-1 text-xs bg-green-100 text-green-700 rounded">
            Ready for Assignment
          </span>
          {isHiredByClient && (
            <span className="inline-block px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded">
              Hired by Client
            </span>
          )}
        </div>
      </div>

      {/* RIGHT */}
      <div className="flex flex-col gap-2">
        <button
          onClick={() => onAssignConsultant(application)}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          {application.consultant_id ? "Assign Task" : "Convert & Assign"}
        </button>
        {onRecordDirectHire && (
          <button
            onClick={() => onRecordDirectHire(application)}
            className="bg-violet-600 text-white px-4 py-2 rounded hover:bg-violet-700"
          >
            Close as Direct Hire
          </button>
        )}
      </div>
    </div>
  );
}
