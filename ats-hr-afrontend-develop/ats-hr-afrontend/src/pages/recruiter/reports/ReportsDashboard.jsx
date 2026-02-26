import React, { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
} from "recharts";
import api from "../../../api/axios";

const COLORS = ["#7c3aed", "#06b6d4", "#f97316", "#10b981", "#ef4444"];

const formatDateInput = (d) => d.toISOString().slice(0, 10);

const getPresetRange = (preset) => {
  const today = new Date();
  if (preset === "today") {
    return { from: formatDateInput(today), to: formatDateInput(today) };
  }
  if (preset === "week") {
    const day = today.getDay();
    const diff = (day + 6) % 7;
    const start = new Date(today);
    start.setDate(today.getDate() - diff);
    return { from: formatDateInput(start), to: formatDateInput(today) };
  }
  if (preset === "month") {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    return { from: formatDateInput(start), to: formatDateInput(today) };
  }
  return { from: "", to: "" };
};

export default function ReportsDashboard() {
  const [datePreset, setDatePreset] = useState("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [candidateReport, setCandidateReport] = useState(null);
  const [jobReport, setJobReport] = useState(null);
  const [interviewReport, setInterviewReport] = useState(null);
  const [recruiterReport, setRecruiterReport] = useState(null);

  const [exportType, setExportType] = useState("candidates");
  const [exportFormat, setExportFormat] = useState("csv");

  const range = useMemo(() => {
    if (datePreset === "custom") {
      return { from: customFrom, to: customTo };
    }
    return getPresetRange(datePreset);
  }, [datePreset, customFrom, customTo]);

  const queryParams = useMemo(() => {
    const params = {};
    if (range.from) params.from = range.from;
    if (range.to) params.to = range.to;
    return params;
  }, [range]);

  useEffect(() => {
    const fetchReports = async () => {
      setLoading(true);
      setError("");
      try {
        const [candidates, jobs, interviews, recruiters] = await Promise.all([
          api.get("/v1/reports/candidates", { params: queryParams }),
          api.get("/v1/reports/jobs", { params: queryParams }),
          api.get("/v1/reports/interviews", { params: queryParams }),
          api.get("/v1/reports/recruiters", { params: queryParams }),
        ]);
        setCandidateReport(candidates.data);
        setJobReport(jobs.data);
        setInterviewReport(interviews.data);
        setRecruiterReport(recruiters.data);
      } catch (err) {
        console.error("Failed to load reports:", err);
        setError("Failed to load reports. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
  }, [queryParams]);

  const handleExport = async () => {
    try {
      const res = await api.get("/v1/reports/export", {
        params: {
          type: exportType,
          format: exportFormat,
          ...queryParams,
        },
        responseType: "blob",
      });
      const blob = new Blob([res.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${exportType}_report.${exportFormat}`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
      setError("Export failed. Please try again.");
    }
  };

  const statusPieData =
    candidateReport?.candidates_by_status?.map((s) => ({
      name: s.status,
      value: s.count,
    })) || [];

  const sourceBarData =
    candidateReport?.candidates_by_source?.map((s) => ({
      name: s.source,
      count: s.count,
    })) || [];

  const deptBarData =
    jobReport?.jobs_by_department?.map((d) => ({
      name: d.department,
      count: d.count,
    })) || [];

  const candidateTrend = candidateReport?.trend || [];
  const interviewTrend = interviewReport?.trend || [];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Reports</h1>
            <p className="text-sm text-gray-500">
              Real-time recruiting analytics and performance
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="px-3 py-2 border rounded text-sm bg-white"
              value={datePreset}
              onChange={(e) => setDatePreset(e.target.value)}
            >
              <option value="today">Today</option>
              <option value="week">This week</option>
              <option value="month">This month</option>
              <option value="custom">Custom range</option>
            </select>
            {datePreset === "custom" && (
              <>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="px-3 py-2 border rounded text-sm bg-white"
                />
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="px-3 py-2 border rounded text-sm bg-white"
                />
              </>
            )}
            <select
              className="px-3 py-2 border rounded text-sm bg-white"
              value={exportType}
              onChange={(e) => setExportType(e.target.value)}
            >
              <option value="candidates">Candidates</option>
              <option value="jobs">Jobs</option>
              <option value="interviews">Interviews</option>
              <option value="recruiters">Recruiters</option>
            </select>
            <select
              className="px-3 py-2 border rounded text-sm bg-white"
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value)}
            >
              <option value="csv">CSV</option>
              <option value="xlsx">Excel</option>
              <option value="pdf">PDF</option>
            </select>
            <button
              onClick={handleExport}
              className="px-4 py-2 bg-purple-600 text-white rounded text-sm"
            >
              Export
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded">
            {error}
          </div>
        )}

        {loading ? (
          <div className="bg-white p-6 rounded shadow text-center text-gray-500">
            Loading reports...
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="bg-white p-4 rounded shadow">
                <div className="text-xs text-gray-500">Total Candidates</div>
                <div className="text-2xl font-semibold">
                  {candidateReport?.total_candidates ?? 0}
                </div>
              </div>
              <div className="bg-white p-4 rounded shadow">
                <div className="text-xs text-gray-500">New Candidates</div>
                <div className="text-2xl font-semibold">
                  {candidateReport?.new_candidates ?? 0}
                </div>
              </div>
              <div className="bg-white p-4 rounded shadow">
                <div className="text-xs text-gray-500">Total Jobs</div>
                <div className="text-2xl font-semibold">
                  {jobReport?.total_jobs ?? 0}
                </div>
              </div>
              <div className="bg-white p-4 rounded shadow">
                <div className="text-xs text-gray-500">Total Interviews</div>
                <div className="text-2xl font-semibold">
                  {interviewReport?.total_interviews ?? 0}
                </div>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="bg-white p-4 rounded shadow">
                <h3 className="font-semibold mb-3">Candidate Status</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusPieData}
                        dataKey="value"
                        nameKey="name"
                        outerRadius={90}
                      >
                        {statusPieData.map((entry, index) => (
                          <Cell
                            key={`cell-${entry.name}-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white p-4 rounded shadow">
                <h3 className="font-semibold mb-3">Candidate Sources</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={sourceBarData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="#7c3aed" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="bg-white p-4 rounded shadow">
                <h3 className="font-semibold mb-3">Jobs by Department</h3>
                <div className="flex flex-wrap gap-3 text-xs text-gray-600 mb-3">
                  <span className="bg-gray-50 px-2 py-1 rounded">
                    Active: {jobReport?.active_jobs ?? 0}
                  </span>
                  <span className="bg-gray-50 px-2 py-1 rounded">
                    Closed: {jobReport?.closed_jobs ?? 0}
                  </span>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={deptBarData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="#10b981" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white p-4 rounded shadow">
                <h3 className="font-semibold mb-3">Interview Outcomes</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-gray-50 p-3 rounded">
                    Scheduled: {interviewReport?.scheduled_count ?? 0}
                  </div>
                  <div className="bg-gray-50 p-3 rounded">
                    Scheduled today: {interviewReport?.scheduled_today ?? 0}
                  </div>
                  <div className="bg-gray-50 p-3 rounded">
                    Completed: {interviewReport?.completed_count ?? 0}
                  </div>
                  <div className="bg-gray-50 p-3 rounded">
                    Cancelled: {interviewReport?.cancelled_count ?? 0}
                  </div>
                  <div className="bg-gray-50 p-3 rounded">
                    No-show rate:{" "}
                    {((interviewReport?.no_show_rate ?? 0) * 100).toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="bg-white p-4 rounded shadow">
                <h3 className="font-semibold mb-3">Candidate Trend</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={candidateTrend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="count" stroke="#7c3aed" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white p-4 rounded shadow">
                <h3 className="font-semibold mb-3">Interview Trend</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={interviewTrend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="count" stroke="#06b6d4" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded shadow">
              <h3 className="font-semibold mb-3">Recruiter Performance</h3>
              {recruiterReport?.recruiters?.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="border p-2 text-left">Recruiter</th>
                        <th className="border p-2 text-left">Candidates Sourced</th>
                        <th className="border p-2 text-left">Interviews Scheduled</th>
                        <th className="border p-2 text-left">Hires Made</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recruiterReport.recruiters.map((r) => (
                        <tr key={r.recruiter_id}>
                          <td className="border p-2">{r.recruiter_name}</td>
                          <td className="border p-2">{r.candidates_sourced}</td>
                          <td className="border p-2">{r.interviews_scheduled}</td>
                          <td className="border p-2">{r.hires_made}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-sm text-gray-500">No recruiter data found.</div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
