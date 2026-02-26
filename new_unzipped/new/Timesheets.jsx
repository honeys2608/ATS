import React, { useEffect, useState } from "react";
import {
  getAMTimesheets,
  approveTimesheetByAM,
  rejectTimesheet,
} from "../../services/timesheetService";
import { formatStatus } from "../../utils/formatStatus";

export default function AMTimesheets() {
  const [timesheets, setTimesheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectId, setRejectId] = useState(null);

  // ---------------------------
  // Load AM timesheets
  // ---------------------------
  const loadTimesheets = async () => {
    try {
      setLoading(true);
      const res = await getAMTimesheets();
      setTimesheets(res?.timesheets || []);
    } catch (err) {
      console.error(err);
      alert("Failed to load timesheets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTimesheets();
  }, []);

  // ---------------------------
  // Approve
  // ---------------------------
  const handleApprove = async (id) => {
    if (!window.confirm("Approve this timesheet?")) return;
    try {
      await approveTimesheetByAM(id);
      alert("Timesheet approved");
      loadTimesheets();
    } catch (err) {
      console.error(err);
      alert("Approval failed");
    }
  };

  // ---------------------------
  // Reject
  // ---------------------------
  const handleReject = async () => {
    if (!rejectReason.trim()) {
      alert("Please enter rejection reason");
      return;
    }
    try {
      await rejectTimesheet(rejectId, rejectReason);
      alert("Timesheet rejected");
      setRejectId(null);
      setRejectReason("");
      loadTimesheets();
    } catch (err) {
      console.error(err);
      alert("Reject failed");
    }
  };

  if (loading) return <p style={{ padding: 24 }}>Loading timesheets...</p>;

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <h2 style={{ marginBottom: 20 }}>Pending Timesheets</h2>

      {timesheets.length === 0 && (
        <div
          style={{
            background: "#ffffff",
            border: "1px dashed #e5e7eb",
            borderRadius: 12,
            padding: "48px 24px",
            textAlign: "center",
            color: "#6b7280",
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 12 }}>🗂️</div>

          <h3 style={{ fontSize: 18, color: "#111827", marginBottom: 6 }}>
            No Pending Timesheets
          </h3>

          <p style={{ fontSize: 14 }}>
            All submitted timesheets have been reviewed.
            <br />
            New submissions will appear here.
          </p>
        </div>
      )}

      {timesheets.map((t) => (
        <div key={t.id} style={card}>
          {/* HEADER */}
          <div style={cardHeader}>
            <div>
              <h3 style={{ margin: 0, fontSize: 18 }}>
                {t.consultant_name || "—"}
              </h3>
              <span style={muted}>Consultant</span>
            </div>

            <span style={statusBadge}>
              {formatStatus(t.status) === "—"
                ? "Submitted"
                : formatStatus(t.status)}
            </span>
          </div>

          {/* BODY */}
          <div style={cardBody}>
            <p>
              <b>Client:</b> {t.client_name || "—"}
            </p>

            <p>
              <b>Period:</b> {formatDate(t.period_start)} –{" "}
              {formatDate(t.period_end)}
            </p>

            <div style={totalHours}>⏱ Total Hours: {t.total_hours}</div>

            <div style={{ marginTop: 16 }}>
              <h4 style={{ marginBottom: 8 }}>Entries</h4>

              <table style={table}>
                <thead>
                  <tr>
                    <th style={th}>Date</th>
                    <th style={th}>Hours</th>
                    <th style={th}>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {t.entries?.map((e) => (
                    <tr key={e.id}>
                      <td style={td}>{formatDate(e.work_date)}</td>
                      <td style={td}>{e.hours}</td>
                      <td style={td}>{e.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ACTIONS */}
          <div style={cardActions}>
            <button style={approveBtn} onClick={() => handleApprove(t.id)}>
              Approve
            </button>
            <button style={rejectBtn} onClick={() => setRejectId(t.id)}>
              Reject
            </button>
          </div>
        </div>
      ))}

      {/* REJECT MODAL */}
      {rejectId && (
        <div style={modalOverlay}>
          <div style={modal}>
            <h3 style={{ marginTop: 0 }}>Reject Timesheet</h3>

            <textarea
              rows={4}
              placeholder="Enter rejection reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              style={textarea}
            />

            <div style={{ marginTop: 14, textAlign: "right" }}>
              <button onClick={() => setRejectId(null)} style={secondaryBtn}>
                Cancel
              </button>
              <button onClick={handleReject} style={rejectBtn}>
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* =======================
   Helpers
======================= */
const formatDate = (d) => (d ? new Date(d).toLocaleDateString("en-GB") : "—");

/* =======================
   Styles
======================= */
const card = {
  background: "#fff",
  borderRadius: 10,
  padding: 18,
  marginBottom: 18,
  boxShadow: "0 4px 10px rgba(0,0,0,0.08)",
};

const cardHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 8,
};

const muted = {
  fontSize: 13,
  color: "#6b7280",
};

const statusBadge = {
  background: "#fef3c7",
  color: "#92400e",
  padding: "4px 12px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 500,
};

const cardBody = {
  marginTop: 14,
};

const totalHours = {
  marginTop: 6,
  fontSize: 16,
  fontWeight: 600,
  color: "#111827",
};

const table = {
  width: "100%",
  borderCollapse: "collapse",
  marginTop: 8,
};

const th = {
  textAlign: "left",
  padding: "8px",
  fontSize: 13,
  background: "#f9fafb",
  borderBottom: "1px solid #e5e7eb",
};

const td = {
  padding: "8px",
  fontSize: 14,
  borderBottom: "1px solid #e5e7eb",
};

const cardActions = {
  marginTop: 16,
  display: "flex",
  gap: 10,
};

const approveBtn = {
  background: "#16a34a",
  color: "#fff",
  border: "none",
  padding: "8px 18px",
  borderRadius: 6,
  cursor: "pointer",
  fontWeight: 500,
};

const rejectBtn = {
  background: "#dc2626",
  color: "#fff",
  border: "none",
  padding: "8px 18px",
  borderRadius: 6,
  cursor: "pointer",
  fontWeight: 500,
};

const secondaryBtn = {
  background: "#e5e7eb",
  border: "none",
  padding: "8px 18px",
  borderRadius: 6,
  marginRight: 8,
};

const modalOverlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const modal = {
  background: "#fff",
  padding: 20,
  borderRadius: 10,
  width: 420,
};

const textarea = {
  width: "100%",
  padding: 10,
  borderRadius: 6,
  border: "1px solid #d1d5db",
};
