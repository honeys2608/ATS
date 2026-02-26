import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import SearchFiltersPanel from "../../components/semantic-search/SearchFiltersPanel";
import CandidateResultsList from "../../components/semantic-search/CandidateResultsList";
import { SemanticSearchEngine } from "../../services/SemanticSearchEngine";
import candidateService from "../../services/candidateService";
import "./AdvancedSearch.css";

const searchEngine = new SemanticSearchEngine();
const CANDIDATE_LIMIT = 200;

const toNumber = (value) => {
  const parsed = Number(String(value ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

const sortCandidates = (items, sortBy) => {
  const list = [...items];
  switch (sortBy) {
    case "experience":
      return list.sort(
        (a, b) =>
          toNumber(b.experience_years || b.experience || b.total_experience) -
          toNumber(a.experience_years || a.experience || a.total_experience),
      );
    case "salary":
      return list.sort(
        (a, b) =>
          toNumber(b.expected_ctc || b.expected_salary || b.current_ctc) -
          toNumber(a.expected_ctc || a.expected_salary || a.current_ctc),
      );
    case "recent":
      return list.sort(
        (a, b) =>
          new Date(b.updated_at || b.created_at || 0).getTime() -
          new Date(a.updated_at || a.created_at || 0).getTime(),
      );
    case "name":
      return list.sort((a, b) =>
        String(a.full_name || a.name || "").localeCompare(
          String(b.full_name || b.name || ""),
        ),
      );
    case "relevance":
    default:
      return list.sort(
        (a, b) =>
          Number(b.semantic_score || b.match_score || 0) -
          Number(a.semantic_score || a.match_score || 0),
      );
  }
};

const toErrorText = (error, fallback = "Unable to load candidates for semantic search.") => {
  const detail = error?.response?.data?.detail;
  if (typeof detail === "string" && detail.trim()) return detail;
  if (Array.isArray(detail)) {
    const lines = detail
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") return item.msg || item.message || "";
        return "";
      })
      .filter(Boolean);
    if (lines.length) return lines.join(", ");
  }
  if (detail && typeof detail === "object") {
    return detail.msg || detail.message || JSON.stringify(detail);
  }
  if (typeof error?.message === "string" && error.message.trim()) return error.message;
  return fallback;
};

export default function AdvancedSearch() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [allCandidates, setAllCandidates] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [sortBy, setSortBy] = useState("relevance");
  const [error, setError] = useState("");
  const [initialFilters, setInitialFilters] = useState(null);

  const loadCandidates = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await candidateService.listCandidates({ limit: CANDIDATE_LIMIT });
      const rows = Array.isArray(data) ? data : (data?.items || []);
      setAllCandidates(rows);
      setResults(rows);
    } catch (loadErr) {
      setError(toErrorText(loadErr));
      setAllCandidates([]);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCandidates();
  }, [loadCandidates]);

  useEffect(() => {
    const keywordParam = searchParams.get("keywords");
    const keywordList = keywordParam
      ? keywordParam.split(",").map((item) => item.trim()).filter(Boolean)
      : [];
    setQuery(searchParams.get("q") || "");
    setInitialFilters(
      keywordList.length > 0 ? { keywords: keywordList } : null,
    );
  }, [searchParams]);

  const handleSearch = useCallback(
    ({ query: q = "", ...filters }) => {
      const matched = searchEngine.search(q, filters, allCandidates);
      setResults(matched);
      setQuery(q);

      const next = new URLSearchParams(searchParams);
      if (q) next.set("q", q);
      else next.delete("q");
      setSearchParams(next, { replace: true });
    },
    [allCandidates, searchParams, setSearchParams],
  );

  const sortedResults = useMemo(
    () => sortCandidates(results, sortBy),
    [results, sortBy],
  );

  const analysisText = searchParams.get("analysis");

  return (
    <div className="semantic-search-page">
      <div className="semantic-search-page__header">
        <div>
          <h1 className="semantic-search-page__title">Semantic Search</h1>
          <p className="semantic-search-page__subtitle">
            Smart filtering and relevance scoring across every candidate profile.
          </p>
        </div>
        <div className="semantic-search-page__header-actions">
          <button type="button" className="semantic-search-refresh" onClick={loadCandidates}>
            Refresh
          </button>
        </div>
      </div>

      {analysisText && (
        <div className="semantic-search-page__context semantic-search-page__context--ai">
          <span className="semantic-search-page__context-badge">AI Analysis</span>
          <p className="semantic-search-page__context-text">{analysisText}</p>
          <span className="semantic-search-page__context-score">
            Query: {query || "Not specified"}
          </span>
        </div>
      )}

      {error && (
        <div className="semantic-search-page__context">
          <span className="semantic-search-page__context-text">{error}</span>
        </div>
      )}

      <div className="semantic-search-page__content">
        <SearchFiltersPanel
          onSearch={handleSearch}
          loading={loading}
          initialQuery={query}
          initialKeywords={initialFilters?.keywords || []}
          initialFilters={initialFilters}
          showSmartHint={Boolean(analysisText)}
        />
        <CandidateResultsList
          candidates={sortedResults}
          loading={loading}
          sortBy={sortBy}
          onSortChange={setSortBy}
          onViewDetails={(candidate) =>
            navigate(`/recruiter/candidate-profile/${candidate?.id || candidate?.candidate_id || ""}`)
          }
        />
      </div>
    </div>
  );
}
