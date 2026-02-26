import React, { useEffect, useState } from "react";
import { formatDate } from "../../utils/dateFormatter";
import { useParams } from "react-router-dom";
import api from "../../api/axios";
import { formatStatus } from "../../utils/formatStatus";

export default function RecruiterSubmissions() {
  const { jobId } = useParams();

  const [loading, setLoading] = useState(true);
  const [submissions, setSubmissions] = useState([]);

  const loadSubmissions = async () => {
    try {
      const res = await api.get(`/v1/am/recruiter-submissions`, {
        params: { job_id: jobId },
      });

      setSubmissions(res.data.submissions || []);
    } catch (err) {
      console.error("Failed to load submissions:", err);
      alert("Failed to fetch recruiter submissions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubmissions();
  }, []);

  if (loading) return <h2>Loading...</h2>;

  return (
    <div className="p-6 bg-white shadow rounded">
      <h2 className="text-2xl font-bold mb-4">
        Recruiter Submissions – Job: {jobId}
      </h2>

      {!submissions.length ? (
        <p>No submissions found</p>
      ) : (
        <table className="w-full border">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-2 border">Candidate</th>
              <th className="p-2 border">Email</th>
              <th className="p-2 border">Status</th>
              <th className="p-2 border">Fit Score</th>
              <th className="p-2 border">Submitted</th>
            </tr>
          </thead>

          <tbody>
            {submissions.map((s) => (
              <tr key={s.application_id}>
                <td className="border p-2">{s.candidate_name}</td>
                <td className="border p-2">{s.email}</td>
                <td className="border p-2">{formatStatus(s.status)}</td>
                <td className="border p-2">{s.fit_score || "N/A"}</td>
                <td className="border p-2">{formatDate(s.submitted_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
