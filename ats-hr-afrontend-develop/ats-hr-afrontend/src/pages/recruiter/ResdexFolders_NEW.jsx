import React, { useState } from "react";
import {
  Folder,
  FolderPlus,
  Share2,
  Edit,
  Trash2,
  Users,
  Calendar,
  X,
  ChevronRight,
  MessageSquare,
  Trash,
  Eye,
  Copy,
  Send,
} from "lucide-react";

export default function ResdexFolders() {
  const [viewMode, setViewMode] = useState("folders");
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameFolderId, setRenameFolderId] = useState(null);
  const [renameValue, setRenameValue] = useState("");

  const [folders, setFolders] = useState([
    {
      id: 1,
      name: "Hot Candidates",
      candidateCount: 24,
      createdDate: "2026-01-20",
      isSystemFolder: true,
      isShared: false,
      sharedWith: [],
    },
    {
      id: 2,
      name: "React Developers",
      candidateCount: 18,
      createdDate: "2026-01-22",
      isSystemFolder: false,
      isShared: true,
      sharedWith: ["john.doe@company.com"],
    },
    {
      id: 3,
      name: "Senior Engineers",
      candidateCount: 35,
      createdDate: "2026-01-19",
      isSystemFolder: false,
      isShared: false,
      sharedWith: [],
    },
    {
      id: 4,
      name: "Contacted Candidates",
      candidateCount: 12,
      createdDate: "2026-01-15",
      isSystemFolder: true,
      isShared: false,
      sharedWith: [],
    },
  ]);

  const [folderCandidates, setFolderCandidates] = useState([
    {
      id: 1,
      name: "Raj Kumar",
      designation: "React Developer",
      experience: 5,
      location: "Bangalore",
      addedDate: "2026-01-22",
      comment: "Great technical skills",
    },
    {
      id: 2,
      name: "Priya Singh",
      designation: "Senior Frontend Engineer",
      experience: 7,
      location: "Pune",
      addedDate: "2026-01-21",
      comment: "Excellent communication",
    },
    {
      id: 3,
      name: "Amit Patel",
      designation: "Full Stack Developer",
      experience: 4,
      location: "Mumbai",
      addedDate: "2026-01-20",
      comment: "Available immediately",
    },
  ]);

  const handleCreateFolder = () => {
    if (folderName.trim()) {
      const newFolder = {
        id: Date.now(),
        name: folderName,
        candidateCount: 0,
        createdDate: new Date().toISOString().split("T")[0],
        isSystemFolder: false,
        isShared: false,
        sharedWith: [],
      };
      setFolders([newFolder, ...folders]);
      setFolderName("");
      setShowNewFolderModal(false);
      alert("Folder created!");
    }
  };

  const handleOpenFolder = (folderId) => {
    setSelectedFolder(folderId);
    setViewMode("folder-contents");
  };

  const handleBackToFolders = () => {
    setViewMode("folders");
    setSelectedFolder(null);
  };

  const handleRenameFolder = () => {
    if (renameValue.trim()) {
      setFolders(
        folders.map((f) =>
          f.id === renameFolderId ? { ...f, name: renameValue } : f,
        ),
      );
      setRenameFolderId(null);
      setRenameValue("");
      setShowRenameModal(false);
      alert("Folder renamed!");
    }
  };

  const handleDeleteFolder = (folderId) => {
    if (confirm("Delete this folder?")) {
      setFolders(folders.filter((f) => f.id !== folderId));
    }
  };

  const handleDeleteCandidate = (candidateId) => {
    if (confirm("Remove this candidate from folder?")) {
      setFolderCandidates(folderCandidates.filter((c) => c.id !== candidateId));
    }
  };

  const currentFolder = folders.find((f) => f.id === selectedFolder);

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Folders</h1>
          <p className="text-gray-600 mt-1">
            Organize and manage candidate folders
          </p>
        </div>
        {viewMode === "folders" && (
          <button
            onClick={() => setShowNewFolderModal(true)}
            className="px-4 py-2 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition flex items-center gap-2"
          >
            <FolderPlus size={18} />
            New Folder
          </button>
        )}
        {viewMode === "folder-contents" && (
          <button
            onClick={handleBackToFolders}
            className="px-4 py-2 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-700 transition flex items-center gap-2"
          >
            <ChevronRight size={18} className="rotate-180" />
            Back
          </button>
        )}
      </div>

      {/* FOLDER LIST VIEW */}
      {viewMode === "folders" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {folders.map((folder) => (
            <div
              key={folder.id}
              className="bg-white rounded-lg shadow-sm hover:shadow-md transition p-6 group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3 flex-1">
                  <Folder size={32} className="text-purple-600" />
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 text-lg">
                      {folder.name}
                    </h3>
                    {folder.isSystemFolder && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded mt-1 inline-block">
                        System
                      </span>
                    )}
                  </div>
                </div>
                <div className="opacity-0 group-hover:opacity-100 transition flex gap-1">
                  {!folder.isSystemFolder && (
                    <>
                      <button
                        onClick={() => {
                          setRenameFolderId(folder.id);
                          setRenameValue(folder.name);
                          setShowRenameModal(true);
                        }}
                        className="p-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition"
                        title="Rename"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteFolder(folder.id)}
                        className="p-2 bg-red-100 text-red-700 rounded hover:bg-red-200 transition"
                        title="Delete"
                      >
                        <Trash size={16} />
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 py-4 border-y text-sm">
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold">
                    Candidates
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    {folder.candidateCount}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold">
                    Created
                  </p>
                  <p className="text-sm text-gray-600">{folder.createdDate}</p>
                </div>
              </div>

              {folder.isShared && (
                <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center gap-2 text-sm text-green-700">
                    <Share2 size={14} />
                    <span className="font-semibold">
                      Shared with {folder.sharedWith.length}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => handleOpenFolder(folder.id)}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition flex items-center justify-center gap-2"
                >
                  <Eye size={16} />
                  Open
                </button>
                {!folder.isSystemFolder && (
                  <button
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition flex items-center justify-center gap-2"
                    title="Share"
                  >
                    <Share2 size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* FOLDER CONTENTS VIEW */}
      {viewMode === "folder-contents" && currentFolder && (
        <div className="space-y-6">
          {/* FOLDER INFO HEADER */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center gap-4 mb-4">
              <Folder size={40} className="text-purple-600" />
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {currentFolder.name}
                </h2>
                <p className="text-gray-600">
                  {folderCandidates.length} candidates
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <button className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition flex items-center gap-2">
                <Users size={16} />
                Add Candidates
              </button>
              <button className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition flex items-center gap-2">
                <Send size={16} />
                Send NVite
              </button>
              {!currentFolder.isSystemFolder && (
                <button className="px-4 py-2 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition flex items-center gap-2">
                  <Share2 size={16} />
                  Share
                </button>
              )}
            </div>
          </div>

          {/* CANDIDATES TABLE */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            {folderCandidates.length === 0 ? (
              <div className="text-center py-12">
                <Users size={48} className="mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  No candidates yet
                </h3>
                <p className="text-gray-600">
                  Add candidates to this folder to organize them
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">
                        Name
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">
                        Designation
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">
                        Experience
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">
                        Location
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">
                        Added
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {folderCandidates.map((candidate) => (
                      <tr
                        key={candidate.id}
                        className="border-b hover:bg-gray-50"
                      >
                        <td className="py-3 px-4 font-semibold text-gray-900">
                          {candidate.name}
                        </td>
                        <td className="py-3 px-4 text-gray-600">
                          {candidate.designation}
                        </td>
                        <td className="py-3 px-4 text-gray-600">
                          {candidate.experience} yrs
                        </td>
                        <td className="py-3 px-4 text-gray-600">
                          {candidate.location}
                        </td>
                        <td className="py-3 px-4 text-gray-600">
                          {candidate.addedDate}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex gap-2">
                            <button
                              className="p-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition"
                              title="Comment"
                            >
                              <MessageSquare size={14} />
                            </button>
                            <button
                              onClick={() =>
                                handleDeleteCandidate(candidate.id)
                              }
                              className="p-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition"
                              title="Remove"
                            >
                              <Trash size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* NEW FOLDER MODAL */}
      {showNewFolderModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              Create New Folder
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Folder Name
                </label>
                <input
                  type="text"
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                  placeholder="e.g., React Specialists"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleCreateFolder}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition"
                >
                  Create
                </button>
                <button
                  onClick={() => setShowNewFolderModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RENAME FOLDER MODAL */}
      {showRenameModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              Rename Folder
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  New Name
                </label>
                <input
                  type="text"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleRenameFolder}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition"
                >
                  Rename
                </button>
                <button
                  onClick={() => {
                    setShowRenameModal(false);
                    setRenameFolderId(null);
                  }}
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
