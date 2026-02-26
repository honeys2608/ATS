/**
 * Screening & Shortlisting Page
 * Review candidates and make shortlist/reject decisions
 */

import React, { useState, useEffect } from "react";
import axios from "../../api/axios";

function ScreeningCard({ candidate, job, onShortlist, onReject, onSkip }) {
  const [loading, setLoading] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [screeningNotes, setScreeningNotes] = useState("");

  const handleShortlist = async () => {
    try {
      setLoading(true);
      await onShortlist(candidate.id, screeningNotes);
      setScreeningNotes("");
      setShowNotes(false);
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!window.confirm("Are you sure you want to reject this candidate?"))
      return;
    try {
      setLoading(true);
      await onReject(candidate.id, screeningNotes);
      setScreeningNotes("");
      setShowNotes(false);
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const getSkillMatch = () => {
    if (!candidate.skills || !job?.required_skills) return 0;
    const matches = candidate.skills.filter((s) =>
      job.required_skills.some((js) => js.toLowerCase() === s.toLowerCase()),
    ).length;
    return Math.round((matches / job.required_skills.length) * 100);
  };

  const getExperienceMatch = () => {
    if (!job?.min_experience || !candidate.experience_years) return 0;
    const exp = candidate.experience_years;
    const min = job.min_experience;
    const max = job.max_experience || min + 5;
    if (exp < min) return Math.round((exp / min) * 100);
    if (exp > max) return 100;
    return Math.round(((exp - min) / (max - min)) * 100) + 50;
  };

  const skillMatch = getSkillMatch();
  const expMatch = getExperienceMatch();

  return (
    <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full p-6">
      {/* HEADER */}
      <div className="mb-6 pb-4 border-b">
        <h2 className="text-2xl font-bold text-gray-900">
          {candidate.full_name}
        </h2>
        <p className="text-gray-600 mt-1">
          {candidate.current_employer} • {candidate.current_location}
        </p>
        <p className="text-sm text-gray-500 mt-2">
          Applying for: <strong>{job?.title}</strong>
        </p>
      </div>

      {/* CONTACT INFO */}
      <div className="grid grid-cols-2 gap-4 mb-6 pb-4 border-b">
        <div>
          <p className="text-xs text-gray-600 font-semibold">Email</p>
          <p className="text-gray-900">{candidate.email}</p>
        </div>
        <div>
          <p className="text-xs text-gray-600 font-semibold">Phone</p>
          <p className="text-gray-900">{candidate.phone || "N/A"}</p>
        </div>
        <div>
          <p className="text-xs text-gray-600 font-semibold">Experience</p>
          <p className="text-gray-900">{candidate.experience_years} years</p>
        </div>
        <div>
          <p className="text-xs text-gray-600 font-semibold">Location</p>
          <p className="text-gray-900">{candidate.current_location}</p>
        </div>
      </div>

      {/* SKILLS & EXPERIENCE MATCH */}
      <div className="grid grid-cols-2 gap-4 mb-6 pb-4 border-b">
        <div className="bg-blue-50 p-4 rounded-lg">
          <p className="text-xs text-blue-600 font-semibold">SKILL MATCH</p>
          <div className="flex items-center gap-2 mt-2">
            <div className="text-3xl font-bold text-blue-600">
              {skillMatch}%
            </div>
            <div className="flex-1">
              <div className="bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{ width: `${skillMatch}%` }}
                />
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-600 mt-2">
            {candidate.skills?.length || 0} of{" "}
            {job?.required_skills?.length || 0} skills match
          </p>
        </div>

        <div className="bg-green-50 p-4 rounded-lg">
          <p className="text-xs text-green-600 font-semibold">
            EXPERIENCE MATCH
          </p>
          <div className="flex items-center gap-2 mt-2">
            <div className="text-3xl font-bold text-green-600">{expMatch}%</div>
            <div className="flex-1">
              <div className="bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full"
                  style={{ width: `${expMatch}%` }}
                />
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-600 mt-2">
            {candidate.experience_years}y vs {job?.min_experience}y required
          </p>
        </div>
      </div>

      {/* SKILLS DISPLAY */}
      <div className="mb-6 pb-4 border-b">
        <p className="text-xs text-gray-600 font-semibold mb-2">
          CANDIDATE SKILLS
        </p>
        <div className="flex flex-wrap gap-2">
          {candidate.skills?.map((skill, idx) => {
            const isRequired = job?.required_skills?.some(
              (s) => s.toLowerCase() === skill.toLowerCase(),
            );
            return (
              <span
                key={idx}
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  isRequired
                    ? "bg-green-100 text-green-700 border border-green-300"
                    : "bg-gray-100 text-gray-700"
                }`}
              >
                {skill} {isRequired && "✓"}
              </span>
            );
          })}
        </div>
      </div>

      {/* SCORE INPUT */}
      <div className="mb-6 pb-4 border-b">
        <label className="block text-xs text-gray-600 font-semibold mb-2">
          SCREENING SCORE (0-100)
        </label>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min="0"
            max="100"
            defaultValue="50"
            onChange={(e) =>
              setScreeningNotes((prev) => {
                const notes = typeof prev === "object" ? prev : {};
                return { ...notes, score: e.target.value };
              })
            }
            className="flex-1 h-2 bg-gray-200 rounded-lg cursor-pointer"
          />
          <input
            type="number"
            min="0"
            max="100"
            defaultValue="50"
            className="w-20 border border-gray-300 rounded px-3 py-2 text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* NOTES SECTION */}
      <div className="mb-6">
        <button
          onClick={() => setShowNotes(!showNotes)}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium mb-2"
        >
          {showNotes ? "▼" : "▶"} Add Screening Notes
        </button>
        {showNotes && (
          <textarea
            value={screeningNotes}
            onChange={(e) => setScreeningNotes(e.target.value)}
            placeholder="Add your screening observations, concerns, or comments..."
            className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 h-32"
          />
        )}
      </div>

      {/* ACTION BUTTONS */}
      <div className="flex gap-3 justify-end">
        <button
          onClick={() => onSkip()}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 font-medium"
        >
          ⏭ Skip
        </button>
        <button
          onClick={handleReject}
          disabled={loading}
          className="px-4 py-2 border border-red-300 text-red-700 rounded hover:bg-red-50 font-medium disabled:opacity-50"
        >
          ✗ Reject
        </button>
        <button
          onClick={handleShortlist}
          disabled={loading}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-medium disabled:opacity-50"
        >
          {loading ? "Saving..." : "✓ Shortlist"}
        </button>
      </div>

      {/* FIT SCORE DISPLAY */}
      <div className="mt-6 pt-4 border-t">
        <p className="text-xs text-gray-600 font-semibold mb-2">
          OVERALL FIT SCORE
        </p>
        <div className="flex items-center gap-3">
          <div className="text-4xl font-bold text-blue-600">
            {Math.round((skillMatch + expMatch) / 2)}%
          </div>
          <div>
            <p className="text-sm text-gray-900 font-medium">
              {Math.round((skillMatch + expMatch) / 2) >= 75
                ? "Strong Match"
                : Math.round((skillMatch + expMatch) / 2) >= 50
                  ? "Moderate Match"
                  : "Weak Match"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ScreeningUI() {
  const [candidates, setCandidates] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [screeningStats, setScreeningStats] = useState({
    total: 0,
    shortlisted: 0,
    rejected: 0,
    pending: 0,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [jobRes, candRes] = await Promise.all([
        axios.get("/v1/jobs"),
        axios.get("/v1/candidates"),
      ]);
      setJobs(
        Array.isArray(jobRes.data) ? jobRes.data : jobRes.data?.data || [],
      );
      setCandidates(
        Array.isArray(candRes.data) ? candRes.data : candRes.data?.data || [],
      );
    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      setLoading(false);
    }
  };

  const currentCandidate = selectedJob && candidates[currentIdx];
  const filteredCandidates = selectedJob
    ? candidates.filter((c) => c.status === "active")
    : [];

  const handleShortlist = async (candidateId, notes) => {
    try {
      await axios.put(`/v1/candidates/${candidateId}`, {
        status: "shortlisted",
        screening_notes: notes,
      });
      setCandidates(
        candidates.map((c) =>
          c.id === candidateId ? { ...c, status: "shortlisted" } : c,
        ),
      );
      setCurrentIdx(currentIdx + 1);
      setScreeningStats((prev) => ({
        ...prev,
        shortlisted: prev.shortlisted + 1,
        pending: prev.pending - 1,
      }));
    } catch (err) {
      throw err;
    }
  };

  const handleReject = async (candidateId, notes) => {
    try {
      await axios.put(`/v1/candidates/${candidateId}`, {
        status: "rejected",
        screening_notes: notes,
      });
      setCandidates(
        candidates.map((c) =>
          c.id === candidateId ? { ...c, status: "rejected" } : c,
        ),
      );
      setCurrentIdx(currentIdx + 1);
      setScreeningStats((prev) => ({
        ...prev,
        rejected: prev.rejected + 1,
        pending: prev.pending - 1,
      }));
    } catch (err) {
      throw err;
    }
  };

  const handleSkip = () => {
    if (currentIdx + 1 < filteredCandidates.length) {
      setCurrentIdx(currentIdx + 1);
    } else {
      alert("No more candidates to review");
    }
  };

  if (loading) return <div className="p-6 text-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* HEADER */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Screening & Shortlisting
          </h1>
          <p className="text-gray-600 mt-2">Review and evaluate candidates</p>
        </div>

        {/* JOB SELECTOR */}
        {!selectedJob ? (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Select a Job Opening
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {jobs.map((job) => (
                <div
                  key={job.id}
                  onClick={() => {
                    setSelectedJob(job);
                    setCurrentIdx(0);
                    setScreeningStats({
                      total: candidates.filter(
                        (c) =>
                          !c.screened_for_job || c.screened_for_job !== job.id,
                      ).length,
                      shortlisted: 0,
                      rejected: 0,
                      pending: candidates.filter(
                        (c) =>
                          !c.screened_for_job || c.screened_for_job !== job.id,
                      ).length,
                    });
                  }}
                  className="bg-white p-4 rounded-lg shadow cursor-pointer hover:shadow-lg transition"
                >
                  <h3 className="font-bold text-gray-900">{job.title}</h3>
                  <p className="text-gray-600 text-sm">{job.location}</p>
                  <p className="text-blue-600 font-semibold mt-2">
                    {candidates.filter((c) => c.status === "active").length}{" "}
                    candidates to review
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-8">
            {/* STATS BAR */}
            <div className="w-full grid grid-cols-4 gap-4">
              {[
                { label: "Total", value: screeningStats.total, color: "blue" },
                {
                  label: "Pending",
                  value: screeningStats.pending,
                  color: "yellow",
                },
                {
                  label: "Shortlisted",
                  value: screeningStats.shortlisted,
                  color: "green",
                },
                {
                  label: "Rejected",
                  value: screeningStats.rejected,
                  color: "red",
                },
              ].map((stat, idx) => (
                <div
                  key={idx}
                  className={`bg-${stat.color}-50 border-2 border-${stat.color}-200 p-4 rounded-lg`}
                >
                  <p className={`text-${stat.color}-600 text-xs font-semibold`}>
                    {stat.label}
                  </p>
                  <p
                    className={`text-${stat.color}-600 text-2xl font-bold mt-1`}
                  >
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>

            {/* SCREENING CARD */}
            {currentCandidate ? (
              <div className="w-full flex justify-center">
                <ScreeningCard
                  candidate={currentCandidate}
                  job={selectedJob}
                  onShortlist={handleShortlist}
                  onReject={handleReject}
                  onSkip={handleSkip}
                />
              </div>
            ) : (
              <div className="bg-white p-12 rounded-lg text-center max-w-2xl w-full">
                <p className="text-2xl font-bold text-gray-900">
                  Screening Complete!
                </p>
                <p className="text-gray-600 mt-2">
                  All candidates have been reviewed
                </p>
                <button
                  onClick={() => {
                    setSelectedJob(null);
                    setCurrentIdx(0);
                  }}
                  className="mt-4 px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Back to Jobs
                </button>
              </div>
            )}

            {/* PROGRESS */}
            <div className="w-full max-w-2xl">
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>Progress</span>
                <span>
                  {currentIdx + 1} of {filteredCandidates.length}
                </span>
              </div>
              <div className="bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{
                    width: `${((currentIdx + 1) / filteredCandidates.length) * 100}%`,
                  }}
                />
              </div>
            </div>

            {/* BACK BUTTON */}
            <button
              onClick={() => {
                setSelectedJob(null);
                setCurrentIdx(0);
              }}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
            >
              ← Back to Jobs
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
