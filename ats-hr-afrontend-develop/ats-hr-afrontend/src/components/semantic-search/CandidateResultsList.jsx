import React, { useEffect, useMemo, useRef, useState } from "react";
import CandidateResultCard from "./CandidateResultCard";
import "./CandidateResultsList.css";

const CANDIDATES_PER_PAGE = 5;

const buildPageItems = (currentPage, totalPages) => {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, "...", totalPages];
  }

  if (currentPage >= totalPages - 3) {
    return [
      1,
      "...",
      totalPages - 4,
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
      totalPages,
    ];
  }

  return [
    1,
    "...",
    currentPage - 1,
    currentPage,
    currentPage + 1,
    "...",
    totalPages,
  ];
};

export default function CandidateResultsList({
  candidates,
  loading,
  sortBy,
  onSortChange,
  onViewDetails,
}) {
  const [selectedCandidates, setSelectedCandidates] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const resultsContainerRef = useRef(null);

  const totalPages = Math.max(
    1,
    Math.ceil(candidates.length / CANDIDATES_PER_PAGE),
  );

  const paginatedCandidates = useMemo(() => {
    const start = (currentPage - 1) * CANDIDATES_PER_PAGE;
    return candidates.slice(start, start + CANDIDATES_PER_PAGE);
  }, [candidates, currentPage]);

  const pageItems = useMemo(
    () => buildPageItems(currentPage, totalPages),
    [currentPage, totalPages],
  );

  const pageStart = candidates.length
    ? (currentPage - 1) * CANDIDATES_PER_PAGE + 1
    : 0;
  const pageEnd = Math.min(currentPage * CANDIDATES_PER_PAGE, candidates.length);

  useEffect(() => {
    setSelectedCandidates([]);
  }, [candidates]);

  useEffect(() => {
    setCurrentPage(1);
  }, [candidates]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (resultsContainerRef.current) {
      resultsContainerRef.current.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }
  }, [currentPage]);

  const handleSelectCandidate = (candidateId) => {
    setSelectedCandidates((prev) =>
      prev.includes(candidateId)
        ? prev.filter((id) => id !== candidateId)
        : [...prev, candidateId],
    );
  };

  return (
    <div className="candidate-results-list">
      <div className="results-header">
        <div className="results-info">
          <span className="results-count">
            {loading ? "Searching..." : `${candidates.length} candidates found`}
          </span>
          {!loading && candidates.length > 0 && (
            <span className="results-page-range">
              Showing {pageStart}-{pageEnd}
            </span>
          )}
          {selectedCandidates.length > 0 && (
            <span className="results-selected">
              {selectedCandidates.length} selected
            </span>
          )}
        </div>
        <div className="results-controls">
          <div className="results-sort-wrap">
            <label htmlFor="results-sort-select" className="results-sort-label">
              Sort By
            </label>
            <select
              id="results-sort-select"
              className="sort-select"
              value={sortBy}
              onChange={(event) => onSortChange(event.target.value)}
            >
              <option value="relevance">Relevance</option>
              <option value="experience">Experience</option>
              <option value="salary">Salary</option>
              <option value="recent">Recently Updated</option>
              <option value="name">Name</option>
            </select>
          </div>
        </div>
      </div>

      <div className="results-container" ref={resultsContainerRef}>
        {loading ? (
          <div className="loading-state">
            <div className="spinner" />
            <p>Searching candidates...</p>
          </div>
        ) : candidates.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">No results</div>
            <h3>No candidates found</h3>
            <p>Try adjusting filters or search keywords.</p>
          </div>
        ) : (
          <div className="results-grid">
            {paginatedCandidates.map((candidate) => (
              <CandidateResultCard
                key={candidate.id}
                candidate={candidate}
                selected={selectedCandidates.includes(candidate.id)}
                onSelect={handleSelectCandidate}
                onViewDetails={onViewDetails}
              />
            ))}
          </div>
        )}
      </div>

      {!loading && candidates.length > CANDIDATES_PER_PAGE && (
        <div className="results-pagination">
          <button
            type="button"
            className="results-pagination__btn"
            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            disabled={currentPage === 1}
          >
            Previous
          </button>

          <div className="results-pagination__pages">
            {pageItems.map((item, index) =>
              item === "..." ? (
                <span
                  key={`ellipsis-${index}`}
                  className="results-pagination__ellipsis"
                >
                  ...
                </span>
              ) : (
                <button
                  key={item}
                  type="button"
                  className={`results-pagination__page ${currentPage === item ? "is-active" : ""}`}
                  onClick={() => setCurrentPage(item)}
                  aria-current={currentPage === item ? "page" : undefined}
                >
                  {item}
                </button>
              ),
            )}
          </div>

          <button
            type="button"
            className="results-pagination__btn"
            onClick={() =>
              setCurrentPage((page) => Math.min(totalPages, page + 1))
            }
            disabled={currentPage === totalPages}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
