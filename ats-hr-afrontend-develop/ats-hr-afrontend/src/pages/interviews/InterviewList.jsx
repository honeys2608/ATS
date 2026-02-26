import React from "react";

export default function InterviewList({ interviews, onView, onStatusChange }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2 border">Job</th>
            <th className="p-2 border">Candidate</th>
            <th className="p-2 border">Type</th>
            <th className="p-2 border">Scheduled Time</th>
            <th className="p-2 border">Status</th>
            <th className="p-2 border">Actions</th>
          </tr>
        </thead>
        <tbody>
          {interviews.map((iv) => (
            <tr key={iv.id}>
              <td className="border p-2">{iv.jobName}</td>
              <td className="border p-2">{iv.candidateName}</td>
              <td className="border p-2">{iv.type}</td>
              <td className="border p-2">{iv.scheduledTimeFormatted}</td>
              <td className="border p-2">{iv.status}</td>
              <td className="border p-2">
                <button
                  className="text-blue-600 mr-2"
                  onClick={() => onView(iv.id)}
                >
                  View
                </button>
                <select
                  value={iv.status}
                  onChange={(e) => onStatusChange(iv.id, e.target.value)}
                  className="border rounded px-1 py-0.5 text-xs"
                >
                  <option>Scheduled</option>
                  <option>Completed</option>
                  <option>Cancelled</option>
                  <option>Rescheduled</option>
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
