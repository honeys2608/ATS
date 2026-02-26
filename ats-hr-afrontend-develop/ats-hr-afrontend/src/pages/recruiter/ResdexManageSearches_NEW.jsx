import React, { useState } from "react";
import {
  Search,
  Share2,
  Edit,
  Trash2,
  Bell,
  BellOff,
  Plus,
  Eye,
  AlertCircle,
  Copy,
  MoreVertical,
} from "lucide-react";

export default function ResdexManageSearches() {
  const [activeTab, setActiveTab] = useState("saved");
  const [searchName, setSearchName] = useState("");
  const [showNewSearch, setShowNewSearch] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [savedSearches, setSavedSearches] = useState([
    {
      id: 1,
      name: "React Developers",
      keywords: "React, JavaScript, Node.js",
      date: "2026-01-25",
      newProfiles: 12,
      alertsEnabled: true,
      results: 145,
    },
    {
      id: 2,
      name: "Senior Java Engineers",
      keywords: "Java, Spring Boot, Microservices",
      date: "2026-01-24",
      newProfiles: 5,
      alertsEnabled: true,
      results: 89,
    },
    {
      id: 3,
      name: "Data Scientists",
      keywords: "Python, Machine Learning, SQL",
      date: "2026-01-20",
      newProfiles: 0,
      alertsEnabled: false,
      results: 56,
    },
  ]);

  const [sharedSearches, setSharedSearches] = useState([
    {
      id: 1,
      name: "DevOps Engineers",
      keywords: "Docker, Kubernetes, AWS",
      sharedBy: "John Smith",
      date: "2026-01-22",
      alertsEnabled: false,
      results: 78,
    },
    {
      id: 2,
      name: "UI/UX Designers",
      keywords: "Figma, Adobe XD, Prototyping",
      sharedBy: "Sarah Johnson",
      date: "2026-01-21",
      alertsEnabled: true,
      results: 45,
    },
  ]);

  const [recentSearches, setRecentSearches] = useState([
    {
      id: 1,
      name: "PHP Developers",
      keywords: "PHP, Laravel, MySQL",
      date: "2026-01-25 10:30 AM",
    },
    {
      id: 2,
      name: "Frontend Engineers",
      keywords: "React, Vue, Angular",
      date: "2026-01-25 09:15 AM",
    },
    {
      id: 3,
      name: "Database Admins",
      keywords: "MySQL, PostgreSQL, MongoDB",
      date: "2026-01-24 04:45 PM",
    },
  ]);

  const handleSaveSearch = () => {
    if (searchName.trim()) {
      const newSearch = {
        id: Date.now(),
        name: searchName,
        keywords: "New search criteria",
        date: new Date().toISOString().split("T")[0],
        newProfiles: 0,
        alertsEnabled: true,
        results: 0,
      };
      setSavedSearches([newSearch, ...savedSearches]);
      setSearchName("");
      setShowNewSearch(false);
      alert("Search saved!");
    }
  };

  const handleDeleteSearch = (id) => {
    if (confirm("Delete this search?")) {
      setSavedSearches(savedSearches.filter((s) => s.id !== id));
    }
  };

  const handleToggleAlert = (id) => {
    setSavedSearches(
      savedSearches.map((s) =>
        s.id === id ? { ...s, alertsEnabled: !s.alertsEnabled } : s,
      ),
    );
  };

  const handleDuplicateSearch = (search) => {
    const newSearch = {
      ...search,
      id: Date.now(),
      name: `${search.name} (Copy)`,
      date: new Date().toISOString().split("T")[0],
    };
    setSavedSearches([newSearch, ...savedSearches]);
    alert("Search duplicated!");
  };

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Searches</h1>
          <p className="text-gray-600 mt-1">
            Manage, share and reuse your candidate searches
          </p>
        </div>
        <button
          onClick={() => setShowNewSearch(true)}
          className="px-4 py-2 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition flex items-center gap-2"
        >
          <Plus size={18} />
          New Search
        </button>
      </div>

      {/* TABS */}
      <div className="bg-white rounded-lg shadow-sm border-b">
        <div className="flex">
          {[
            { id: "saved", label: "Saved Searches", icon: "💾" },
            { id: "shared", label: "Shared with Me", icon: "🤝" },
            { id: "recent", label: "Recent Searches", icon: "🕐" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-6 py-4 font-semibold text-sm transition ${
                activeTab === tab.id
                  ? "text-purple-600 border-b-2 border-purple-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* CONTENT */}
      <div className="space-y-4">
        {/* SAVED SEARCHES */}
        {activeTab === "saved" && (
          <>
            {savedSearches.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm p-12 text-center">
                <Search size={48} className="mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  No saved searches yet
                </h3>
                <p className="text-gray-600 mb-6">
                  Create and save searches to reuse them later
                </p>
                <button
                  onClick={() => setShowNewSearch(true)}
                  className="px-4 py-2 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition"
                >
                  Create Search
                </button>
              </div>
            ) : (
              savedSearches.map((search) => (
                <div
                  key={search.id}
                  className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-900">
                        {search.name}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {search.keywords}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleToggleAlert(search.id)}
                        className={`p-2 rounded-lg transition ${
                          search.alertsEnabled
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-700"
                        }`}
                        title={
                          search.alertsEnabled
                            ? "Alerts enabled"
                            : "Alerts disabled"
                        }
                      >
                        {search.alertsEnabled ? (
                          <Bell size={18} />
                        ) : (
                          <BellOff size={18} />
                        )}
                      </button>
                      <button
                        onClick={() => handleDuplicateSearch(search)}
                        className="p-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition"
                        title="Duplicate"
                      >
                        <Copy size={18} />
                      </button>
                      <button
                        onClick={() => handleDeleteSearch(search.id)}
                        className="p-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition"
                        title="Delete"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase">
                        Total Results
                      </p>
                      <p className="text-2xl font-bold text-gray-900">
                        {search.results}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase">
                        New Profiles
                      </p>
                      <p className="text-2xl font-bold text-green-600">
                        +{search.newProfiles}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase">
                        Saved
                      </p>
                      <p className="text-sm text-gray-600">{search.date}</p>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4">
                    <button className="flex-1 px-4 py-2 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition flex items-center justify-center gap-2">
                      <Eye size={16} />
                      Search Profiles
                    </button>
                    <button className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition flex items-center justify-center gap-2">
                      <Share2 size={16} />
                      Share
                    </button>
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {/* SHARED SEARCHES */}
        {activeTab === "shared" && (
          <>
            {sharedSearches.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm p-12 text-center">
                <AlertCircle size={48} className="mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  No shared searches
                </h3>
                <p className="text-gray-600">
                  No one has shared searches with you yet
                </p>
              </div>
            ) : (
              sharedSearches.map((search) => (
                <div
                  key={search.id}
                  className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-900">
                        {search.name}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {search.keywords}
                      </p>
                      <p className="text-xs text-gray-500 mt-2">
                        Shared by{" "}
                        <span className="font-semibold">{search.sharedBy}</span>
                      </p>
                    </div>
                    <button
                      onClick={() => handleToggleAlert(search.id)}
                      className={`p-2 rounded-lg transition ${
                        search.alertsEnabled
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {search.alertsEnabled ? (
                        <Bell size={18} />
                      ) : (
                        <BellOff size={18} />
                      )}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase">
                        Total Results
                      </p>
                      <p className="text-2xl font-bold text-gray-900">
                        {search.results}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase">
                        Received
                      </p>
                      <p className="text-sm text-gray-600">{search.date}</p>
                    </div>
                  </div>

                  <button className="w-full mt-4 px-4 py-2 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition flex items-center justify-center gap-2">
                    <Eye size={16} />
                    View Results
                  </button>
                </div>
              ))
            )}
          </>
        )}

        {/* RECENT SEARCHES */}
        {activeTab === "recent" && (
          <>
            {recentSearches.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm p-12 text-center">
                <AlertCircle size={48} className="mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  No recent searches
                </h3>
                <p className="text-gray-600">
                  Your recent searches will appear here
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentSearches.map((search) => (
                  <div
                    key={search.id}
                    className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition flex items-center justify-between"
                  >
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900">
                        {search.name}
                      </h4>
                      <p className="text-sm text-gray-600">{search.keywords}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {search.date}
                      </p>
                    </div>
                    <button className="px-4 py-2 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition">
                      Search
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* NEW SEARCH MODAL */}
      {showNewSearch && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              Create New Search
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Search Name
                </label>
                <input
                  type="text"
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                  placeholder="e.g., Senior React Developers"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleSaveSearch}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition"
                >
                  Create
                </button>
                <button
                  onClick={() => setShowNewSearch(false)}
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
