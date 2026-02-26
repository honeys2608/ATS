import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "../api/axios";

export default function CandidateInterviews() {
  const { id } = useParams();
  const [interviews, setInterviews] = useState([]);
  const [candidate, setCandidate] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCandidateData();
  }, [id]);

  const loadCandidateData = async () => {
    try {
      const [candidateRes, interviewRes] = await Promise.all([
        axios.get(`/v1/candidates/${id}`),
        axios.get(`/v1/interviews?candidate_id=${id}`)
      ]);

      setCandidate(candidateRes.data);
      setInterviews(interviewRes.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const statusColor = (status) => {
    return {
      scheduled: "bg-yellow-100 text-yellow-800",
      in_progress: "bg-blue-100 text-blue-800",
      completed: "bg-green-100 text-green-800",
    }[status] || "bg-gray-100 text-gray-800";
  };

  if (loading) return <p className="p-6">Loading...</p>;

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-2">
        Interviews for {candidate?.name}
      </h1>
      <p className="text-gray-600 mb-6">{candidate?.email}</p>

      {interviews.length === 0 && (
        <p className="text-gray-600">No interviews found for this candidate.</p>
      )}

      <div className="space-y-4">
        {interviews.map((i) => (
          <div key={i.id} className="p-4 bg-white rounded shadow flex justify-between">
            <div>
              <p className="font-semibold">{i.job?.title}</p>
              <p className="text-gray-600">
                {new Date(i.scheduled_at).toLocaleString()}
              </p>
            </div>

            <span className={`px-3 py-1 rounded ${statusColor(i.status)}`}>
              {i.status}
            </span>

            <Link
              to={`/interviews/${i.id}`}
              className="bg-blue-600 text-white px-4 py-2 rounded"
            >
              View
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
