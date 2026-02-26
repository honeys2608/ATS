// src/components/candidates/CandidateList.jsx
import React from "react";
import CandidateCard from "./CandidateCard";

/**
 * CandidateList
 * Props:
 * - candidates (array)
 * - onOpen(id)
 * - onChangeStatus(id,status)
 */
export default function CandidateList({ candidates = [], onOpen, onChangeStatus }) {
  if (!candidates || candidates.length === 0) {
    return <div style={{ padding: 12 }}>No candidates yet.</div>;
  }
  return (
    <div>
      {candidates.map((c) => (
        <CandidateCard key={c.id} candidate={c} onOpen={onOpen} onChangeStatus={onChangeStatus} />
      ))}
    </div>
  );
}
