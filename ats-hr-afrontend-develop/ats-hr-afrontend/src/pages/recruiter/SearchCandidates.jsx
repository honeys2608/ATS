import React, { useEffect, useState } from "react";
import axios from "../../api/axios";
import "./SearchCandidates.css";

export default function SearchCandidates() {
  const [searchForm, setSearchForm] = useState({
    // Client Context
    client_id: "",

    // Keywords
    keywords: "",
    keywords_mandatory: false,
    boolean_search: "OR",
    search_in: "entire_resume",
    exclude_keywords: "",
    it_skills: [],

    // Experience
    min_experience: "",
    max_experience: "",

    // Location
    location: "",
    include_relocate: false,
    exclude_anywhere: false,

    // Salary
    currency: "INR",
    min_salary: "",
    max_salary: "",
    include_no_salary_mention: false,

    // Employment Details
    current_company: "",
    past_companies: "",
    exclude_companies: "",
    industry: "",
    employment_type: "",

    // Education Details
    highest_qualification: "",
    degree: "",
    institute: "",
    graduation_year: "",

    // Diversity Hiring
    gender: "",
    differently_abled: false,
    career_break: false,
    veteran_status: false,

    // Additional Details
    notice_period: "",
    preferred_shift: "",
    work_mode: "",
    candidate_activity_months: 6,
  });

  const [clients, setClients] = useState([]);
  const [recentSearches, setRecentSearches] = useState([]);
  const [savedSearches, setSavedSearches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    employment: false,
    education: false,
    diversity: false,
    additional: false,
  });
  const [itSkillsInput, setItSkillsInput] = useState("");

  useEffect(() => {
    loadInitialData();
  }, []);

  async function loadInitialData() {
    try {
      const [clientsRes, recentRes, savedRes] = await Promise.all([
        axios.get("/v1/clients"),
        axios.get("/v1/searches/recent"),
        axios.get("/v1/searches/saved"),
      ]);
      setClients(clientsRes.data?.data || []);
      setRecentSearches(recentRes.data?.data || []);
      setSavedSearches(savedRes.data?.data || []);
    } catch (err) {
      console.error("Failed to load initial data", err);
    }
  }

  const toggleSection = (section) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSearchForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const addITSkill = () => {
    if (itSkillsInput.trim()) {
      setSearchForm((prev) => ({
        ...prev,
        it_skills: [...prev.it_skills, itSkillsInput.trim()],
      }));
      setItSkillsInput("");
    }
  };

  const removeITSkill = (skill) => {
    setSearchForm((prev) => ({
      ...prev,
      it_skills: prev.it_skills.filter((s) => s !== skill),
    }));
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const response = await axios.post("/v1/candidates/search", searchForm);

      // Save to recent searches
      localStorage.setItem(
        "recentSearches",
        JSON.stringify([searchForm, ...recentSearches.slice(0, 4)]),
      );

      // Redirect to results
      window.location.href = `/recruiter/search-results?id=${response.data.search_id}`;
    } catch (err) {
      alert("Search failed: " + err.response?.data?.detail);
    } finally {
      setLoading(false);
    }
  };

  const fillSearchForm = (search) => {
    setSearchForm(search);
    window.scrollTo(0, 0);
  };

  return (
    <div className="search-candidates min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-6 shadow-lg">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold mb-2">Search Candidates</h1>
          <p className="text-purple-100">
            Find the perfect candidates using advanced filters and criteria
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Search Form */}
          <div className="lg:col-span-2">
            <form
              onSubmit={handleSearch}
              className="bg-white rounded-lg shadow-md p-6 space-y-6"
            >
              {/* Section A: Client / Hiring Context */}
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">
                  Client / Company
                </label>
                <select
                  name="client_id"
                  value={searchForm.client_id}
                  onChange={handleFormChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                >
                  <option value="">Select Client (Optional)</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
                <p className="text-sm text-gray-500 mt-1">
                  💡 Get AI-powered results tailored to your client's needs
                </p>
              </div>

              {/* Section B: Keywords */}
              <div className="border-t pt-6">
                <label className="block text-sm font-bold text-gray-900 mb-3">
                  Keywords
                </label>
                <textarea
                  name="keywords"
                  value={searchForm.keywords}
                  onChange={handleFormChange}
                  placeholder="Skills, designation, company (separate by comma)"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                  rows="3"
                />

                <div className="mt-4 space-y-3">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      name="keywords_mandatory"
                      checked={searchForm.keywords_mandatory}
                      onChange={handleFormChange}
                      className="w-4 h-4 text-purple-600 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">
                      Mark all keywords as mandatory
                    </span>
                  </label>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">
                        Boolean Search
                      </label>
                      <select
                        name="boolean_search"
                        value={searchForm.boolean_search}
                        onChange={handleFormChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                      >
                        <option value="OR">OR (Any match)</option>
                        <option value="AND">AND (All match)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">
                        Search In
                      </label>
                      <select
                        name="search_in"
                        value={searchForm.search_in}
                        onChange={handleFormChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                      >
                        <option value="entire_resume">Entire Resume</option>
                        <option value="skills_only">Skills Only</option>
                        <option value="job_title_only">Job Title Only</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Exclude Keywords
                    </label>
                    <textarea
                      name="exclude_keywords"
                      value={searchForm.exclude_keywords}
                      onChange={handleFormChange}
                      placeholder="Keywords to exclude"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm"
                      rows="2"
                    />
                  </div>

                  {/* IT Skills */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-2">
                      IT Skills (Tag-based)
                    </label>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={itSkillsInput}
                        onChange={(e) => setItSkillsInput(e.target.value)}
                        placeholder="Add IT skill"
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                        onKeyPress={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addITSkill();
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={addITSkill}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-semibold"
                      >
                        Add
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {searchForm.it_skills.map((skill) => (
                        <span
                          key={skill}
                          className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium flex items-center gap-2"
                        >
                          {skill}
                          <button
                            type="button"
                            onClick={() => removeITSkill(skill)}
                            className="text-purple-600 hover:text-purple-900"
                          >
                            ✕
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Section C: Experience */}
              <div className="border-t pt-6">
                <label className="block text-sm font-bold text-gray-900 mb-3">
                  Experience (Years)
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Min Experience
                    </label>
                    <input
                      type="number"
                      name="min_experience"
                      value={searchForm.min_experience}
                      onChange={handleFormChange}
                      placeholder="0"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Max Experience
                    </label>
                    <input
                      type="number"
                      name="max_experience"
                      value={searchForm.max_experience}
                      onChange={handleFormChange}
                      placeholder="50"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                      min="0"
                    />
                  </div>
                </div>
              </div>

              {/* Section D: Location */}
              <div className="border-t pt-6">
                <label className="block text-sm font-bold text-gray-900 mb-3">
                  Current Location
                </label>
                <input
                  type="text"
                  name="location"
                  value={searchForm.location}
                  onChange={handleFormChange}
                  placeholder="City or cities (comma separated)"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none mb-3"
                />

                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      name="include_relocate"
                      checked={searchForm.include_relocate}
                      onChange={handleFormChange}
                      className="w-4 h-4 text-purple-600 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">
                      Include candidates willing to relocate
                    </span>
                  </label>

                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      name="exclude_anywhere"
                      checked={searchForm.exclude_anywhere}
                      onChange={handleFormChange}
                      className="w-4 h-4 text-purple-600 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">
                      Exclude candidates mentioning "Anywhere"
                    </span>
                  </label>
                </div>
              </div>

              {/* Section E: Salary */}
              <div className="border-t pt-6">
                <label className="block text-sm font-bold text-gray-900 mb-3">
                  Annual Salary (Lacs)
                </label>

                <div className="mb-3">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Currency
                  </label>
                  <select
                    name="currency"
                    value={searchForm.currency}
                    onChange={handleFormChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                  >
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Min Salary
                    </label>
                    <input
                      type="number"
                      name="min_salary"
                      value={searchForm.min_salary}
                      onChange={handleFormChange}
                      placeholder="0"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Max Salary
                    </label>
                    <input
                      type="number"
                      name="max_salary"
                      value={searchForm.max_salary}
                      onChange={handleFormChange}
                      placeholder="100"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                      min="0"
                    />
                  </div>
                </div>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    name="include_no_salary_mention"
                    checked={searchForm.include_no_salary_mention}
                    onChange={handleFormChange}
                    className="w-4 h-4 text-purple-600 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    Include candidates who did not mention salary
                  </span>
                </label>
              </div>

              {/* Advanced Sections - Accordion */}

              {/* Employment Details */}
              <AccordionSection
                title="Employment Details"
                expanded={expandedSections.employment}
                onToggle={() => toggleSection("employment")}
              >
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Current Company
                    </label>
                    <input
                      type="text"
                      name="current_company"
                      value={searchForm.current_company}
                      onChange={handleFormChange}
                      placeholder="Company name"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Past Companies
                    </label>
                    <input
                      type="text"
                      name="past_companies"
                      value={searchForm.past_companies}
                      onChange={handleFormChange}
                      placeholder="Companies (comma separated)"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Exclude Companies
                    </label>
                    <input
                      type="text"
                      name="exclude_companies"
                      value={searchForm.exclude_companies}
                      onChange={handleFormChange}
                      placeholder="Companies to exclude"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Industry
                    </label>
                    <input
                      type="text"
                      name="industry"
                      value={searchForm.industry}
                      onChange={handleFormChange}
                      placeholder="Industry"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Employment Type
                    </label>
                    <select
                      name="employment_type"
                      value={searchForm.employment_type}
                      onChange={handleFormChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                    >
                      <option value="">Any</option>
                      <option value="Full-time">Full-time</option>
                      <option value="Part-time">Part-time</option>
                      <option value="Contract">Contract</option>
                      <option value="Freelance">Freelance</option>
                      <option value="Internship">Internship</option>
                    </select>
                  </div>
                </div>
              </AccordionSection>

              {/* Education Details */}
              <AccordionSection
                title="Education Details"
                expanded={expandedSections.education}
                onToggle={() => toggleSection("education")}
              >
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Highest Qualification
                    </label>
                    <select
                      name="highest_qualification"
                      value={searchForm.highest_qualification}
                      onChange={handleFormChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                    >
                      <option value="">Any</option>
                      <option value="10th">10th Pass</option>
                      <option value="12th">12th Pass</option>
                      <option value="Diploma">Diploma</option>
                      <option value="Bachelor">Bachelor's Degree</option>
                      <option value="Master">Master's Degree</option>
                      <option value="PhD">PhD</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Degree
                    </label>
                    <input
                      type="text"
                      name="degree"
                      value={searchForm.degree}
                      onChange={handleFormChange}
                      placeholder="e.g., B.Tech, MBA"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Institute
                    </label>
                    <input
                      type="text"
                      name="institute"
                      value={searchForm.institute}
                      onChange={handleFormChange}
                      placeholder="Institute name"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Graduation Year
                    </label>
                    <input
                      type="number"
                      name="graduation_year"
                      value={searchForm.graduation_year}
                      onChange={handleFormChange}
                      placeholder="YYYY"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                  </div>
                </div>
              </AccordionSection>

              {/* Diversity Hiring */}
              <AccordionSection
                title="Diversity Hiring"
                expanded={expandedSections.diversity}
                onToggle={() => toggleSection("diversity")}
              >
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Gender
                    </label>
                    <select
                      name="gender"
                      value={searchForm.gender}
                      onChange={handleFormChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                    >
                      <option value="">Any</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Non-binary">Non-binary</option>
                      <option value="Prefer not to say">
                        Prefer not to say
                      </option>
                    </select>
                  </div>

                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      name="differently_abled"
                      checked={searchForm.differently_abled}
                      onChange={handleFormChange}
                      className="w-4 h-4 text-purple-600 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">
                      Differently-abled candidates
                    </span>
                  </label>

                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      name="career_break"
                      checked={searchForm.career_break}
                      onChange={handleFormChange}
                      className="w-4 h-4 text-purple-600 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">
                      Candidates with career break
                    </span>
                  </label>

                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      name="veteran_status"
                      checked={searchForm.veteran_status}
                      onChange={handleFormChange}
                      className="w-4 h-4 text-purple-600 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">
                      Veteran status
                    </span>
                  </label>
                </div>
              </AccordionSection>

              {/* Additional Details */}
              <AccordionSection
                title="Additional Details"
                expanded={expandedSections.additional}
                onToggle={() => toggleSection("additional")}
              >
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Notice Period
                    </label>
                    <select
                      name="notice_period"
                      value={searchForm.notice_period}
                      onChange={handleFormChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                    >
                      <option value="">Any</option>
                      <option value="0">Immediate</option>
                      <option value="7">7 days</option>
                      <option value="15">15 days</option>
                      <option value="30">30 days</option>
                      <option value="60">60 days</option>
                      <option value="90">90 days</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Preferred Shift
                    </label>
                    <select
                      name="preferred_shift"
                      value={searchForm.preferred_shift}
                      onChange={handleFormChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                    >
                      <option value="">Any</option>
                      <option value="Day">Day Shift</option>
                      <option value="Night">Night Shift</option>
                      <option value="Flexible">Flexible</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Work Mode
                    </label>
                    <select
                      name="work_mode"
                      value={searchForm.work_mode}
                      onChange={handleFormChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                    >
                      <option value="">Any</option>
                      <option value="Remote">Remote</option>
                      <option value="Hybrid">Hybrid</option>
                      <option value="On-site">On-site</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Candidate Activity
                    </label>
                    <select
                      name="candidate_activity_months"
                      value={searchForm.candidate_activity_months}
                      onChange={handleFormChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                    >
                      <option value="1">Active in last 1 month</option>
                      <option value="3">Active in last 3 months</option>
                      <option value="6">Active in last 6 months</option>
                      <option value="12">Active in last 12 months</option>
                      <option value="0">Any</option>
                    </select>
                  </div>
                </div>
              </AccordionSection>

              {/* Submit Button */}
              <div className="border-t pt-6">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold rounded-lg hover:from-purple-700 hover:to-blue-700 transition disabled:opacity-50"
                >
                  {loading ? "Searching..." : "🔍 Search Candidates"}
                </button>
              </div>
            </form>
          </div>

          {/* Right Panel - Saved & Recent Searches */}
          <div className="lg:col-span-1">
            {/* Saved Searches */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-6 sticky top-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                📌 Saved Searches
              </h3>

              {savedSearches.length > 0 ? (
                <div className="space-y-3">
                  {savedSearches.map((search) => (
                    <div
                      key={search.id}
                      className="p-4 border border-gray-200 rounded-lg hover:border-purple-500 transition"
                    >
                      <h4 className="font-semibold text-gray-900 mb-2">
                        {search.name}
                      </h4>
                      <p className="text-xs text-gray-600 mb-3">
                        {search.description}
                      </p>
                      <button
                        onClick={() => fillSearchForm(search.filters)}
                        className="w-full px-3 py-2 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 transition font-semibold"
                      >
                        Use This Search
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No saved searches yet</p>
              )}
            </div>

            {/* Recent Searches */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                ⏱️ Recent Searches
              </h3>

              {recentSearches.length > 0 ? (
                <div className="space-y-3">
                  {recentSearches.slice(0, 5).map((search, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <p className="text-sm text-gray-700 mb-2">
                        {search.keywords || "No keywords"}
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => fillSearchForm(search)}
                          className="flex-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition font-semibold"
                        >
                          Fill
                        </button>
                        <button
                          onClick={() => {
                            setSearchForm(search);
                            document
                              .querySelector('button[type="submit"]')
                              .click();
                          }}
                          className="flex-1 px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 transition font-semibold"
                        >
                          Search
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No recent searches</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Accordion Section Component
function AccordionSection({ title, expanded, onToggle, children }) {
  return (
    <div className="border-t">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between py-4 text-gray-900 font-bold hover:bg-gray-50 transition"
      >
        <span>{title}</span>
        <span
          className={`transition-transform ${expanded ? "rotate-180" : ""}`}
        >
          ▼
        </span>
      </button>
      {expanded && <div className="pb-6 space-y-4">{children}</div>}
    </div>
  );
}
