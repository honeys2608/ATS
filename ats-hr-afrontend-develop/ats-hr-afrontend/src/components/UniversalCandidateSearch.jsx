import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X } from "lucide-react";
import api from "../api/axios";

const debounce = (fn, wait = 300) => {
  let timeout;
  return (...args) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), wait);
  };
};

const UniversalCandidateSearch = () => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce(async (searchQuery) => {
      if (!searchQuery.trim()) {
        setResults([]);
        setIsOpen(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await api.get("/v1/candidates/search", {
          params: { keyword: searchQuery },
        });
        const payload =
          response.data?.results ??
          response.data?.data ??
          response.data ??
          [];
        setResults(Array.isArray(payload) ? payload : []);
        setIsOpen(true);
        setSelectedIndex(-1);
      } catch (err) {
        console.error("Search error:", err);
        setError("Search failed, try again");
        setResults([]);
        setIsOpen(false);
      } finally {
        setLoading(false);
      }
    }, 300),
    [],
  );

  useEffect(() => {
    debouncedSearch(query);
  }, [query, debouncedSearch]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        inputRef.current &&
        !inputRef.current.contains(event.target)
      ) {
        setIsOpen(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (!isOpen) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < results.length - 1 ? prev + 1 : prev,
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0 && results[selectedIndex]) {
          handleSelect(results[selectedIndex]);
        }
        break;
      case "Escape":
        setIsOpen(false);
        setSelectedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  };

  const handleSelect = (candidate) => {
    const candidateId = candidate.id || candidate._id;
    if (candidateId) {
      navigate(`/recruiter/candidates/${candidateId}`);
    }
    setIsOpen(false);
    setQuery("");
    setResults([]);
  };

  const clearSearch = () => {
    setQuery("");
    setResults([]);
    setIsOpen(false);
    setSelectedIndex(-1);
    inputRef.current?.focus();
  };

  return (
    <div className="relative">
      {/* Search Input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-gray-400" />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          placeholder="Search candidates..."
          className="w-80 pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm bg-white shadow-sm"
        />
        {query && (
          <button
            onClick={clearSearch}
            className="absolute inset-y-0 right-0 pr-3 flex items-center"
          >
            <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
          </button>
        )}
      </div>

      {/* Loading Indicator */}
      {loading && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4 text-center">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-500 mx-auto"></div>
          <p className="text-sm text-gray-500 mt-2">Searching...</p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4 text-center">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Results Dropdown */}
      {isOpen && results.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-y-auto z-50"
        >
          {results.map((candidate, index) => (
            <div
              key={candidate.id || candidate._id}
              onClick={() => handleSelect(candidate)}
              className={`px-4 py-3 cursor-pointer border-b border-gray-100 last:border-b-0 hover:bg-gray-50 ${
                index === selectedIndex ? "bg-purple-50" : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {candidate.full_name || candidate.name || "Unknown"}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {candidate.email || "No email"}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {candidate.phone || "No phone"} •{" "}
                    {candidate.current_location ||
                      candidate.preferred_location ||
                      "No location"}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {candidate.job_title ||
                      candidate.designation ||
                      "No designation"}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No Results */}
      {isOpen && !loading && results.length === 0 && query.trim() && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4 text-center">
          <p className="text-sm text-gray-500">No matching candidates found</p>
        </div>
      )}
    </div>
  );
};

export default UniversalCandidateSearch;
