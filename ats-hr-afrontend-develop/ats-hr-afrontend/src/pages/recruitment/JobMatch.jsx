// src/pages/recruitment/JobMatch.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { matchCandidates, getJob, createJobSubmission } from "../../services/jobService";
import CandidateCard from "../../components/candidates/CandidateCard";

export default function JobMatch() {
  const { id: jobId } = useParams(); // route: /recruitment/jobs/:id/match
  const navigate = useNavigate();
  const [matches, setMatches] = useState([]);
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [promotingId, setPromotingId] = useState(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    // fetch job basic to show context (if getJob exists)
    getJob(jobId)
      .then((r) => {
        if (!mounted) return;
        // normalize: backend might return job in r.data or r.data.data
        const jobData = r.data?.data ?? r.data ?? null;
        setJob(jobData);
      })
      .catch(() => { /* ignore */ })
      .finally(() => mounted && setLoading(false));
    return () => (mounted = false);
  }, [jobId]);

  const runMatch = async () => {
    setRunning(true);
    setError("");
    try {
      const res = await matchCandidates(jobId);
      // expect an array of objects { candidate_id, full_name, fit_score, resume_url, ... }
      const data = res.data ?? [];
      setMatches(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setError("Failed to run matching");
    } finally {
      setRunning(false);
    }
  };

  useEffect(() => {
    // run match on mount; optional: comment out if you prefer manual trigger
    runMatch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  const handlePromote = async (candidate) => {
    const candidateId = candidate.candidate_id ?? candidate.id;

    if (!candidateId) {
      alert("Candidate id not available");
      return;
    }

    if (!confirm(`Promote ${candidate.full_name || 'candidate'} to submission for this job?`)) return;

    setPromotingId(candidateId);
    try {
      await createJobSubmission(jobId, candidateId);
      alert("Candidate promoted to submission. Check Submissions page.");
      // optional: navigate to submissions page or refresh matches/submissions
      // navigate(`/recruitment/jobs/${jobId}/submissions`);
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.detail || "Failed to promote candidate");
    } finally {
      setPromotingId(null);
    }
  };

  return (
    <div className="page-container">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>Matches for Job {job?.title ?? jobId}</h2>
        <div>
          <button onClick={() => navigate(`/recruitment/jobs/${jobId}`)}>Back to Job</button>
          <button onClick={runMatch} disabled={running} style={{ marginLeft: 8 }}>
            {running ? "Running..." : "Run Match"}
          </button>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      <div style={{ marginTop: 12 }}>
        {matches.length === 0 ? (
          <div>No matches returned yet.</div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {matches.map((m) => {
              const cid = m.candidate_id ?? m.public_id ?? m.id;
              return (
                <div key={cid} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <CandidateCard
                    candidate={{
                      id: cid,
                      public_id: m.public_id,
                      full_name: m.full_name,
                      email: m.email,
                      phone: m.phone
                    }}
                  />
                  <div style={{ minWidth: 180 }}>
                    <div>Fit score: {typeof m.fit_score === "number" ? m.fit_score.toFixed(2) : m.fit_score}</div>
                    {m.resume_url && (
                      <div style={{ marginTop: 8 }}>
                        <a href={m.resume_url} target="_blank" rel="noreferrer">View Resume</a>
                      </div>
                    )}
                    <div style={{ marginTop: 8 }}>
                      <button
                        onClick={() => handlePromote(m)}
                        disabled={promotingId === cid}
                      >
                        {promotingId === cid ? "Promoting..." : "Promote to Submission"}
                      </button>
                      <button
                        onClick={() => {
                          window.open(`/candidates/${cid}`, "_blank");
                        }}
                        style={{ marginLeft: 8 }}
                      >
                        View Profile
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
