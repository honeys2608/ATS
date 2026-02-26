// src/components/candidates/CandidateTimeline.jsx
import React, { useEffect, useState } from "react";
import axios from "../../api/axios";

/**
 * CandidateTimeline
 * Props:
 * - candidateId (string|number) optional
 * - initialTimeline (array) optional — array of { status, by, at, note }
 *
 * Behavior:
 * - If initialTimeline passed and not empty => use it.
 * - Otherwise try to GET /v1/candidates/:id/timeline and use that.
 *
 * Timeline items expected shape:
 * { status: "screening", by: "Alice", at: "2025-11-24T10:12:00Z", note: "Phone screen completed" }
 */
export default function CandidateTimeline({ candidateId, initialTimeline = [] }) {
  const [timeline, setTimeline] = useState(initialTimeline || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      // if initial timeline provided and not empty, use that
      if (initialTimeline && initialTimeline.length > 0) {
        setTimeline(initialTimeline);
        return;
      }

      if (!candidateId) {
        setTimeline([]);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const res = await axios.get(`/v1/candidates/${candidateId}/timeline`);
        if (!mounted) return;
        const data = res.data?.data || res.data || [];
        // Normalize: make sure items have at least {status, at}
        const normalized = (data || []).map((it) => ({
          status: it.status || it.event || "updated",
          by: it.by || it.actor || it.user || "",
          at: it.at || it.timestamp || it.created_at || it.createdAt || "",
          note: it.note || it.message || "",
          ...it,
        }));
        setTimeline(normalized);
      } catch (err) {
        console.warn("Failed to load timeline", err);
        if (mounted) setError(err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => { mounted = false; };
  }, [candidateId, initialTimeline]);

  if (loading) return <div className="text-sm text-gray-500">Loading timeline...</div>;
  if (error) return <div className="text-sm text-red-600">Failed to load timeline.</div>;
  if (!timeline || timeline.length === 0) return <div className="text-sm text-gray-500">No timeline events yet.</div>;

  // Sort descending (newest first). Change to ascending if you prefer.
  const sorted = [...timeline].sort((a, b) => new Date(b.at) - new Date(a.at));

  return (
    <div className="space-y-3">
      {sorted.map((ev, idx) => (
        <div key={idx} className="flex gap-3">
          <div className="flex-shrink-0">
            <div className="w-3 h-3 rounded-full bg-indigo-600 mt-1" aria-hidden="true" />
            {idx < sorted.length - 1 && <div className="w-px h-full bg-gray-200 mx-auto" style={{ height: 40, marginTop: 6 }} />}
          </div>

          <div className="flex-1">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold capitalize">{(ev.status || "updated").replace(/_/g, " ")}</div>
              <div className="text-xs text-gray-500">{ev.by || ""}</div>
            </div>

            <div className="text-xs text-gray-500">{ev.at ? new Date(ev.at).toLocaleString() : ""}</div>

            {ev.note && <div className="mt-1 text-sm text-gray-700">{ev.note}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}
