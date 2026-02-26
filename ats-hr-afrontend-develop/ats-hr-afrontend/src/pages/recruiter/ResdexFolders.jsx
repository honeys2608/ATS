import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Folder,
  FolderPlus,
  RefreshCw,
  Trash2,
  AlertCircle,
  ArrowLeft,
} from "lucide-react";
import api from "../../api/axios";
import {
  normalizeText,
  validateDescription,
  validateFeatureName,
} from "../../utils/recruiterValidations";

export default function ResdexFolders() {
  const navigate = useNavigate();
  const [folders, setFolders] = useState([]);
  const [searches, setSearches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchesLoading, setSearchesLoading] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [viewMode, setViewMode] = useState("list");
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [folderSearches, setFolderSearches] = useState([]);
  const [folderLoading, setFolderLoading] = useState(false);

  useEffect(() => {
    fetchFolders();
    fetchSearches();
  }, []);

  async function fetchFolders() {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/v1/folders");
      setFolders(res.data?.results || []);
    } catch (err) {
      setError(
        err?.response?.data?.detail || "Failed to load folders. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function fetchSearches() {
    setSearchesLoading(true);
    try {
      const res = await api.get("/searches");
      const list = res.data?.results || [];
      setSearches(list);
      return list;
    } catch (err) {
      console.error("Failed to load searches:", err);
      return [];
    } finally {
      setSearchesLoading(false);
    }
  }

  async function createFolder(e) {
    e.preventDefault();
    const trimmedName = normalizeText(name);
    const trimmedDescription = normalizeText(description);

    const folderNameError = validateFeatureName(trimmedName, "Folder name");
    if (folderNameError) {
      setError(folderNameError);
      return;
    }

    const descError = validateDescription(trimmedDescription, { minLength: 20 });
    if (descError) {
      setError(descError);
      return;
    }

    const duplicateFolder = folders.some(
      (folder) => normalizeText(folder?.name).toLowerCase() === trimmedName.toLowerCase(),
    );
    if (duplicateFolder) {
      setError("Duplicate Feature name under the same Sub-Category is not allowed.");
      return;
    }

    setCreating(true);
    setError("");
    try {
      await api.post("/v1/folders", {
        name: trimmedName,
        description: trimmedDescription || null,
      });
      setName("");
      setDescription("");
      await fetchFolders();
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
          "Unable to create folder. Please try again.",
      );
    } finally {
      setCreating(false);
    }
  }

  async function deleteFolder(id) {
    if (!window.confirm("Delete this folder? Searches will be moved to Unfiled.")) {
      return;
    }
    try {
      await api.delete(`/v1/folders/${id}`);
      if (selectedFolder?.id === id) {
        setViewMode("list");
        setSelectedFolder(null);
        setFolderSearches([]);
      }
      await fetchFolders();
      await fetchSearches();
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
          "Unable to delete folder. Please try again.",
      );
    }
  }

  const unfiledSearches = useMemo(
    () => searches.filter((s) => !s.folder_id),
    [searches],
  );

  const folderMap = useMemo(() => {
    const map = {};
    folders.forEach((f) => {
      map[f.id] = f;
    });
    return map;
  }, [folders]);

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

  async function openFolder(folder) {
    setSelectedFolder(folder);
    setViewMode("folder");
    if (folder.id === "unfiled") {
      setFolderSearches(unfiledSearches);
      return;
    }

    setFolderLoading(true);
    try {
      const res = await api.get(`/v1/folders/${folder.id}/searches`);
      setFolderSearches(res.data?.results || []);
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
          "Unable to load folder contents. Please try again.",
      );
      setFolderSearches([]);
    } finally {
      setFolderLoading(false);
    }
  }

  async function moveSearch(searchId, folderId) {
    try {
      await api.put(`/searches/${searchId}/folder`, {
        folder_id: folderId || null,
      });
      await fetchFolders();
      const updatedSearches = await fetchSearches();
      if (selectedFolder) {
        if (selectedFolder.id === "unfiled") {
          setFolderSearches(updatedSearches.filter((s) => !s.folder_id));
        } else {
          await openFolder(selectedFolder);
        }
      }
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
          "Unable to move search. Please try again.",
      );
    }
  }

  async function runSearch(search) {
    try {
      const res = await api.get(`/searches/${search.id}/run`);
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

  const totalFolders = folders.length + 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Folders</h2>
          <p className="text-gray-600 mt-1">
            Organize your saved searches into folders
          </p>
        </div>
        <button
          onClick={() => {
            fetchFolders();
            fetchSearches();
          }}
          className="px-3 py-2 rounded-lg border text-sm font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-2"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start gap-2">
          <AlertCircle size={18} className="mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {viewMode === "list" && (
        <>
          <form
            onSubmit={createFolder}
            className="bg-white rounded-xl shadow-sm border p-5 space-y-4"
          >
            <div className="flex items-center gap-2 text-gray-700 font-semibold">
              <FolderPlus size={18} />
              Create Folder
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Folder Name
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={(e) => setName(normalizeText(e.target.value))}
                  placeholder="e.g., Senior Frontend"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Description (optional)
                </label>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onBlur={(e) => setDescription(normalizeText(e.target.value))}
                  placeholder="Short description"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={creating}
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-50"
              >
                {creating ? "Creating..." : "Create Folder"}
              </button>
            </div>
          </form>

          <div className="bg-white rounded-xl shadow-sm border">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <div className="flex items-center gap-2 text-gray-700 font-semibold">
                <Folder size={18} />
                Your Folders
              </div>
              <div className="text-sm text-gray-500">
                {loading ? "Loading..." : `${totalFolders} folders`}
              </div>
            </div>

            {loading || searchesLoading ? (
              <div className="p-6 text-gray-600">Loading folders...</div>
            ) : (
              <div className="divide-y">
                <div className="p-5 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      Unfiled Searches
                    </h3>
                    <p className="text-sm text-gray-600">
                      Searches without a folder
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-gray-500">
                      {unfiledSearches.length} searches
                    </span>
                    <button
                      onClick={() =>
                        openFolder({ id: "unfiled", name: "Unfiled Searches" })
                      }
                      className="px-3 py-2 rounded-lg bg-indigo-50 text-indigo-700 text-sm font-semibold"
                    >
                      View
                    </button>
                  </div>
                </div>

                {folders.length === 0 ? (
                  <div className="p-10 text-center text-gray-600">
                    No folders yet.
                  </div>
                ) : (
                  folders.map((folder) => (
                    <div
                      key={folder.id}
                      className="p-5 flex items-center justify-between"
                    >
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {folder.name}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {folder.description || "No description"}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-500">
                          {folder.search_count} searches
                        </span>
                        <button
                          onClick={() => openFolder(folder)}
                          className="px-3 py-2 rounded-lg bg-indigo-50 text-indigo-700 text-sm font-semibold"
                        >
                          Open
                        </button>
                        <button
                          onClick={() => deleteFolder(folder.id)}
                          className="px-3 py-2 rounded-lg bg-red-50 text-red-700 text-sm font-semibold flex items-center gap-1"
                        >
                          <Trash2 size={14} />
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </>
      )}

      {viewMode === "folder" && selectedFolder && (
        <div className="bg-white rounded-xl shadow-sm border p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setViewMode("list");
                  setSelectedFolder(null);
                  setFolderSearches([]);
                }}
                className="px-3 py-2 border rounded-lg text-sm flex items-center gap-2"
              >
                <ArrowLeft size={16} />
                Back
              </button>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {selectedFolder.name}
                </h3>
                <p className="text-sm text-gray-600">
                  {selectedFolder.description || "Saved searches in this folder"}
                </p>
              </div>
            </div>
            <div className="text-sm text-gray-500">
              {folderSearches.length} searches
            </div>
          </div>

          {folderLoading ? (
            <div className="text-sm text-gray-600">Loading searches...</div>
          ) : folderSearches.length === 0 ? (
            <div className="text-sm text-gray-600">No searches in this folder.</div>
          ) : (
            <div className="divide-y">
              {folderSearches.map((search) => (
                <div key={search.id} className="py-4 flex flex-col gap-2">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                      <h4 className="font-semibold text-gray-900">
                        {search.search_name}
                      </h4>
                      <p className="text-sm text-gray-600">
                        {renderFilters(search.filters)}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Results: {search.result_count || 0}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => runSearch(search)}
                        className="px-3 py-2 rounded-lg bg-indigo-50 text-indigo-700 text-sm font-semibold"
                      >
                        Run Search
                      </button>
                      <select
                        value={search.folder_id || ""}
                        onChange={(e) => moveSearch(search.id, e.target.value)}
                        className="px-3 py-2 rounded-lg border text-sm bg-white"
                      >
                        <option value="">Unfiled</option>
                        {folders.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name}
                          </option>
                        ))}
                      </select>
                      {search.folder_id && (
                        <button
                          onClick={() => moveSearch(search.id, null)}
                          className="px-3 py-2 rounded-lg bg-red-50 text-red-700 text-sm font-semibold"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
