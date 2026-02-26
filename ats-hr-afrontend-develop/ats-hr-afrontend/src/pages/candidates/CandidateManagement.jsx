/**
 * Comprehensive Candidate Management Page
 * View profiles, upload resumes, manage notes and timeline
 */

import React, { useState, useEffect } from "react";
import axios from "../../api/axios";
import { useNavigate } from "react-router-dom";

function CandidateCard({ candidate, onSelect, onViewProfile }) {
  const getStatusColor = (status) => {
    switch (status) {
      case "shortlisted":
        return "bg-green-100 text-green-700";
      case "rejected":
        return "bg-red-100 text-red-700";
      case "interview":
        return "bg-blue-100 text-blue-700";
      case "offer":
        return "bg-purple-100 text-purple-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <div
      onClick={() => onSelect(candidate.id)}
      className="bg-white border rounded-lg p-4 cursor-pointer hover:shadow-lg transition"
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1">
          <h3 className="font-bold text-gray-900">
            {candidate.full_name || "Unknown"}
          </h3>
          <p className="text-sm text-gray-600">
            {candidate.current_employer || "Not specified"}
          </p>
        </div>
        <span
          className={`px-2 py-1 text-xs rounded-full font-medium ${getStatusColor(candidate.status)}`}
        >
          {candidate.status || "active"}
        </span>
      </div>

      <div className="text-sm text-gray-600 mb-3 space-y-1">
        <p>📧 {candidate.email || "No email"}</p>
        <p>📍 {candidate.current_location || "Location unknown"}</p>
        <p>💼 {candidate.experience_years || 0} years experience</p>
        <p>
          🎯 Skills:{" "}
          {candidate.skills?.slice(0, 2).join(", ") || "Not specified"}
        </p>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onViewProfile(candidate.id);
        }}
        className="w-full bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-2 rounded text-sm font-medium"
      >
        View Full Profile →
      </button>
    </div>
  );
}

