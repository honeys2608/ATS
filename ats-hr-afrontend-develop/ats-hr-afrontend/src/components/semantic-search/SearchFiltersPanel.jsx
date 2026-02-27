import React, { useEffect, useMemo, useState } from "react";
import "./SearchFiltersPanel.css";

const initialFilters = {
  experience: { min: "", max: "", type: "total" },
  location: { current: "", preferred: "", remote: false },
  salary: { min: "", max: "", currency: "INR", type: "expected" },
  keywords: [],
  companies: [],
  designations: [],
  education: { degrees: [], institutions: [], majors: [], topTier: false },
  certifications: [],
  activeCertsOnly: false,
};

const toArray = (value) =>
  String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const normalizeArray = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }
  return toArray(value);
};

const toCsvText = (value) => normalizeArray(value).join(", ");

const buildArrayInputState = (filters = {}) => ({
  keywords: toCsvText(filters.keywords),
  companies: toCsvText(filters.companies),
  designations: toCsvText(filters.designations),
  certifications: toCsvText(filters.certifications),
  educationDegrees: toCsvText(filters.education?.degrees),
  educationMajors: toCsvText(filters.education?.majors),
  educationInstitutions: toCsvText(filters.education?.institutions),
});

const mergeFilters = (overrides = {}, keywordOverrides = []) => ({
  ...initialFilters,
  ...overrides,
  query: String(overrides.query || ""),
  keywords:
    keywordOverrides.length > 0
      ? keywordOverrides
      : normalizeArray(overrides.keywords),
  companies: normalizeArray(overrides.companies),
  designations: normalizeArray(overrides.designations),
  certifications: normalizeArray(overrides.certifications),
  experience: {
    ...initialFilters.experience,
    ...(overrides.experience || {}),
    min: String(overrides?.experience?.min || ""),
    max: String(overrides?.experience?.max || ""),
    type:
      overrides?.experience?.type === "relevant"
        ? "relevant"
        : initialFilters.experience.type,
  },
  location: {
    ...initialFilters.location,
    ...(overrides.location || {}),
    current: String(overrides?.location?.current || ""),
    preferred: String(overrides?.location?.preferred || ""),
    remote: Boolean(overrides?.location?.remote),
  },
  salary: {
    ...initialFilters.salary,
    ...(overrides.salary || {}),
    min: String(overrides?.salary?.min || ""),
    max: String(overrides?.salary?.max || ""),
    currency: String(overrides?.salary?.currency || initialFilters.salary.currency),
    type:
      overrides?.salary?.type === "current"
        ? "current"
        : initialFilters.salary.type,
  },
  education: {
    ...initialFilters.education,
    ...(overrides.education || {}),
    degrees: normalizeArray(overrides?.education?.degrees),
    majors: normalizeArray(overrides?.education?.majors),
    institutions: normalizeArray(overrides?.education?.institutions),
    topTier: Boolean(overrides?.education?.topTier),
  },
  activeCertsOnly: Boolean(overrides.activeCertsOnly),
});

