import React, { useState, useEffect } from "react";
import { apiService } from "@/api/axios";
import { Search, Loader, AlertCircle } from "lucide-react";

/**
 * CandidatePoolSelector Component
 *
 * Shows a filtered list of candidates from the pool with:
 * - Name, email, phone
 * - Skills (comma-separated)
 * - Years of experience
 * - Current status
 * - Selection checkbox
 *
 * Props:
 * - onSelectCandidate(candidate) - Called when candidate is selected
 * - excludeCandidateIds - Array of candidate IDs to exclude
 * - limit - Maximum candidates to show (default: 50)
 */

export default function CandidatePoolSelector({
  onSelectCandidate,
  excludeCandidateIds = [],
  limit = 50,
}) {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedCandidateId, setSelectedCandidateId] = useState(null);

  // Fetch candidates from pool
  useEffect(() => {
    const fetchCandidates = async () => {
      try {
        setLoading(true);
        const response = await apiService.get("/api/candidates", {
          params: {
            page: 1,
            limit: limit,
          },
        });

        // Filter out excluded candidates
        let filteredCandidates = (
          response.data.data ||
          response.data ||
          []
        ).filter((c) => !excludeCandidateIds.includes(c.id));

        setCandidates(filteredCandidates);
        setError(null);
      } catch (err) {
        console.error("Failed to fetch candidates:", err);
        setError("Failed to load candidate pool");
        setCandidates([]);
      } finally {
        setLoading(false);
      }
    };

    fetchCandidates();
  }, [excludeCandidateIds, limit]);

  // Filter candidates based on search and status
  const filteredCandidates = candidates.filter((candidate) => {
    const matchesSearch =
      !searchTerm ||
      candidate.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      candidate.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      candidate.skills?.some((skill) =>
        skill.toLowerCase().includes(searchTerm.toLowerCase()),
      );

    const matchesStatus =
      filterStatus === "all" || candidate.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  const handleSelectCandidate = (candidate) => {
    setSelectedCandidateId(candidate.id);
    onSelectCandidate(candidate);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader className="animate-spin text-blue-500" size={32} />
        <span className="ml-3 text-gray-600">Loading candidate pool...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
        <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
        <div>
          <p className="font-semibold text-red-800">{error}</p>
          <p className="text-sm text-red-700 mt-1">Please try again later.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Filter Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Search Input */}
        <div className="relative md:col-span-2">
          <Search className="absolute left-3 top-3 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search by name, email, or skills..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Status Filter */}
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Statuses</option>
          <option value="new">New</option>
          <option value="sourced">Sourced</option>
          <option value="screening">Screening</option>
          <option value="screened">Screened</option>
          <option value="applied">Applied</option>
        </select>
      </div>

      {/* Candidate List */}
      <div className="space-y-2 max-h-[500px] overflow-y-auto">
        {filteredCandidates.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p className="font-medium">No candidates found</p>
            <p className="text-sm">Try adjusting your search or filters</p>
          </div>
        ) : (
          filteredCandidates.map((candidate) => (
            <div
              key={candidate.id}
              onClick={() => handleSelectCandidate(candidate)}
              className={`p-4 border rounded-lg cursor-pointer transition-all ${
                selectedCandidateId === candidate.id
                  ? "bg-blue-50 border-blue-500 ring-2 ring-blue-200"
                  : "bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm"
              }`}
            >
              {/* Candidate Info Row */}
              <div className="flex items-start gap-4">
                {/* Selection Radio */}
                <div className="flex-shrink-0 mt-1">
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      selectedCandidateId === candidate.id
                        ? "border-blue-500 bg-blue-500"
                        : "border-gray-300"
                    }`}
                  >
                    {selectedCandidateId === candidate.id && (
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                    )}
                  </div>
                </div>

                {/* Candidate Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <h3 className="font-semibold text-gray-900">
                      {candidate.full_name}
                    </h3>
                    <span className="text-sm px-2 py-1 bg-gray-100 text-gray-700 rounded">
                      {candidate.status || "new"}
                    </span>
                  </div>

                  {/* Contact Info */}
                  <p className="text-sm text-gray-600 mt-1">
                    {candidate.email}
                    {candidate.phone_number && (
                      <>
                        {" "}
                        •{" "}
                        <span className="text-gray-500">
                          {candidate.phone_number}
                        </span>
                      </>
                    )}
                  </p>

                  {/* Experience */}
                  <p className="text-sm text-gray-700 mt-2">
                    <span className="font-medium">Experience:</span>{" "}
                    {candidate.experience_years || 0} years
                  </p>

                  {/* Skills */}
                  {candidate.skills && candidate.skills.length > 0 && (
                    <div className="mt-2">
                      <p className="text-sm text-gray-700 font-medium mb-1">
                        Skills:
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {candidate.skills.slice(0, 5).map((skill, idx) => (
                          <span
                            key={idx}
                            className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded"
                          >
                            {skill}
                          </span>
                        ))}
                        {candidate.skills.length > 5 && (
                          <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
                            +{candidate.skills.length - 5} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer Info */}
      <div className="text-sm text-gray-500 text-center pt-2">
        Showing {filteredCandidates.length} of {candidates.length} candidates
      </div>
    </div>
  );
}