function CandidateDetailView({ candidate, onClose, onSaveNotes }) {
  const [notes, setNotes] = useState(candidate?.notes || "");
  const [tags, setTags] = useState(candidate?.tags || []);
  const [newTag, setNewTag] = useState("");
  const [saving, setSaving] = useState(false);

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag("");
    }
  };

  const handleRemoveTag = (tag) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await onSaveNotes(candidate.id, { notes, tags });
      alert("Saved successfully!");
    } catch (err) {
      alert("Failed to save: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b p-6 flex justify-between items-center">
          <h2 className="text-xl font-bold">
            {candidate?.full_name || "Candidate"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* BASIC INFO */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-600 font-semibold">Email</p>
              <p className="text-gray-900">{candidate?.email || "N/A"}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 font-semibold">Phone</p>
              <p className="text-gray-900">{candidate?.phone || "N/A"}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 font-semibold">Location</p>
              <p className="text-gray-900">
                {candidate?.current_location || "N/A"}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-600 font-semibold">Experience</p>
              <p className="text-gray-900">
                {candidate?.experience_years || 0} years
              </p>
            </div>
          </div>

          {/* RESUME VIEWER */}
          {candidate?.resume_url && (
            <div>
              <p className="text-xs text-gray-600 font-semibold mb-2">Resume</p>
              <iframe
                src={candidate.resume_url}
                className="w-full h-64 border border-gray-200 rounded"
                title="Resume"
              />
              <a
                href={candidate.resume_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline text-sm mt-2 inline-block"
              >
                📥 Download Resume
              </a>
            </div>
          )}

          {/* SKILLS */}
          <div>
            <p className="text-xs text-gray-600 font-semibold mb-2">Skills</p>
            <div className="flex flex-wrap gap-2">
              {candidate?.skills?.map((skill, idx) => (
                <span
                  key={idx}
                  className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm"
                >
                  {skill}
                </span>
              ))}
              {!candidate?.skills?.length && (
                <span className="text-gray-500">No skills listed</span>
              )}
            </div>
          </div>

          {/* TAGS */}
          <div>
            <p className="text-xs text-gray-600 font-semibold mb-2">Tags</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {tags.map((tag, idx) => (
                <div
                  key={idx}
                  className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm flex items-center gap-2"
                >
                  {tag}
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="hover:font-bold"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleAddTag()}
                placeholder="Add tag..."
                className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleAddTag}
                className="bg-gray-200 hover:bg-gray-300 px-3 py-2 rounded text-sm font-medium"
              >
                Add
              </button>
            </div>
          </div>

          {/* INTERNAL NOTES */}
          <div>
            <label className="text-xs text-gray-600 font-semibold block mb-2">
              Internal Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add screening notes, feedback, or internal observations..."
              className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 h-40"
            />
          </div>

          {/* ACTIVITY TIMELINE */}
          <div>
            <p className="text-xs text-gray-600 font-semibold mb-2">
              Activity Timeline
            </p>
            <div className="space-y-2">
              <div className="flex gap-4 text-sm">
                <div className="text-gray-500 min-w-fit">Applied on</div>
                <div className="text-gray-900">
                  {candidate?.application_date
                    ? new Date(candidate.application_date).toLocaleDateString()
                    : "N/A"}
                </div>
              </div>
              <div className="flex gap-4 text-sm">
                <div className="text-gray-500 min-w-fit">Joined on</div>
                <div className="text-gray-900">
                  {candidate?.created_at
                    ? new Date(candidate.created_at).toLocaleDateString()
                    : "N/A"}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-gray-50 border-t p-6 flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 font-medium"
          >
            Close
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CandidateManagement() {
  const navigate = useNavigate();
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [skillFilter, setSkillFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [experienceFilter, setExperienceFilter] = useState("all");

  useEffect(() => {
    loadCandidates();
  }, []);

  const loadCandidates = async () => {
    try {
      setLoading(true);
      const res = await axios.get("/v1/candidates");
      setCandidates(Array.isArray(res.data) ? res.data : res.data?.data || []);
    } catch (err) {
      console.error("Failed to load candidates:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNotes = async (candidateId, data) => {
    try {
      await axios.put(`/v1/candidates/${candidateId}`, data);
      setCandidates(
        candidates.map((c) => (c.id === candidateId ? { ...c, ...data } : c)),
      );
    } catch (err) {
      throw err;
    }
  };

  const filteredCandidates = candidates.filter((candidate) => {
    const matchesSearch =
      candidate.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      candidate.email?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || candidate.status === statusFilter;

    const matchesExperience =
      experienceFilter === "all" ||
      (experienceFilter === "junior" && candidate.experience_years < 3) ||
      (experienceFilter === "mid" &&
        candidate.experience_years >= 3 &&
        candidate.experience_years < 7) ||
      (experienceFilter === "senior" && candidate.experience_years >= 7);

    const matchesSkill =
      !skillFilter ||
      candidate.skills?.some((s) =>
        s.toLowerCase().includes(skillFilter.toLowerCase()),
      );

    return matchesSearch && matchesStatus && matchesExperience && matchesSkill;
  });

  if (loading)
    return <div className="p-6 text-center">Loading candidates...</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* HEADER */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">
          Candidate Management
        </h1>
        <p className="text-gray-600 mt-1">
          View, manage and evaluate candidates
        </p>
      </div>

      {/* FILTERS */}
      <div className="bg-white p-4 rounded-lg shadow mb-6 space-y-4">
        <div className="flex gap-4 flex-wrap">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name or email..."
            className="flex-1 min-w-64 border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="shortlisted">Shortlisted</option>
            <option value="interview">Interview</option>
            <option value="offer">Offer</option>
            <option value="rejected">Rejected</option>
          </select>

          <select
            value={experienceFilter}
            onChange={(e) => setExperienceFilter(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Experience</option>
            <option value="junior">Junior (&lt;3y)</option>
            <option value="mid">Mid (3-7y)</option>
            <option value="senior">Senior (7y+)</option>
          </select>

          <input
            type="text"
            value={skillFilter}
            onChange={(e) => setSkillFilter(e.target.value)}
            placeholder="Filter by skill..."
            className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <button
            onClick={() => {
              setSearchTerm("");
              setStatusFilter("all");
              setExperienceFilter("all");
              setSkillFilter("");
            }}
            className="border border-gray-300 text-gray-700 rounded px-3 py-2 text-sm hover:bg-gray-50 font-medium"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* CANDIDATES GRID */}
      {filteredCandidates.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCandidates.map((candidate) => (
            <CandidateCard
              key={candidate.id}
              candidate={candidate}
              onSelect={setSelectedCandidate}
              onViewProfile={(id) => navigate(`/candidate/${id}`)}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white p-12 rounded-lg text-center">
          <p className="text-gray-600 text-lg">No candidates found</p>
          <p className="text-gray-400 text-sm mt-2">
            Try adjusting your filters
          </p>
        </div>
      )}

      {/* DETAIL MODAL */}
      {selectedCandidate && (
        <CandidateDetailView
          candidate={selectedCandidate}
          onClose={() => setSelectedCandidate(null)}
          onSaveNotes={handleSaveNotes}
        />
      )}

      {/* RESULTS INFO */}
      <div className="mt-6 text-sm text-gray-600">
        Showing {filteredCandidates.length} of {candidates.length} candidates
      </div>
    </div>
  );
}