function SearchFiltersPanel({
  onSearch,
  loading,
  initialQuery = "",
  initialKeywords,
  initialFilters: initialFilterOverrides = null,
  showSmartHint = false,
}) {
  const normalizedInitialKeywords = useMemo(() => {
    if (Array.isArray(initialKeywords)) {
      return initialKeywords.map((item) => String(item).trim()).filter(Boolean);
    }
    return toArray(initialKeywords);
  }, [initialKeywords]);

  const normalizedInitialFilters = useMemo(
    () => mergeFilters(initialFilterOverrides || {}, normalizedInitialKeywords),
    [initialFilterOverrides, normalizedInitialKeywords],
  );

  const [searchQuery, setSearchQuery] = useState(String(initialQuery || ""));
  const [filters, setFilters] = useState(normalizedInitialFilters);
  const [arrayInputs, setArrayInputs] = useState(
    buildArrayInputState(normalizedInitialFilters),
  );

  useEffect(() => {
    setSearchQuery(String(initialQuery || ""));
    setFilters(normalizedInitialFilters);
    setArrayInputs(buildArrayInputState(normalizedInitialFilters));
  }, [initialQuery, normalizedInitialFilters]);

  const handleInputChange = (category, field, value) => {
    setFilters((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        [field]: value,
      },
    }));
  };

  const handleArrayInput = (category, value, inputKey = category) => {
    setArrayInputs((prev) => ({
      ...prev,
      [inputKey]: value,
    }));
    setFilters((prev) => ({
      ...prev,
      [category]: toArray(value),
    }));
  };

  const handleEducationArrayInput = (field, value, inputKey) => {
    setArrayInputs((prev) => ({
      ...prev,
      [inputKey]: value,
    }));
    setFilters((prev) => ({
      ...prev,
      education: {
        ...prev.education,
        [field]: toArray(value),
      },
    }));
  };

  const handleApplyFilters = (event) => {
    if (event?.preventDefault) event.preventDefault();
    onSearch({
      query: searchQuery.trim(),
      ...filters,
    });
  };

  const handleClearAll = () => {
    const resetFilters = mergeFilters({}, []);
    setSearchQuery("");
    setFilters(resetFilters);
    setArrayInputs(buildArrayInputState(resetFilters));
    onSearch({ query: "", ...resetFilters });
  };

  const handlePanelKeyDown = (event) => {
    if (event.key !== "Enter") return;
    const tagName = String(event.target?.tagName || "").toLowerCase();
    const type = String(event.target?.type || "").toLowerCase();
    if (tagName === "textarea") return;
    if (tagName === "button") return;
    if (tagName === "select") return;
    if (["checkbox", "radio"].includes(type)) return;
    event.preventDefault();
    handleApplyFilters();
  };

  return (
    <div className="search-filters-panel" onKeyDown={handlePanelKeyDown}>
      <div className="search-filters-panel__header">
        <h3>Search & Filters</h3>
        {showSmartHint && (
          <p className="smart-fill-hint">AI filters auto-filled from job description</p>
        )}
      </div>

      <div className="filter-section filter-section--quick-search">
        <label
          className="filter-label filter-label--quick-search"
          htmlFor="semantic-quick-search"
        >
          Quick Search
        </label>
        <form className="search-bar-section" onSubmit={handleApplyFilters}>
          <input
            id="semantic-quick-search"
            type="text"
            className="semantic-search-input"
            placeholder="e.g., React developer 5 years Bangalore"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
          <button
            type="submit"
            className="search-btn"
            disabled={loading}
          >
            {loading ? "Searching..." : "Search"}
          </button>
        </form>
      </div>

      <div className="filters-divider" />

      <div className="filter-section">
        <h4 className="filter-section-heading">Keywords & Skills</h4>
        <input
          type="text"
          className="filter-input"
          placeholder="React, Node.js, Python"
          value={arrayInputs.keywords}
          onChange={(event) =>
            handleArrayInput("keywords", event.target.value, "keywords")
          }
        />
        <small className="filter-hint">Comma-separated</small>
      </div>

      <div className="filter-section">
        <h4 className="filter-section-heading">Experience (Years)</h4>
        <div className="range-inputs">
          <input
            type="number"
            className="filter-input-small"
            placeholder="Min"
            value={filters.experience.min}
            onChange={(event) =>
              handleInputChange("experience", "min", event.target.value)
            }
          />
          <span className="range-separator">to</span>
          <input
            type="number"
            className="filter-input-small"
            placeholder="Max"
            value={filters.experience.max}
            onChange={(event) =>
              handleInputChange("experience", "max", event.target.value)
            }
          />
        </div>
        <div className="radio-group">
          <label className="radio-label">
            <input
              type="radio"
              className="radio-input"
              name="expType"
              checked={filters.experience.type === "total"}
              onChange={() => handleInputChange("experience", "type", "total")}
            />
            <span className="option-label-text">Total Experience</span>
          </label>
          <label className="radio-label">
            <input
              type="radio"
              className="radio-input"
              name="expType"
              checked={filters.experience.type === "relevant"}
              onChange={() =>
                handleInputChange("experience", "type", "relevant")
              }
            />
            <span className="option-label-text">Relevant Only</span>
          </label>
        </div>
      </div>

      <div className="filter-section">
        <h4 className="filter-section-heading">Location</h4>
        <input
          type="text"
          className="filter-input"
          placeholder="Current location"
          value={filters.location.current}
          onChange={(event) =>
            handleInputChange("location", "current", event.target.value)
          }
        />
        <input
          type="text"
          className="filter-input"
          placeholder="Preferred location"
          value={filters.location.preferred}
          onChange={(event) =>
            handleInputChange("location", "preferred", event.target.value)
          }
        />
        <label className="checkbox-label">
          <input
            type="checkbox"
            className="checkbox-input"
            checked={filters.location.remote}
            onChange={(event) =>
              handleInputChange("location", "remote", event.target.checked)
            }
          />
          <span className="option-label-text">Open to remote work</span>
        </label>
      </div>

      <div className="filter-section">
        <h4 className="filter-section-heading">Salary Range</h4>
        <div className="radio-group">
          <label className="radio-label">
            <input
              type="radio"
              className="radio-input"
              name="salaryType"
              checked={filters.salary.type === "current"}
              onChange={() => handleInputChange("salary", "type", "current")}
            />
            <span className="option-label-text">Current CTC</span>
          </label>
          <label className="radio-label">
            <input
              type="radio"
              className="radio-input"
              name="salaryType"
              checked={filters.salary.type === "expected"}
              onChange={() => handleInputChange("salary", "type", "expected")}
            />
            <span className="option-label-text">Expected CTC</span>
          </label>
        </div>
        <div className="range-inputs">
          <input
            type="number"
            className="filter-input-small"
            placeholder="Min"
            value={filters.salary.min}
            onChange={(event) =>
              handleInputChange("salary", "min", event.target.value)
            }
          />
          <span className="range-separator">to</span>
          <input
            type="number"
            className="filter-input-small"
            placeholder="Max"
            value={filters.salary.max}
            onChange={(event) =>
              handleInputChange("salary", "max", event.target.value)
            }
          />
        </div>
        <select
          className="filter-select"
          value={filters.salary.currency}
          onChange={(event) =>
            handleInputChange("salary", "currency", event.target.value)
          }
        >
          <option value="INR">INR (LPA)</option>
          <option value="USD">USD (Annual)</option>
          <option value="EUR">EUR (Annual)</option>
        </select>
      </div>

      <div className="filter-section">
        <h4 className="filter-section-heading">Companies</h4>
        <input
          type="text"
          className="filter-input"
          placeholder="Google, Amazon, Microsoft"
          value={arrayInputs.companies}
          onChange={(event) =>
            handleArrayInput("companies", event.target.value, "companies")
          }
        />
        <small className="filter-hint">Current or previous employers</small>
      </div>

      <div className="filter-section">
        <h4 className="filter-section-heading">Designation / Role</h4>
        <input
          type="text"
          className="filter-input"
          placeholder="Software Engineer, Senior Dev"
          value={arrayInputs.designations}
          onChange={(event) =>
            handleArrayInput("designations", event.target.value, "designations")
          }
        />
      </div>

      <div className="filter-section">
        <h4 className="filter-section-heading">Education</h4>
        <input
          type="text"
          className="filter-input"
          placeholder="Degree (e.g., B.Tech, MBA)"
          value={arrayInputs.educationDegrees}
          onChange={(event) =>
            handleEducationArrayInput(
              "degrees",
              event.target.value,
              "educationDegrees",
            )
          }
        />
        <input
          type="text"
          className="filter-input"
          placeholder="Major (e.g., Computer Science)"
          value={arrayInputs.educationMajors}
          onChange={(event) =>
            handleEducationArrayInput(
              "majors",
              event.target.value,
              "educationMajors",
            )
          }
        />
        <input
          type="text"
          className="filter-input"
          placeholder="Institution (e.g., IIT, MIT)"
          value={arrayInputs.educationInstitutions}
          onChange={(event) =>
            handleEducationArrayInput(
              "institutions",
              event.target.value,
              "educationInstitutions",
            )
          }
        />
        <label className="checkbox-label">
          <input
            type="checkbox"
            className="checkbox-input"
            checked={filters.education.topTier}
            onChange={(event) =>
              handleInputChange("education", "topTier", event.target.checked)
            }
          />
          <span className="option-label-text">Only top-tier institutions</span>
        </label>
      </div>

      <div className="filter-section">
        <h4 className="filter-section-heading">Certifications</h4>
        <input
          type="text"
          className="filter-input"
          placeholder="AWS, PMP, Scrum Master"
          value={arrayInputs.certifications}
          onChange={(event) =>
            handleArrayInput("certifications", event.target.value, "certifications")
          }
        />
        <label className="checkbox-label">
          <input
            type="checkbox"
            className="checkbox-input"
            checked={filters.activeCertsOnly}
            onChange={(event) =>
              setFilters((prev) => ({
                ...prev,
                activeCertsOnly: event.target.checked,
              }))
            }
          />
          <span className="option-label-text">Only active certifications</span>
        </label>
      </div>

      <div className="filter-actions">
        <button
          type="button"
          className="btn-apply"
          onClick={handleApplyFilters}
          disabled={loading}
        >
          Apply Filters
        </button>
        <button type="button" className="btn-clear" onClick={handleClearAll}>
          <span className="btn-clear__icon" aria-hidden="true">
            ✕
          </span>
          Clear All
        </button>
      </div>
    </div>
  );
}

export { SearchFiltersPanel };
export default SearchFiltersPanel;
