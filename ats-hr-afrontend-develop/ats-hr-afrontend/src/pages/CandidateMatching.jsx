import React, { useEffect, useState } from "react";
import axios from "../api/axios";
import useCandidateMatching from "../hooks/useCandidateMatching";
import MatchCard from "../components/matching/MatchCard";

export default function CandidateMatching() {
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState("");

  const { loading, matches, error, getMatches } = useCandidateMatching();

  useEffect(() => {
    axios
      .get("/v1/jobs")
      .then((res) => setJobs(res.data || []))
      .catch((err) => console.error("Failed to load jobs", err));
  }, []);

  const handleMatch = () => {
    if (!selectedJob) return;
    getMatches(selectedJob);
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Candidate Matching</h1>

      <div className="bg-white p-4 rounded shadow mb-6">
        <label className="block text-sm font-medium mb-2">Select Job</label>
        <select
          className="w-full p-2 border rounded"
          value={selectedJob}
          onChange={(e) => setSelectedJob(e.target.value)}
        >
          <option value="">Choose a job</option>
          {jobs.map((job) => (
            <option key={job.id} value={job.id}>
              {job.title}
            </option>
          ))}
        </select>

        <button
          onClick={handleMatch}
          disabled={!selectedJob}
          className="mt-4 bg-indigo-600 text-white px-4 py-2 rounded"
        >
          {loading ? "Matching..." : "Find Matches"}
        </button>
      </div>

      {error && <p className="text-red-600 mb-4">{error}</p>}

      <div className="grid grid-cols-1 gap-4">
        {matches.map((match, idx) => (
          <MatchCard key={idx} match={match} />
        ))}
      </div>

      {!loading && matches.length === 0 && selectedJob && (
        <p className="text-gray-500">No matching candidates found.</p>
      )}
    </div>
  );
}
