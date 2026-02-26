import React, { useState, useEffect } from "react";
import {
  Search,
  Plus,
  X,
  ChevronDown,
  Save,
  Filter,
  FolderPlus,
  Send,
  Briefcase,
  AlertCircle,
  CheckCircle,
  MapPin,
  Briefcase as BriefcaseIcon,
  DollarSign,
  Calendar,
} from "lucide-react";

export default function ResdexSearchResumes() {
  const [searchForm, setSearchForm] = useState({
    keywords: "",
    keywords_mandatory: false,
    boolean_search: "OR",
    search_in: "entire_resume",
    exclude_keywords: "",
    min_experience: "",
    max_experience: "",
    location: "",
    include_relocate: false,
    exclude_anywhere: false,
    currency: "INR",
    min_salary: "",
    max_salary: "",
    include_no_salary: false,
    current_company: "",
    industry: "",
    employment_type: "",
    highest_qualification: "",
    notice_period: "",
    work_mode: "",
    active_in_months: 6,
  });

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedResults, setSelectedResults] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState([
    {
      id: 1,
      name: "React Developers",
      keywords: "React, JavaScript, Node.js",
      date: "2026-01-25",
    },
    {
      id: 2,
      name: "Senior Java Engineers",
      keywords: "Java, Spring Boot",
      date: "2026-01-24",
    },
  ]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSearchForm({
      ...searchForm,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  const handleSearch = async () => {
    setIsLoading(true);
    try {
      // Mock API call - replace with actual API
      setTimeout(() => {
        const mockResults = [
          {
            id: 1,
            name: "Raj Kumar",
            experience: 5,
            location: "Bangalore",
            skills: ["React", "JavaScript", "Node.js"],
            salary: 18,
            lastActive: "2026-01-20",
            profileMatch: 95,
            currentCompany: "TechCorp",
          },
          {
            id: 2,
            name: "Priya Singh",
            experience: 7,
            location: "Pune",
            skills: ["React", "TypeScript", "AWS"],
            salary: 22,
            lastActive: "2026-01-21",
            profileMatch: 88,
            currentCompany: "StartupXYZ",
          },
          {
            id: 3,
            name: "Amit Patel",
            experience: 4,
            location: "Mumbai",
            skills: ["React", "JavaScript"],
            salary: 14,
            lastActive: "2026-01-19",
            profileMatch: 92,
            currentCompany: "WebDev Inc",
          },
        ];
        setSearchResults(mockResults);
        setHasSearched(true);
        setIsLoading(false);
      }, 500);
    } catch (error) {
      console.error("Search error:", error);
      setIsLoading(false);
    }
  };

  const handleSelectCandidate = (id) => {
    setSelectedResults((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleSelectAll = () => {
    if (selectedResults.length === searchResults.length) {
      setSelectedResults([]);
    } else {
      setSelectedResults(searchResults.map((r) => r.id));
    }
  };

  const handleSaveSearch = () => {
    if (saveName.trim()) {
      setRecentSearches([
        {
          id: Date.now(),
          name: saveName,
          keywords: searchForm.keywords,
          date: new Date().toISOString().split("T")[0],
        },
        ...recentSearches,
      ]);
      setSaveName("");
      setShowSaveModal(false);
      alert("Search saved successfully!");
    }
  };

  const handleBulkAction = (action) => {
    if (selectedResults.length === 0) {
      alert("Please select at least one candidate");
      return;
    }
    console.log(`${action}:`, selectedResults);
    alert(`${selectedResults.length} candidates selected for ${action}`);
  };

  const canSearch = searchForm.keywords.trim().length > 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* LEFT PANEL - SEARCH FORM */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-sm p-6 sticky top-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              Search Candidates
            </h2>

            {/* Keywords */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Keywords *
              </label>
              <input
                type="text"
                name="keywords"
                value={searchForm.keywords}
                onChange={handleInputChange}
                placeholder="Skills, designation, company"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                e.g., "React JavaScript"
              </p>
            </div>

            {/* Keywords Options */}
            <div className="mb-4 space-y-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  name="keywords_mandatory"
                  checked={searchForm.keywords_mandatory}
                  onChange={handleInputChange}
                  className="w-4 h-4"
                />
                <span className="text-gray-700">Mark mandatory</span>
              </label>

              <div className="flex gap-2">
                <label className="flex items-center gap-1 text-xs">
                  <input
                    type="radio"
                    name="boolean_search"
                    value="AND"
                    checked={searchForm.boolean_search === "AND"}
                    onChange={handleInputChange}
                    className="w-3 h-3"
                  />
                  AND
                </label>
                <label className="flex items-center gap-1 text-xs">
                  <input
                    type="radio"
                    name="boolean_search"
                    value="OR"
                    checked={searchForm.boolean_search === "OR"}
                    onChange={handleInputChange}
                    className="w-3 h-3"
                  />
                  OR
                </label>
              </div>
            </div>

            {/* Search In */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Search In
              </label>
              <select
                name="search_in"
                value={searchForm.search_in}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="entire_resume">Entire Resume</option>
                <option value="skills">Skills Only</option>
                <option value="job_title">Job Title Only</option>
              </select>
            </div>

            {/* Experience */}
            <div className="mb-4 grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Min Exp (yrs)
                </label>
                <input
                  type="number"
                  name="min_experience"
                  value={searchForm.min_experience}
                  onChange={handleInputChange}
                  placeholder="0"
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Max Exp
                </label>
                <input
                  type="number"
                  name="max_experience"
                  value={searchForm.max_experience}
                  onChange={handleInputChange}
                  placeholder="50"
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            {/* Location */}
            <div className="mb-4">
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
              <label className="flex items-center gap-2 text-sm mt-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="include_relocate"
                  checked={searchForm.include_relocate}
                  onChange={handleInputChange}
                  className="w-4 h-4"
                />
                <span className="text-gray-700">Include relocate</span>
              </label>
            </div>

            {/* Salary */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Annual Salary (Lacs)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  name="min_salary"
                  value={searchForm.min_salary}
                  onChange={handleInputChange}
                  placeholder="Min"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <input
                  type="number"
                  name="max_salary"
                  value={searchForm.max_salary}
                  onChange={handleInputChange}
                  placeholder="Max"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            {/* Advanced Filters */}
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-2 text-sm font-semibold text-purple-600 hover:text-purple-700 mb-4 w-full"
            >
              <Filter size={16} />
              Advanced Filters
              <ChevronDown
                size={16}
                className={showAdvanced ? "rotate-180" : ""}
              />
            </button>

            {showAdvanced && (
              <div className="border-t pt-4 space-y-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Current Company
                  </label>
                  <input
                    type="text"
                    name="current_company"
                    value={searchForm.current_company}
                    onChange={handleInputChange}
                    placeholder="e.g., Google"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Work Mode
                  </label>
                  <select
                    name="work_mode"
                    value={searchForm.work_mode}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">All</option>
                    <option value="remote">Remote</option>
                    <option value="hybrid">Hybrid</option>
                    <option value="onsite">On-site</option>
                  </select>
                </div>
              </div>
            )}

            {/* Buttons */}
            <div className="space-y-2 mt-6">
              <button
                onClick={handleSearch}
                disabled={!canSearch || isLoading}
                className="w-full px-4 py-2 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {isLoading ? "Searching..." : "Search"}
              </button>
              <button
                onClick={() => setShowSaveModal(true)}
                disabled={!hasSearched}
                className="w-full px-4 py-2 border border-purple-600 text-purple-600 font-semibold rounded-lg hover:bg-purple-50 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
              >
                <Save size={16} />
                Save Search
              </button>
            </div>

            {/* Recent Searches */}
            {recentSearches.length > 0 && (
              <div className="mt-6 border-t pt-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">
                  Recent Searches
                </h3>
                <div className="space-y-2">
                  {recentSearches.slice(0, 3).map((search) => (
                    <button
                      key={search.id}
                      onClick={() => {
                        setSearchForm({
                          ...searchForm,
                          keywords: search.keywords,
                        });
                        handleSearch();
                      }}
                      className="w-full text-left px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded text-sm transition"
                    >
                      <p className="font-medium text-gray-900">{search.name}</p>
                      <p className="text-xs text-gray-600">{search.keywords}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL - RESULTS */}
        <div className="lg:col-span-3">
          {!hasSearched && (
            <div className="bg-white rounded-lg shadow-sm p-12 text-center">
              <Search size={48} className="mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                Ready to search?
              </h3>
              <p className="text-gray-600">
                Fill in your criteria and click "Search" to find candidates
              </p>
            </div>
          )}

          {hasSearched && (
            <div className="space-y-4">
              {searchResults.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">
                        Found {searchResults.length} candidates
                      </h3>
                      <p className="text-sm text-gray-600">
                        {selectedResults.length} selected
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={
                            selectedResults.length === searchResults.length
                          }
                          onChange={handleSelectAll}
                          className="w-4 h-4"
                        />
                        <span className="text-sm font-medium text-gray-700">
                          Select All
                        </span>
                      </label>
                    </div>
                  </div>

                  {selectedResults.length > 0 && (
                    <div className="flex gap-2 mb-4">
                      <button
                        onClick={() => handleBulkAction("Add to Folder")}
                        className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded hover:bg-blue-700 transition flex items-center gap-2"
                      >
                        <FolderPlus size={16} />
                        Add to Folder
                      </button>
                      <button
                        onClick={() => handleBulkAction("Send NVite")}
                        className="px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded hover:bg-green-700 transition flex items-center gap-2"
                      >
                        <Send size={16} />
                        Send NVite
                      </button>
                    </div>
                  )}

                  <div className="space-y-3">
                    {searchResults.map((result) => (
                      <div
                        key={result.id}
                        className="border rounded-lg p-4 hover:bg-gray-50 transition"
                      >
                        <div className="flex items-start gap-4">
                          <input
                            type="checkbox"
                            checked={selectedResults.includes(result.id)}
                            onChange={() => handleSelectCandidate(result.id)}
                            className="mt-1 w-4 h-4"
                          />
                          <div className="flex-1">
                            <h4 className="font-bold text-gray-900">
                              {result.name}
                            </h4>
                            <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-600">
                              <div className="flex items-center gap-1">
                                <BriefcaseIcon size={14} />
                                {result.experience} yrs
                              </div>
                              <div className="flex items-center gap-1">
                                <MapPin size={14} />
                                {result.location}
                              </div>
                              <div className="flex items-center gap-1">
                                <DollarSign size={14} />
                                {result.salary}L
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2 mt-3">
                              {result.skills.map((skill) => (
                                <span
                                  key={skill}
                                  className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium"
                                >
                                  {skill}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded text-sm font-semibold">
                              {result.profileMatch}%
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {searchResults.length === 0 && (
                <div className="bg-white rounded-lg shadow-sm p-12 text-center">
                  <AlertCircle
                    size={48}
                    className="mx-auto mb-4 text-gray-400"
                  />
                  <h3 className="text-lg font-bold text-gray-900 mb-2">
                    No candidates found
                  </h3>
                  <p className="text-gray-600">
                    Try adjusting your search criteria
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* SAVE SEARCH MODAL */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Save Search</h3>
              <button
                onClick={() => setShowSaveModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Search Name
                </label>
                <input
                  type="text"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="e.g., Senior React Developers"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleSaveSearch}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition"
                >
                  Save
                </button>
                <button
                  onClick={() => setShowSaveModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
