import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  Search,
  Filter,
  AlertCircle,
  Loader,
  Eye,
  Send,
  Mail,
  X,
} from "lucide-react";
import {
  searchCandidates,
  getCandidateById,
} from "../../services/candidateService";
import api from "../../api/axios";
import { normalizeText, validateFeatureName } from "../../utils/recruiterValidations";

export default function ResdexSearchResumes() {
  const location = useLocation();
  const [searchForm, setSearchForm] = useState({
    keyword: "",
    logic: "OR",
    min_exp: "",
    max_exp: "",
    location: "",
  });

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedResults, setSelectedResults] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [totalResults, setTotalResults] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [savingSearch, setSavingSearch] = useState(false);
  const [showSaveInline, setShowSaveInline] = useState(false);
  const [saveName, setSaveName] = useState("");
  const resultsPerPage = 20;

  // Candidate Profile Modal
  const [showModal, setShowModal] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);

  // Send Invite
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteCandidate, setInviteCandidate] = useState(null);
  const [inviteMessage, setInviteMessage] = useState("");
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState(null);

  const hasFilters = useMemo(() => {
    return (
      searchForm.keyword ||
      searchForm.min_exp ||
      searchForm.max_exp ||
      searchForm.location
    );
  }, [searchForm]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.size === 0) return;

    const form = {
      keyword: params.get("keyword") || "",
      logic: params.get("logic") || "OR",
      min_exp: params.get("min_exp") || "",
      max_exp: params.get("max_exp") || "",
      location: params.get("location") || "",
    };
    setSearchForm(form);
    runSearch(form);
  }, [location.search]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setSearchForm((prev) => ({ ...prev, [name]: value }));
  };

  const runSearch = async (overrideForm, page = 1) => {
    const form = overrideForm || searchForm;
    try {
      setIsLoading(true);
      setError(null);

      const params = {
        keyword: form.keyword || undefined,
        logic: form.logic,
        min_exp: form.min_exp ? parseFloat(form.min_exp) : undefined,
        max_exp: form.max_exp ? parseFloat(form.max_exp) : undefined,
        location: form.location || undefined,
        limit: resultsPerPage,
        offset: (page - 1) * resultsPerPage,
      };

      const response = await searchCandidates(params);

      const transformedResults = response.results.map((candidate) => ({
        id: candidate.id,
        name: candidate.name,
        email: candidate.email,
        phone: candidate.phone,
        experience: candidate.experience || 0,
        location: candidate.location || "Not specified",
        skills: Array.isArray(candidate.skills)
          ? candidate.skills
          : typeof candidate.skills === "string"
            ? candidate.skills.split(",").map((s) => s.trim())
            : [],
        salary: candidate.salary || 0,
        profileMatch: 85,
        designation: candidate.designation,
        employer: candidate.employer,
        resume_url: candidate.resume_url,
        status: candidate.status,
      }));

      setSearchResults(transformedResults);
      setTotalResults(response.total);
      setCurrentPage(page);
      setHasSearched(true);
      setSelectedResults([]);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Failed to search candidates. Please try again.",
      );
      setSearchResults([]);
      setTotalResults(0);
      setHasSearched(true);
    } finally {
      setIsLoading(false);
    }
  };

  const totalPages = Math.max(
    1,
    Math.ceil(totalResults / resultsPerPage),
  );

  const handleSelectCandidate = (id) => {
    setSelectedResults((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  };

  const handleSelectAll = () => {
    if (selectedResults.length === searchResults.length) {
      setSelectedResults([]);
    } else {
      setSelectedResults(searchResults.map((r) => r.id));
    }
  };

  const openCandidateProfile = async (candidateId) => {
    try {
      setModalLoading(true);
      setShowModal(true);
      const res = await getCandidateById(candidateId);
      setSelectedCandidate(res);
    } catch (err) {
      setSelectedCandidate(null);
    } finally {
      setModalLoading(false);
    }
  };

  const handleSendInvite = (candidateId, candidateName) => {
    setInviteCandidate({ id: candidateId, name: candidateName });
    setShowInviteModal(true);
  };

  const handleSaveSearch = async () => {
    const trimmedSaveName = normalizeText(saveName);
    const saveNameError = validateFeatureName(trimmedSaveName, "Search name");
    if (saveNameError) {
      setError(saveNameError);
      return;
    }
    try {
      setSavingSearch(true);
      await api.post("/v1/resdex/saved-search", {
        name: trimmedSaveName,
        query: normalizeText(searchForm.keyword),
        logic: searchForm.logic,
        min_exp: searchForm.min_exp || null,
        max_exp: searchForm.max_exp || null,
        location: normalizeText(searchForm.location) || null,
      });
      setSaveName("");
      setShowSaveInline(false);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Failed to save search. Please try again.",
      );
    } finally {
      setSavingSearch(false);
    }
  };

  const submitInvite = async () => {
    if (!inviteCandidate) return;

    try {
      setInviteSending(true);
      const res = await api.post("/v1/resdex/invite", {
        candidate_id: inviteCandidate.id,
        message: inviteMessage,
      });

      setInviteSuccess(res.data?.message || "Invite sent successfully!");
      setInviteMessage("");

      setTimeout(() => {
        setShowInviteModal(false);
        setInviteSuccess(null);
        setInviteCandidate(null);
      }, 1800);
    } catch (err) {
      setInviteSuccess({
        error:
          err.response?.data?.detail || err.message || "Failed to send invite",
      });
    } finally {
      setInviteSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* LEFT PANEL - FILTERS */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              Search Candidates
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Keyword
                </label>
                <input
                  type="text"
                  name="keyword"
                  value={searchForm.keyword}
                  onChange={handleInputChange}
                  placeholder="Skills, name, company..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Search across name, skills, company, and resume
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Search Logic
                </label>
                <div className="flex items-center gap-4 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="logic"
                      value="AND"
                      checked={searchForm.logic === "AND"}
                      onChange={handleInputChange}
                    />
                    AND
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="logic"
                      value="OR"
                      checked={searchForm.logic === "OR"}
                      onChange={handleInputChange}
                    />
                    OR
                  </label>
                </div>
              </div>

              <button
                onClick={() => setShowAdvanced((v) => !v)}
                className="text-sm text-purple-600 font-semibold flex items-center gap-1"
              >
                <Filter size={14} />
                Advanced Filters
              </button>

              {showAdvanced && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Min Experience
                    </label>
                    <input
                      type="number"
                      name="min_exp"
                      value={searchForm.min_exp}
                      onChange={handleInputChange}
                      placeholder="0"
                      min="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Max Experience
                    </label>
                    <input
                      type="number"
                      name="max_exp"
                      value={searchForm.max_exp}
                      onChange={handleInputChange}
                      placeholder="50"
                      min="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Location
                    </label>
                    <input
                      type="text"
                      name="location"
                      value={searchForm.location}
                      onChange={handleInputChange}
                      placeholder="e.g., Bangalore"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>
              )}

              <button
                onClick={() => runSearch(searchForm, 1)}
                disabled={isLoading}
                className="w-full bg-purple-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-purple-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader size={16} className="animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search size={16} />
                    Search
                  </>
                )}
              </button>

              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Save this search for later use</span>
                <button
                  type="button"
                  onClick={() => setShowSaveInline((v) => !v)}
                  className="text-purple-600 font-semibold"
                >
                  {showSaveInline ? "Cancel" : "Save Search"}
                </button>
              </div>

              {showSaveInline && (
                <div className="space-y-2">
                  <input
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    onBlur={(e) => setSaveName(normalizeText(e.target.value))}
                    placeholder="Search name..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <button
                    onClick={handleSaveSearch}
                    disabled={savingSearch}
                    className="w-full bg-indigo-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-indigo-700 transition disabled:opacity-50"
                  >
                    {savingSearch ? "Saving..." : "Save"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT PANEL - RESULTS */}
        <div className="lg:col-span-3">
          {!hasSearched ? (
            <div className="bg-white rounded-lg shadow-sm p-12 text-center">
              <Search size={48} className="mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Start Searching
              </h3>
              <p className="text-gray-600">
                Use the filters on the left to search for candidates matching
                your criteria
              </p>
            </div>
          ) : isLoading ? (
            <div className="bg-white rounded-lg shadow-sm p-12 text-center">
              <Loader
                size={48}
                className="mx-auto text-purple-400 mb-4 animate-spin"
              />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Searching Candidates
              </h3>
              <p className="text-gray-600">
                Please wait while we search the database...
              </p>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <div className="flex items-start gap-3">
                <AlertCircle
                  size={24}
                  className="text-red-600 flex-shrink-0 mt-0.5"
                />
                <div>
                  <h3 className="font-semibold text-red-900 mb-1">
                    Search Error
                  </h3>
                  <p className="text-red-700">{error}</p>
                  <button
                    onClick={() => runSearch()}
                    className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            </div>
          ) : searchResults.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-12 text-center">
              <Search size={48} className="mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No Results Found
              </h3>
              <p className="text-gray-600 mb-4">
                No candidates match your search criteria. Try adjusting your
                filters.
              </p>
              {hasFilters && (
                <button
                  onClick={() => {
                    setSearchForm({
                      keyword: "",
                      logic: "OR",
                      min_exp: "",
                      max_exp: "",
                      location: "",
                    });
                    setHasSearched(false);
                  }}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition"
                >
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-white rounded-lg shadow-sm p-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    Search Results
                  </h3>
                  <p className="text-sm text-gray-600">
                    Found {searchResults.length} of {totalResults} candidates
                  </p>
                </div>
                <button
                  onClick={handleSelectAll}
                  className="px-3 py-2 text-sm font-semibold text-purple-600 hover:bg-purple-50 rounded-lg transition"
                >
                  {selectedResults.length === searchResults.length
                    ? "Deselect All"
                    : "Select All"}
                </button>
              </div>

              <div className="flex items-center justify-between text-sm text-gray-600">
                <span>
                  Page {currentPage} of {totalPages}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => runSearch(searchForm, Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1 || isLoading}
                    className="px-3 py-1 border rounded disabled:opacity-50"
                  >
                    Prev
                  </button>
                  <button
                    onClick={() =>
                      runSearch(searchForm, Math.min(totalPages, currentPage + 1))
                    }
                    disabled={currentPage === totalPages || isLoading}
                    className="px-3 py-1 border rounded disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {searchResults.map((candidate) => (
                  <div
                    key={candidate.id}
                    className="bg-white rounded-lg shadow-sm p-5 border border-gray-100"
                  >
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={selectedResults.includes(candidate.id)}
                          onChange={() => handleSelectCandidate(candidate.id)}
                        />
                        <div>
                          <h4 className="text-lg font-semibold text-gray-900">
                            {candidate.name}
                          </h4>
                          <p className="text-sm text-gray-600">
                            {candidate.designation || "Role not specified"} · {candidate.experience} years
                          </p>
                          <p className="text-sm text-gray-600">
                            {candidate.location} · {candidate.email}
                          </p>
                          {candidate.skills.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {candidate.skills.slice(0, 6).map((skill) => (
                                <span
                                  key={skill}
                                  className="px-2 py-1 bg-purple-50 text-purple-700 text-xs rounded-full"
                                >
                                  {skill}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openCandidateProfile(candidate.id)}
                          className="px-3 py-2 text-sm font-semibold text-gray-700 border rounded-lg hover:bg-gray-50 flex items-center gap-2"
                        >
                          <Eye size={14} />
                          View
                        </button>
                        <button
                          onClick={() => handleSendInvite(candidate.id, candidate.name)}
                          className="px-3 py-2 text-sm font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-700 flex items-center gap-2"
                        >
                          <Send size={14} />
                          NVite
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Candidate Profile Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-lg font-semibold">Candidate Profile</h3>
              <button onClick={() => setShowModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="p-6">
              {modalLoading ? (
                <div className="text-center text-gray-600">Loading...</div>
              ) : selectedCandidate ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700">
                  <div>
                    <span className="font-semibold">Name:</span>{" "}
                    {selectedCandidate.full_name ||
                      selectedCandidate.name ||
                      "—"}
                  </div>
                  <div>
                    <span className="font-semibold">Email:</span>{" "}
                    {selectedCandidate.email || "—"}
                  </div>
                  <div>
                    <span className="font-semibold">Phone:</span>{" "}
                    {selectedCandidate.phone || "—"}
                  </div>
                  <div>
                    <span className="font-semibold">Date of Birth:</span>{" "}
                    {selectedCandidate.dob ||
                      selectedCandidate.date_of_birth ||
                      "—"}
                  </div>
                  <div>
                    <span className="font-semibold">Current Location:</span>{" "}
                    {selectedCandidate.current_location ||
                      selectedCandidate.currentLocation ||
                      "—"}
                  </div>
                  <div>
                    <span className="font-semibold">City:</span>{" "}
                    {selectedCandidate.city || "—"}
                  </div>
                  <div>
                    <span className="font-semibold">Pincode:</span>{" "}
                    {selectedCandidate.pincode || "—"}
                  </div>
                  <div>
                    <span className="font-semibold">Current Address:</span>{" "}
                    {selectedCandidate.current_address ||
                      selectedCandidate.currentAddress ||
                      "—"}
                  </div>
                  <div>
                    <span className="font-semibold">Permanent Address:</span>{" "}
                    {selectedCandidate.permanent_address ||
                      selectedCandidate.permanentAddress ||
                      "—"}
                  </div>
                  <div>
                    <span className="font-semibold">Applied Job:</span>{" "}
                    {selectedCandidate.job_title || "—"}
                  </div>
                  <div>
                    <span className="font-semibold">Classification:</span>{" "}
                    {selectedCandidate.classification || "—"}
                  </div>
                  <div>
                    <span className="font-semibold">Source:</span>{" "}
                    {selectedCandidate.source || "—"}
                  </div>
                  <div>
                    <span className="font-semibold">Referral:</span>{" "}
                    {selectedCandidate.referral || "—"}
                  </div>
                  <div>
                    <span className="font-semibold">Skills:</span>{" "}
                    {Array.isArray(selectedCandidate.skills)
                      ? selectedCandidate.skills.join(", ")
                      : selectedCandidate.skills || "—"}
                  </div>
                  <div>
                    <span className="font-semibold">Experience (years):</span>{" "}
                    {selectedCandidate.experience_years ||
                      selectedCandidate.experience ||
                      "—"}
                  </div>
                  <div>
                    <span className="font-semibold">Education:</span>{" "}
                    {selectedCandidate.education || "—"}
                  </div>
                  <div>
                    <span className="font-semibold">Current Employer:</span>{" "}
                    {selectedCandidate.current_employer ||
                      selectedCandidate.currentEmployer ||
                      "—"}
                  </div>
                  <div>
                    <span className="font-semibold">Previous Employers:</span>{" "}
                    {selectedCandidate.previous_employers ||
                      selectedCandidate.previousEmployers ||
                      "—"}
                  </div>
                  <div>
                    <span className="font-semibold">Notice Period:</span>{" "}
                    {selectedCandidate.notice_period ||
                      selectedCandidate.noticePeriod ||
                      "—"}
                  </div>
                  <div>
                    <span className="font-semibold">Expected CTC:</span>{" "}
                    {selectedCandidate.expected_salary ||
                      selectedCandidate.expectedCtc ||
                      "—"}
                  </div>
                  <div>
                    <span className="font-semibold">Preferred Location:</span>{" "}
                    {selectedCandidate.preferred_location ||
                      selectedCandidate.preferredLocation ||
                      "—"}
                  </div>
                  <div>
                    <span className="font-semibold">Languages Known:</span>{" "}
                    {selectedCandidate.languages_known ||
                      selectedCandidate.languagesKnown ||
                      "—"}
                  </div>
                  <div>
                    <span className="font-semibold">Ready to Relocate:</span>{" "}
                    {selectedCandidate.ready_to_relocate !== undefined
                      ? selectedCandidate.ready_to_relocate
                        ? "Yes"
                        : "No"
                      : selectedCandidate.readyToRelocate !== undefined
                        ? selectedCandidate.readyToRelocate
                          ? "Yes"
                          : "No"
                        : "—"}
                  </div>
                  <div>
                    <span className="font-semibold">LinkedIn:</span>{" "}
                    {selectedCandidate.linkedin_url ||
                      selectedCandidate.linkedinUrl ||
                      "—"}
                  </div>
                  <div>
                    <span className="font-semibold">GitHub:</span>{" "}
                    {selectedCandidate.github_url ||
                      selectedCandidate.githubUrl ||
                      "—"}
                  </div>
                </div>
              ) : (
                <div className="text-center text-gray-600">No data found.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-lg font-semibold">Send NVite</h3>
              <button onClick={() => setShowInviteModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="p-6">
              {inviteSuccess ? (
                <div className="text-center">
                  {inviteSuccess.error ? (
                    <p className="text-red-600">{inviteSuccess.error}</p>
                  ) : (
                    <p className="text-green-600">{inviteSuccess}</p>
                  )}
                </div>
              ) : (
                <>
                  <p className="text-sm text-gray-600 mb-3">
                    Candidate: {inviteCandidate?.name}
                  </p>
                  <textarea
                    value={inviteMessage}
                    onChange={(e) => setInviteMessage(e.target.value)}
                    placeholder="Add a personal message..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    rows="4"
                  />
                  <div className="flex gap-2 pt-4">
                    <button
                      onClick={() => setShowInviteModal(false)}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-semibold text-gray-900 hover:bg-gray-50 transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={submitInvite}
                      disabled={inviteSending}
                      className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {inviteSending ? (
                        <>
                          <Loader size={16} className="animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Mail size={16} />
                          Send Invite
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
