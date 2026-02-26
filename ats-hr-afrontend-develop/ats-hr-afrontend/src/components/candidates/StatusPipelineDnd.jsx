// src/components/candidates/StatusPipelineDnd.jsx
import React, { useMemo, useState, useEffect } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

/**
 * Improved pipeline:
 * - onCardClick(candidateId) -> open detail in right pane
 * - hover transform + subtle shadow
 * - title tooltip shows quick preview
 * - keyboard accessible (Enter/Space opens card)
 * - horizontal scroll snapping for mobile
 *
 * Props:
 * - candidates: array
 * - onStatusChange(id, newStatus) => Promise
 * - onCardClick(id) optional
 * - statuses: ordered array
 * - allowedTransitions: optional map
 */
const DEFAULT_STATUSES = [
  "new",
  "screening",
  "interview_scheduled",
  "interview_completed",
  "offer_extended",
  "offer_accepted",
  "hired",
  "rejected",
];

export default function StatusPipelineDnd({
  candidates = [],
  onStatusChange,
  onCardClick = null,
  statuses = DEFAULT_STATUSES,
  allowedTransitions = null,
}) {
  // grouped map status -> candidate objects
  const grouped = useMemo(() => {
    const map = {};
    statuses.forEach((s) => (map[s] = []));
    (candidates || []).forEach((c) => {
      const s = c.status || "new";
      if (!map[s]) map[s] = [];
      map[s].push(c);
    });
    return map;
  }, [candidates, statuses]);

  // local id lists per column for instant visual feedback
  const [columns, setColumns] = useState(
    () => statuses.reduce((acc, s) => ({ ...acc, [s]: (grouped[s] || []).map((c) => c.id) }), {})
  );

  useEffect(() => {
    setColumns(statuses.reduce((acc, s) => ({ ...acc, [s]: (grouped[s] || []).map((c) => c.id) }), {}));
  }, [candidates, statuses]); // keep sync when prop changes

  const findCandidate = (id) => (candidates || []).find((c) => c.id === id);

  // drag end
  const onDragEnd = async (result) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;

    const fromStatus = source.droppableId;
    const toStatus = destination.droppableId;
    if (fromStatus === toStatus && source.index === destination.index) return;

    if (allowedTransitions && allowedTransitions[fromStatus]) {
      const allowed = allowedTransitions[fromStatus];
      if (!allowed.includes(toStatus)) {
        alert(`Cannot move from "${fromStatus}" to "${toStatus}".`);
        return;
      }
    }

    // optimistic local update
    const newColumns = { ...columns };
    const src = Array.from(newColumns[fromStatus] || []);
    const [moved] = src.splice(source.index, 1);
    const dst = Array.from(newColumns[toStatus] || []);
    dst.splice(destination.index, 0, moved);
    newColumns[fromStatus] = src;
    newColumns[toStatus] = dst;
    setColumns(newColumns);

    try {
      await onStatusChange(draggableId, toStatus);
      // parent fetch or update will sync final data
    } catch (err) {
      console.error("status update failed", err);
      // rollback
      setColumns(statuses.reduce((acc, s) => ({ ...acc, [s]: (grouped[s] || []).map((c) => c.id) }), {}));
      alert("Failed to update status on server. Reverting.");
    }
  };

  // small helper to render a compact card
  function Card({ candidate, index }) {
    const skills = candidate.parsed_resume?.skills || [];
    const tooltip = `${candidate.name || candidate.email || "Candidate"} — ${candidate.email || candidate.phone || ""} \nSkills: ${skills.slice(0,5).join(", ")}`;

    const cardStyle = {
      userSelect: "none",
      padding: 10,
      borderRadius: 8,
      transition: "transform 150ms ease, box-shadow 150ms ease",
      background: "#fff",
      border: "1px solid #e6edf3",
      cursor: onCardClick ? "pointer" : "grab",
    };

    return (
      <div
        role="button"
        tabIndex={0}
        title={tooltip}
        aria-label={candidate.name || candidate.email}
        onClick={() => onCardClick && onCardClick(candidate.id)}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && onCardClick) {
            e.preventDefault();
            onCardClick(candidate.id);
          }
        }}
        style={{ outline: "none" }}
      >
        <div style={cardStyle} className="status-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{candidate.name || candidate.email}</div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>{candidate.email ? candidate.email.split("@")[0] : candidate.phone}</div>
          </div>
          <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
            {skills.slice(0, 3).map((s, i) => (
              <span key={i} style={{ background: "#eef2ff", color: "#3730a3", padding: "2px 6px", borderRadius: 6, fontSize: 12 }}>
                {s}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // wrapper styles: horizontal snap and responsive column sizing
  const containerStyle = {
    display: "flex",
    gap: 12,
    paddingBottom: 12,
    overflowX: "auto",
    scrollSnapType: "x mandatory",
    WebkitOverflowScrolling: "touch",
  };

  const columnStyle = {
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    minWidth: 260,
    maxWidth: 320,
    padding: 12,
    display: "flex",
    flexDirection: "column",
    height: "auto",
    scrollSnapAlign: "start",
    background: "#fff",
  };

  return (
    <div style={{ margin: "8px 0" }}>
      <DragDropContext onDragEnd={onDragEnd}>
        <div style={containerStyle}>
          {statuses.map((status) => (
            <Droppable droppableId={status} key={status}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  style={{
                    ...columnStyle,
                    background: snapshot.isDraggingOver ? "#fbfbff" : "#fff",
                    minWidth: 220,
                    maxWidth: 360,
                    boxShadow: snapshot.isDraggingOver ? "0 8px 24px rgba(99,102,241,0.06)" : "none"
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: 8, textTransform: "capitalize", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>{status.replace(/_/g, " ")}</div>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>{(columns[status] || []).length}</div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 8, minHeight: 40 }}>
                    {(columns[status] || []).map((candidateId, index) => {
                      const candidate = findCandidate(candidateId);
                      if (!candidate) return null;

                      return (
                        <Draggable key={candidateId} draggableId={candidateId} index={index}>
                          {(dragProvided, dragSnapshot) => (
                            <div
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              {...dragProvided.dragHandleProps}
                              style={{
                                ...dragProvided.draggableProps.style,
                                transform: dragSnapshot.isDragging ? `${dragProvided.draggableProps.style?.transform || ""} translateZ(0)` : dragProvided.draggableProps.style?.transform,
                                boxShadow: dragSnapshot.isDragging ? "0 8px 24px rgba(15,23,42,0.12)" : "none"
                              }}
                            >
                              <div style={{ borderRadius: 6, overflow: "hidden" }}>
                                {/* Card is clickable and keyboard accessible */}
                                <div
                                  onClick={() => onCardClick && onCardClick(candidate.id)}
                                  onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && onCardClick) { e.preventDefault(); onCardClick(candidate.id); } }}
                                  role={onCardClick ? "button" : undefined}
                                  tabIndex={onCardClick ? 0 : undefined}
                                >
                                  <div style={{ padding: 6 }}>
                                    <Card candidate={candidate} index={index} />
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      );
                    })}
                    {provided.placeholder}
                  </div>
                </div>
              )}
            </Droppable>
          ))}
        </div>
      </DragDropContext>

      {/* small CSS injection for hover effect (scoped inline styles keep this simple) */}
      <style>{`
        .status-card:hover { transform: translateY(-6px); box-shadow: 0 10px 30px rgba(2,6,23,0.08); }
        @media (max-width: 768px) {
          /* narrower columns on mobile */
          .status-card { font-size: 13px; }
        }
      `}</style>
    </div>
  );
}
