import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, RefreshCw, Search, Trash2, AlertCircle } from "lucide-react";
import api from "../../api/axios";
import {
  isDuplicateNameInGroup,
  normalizeText,
  validateFeatureName,
} from "../../utils/recruiterValidations";

export default function ResdexManageSearches() {
  const navigate = useNavigate();
  const [searches, setSearches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [folders, setFolders] = useState([]);
  const [form, setForm] = useState({
    search_name: "",
    skills: "",
    location: "",
    experience_min: "",
    experience_max: "",
    folder_id: "",
  });

  useEffect(() => {
    fetchSearches();
    fetchFolders();
  }, []);

  async function fetchSearches() {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/searches");
      setSearches(res.data?.results || []);
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
          "Failed to load saved searches. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function fetchFolders() {
    try {
      const res = await api.get("/v1/folders");
      setFolders(res.data?.results || []);
    } catch (err) {
      console.error("Failed to load folders:", err);
    }
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleCreateSearch(e) {
    e.preventDefault();
    const trimmedSearchName = normalizeText(form.search_name);
    const selectedFolderId = form.folder_id || null;
    const searchNameError = validateFeatureName(trimmedSearchName, "Search name");
    if (searchNameError) {
      setError(searchNameError);
      return;
    }

    const duplicateInFolder = isDuplicateNameInGroup({
      list: searches,
      name: trimmedSearchName,
      groupValue: selectedFolderId,
      nameKey: "search_name",
      groupKey: "folder_id",
    });
    if (duplicateInFolder) {
      setError("Duplicate Feature name under the same Sub-Category is not allowed.");
      return;
    }

    const skillsList = form.skills
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const filters = {
      skills: skillsList,
      location: normalizeText(form.location) || null,
      experience_min: form.experience_min
        ? Number(form.experience_min)
        : null,
      experience_max: form.experience_max
        ? Number(form.experience_max)
        : null,
    };

    setSaving(true);
    setError("");
    try {
      await api.post("/searches/save", {
        search_name: trimmedSearchName,
        filters,
        folder_id: selectedFolderId,
      });
      setForm({
        search_name: "",
        skills: "",
        location: "",
        experience_min: "",
        experience_max: "",
        folder_id: "",
      });
      setShowNew(false);
      await fetchSearches();
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
          "Unable to save search. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteSearch(id) {
    if (!window.confirm("Delete this saved search?")) return;
    try {
      await api.delete(`/searches/${id}`);
      await fetchSearches();
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
          "Unable to delete saved search. Please try again.",
      );
    }
  }

  async function handleRunSearch(id) {
    try {
      const res = await api.get(`/searches/${id}/run`);
      const filters = res.data?.filters || {};
      const params = new URLSearchParams();
      if (filters.skills && filters.skills.length > 0) {
        params.set("keyword", filters.skills.join(" "));
      }
      if (filters.location) params.set("location", filters.location);
      if (filters.experience_min !== null && filters.experience_min !== undefined) {
        params.set("min_exp", String(filters.experience_min));
      }
      if (filters.experience_max !== null && filters.experience_max !== undefined) {
        params.set("max_exp", String(filters.experience_max));
      }
      navigate(`/recruiter/resdex/search-resumes?${params.toString()}`);
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
          "Unable to run search. Please try again.",
      );
    }
  }

  const renderFilters = (filters) => {
    if (!filters) return "No filters";
    const parts = [];
    if (filters.skills && filters.skills.length > 0) {
      parts.push(`Skills: ${filters.skills.join(", ")}`);
    }
    if (filters.location) parts.push(`Location: ${filters.location}`);
    if (filters.experience_min !== null && filters.experience_min !== undefined) {
      parts.push(`Min Exp: ${filters.experience_min}`);
    }
    if (filters.experience_max !== null && filters.experience_max !== undefined) {
      parts.push(`Max Exp: ${filters.experience_max}`);
    }
    return parts.length ? parts.join(" | ") : "No filters";
  };

  const folderMap = folders.reduce((acc, f) => {
    acc[f.id] = f.name;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Manage Searches</h2>
          <p className="text-gray-600 mt-1">
            Save, reuse, and organize your Resdex searches
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchSearches}
            className="px-3 py-2 rounded-lg border text-sm font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-2"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
          <button
            onClick={() => setShowNew((v) => !v)}
            className="px-4 py-2 rounded-lg bg-purple-600 text-white font-semibold hover:bg-purple-700 flex items-center gap-2"
          >
            <Plus size={16} />
            New Search
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start gap-2">
          <AlertCircle size={18} className="mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {showNew && (
        <form
          onSubmit={handleCreateSearch}
          className="bg-white rounded-xl shadow-sm border p-5 space-y-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Search Name
              </label>
              <input
                name="search_name"
                value={form.search_name}
                onChange={handleChange}
                onBlur={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    search_name: normalizeText(e.target.value),
                  }))
                }
                placeholder="e.g., React Developers Bangalore"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Skills (comma separated)
              </label>
              <input
                name="skills"
                value={form.skills}
                onChange={handleChange}
                placeholder="React, Node, SQL"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Location
              </label>
              <input
                name="location"
                value={form.location}
                onChange={handleChange}
                placeholder="Bangalore"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Experience Min
              </label>
              <input
                name="experience_min"
                type="number"
                min="0"
                value={form.experience_min}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Experience Max
              </label>
              <input
                name="experience_max"
                type="number"
                min="0"
                value={form.experience_max}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Folder (optional)
              </label>
              <select
                name="folder_id"
                value={form.folder_id}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
              >
                <option value="">Unfiled</option>
                {folders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowNew(false)}
              className="px-4 py-2 rounded-lg border text-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-purple-600 text-white font-semibold hover:bg-purple-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Search"}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl shadow-sm border">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="flex items-center gap-2 text-gray-700 font-semibold">
            <Search size={18} />
            Saved Searches
          </div>
          <div className="text-sm text-gray-500">
            {loading ? "Loading..." : `${searches.length} saved`}
          </div>
        </div>

        {loading ? (
          <div className="p-6 text-gray-600">Loading saved searches...</div>
        ) : searches.length === 0 ? (
          <div className="p-10 text-center text-gray-600">
            No saved searches yet.
          </div>
        ) : (
          <div className="divide-y">
            {searches.map((search) => (
              <div key={search.id} className="p-5 flex flex-col gap-3">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {search.search_name}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {renderFilters(search.filters)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Folder: {search.folder_id ? folderMap[search.folder_id] || "Unknown" : "Unfiled"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleRunSearch(search.id)}
                      className="px-3 py-2 rounded-lg bg-indigo-50 text-indigo-700 text-sm font-semibold"
                    >
                      Run Search
                    </button>
                    <button
                      onClick={() => handleDeleteSearch(search.id)}
                      className="px-3 py-2 rounded-lg bg-red-50 text-red-700 text-sm font-semibold flex items-center gap-1"
                    >
                      <Trash2 size={14} />
                      Delete
                    </button>
                  </div>
                </div>

                <div className="text-sm text-gray-600">
                  Results: {search.result_count || 0} · Created: {search.created_at ? new Date(search.created_at).toLocaleDateString() : "—"}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
