import React, { useEffect, useState } from "react";
import { getConsultantTimesheets } from "../../services/timesheetService";
import { useNavigate } from "react-router-dom";

const getStatusBadge = (status) => {
  const map = {
    draft: "🟡 Draft",
    submitted: "🔵 Submitted",
    am_approved: "🟣 AM Approved",
    client_approved: "🟢 Client Approved",
    rejected: "🔴 Rejected",
    locked: "⚫ Locked",
  };

  return map[status] || status;
};

export default function MyTimesheets() {
  const [timesheets, setTimesheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const loadTimesheets = async () => {
    try {
      const res = await getConsultantTimesheets();
      setTimesheets(res?.timesheets || res?.data?.timesheets || []);
    } catch (e) {
      alert("Failed to load timesheets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTimesheets();
  }, []);
  useEffect(() => {
    const onFocus = () => loadTimesheets();
    window.addEventListener("focus", onFocus);

    return () => window.removeEventListener("focus", onFocus);
  }, []);

  if (loading) return <p>Loading...</p>;

  return (
    <div style={{ padding: 20 }}>
      <h2>My Timesheets</h2>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <p style={{ color: "#555" }}>Total Timesheets: {timesheets.length}</p>

        <button
          style={{
            padding: "8px 16px",
            background: "#2563eb",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
          }}
          onClick={() => navigate("/consultant/timesheets/new")}
        >
          + Create Timesheet
        </button>
      </div>

      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          marginTop: 12,
        }}
      >
        <thead>
          <tr style={{ background: "#f9fafb" }}>
            <th style={th}>Period</th>
            <th style={th}>Total Hours</th>
            <th style={th}>Status</th>
            <th style={th}>Action</th>
          </tr>
        </thead>

        <tbody>
          {timesheets.length === 0 ? (
            <tr>
              <td
                colSpan="4"
                style={{
                  textAlign: "center",
                  padding: 40,
                  color: "#777",
                }}
              >
                <div>
                  <p>No timesheets created yet.</p>

                  <button
                    style={{
                      marginTop: 12,
                      padding: "8px 16px",
                      background: "#2563eb",
                      color: "#fff",
                      border: "none",
                      borderRadius: 4,
                      cursor: "pointer",
                    }}
                    onClick={() => navigate("/consultant/timesheets/new")}
                  >
                    + Create First Timesheet
                  </button>
                </div>
              </td>
            </tr>
          ) : (
            timesheets.map((t) => (
              <tr key={t.id}>
                <td style={td}>
                  {t.period_start} → {t.period_end}
                </td>
                <td style={td}>{t.total_hours}</td>
                <td style={td}>{getStatusBadge(t.status)}</td>
                <td style={td}>
                  {(t.status === "draft" || t.status === "rejected") && (
                    <button
                      style={{
                        padding: "4px 10px",
                        background: "#fde68a",
                        border: "1px solid #f59e0b",
                        borderRadius: 4,
                        cursor: "pointer",
                      }}
                      onClick={() =>
                        navigate(`/consultant/timesheets/edit/${t.id}`)
                      }
                    >
                      Edit
                    </button>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

const th = {
  border: "1px solid #e5e7eb",
  padding: "10px",
  textAlign: "left",
  fontWeight: 600,
};

const td = {
  border: "1px solid #e5e7eb",
  padding: "10px",
};
