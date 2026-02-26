import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X, Sparkles, Loader2, MapPin, Briefcase } from "lucide-react";
import api from "../../api/axios";

const debounce = (fn, wait = 300) => {
  let timeout;
  return (...args) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), wait);
  };
};

const SemanticHeaderSearch = () => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  const debouncedSearch = useCallback(
    debounce(async (searchQuery) => {
      if (!searchQuery.trim()) {
        setResults([]);
        setIsOpen(false);
        return;
      }

      setLoading(true);
      try {
        const response = await api.get("/v1/resdex/search", {
          params: { q: searchQuery, limit: 5 },
        });
        setResults(response.data.results || []);
        setIsOpen(true);
        setSelectedIndex(-1);
      } catch (err) {
        console.error("Semantic search error:", err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300),
    [],
  );

  useEffect(() => {
    debouncedSearch(query);
  }, [query, debouncedSearch]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target) && 
          inputRef.current && !inputRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleKeyDown = (e) => {
    if (!isOpen) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(p => (p < results.length - 1 ? p + 1 : p));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(p => (p > 0 ? p - 1 : -1));
    } else if (e.key === "Enter") {
      if (selectedIndex >= 0) handleSelect(results[selectedIndex]);
      else if (query.trim()) {
        navigate(`/recruiter/resdex/advanced-search?q=${encodeURIComponent(query)}`);
        setIsOpen(false);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  const handleSelect = (candidate) => {
    navigate(`/recruiter/candidates/${candidate.id}`);
    setIsOpen(false);
    setQuery("");
  };

  return (
    <div className="relative">
      <div className="relative group">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          {loading ? (
            <Loader2 className="h-4 w-4 text-purple-600 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4 text-purple-600" />
          )}
        </div>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          placeholder="Semantic Search..."
          className="w-72 pl-10 pr-10 py-2 border-2 border-purple-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm bg-purple-50/30 hover:bg-purple-50 transition-all font-medium"
        />
        {query && (
          <button onClick={() => setQuery("")} className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600">
            <X size={14} />
          </button>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div ref={dropdownRef} className="absolute top-full right-0 left-0 mt-2 bg-white border border-gray-100 rounded-xl shadow-2xl overflow-hidden z-[100] min-w-[320px]">
          <div className="px-3 py-2 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Top Semantic Matches</span>
            <button 
              onClick={() => navigate(`/recruiter/resdex/advanced-search?q=${encodeURIComponent(query)}`)}
              className="text-[10px] font-bold text-purple-600 hover:underline"
            >
              View All
            </button>
          </div>
          {results.map((c, i) => (
            <div
              key={c.id}
              onClick={() => handleSelect(c)}
              className={`p-3 cursor-pointer border-b border-gray-50 last:border-b-0 flex items-center gap-3 transition-colors ${i === selectedIndex ? "bg-purple-50" : "hover:bg-gray-50"}`}
            >
              <div className="w-10 h-10 rounded-full bg-purple-100 border border-purple-200 flex items-center justify-center text-purple-700 font-bold text-xs flex-shrink-0">
                {Math.round(c.match_score)}%
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-gray-900 truncate">{c.name}</p>
                <p className="text-[11px] text-gray-500 truncate flex items-center gap-1">
                  <Briefcase size={10} /> {c.designation}
                </p>
                <p className="text-[10px] text-gray-400 truncate flex items-center gap-1">
                  <MapPin size={10} /> {c.location}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SemanticHeaderSearch;
