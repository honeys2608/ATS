import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../../api/axios";
import {
  saveTimesheet,
  submitTimesheet,
} from "../../services/timesheetService";

export default function Timesheets() {
  const { id } = useParams(); // timesheet id (edit mode)
  const navigate = useNavigate();

  const [deployment, setDeployment] = useState(null);
  const [deploymentId, setDeploymentId] = useState("");

  const [periodType, setPeriodType] = useState("weekly");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");

  const [entries, setEntries] = useState([
    { work_date: "", hours: 0, description: "" },
  ]);

  const [timesheetId, setTimesheetId] = useState(null);
  const [timesheetStatus, setTimesheetStatus] = useState("draft");

  const [loading, setLoading] = useState(false);
  const isReadOnly = !["draft", "rejected"].includes(timesheetStatus);

  // ======================================================
  // LOAD DATA (NEW OR EDIT)
  // ======================================================
  useEffect(() => {
    if (id) {
      loadExistingTimesheet(id);
    } else {
      loadActiveDeployment();
    }
  }, [id]);

  // ======================================================
  // LOAD ACTIVE DEPLOYMENT (NEW TIMESHEET)
  // ======================================================
  const loadActiveDeployment = async () => {
    try {
      const res = await api.get("/v1/consultant/dashboard");
      const active =
        res.data?.active_deployment || res.data?.data?.active_deployment;

      if (!active) {
        alert("No active deployment found");
        return;
      }

      setDeployment(active);
      setDeploymentId(active.id);
    } catch (err) {
      console.error(err);
      alert("Failed to load deployment");
    }
  };

  // ======================================================
  // LOAD EXISTING TIMESHEET (EDIT MODE)
  // ======================================================
  const loadExistingTimesheet = async (timesheetId) => {
    try {
      const res = await api.get(`/v1/timesheets/${timesheetId}`);
      const t = res.data?.data || res.data;

      setTimesheetId(t.id);
      setDeploymentId(t.deployment_id);

      setPeriodType(t.period_type);

      // 🔧 FIX DATE FORMAT FOR INPUT TYPE="date"
      setPeriodStart(t.period_start?.slice(0, 10));
      setPeriodEnd(t.period_end?.slice(0, 10));

      setTimesheetStatus(t.status);

      // 🔧 FIX ENTRY DATES FORMAT
      setEntries(
        t.entries?.length
          ? t.entries.map((e) => {
              const wd = e.work_date?.slice(0, 10);
              if (
                wd < t.period_start?.slice(0, 10) ||
                wd > t.period_end?.slice(0, 10)
              ) {
                return { ...e, work_date: "" };
              }
              return { ...e, work_date: wd };
            })
          : [{ work_date: "", hours: 0, description: "" }]
      );
    } catch (err) {
      console.error(err);
      alert("Failed to load timesheet");
    }
  };

  // ======================================================
  // ADD ROW
  // ======================================================
  const addRow = () => {
    setEntries([...entries, { work_date: "", hours: 0, description: "" }]);
  };

  // ======================================================
  // UPDATE ENTRY
  // ======================================================
  const updateEntry = (index, field, value) => {
    const updated = [...entries];
    updated[index][field] = value;
    setEntries(updated);
  };

  // ======================================================
  // SAVE (DRAFT)
  // ======================================================
  const handleSave = async () => {
    console.log("🟡 SAVE CLICKED");
    console.log("deploymentId:", deploymentId);
    console.log("current timesheetId BEFORE save:", timesheetId);

    if (!deploymentId) {
      alert("No deployment found");
      return;
    }

    if (periodEnd < periodStart) {
      alert("End date cannot be before start date");
      return;
    }
    // 🔒 Validate work dates inside period
    for (let e of entries) {
      if (!e.work_date) {
        alert("Work date is required");
        return;
      }

      if (e.work_date < periodStart || e.work_date > periodEnd) {
        alert("Work date must be within selected period");
        return;
      }
    }

    try {
      setLoading(true);

      const payload = {
        period_type: periodType,
        period_start: periodStart,
        period_end: periodEnd,
        entries,
      };

      const res = await saveTimesheet(deploymentId, payload);
      console.log("✅ SAVE RESPONSE ID:", res.id);
      setTimesheetStatus("draft");
      setTimesheetId(res.id);

      // 🔥 FORCE navigation to edit mode
      navigate(`/consultant/timesheets/edit/${res.id}`);

      alert("Timesheet saved as draft");
    } catch (err) {
      console.error(err);
      alert("Failed to save timesheet");
    } finally {
      setLoading(false);
    }
  };

  // ======================================================
  // SUBMIT
  // ======================================================
  const handleSubmit = async () => {
    console.log("🔵 SUBMIT CLICKED");
    console.log("timesheetId at submit time:", timesheetId);

    if (!timesheetId) {
      alert("Timesheet ID missing");
      return;
    }

    try {
      setLoading(true);

      const check = await api.get(`/v1/timesheets/${timesheetId}`);
      const latestStatus = check.data?.data?.status || check.data?.status;

      if (latestStatus !== "draft") {
        alert("Timesheet already submitted");
        return;
      }

      // ❗ IMPORTANT: DO NOT CALL SAVE API IN EDIT MODE
      await submitTimesheet(timesheetId);

      alert("Timesheet submitted successfully");
      navigate("/consultant/timesheets");
    } catch (err) {
      console.error(err.response?.data || err);
      alert(err.response?.data?.detail || "Submit failed");
    } finally {
      setLoading(false);
    }
  };

  const totalHours = entries.reduce((sum, e) => sum + Number(e.hours || 0), 0);

  // ======================================================
  // UI
  // ======================================================

  return (
    <div style={{ padding: 24 }}>
      <div
        style={{
          maxWidth: 900,
          margin: "0 auto",
          background: "#fff",
          padding: 24,
          borderRadius: 8,
          boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
        }}
      >
        <h2 style={{ marginBottom: 4 }}>
          {id ? "Edit Timesheet" : "New Timesheet"}
        </h2>
        {isReadOnly && (
          <p style={{ color: "#dc2626", marginBottom: 12 }}>
            This timesheet has been submitted and is read-only.
          </p>
        )}

        {deployment && (
          <p style={{ color: "#555", marginBottom: 20 }}>
            <b>Client:</b> {deployment.client_name} &nbsp; | &nbsp;
            <b>Role:</b> {deployment.role}
          </p>
        )}

        {/* PERIOD */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 16,
            marginBottom: 24,
          }}
        >
          <div>
            <label>Period Type</label>
            <select
              value={periodType}
              disabled={isReadOnly}
              onChange={(e) => setPeriodType(e.target.value)}
              style={input}
            >
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>

          <div>
            <label>Start Date</label>
            <input
              type="date"
              value={periodStart}
              disabled={isReadOnly}
              onChange={(e) => setPeriodStart(e.target.value)}
              style={input}
            />
          </div>

          <div>
            <label>End Date</label>
            <input
              type="date"
              value={periodEnd}
              disabled={isReadOnly}
              onChange={(e) => setPeriodEnd(e.target.value)}
              style={input}
            />
          </div>
        </div>

        {/* WORK ENTRIES */}
        <h4 style={{ marginBottom: 8 }}>Work Entries</h4>

        <table style={table}>
          <thead>
            <tr style={{ background: "#f9fafb" }}>
              <th style={th}>Date</th>
              <th style={th}>Hours</th>
              <th style={th}>Description</th>
            </tr>
          </thead>

          <tbody>
            {entries.map((row, idx) => (
              <tr key={idx}>
                <td style={td}>
                  <input
                    type="date"
                    value={row.work_date}
                    min={periodStart}
                    max={periodEnd}
                    disabled={isReadOnly}
                    onChange={(e) =>
                      updateEntry(idx, "work_date", e.target.value)
                    }
                    style={input}
                  />
                </td>

                <td style={td}>
                  <input
                    type="number"
                    value={row.hours}
                    disabled={isReadOnly}
                    onChange={(e) =>
                      updateEntry(idx, "hours", Number(e.target.value))
                    }
                    style={input}
                  />
                </td>

                <td style={td}>
                  <input
                    value={row.description}
                    disabled={isReadOnly}
                    onChange={(e) =>
                      updateEntry(idx, "description", e.target.value)
                    }
                    style={input}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!isReadOnly && (
          <button onClick={addRow} style={linkBtn}>
            + Add Row
          </button>
        )}

        <p style={{ marginTop: 16 }}>
          <b>Total Hours:</b> {totalHours}
        </p>

        {/* ACTIONS */}
        <div
          style={{
            marginTop: 24,
            display: "flex",
            justifyContent: "flex-end",
            gap: 12,
          }}
        >
          {!id && ["draft", "rejected"].includes(timesheetStatus) && (
            <button
              onClick={handleSave}
              disabled={loading}
              style={secondaryBtn}
            >
              Save Draft
            </button>
          )}

          {timesheetStatus === "draft" && (
            <button
              onClick={handleSubmit}
              disabled={loading}
              style={primaryBtn}
            >
              Submit
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
const input = {
  width: "100%",
  padding: "8px 10px",
  border: "1px solid #d1d5db",
  borderRadius: 4,
};

const table = {
  width: "100%",
  borderCollapse: "collapse",
};

const th = {
  border: "1px solid #e5e7eb",
  padding: 10,
  textAlign: "left",
};

const td = {
  border: "1px solid #e5e7eb",
  padding: 8,
};

const primaryBtn = {
  background: "#2563eb",
  color: "#fff",
  padding: "8px 16px",
  border: "none",
  borderRadius: 4,
  cursor: "pointer",
};

const secondaryBtn = {
  background: "#e5e7eb",
  padding: "8px 16px",
  border: "none",
  borderRadius: 4,
  cursor: "pointer",
};

const linkBtn = {
  marginTop: 8,
  background: "transparent",
  border: "none",
  color: "#2563eb",
  cursor: "pointer",
};
