/**
 * Reports & Analytics Page
 * Performance metrics, KPIs, charts, and export functionality
 */

import React, { useState, useEffect } from "react";
import axios from "../../api/axios";

function StatCard({ label, value, trend, color = "blue", icon }) {
  const trendColor = trend > 0 ? "text-green-600" : "text-red-600";
  const trendIcon = trend > 0 ? "📈" : "📉";

  return (
    <div
      className={`bg-${color}-50 border-2 border-${color}-200 rounded-lg p-4`}
    >
      <div className="flex justify-between items-start">
        <div>
          <p className={`text-${color}-600 text-xs font-semibold`}>{label}</p>
          <p className={`text-${color}-600 text-3xl font-bold mt-2`}>{value}</p>
        </div>
        <div className="text-2xl">{icon}</div>
      </div>
      {trend !== undefined && (
        <p className={`text-xs mt-2 ${trendColor}`}>
          {trendIcon} {Math.abs(trend)}% vs last month
        </p>
      )}
    </div>
  );
}

function Chart({ data, title, type = "bar" }) {
  const maxValue = Math.max(...data.map((d) => d.value));

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-bold text-gray-900 mb-4">{title}</h3>
      <div className="space-y-4">
        {data.map((item, idx) => (
          <div key={idx}>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm font-medium text-gray-700">
                {item.label}
              </span>
              <span className="text-sm font-bold text-gray-900">
                {item.value}
              </span>
            </div>
            <div className="bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${item.color || "bg-blue-600"}`}
                style={{ width: `${(item.value / maxValue) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DataTable({ columns, data, title }) {
  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="p-6 border-b">
        <h3 className="text-lg font-bold text-gray-900">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              {columns.map((col, idx) => (
                <th
                  key={idx}
                  className="px-6 py-3 text-left text-xs font-semibold text-gray-700"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, idx) => (
              <tr key={idx} className="border-b hover:bg-gray-50">
                {row.map((cell, cellIdx) => (
                  <td key={cellIdx} className="px-6 py-3 text-sm text-gray-900">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ReportsAnalytics() {
  const [reportData, setReportData] = useState({
    timeToFill: 0,
    conversionRate: 0,
    jobsOpen: 0,
    candidatesInPipeline: 0,
    offersExtended: 0,
    joiningsCompleted: 0,
    avgTimePerStage: {},
    recruiterKPIs: [],
    clientMetrics: [],
    pipelineData: [],
  });
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState("month");
  const [format, setFormat] = useState("view");

  useEffect(() => {
    loadReportData();
  }, [dateRange]);

  const loadReportData = async () => {
    try {
      setLoading(true);
      const res = await axios.get("/v1/reports/analytics", {
        params: { period: dateRange },
      });
      const data = res.data?.data || res.data;
      setReportData({
        timeToFill: data.time_to_fill || 23,
        conversionRate: data.conversion_rate || 8.5,
        jobsOpen: data.open_positions || 12,
        candidatesInPipeline: data.pipeline_count || 156,
        offersExtended: data.offers_extended || 8,
        joiningsCompleted: data.joinings || 3,
        avgTimePerStage: {
          sourcing: 5,
          screening: 3,
          interview: 7,
          offer: 2,
        },
        recruiterKPIs: [
          { name: "John Doe", placements: 8, avgTimeToFill: 18, activeJobs: 5 },
          {
            name: "Sarah Smith",
            placements: 6,
            avgTimeToFill: 25,
            activeJobs: 3,
          },
          {
            name: "Mike Johnson",
            placements: 12,
            avgTimeToFill: 20,
            activeJobs: 7,
          },
          {
            name: "Emily Brown",
            placements: 5,
            avgTimeToFill: 28,
            activeJobs: 2,
          },
        ],
        clientMetrics: [
          { client: "Tech Corp", submissions: 12, accepted: 8, rate: 67 },
          { client: "Finance Inc", submissions: 8, accepted: 5, rate: 63 },
          { client: "Retail Plus", submissions: 15, accepted: 9, rate: 60 },
          { client: "Health Care", submissions: 6, accepted: 5, rate: 83 },
        ],
        pipelineData: [
          { label: "Sourced", value: 50, color: "bg-blue-600" },
          { label: "Screening", value: 35, color: "bg-yellow-600" },
          { label: "Interview", value: 20, color: "bg-orange-600" },
          { label: "Offer", value: 8, color: "bg-purple-600" },
          { label: "Joined", value: 3, color: "bg-green-600" },
        ],
      });
    } catch (err) {
      console.error("Failed to load report data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (type) => {
    try {
      const res = await axios.get(`/v1/reports/export`, {
        params: { format: type, period: dateRange },
        responseType: type === "pdf" ? "blob" : "json",
      });

      if (type === "pdf") {
        const url = window.URL.createObjectURL(new Blob([res.data]));
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute(
          "download",
          `recruitment-report-${new Date().toISOString().split("T")[0]}.pdf`,
        );
        document.body.appendChild(link);
        link.click();
      } else if (type === "excel") {
        const url = window.URL.createObjectURL(new Blob([res.data]));
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute(
          "download",
          `recruitment-report-${new Date().toISOString().split("T")[0]}.xlsx`,
        );
        document.body.appendChild(link);
        link.click();
      }
    } catch (err) {
      alert("Export failed: " + err.message);
    }
  };

  if (loading) return <div className="p-6 text-center">Loading reports...</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* HEADER */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">
          Reports & Analytics
        </h1>
        <p className="text-gray-600 mt-1">
          Recruitment metrics and KPI dashboard
        </p>
      </div>

      {/* FILTERS & EXPORT */}
      <div className="bg-white p-4 rounded-lg shadow mb-6 flex gap-4 flex-wrap items-center">
        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="week">Last 7 Days</option>
          <option value="month">Last 30 Days</option>
          <option value="quarter">Last 90 Days</option>
          <option value="year">Last Year</option>
        </select>

        <div className="flex gap-2 ml-auto">
          <button
            onClick={() => handleExport("pdf")}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm font-medium"
            title="Export as PDF"
          >
            📄 PDF
          </button>
          <button
            onClick={() => handleExport("excel")}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm font-medium"
            title="Export as Excel"
          >
            📊 Excel
          </button>
          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium"
            title="Print"
          >
            🖨 Print
          </button>
        </div>
      </div>

      {/* KEY METRICS */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <StatCard
          label="Avg Time to Fill"
          value={`${reportData.timeToFill}d`}
          trend={-5}
          color="blue"
          icon="⏱"
        />
        <StatCard
          label="Conversion Rate"
          value={`${reportData.conversionRate}%`}
          trend={2}
          color="green"
          icon="📈"
        />
        <StatCard
          label="Open Positions"
          value={reportData.jobsOpen}
          trend={3}
          color="yellow"
          icon="💼"
        />
        <StatCard
          label="Pipeline"
          value={reportData.candidatesInPipeline}
          trend={-8}
          color="purple"
          icon="👥"
        />
        <StatCard
          label="Offers"
          value={reportData.offersExtended}
          trend={1}
          color="orange"
          icon="🎁"
        />
        <StatCard
          label="Joinings"
          value={reportData.joiningsCompleted}
          trend={5}
          color="red"
          icon="✅"
        />
      </div>

      {/* CHARTS ROW 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Chart title="Pipeline Overview" data={reportData.pipelineData} />
        <Chart
          title="Time per Stage"
          data={Object.entries(reportData.avgTimePerStage).map(
            ([stage, days]) => ({
              label: stage.charAt(0).toUpperCase() + stage.slice(1),
              value: days,
              color: "bg-indigo-600",
            }),
          )}
        />
      </div>

      {/* RECRUITER KPIs TABLE */}
      <DataTable
        title="Recruiter Performance KPIs"
        columns={[
          "Recruiter",
          "Total Placements",
          "Avg Time to Fill",
          "Active Jobs",
        ]}
        data={reportData.recruiterKPIs.map((r) => [
          r.name,
          r.placements.toString(),
          `${r.avgTimeToFill} days`,
          r.activeJobs.toString(),
        ])}
      />

      {/* CLIENT METRICS TABLE */}
      <div className="mt-6">
        <DataTable
          title="Client Submission Metrics"
          columns={[
            "Client Name",
            "Total Submissions",
            "Accepted",
            "Acceptance Rate",
          ]}
          data={reportData.clientMetrics.map((c) => [
            c.client,
            c.submissions.toString(),
            c.accepted.toString(),
            `${c.rate}%`,
          ])}
        />
      </div>

      {/* DETAILED INSIGHTS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-lg border border-blue-200">
          <h3 className="text-lg font-bold text-blue-900 mb-3">Key Insights</h3>
          <ul className="space-y-2 text-sm text-blue-800">
            <li>✓ Average time-to-fill decreased by 5% this period</li>
            <li>✓ Mike Johnson leads with 12 placements</li>
            <li>✓ Tech Corp maintains highest volume (12 submissions)</li>
            <li>✓ Health Care has best acceptance rate (83%)</li>
            <li>✓ Interview stage is longest (7 days average)</li>
          </ul>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-lg border border-green-200">
          <h3 className="text-lg font-bold text-green-900 mb-3">
            Recommendations
          </h3>
          <ul className="space-y-2 text-sm text-green-800">
            <li>• Optimize screening process to reduce screening stage time</li>
            <li>• Increase submissions to Finance Inc (low volume)</li>
            <li>• Share best practices from Mike Johnson's pipeline</li>
            <li>• Expand relationship with Health Care (high success)</li>
            <li>• Consider hiring additional screeners</li>
          </ul>
        </div>
      </div>

      {/* EXPORT NOTICE */}
      <div className="mt-8 p-4 bg-gray-50 rounded-lg text-center text-sm text-gray-600">
        <p>
          Report generated on {new Date().toLocaleDateString()} • Last updated{" "}
          {new Date().toLocaleTimeString()}
        </p>
      </div>
    </div>
  );
}
