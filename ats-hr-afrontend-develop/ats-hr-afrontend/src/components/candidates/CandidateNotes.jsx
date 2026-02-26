// src/components/candidates/CandidateNotes.jsx
import React, { useEffect, useState } from "react";
import api from "../../api/axios";

/**
 * CandidateNotes
 * Props:
 * - candidateId
 *
 * Backend endpoints expected:
 * GET /v1/candidates/:id/notes
 * POST /v1/candidates/:id/notes   -> { note: "text here" }
 */

export default function CandidateNotes({ candidateId }) {
  const [notes, setNotes] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  // Load notes
  useEffect(() => {
    if (!candidateId) return;
    async function load() {
      try {
        const res = await api.get(`/v1/candidates/${candidateId}/notes`);
        setNotes(res.data.data || res.data || []);
      } catch (err) {
        console.error("Failed to load notes", err);
      }
    }
    load();
  }, [candidateId]);

  // Add note
  const addNote = async () => {
    if (!text.trim()) return;

    try {
      const res = await api.post(`/v1/candidates/${candidateId}/notes`, {
        note: text,
      });

      const newNote = res.data.data || res.data;

      setNotes((prev) => [newNote, ...prev]);
      setText("");
    } catch (err) {
      console.error(err);
      alert("Failed to save note");
    }
  };

  return (
    <div>
      <h4 className="text-sm font-semibold mb-2">Notes</h4>

      {/* Notes input */}
      <div className="mb-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write a note..."
          className="w-full p-2 border rounded text-sm"
          rows={3}
        />
        <button
          onClick={addNote}
          className="mt-2 bg-indigo-600 text-white px-3 py-1 rounded hover:bg-indigo-700 text-sm"
        >
          Add Note
        </button>
      </div>

      {/* List of notes */}
      <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
        {notes.length === 0 ? (
          <div className="text-xs text-gray-500">No notes yet.</div>
        ) : (
          notes.map((n, idx) => (
            <div key={idx} className="border p-2 rounded bg-gray-50">
              <div className="text-sm">{n.note}</div>
              <div className="text-xs text-gray-500 mt-1">
                {n.author || "Recruiter"} —{" "}
                {n.created_at
                  ? new Date(n.created_at).toLocaleString()
                  : ""}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}