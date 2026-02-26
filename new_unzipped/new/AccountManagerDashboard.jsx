import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  RefreshCw,
  X,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Sector,
} from "recharts";
import api from "../../api/axios";
import ThemeToggle from "../../components/ThemeToggle";

const FILTER_OPTIONS = [
  { key: "today", label: "Today" },
  { key: "this_week", label: "This Week" },
  { key: "this_month", label: "This Month" },
];

const FILTER_LABELS = {
  today: "Today",
  this_week: "This Week",
  this_month: "This Month",
};

const AUTO_REFRESH_MS = 5 * 60 * 1000;
const SHOW_CONSULTANTS_FEATURES = false;
const SHOW_CLIENTS_FEATURES = false;

const KPI_CARDS = [
  {
    key: "total_clients",
    label: "Total Clients",
    icon: "🏢",
    accent: "#3B82F6",
    onClick: (navigate) => navigate("/account-manager/clients"),
  },
  {
    key: "active_requirements",
    label: "Active Requirements",
    icon: "📋",
    accent: "#6C2BD9",
    onClick: (navigate) => navigate("/account-manager/requirements"),
  },
  {
    key: "recruiter_submissions",
    label: "Recruiter Submissions",
    icon: "👤",
    accent: "#6366F1",
    onClick: (navigate) => navigate("/account-manager/submissions"),
  },
  {
    key: "interviews_in_progress",
    label: "Interviews in Progress",
    icon: "🎯",
    accent: "#F59E0B",
    onClick: (navigate) => navigate("/account-manager/interview-logs"),
  },
  {
    key: "hired_candidates",
    label: "Hired Candidates",
    icon: "✅",
    accent: "#10B981",
    onClick: (navigate) => navigate("/account-manager/submissions?status=hired"),
  },
  {
    key: "active_consultants",
    label: "Active Consultants",
    icon: "💼",
    accent: "#14B8A6",
    onClick: (navigate) => navigate("/account-manager/assignments"),
  },
  {
    key: "pending_timesheets",
    label: "Pending Timesheets",
    icon: "⏰",
    accent: "#EF4444",
    onClick: (navigate) => navigate("/account-manager/timesheets"),
  },
];

const REQUIREMENT_COLORS = {
  Active: "#6C2BD9",
  Closed: "#10B981",
  "On Hold": "#F59E0B",
  Draft: "#94A3B8",
};

const PIPELINE_GROUP_COLORS = {
  "AM Review": "#6C2BD9",
  "Client Review": "#3B82F6",
  "Interview Stage": "#F59E0B",
  "Offer Stage": "#8B5CF6",
  Successful: "#10B981",
  Rejected: "#EF4444",
};

const EMPTY_ERRORS = {
  kpi: false,
  requirements: false,
  pipeline: false,
  panels: false,
};

const normalizeFilter = (value) => {
  const key = String(value || "").trim().toLowerCase();
  return FILTER_OPTIONS.some((item) => item.key === key) ? key : "this_month";
};

const formatNumber = (value) => {
  if (typeof value !== "number" || Number.isNaN(value)) return "--";
  return value.toLocaleString();
};

const formatPercent = (value, trend) => {
  if (typeof value !== "number" || Number.isNaN(value)) return "0.0%";
  if (trend === "down") return `-${Math.abs(value).toFixed(1)}%`;
  if (trend === "up") return `+${Math.abs(value).toFixed(1)}%`;
  return `${Math.abs(value).toFixed(1)}%`;
};

const trendMeta = (trend) => {
  if (trend === "up") return { icon: "▲", color: "text-emerald-500" };
  if (trend === "down") return { icon: "▼", color: "text-red-500" };
  return { icon: "➡", color: "text-gray-500" };
};

const statusKeyToLabel = (key) =>
  String(key || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();

const renderActiveSlice = (props) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
  return (
    <Sector
      cx={cx}
      cy={cy}
      innerRadius={innerRadius}
      outerRadius={outerRadius + 8}
      startAngle={startAngle}
      endAngle={endAngle}
      fill={fill}
    />
  );
};

function ChartSkeleton() {
  return (
    <div className="h-[320px] w-full rounded-xl border border-gray-200 bg-white p-5">
      <div className="h-5 w-40 animate-pulse rounded bg-gray-200" />
      <div className="mt-6 h-60 animate-pulse rounded-xl bg-gray-100" />
    </div>
  );
}

function ChartErrorState({ message }) {
  return (
    <div className="h-[320px] w-full rounded-xl border border-red-200 bg-red-50 p-5">
      <div className="flex items-center gap-2 text-sm font-medium text-red-700">
        <AlertTriangle className="h-4 w-4" />
        {message}
      </div>
    </div>
  );
}

function KpiCard({ config, payload, loading, hasError, onClick }) {
  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="h-4 w-28 animate-pulse rounded bg-gray-200" />
        <div className="mt-3 h-9 w-20 animate-pulse rounded bg-gray-200" />
        <div className="mt-3 h-4 w-36 animate-pulse rounded bg-gray-200" />
        <div className="mt-4 h-10 animate-pulse rounded bg-gray-100" />
      </div>
    );
  }

  const safePayload = payload || {};
  const hasMetricError = hasError || payload == null;
  const sparkline = Array.isArray(safePayload.sparkline)
    ? safePayload.sparkline
    : [0, 0, 0, 0, 0, 0, 0];
  const sparklineData = sparkline.map((value, index) => ({ index, value }));
  const trend = trendMeta(safePayload.trend);

  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border border-gray-200 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-center justify-between">
        <div className="text-lg">{config.icon}</div>
        {hasMetricError && (
          <AlertTriangle
            className="h-4 w-4 text-amber-500"
            title="Data unavailable"
            aria-label="Data unavailable"
          />
        )}
      </div>
      <p className="mt-2 text-xs font-medium text-gray-500">{config.label}</p>
      <p className="mt-2 text-3xl font-bold text-gray-900">
        {hasMetricError ? "--" : formatNumber(safePayload.value)}
      </p>

      <div className={`mt-3 flex items-center gap-1 text-xs ${trend.color}`}>
        <span>{trend.icon}</span>
        <span>
          {hasMetricError
            ? "--"
            : `${formatPercent(safePayload.change_pct, safePayload.trend)} vs previous period`}
        </span>
      </div>

      <div className="mt-3 h-12">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={sparklineData}>
            <Line
              type="monotone"
              dataKey="value"
              stroke={config.accent}
              strokeWidth={2}
              dot={false}
              isAnimationActive={!hasMetricError}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </button>
  );
}

function SummaryPanel({ title, value, subtitle, detail, actionLabel, onAction, loading, hasError, progress }) {
  if (loading) {
    return (
      <div className="rounded-xl border border-purple-100 bg-white p-5">
        <div className="h-4 w-28 animate-pulse rounded bg-gray-200" />
        <div className="mt-3 h-9 w-20 animate-pulse rounded bg-gray-200" />
        <div className="mt-3 h-4 w-56 animate-pulse rounded bg-gray-200" />
        <div className="mt-3 h-4 w-44 animate-pulse rounded bg-gray-200" />
        <div className="mt-4 h-9 w-40 animate-pulse rounded bg-gray-200" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-purple-100 bg-white p-5">
      <p className="text-xs uppercase tracking-wide text-gray-400">{title}</p>
      <p className="mt-3 text-3xl font-bold text-gray-900">{hasError ? "--" : formatNumber(value)}</p>
      <p className="mt-2 text-sm text-gray-600">{subtitle}</p>

      {typeof progress === "number" && !hasError && (
        <div className="mt-4">
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-purple-500 to-indigo-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-gray-500">{detail}</p>
        </div>
      )}

      {!progress && (
        <p className="mt-4 text-sm font-medium text-gray-700">{hasError ? "--" : detail}</p>
      )}

      <button
        type="button"
        onClick={onAction}
        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-700"
      >
        {actionLabel}
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function RequirementsTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="font-semibold text-gray-900">
        {data.status}: {data.count} ({(data.pct ?? 0).toFixed(1)}%)
      </p>
    </div>
  );
}

function PipelineTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  const breakdown = Object.entries(data.breakdown || {});
  return (
    <div className="w-64 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="font-semibold text-gray-900">
        {data.group}: {data.count} ({(data.pct ?? 0).toFixed(1)}%)
      </p>
      <div className="mt-2 space-y-1 text-gray-700">
        {breakdown.map(([status, count]) => (
          <p key={status}>
            {statusKeyToLabel(status)}: {count}
          </p>
        ))}
      </div>
    </div>
  );
}

export default function AccountManagerDashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestIdRef = useRef(0);

  const activeFilter = normalizeFilter(searchParams.get("filter"));

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const [kpiData, setKpiData] = useState(null);
  const [requirementsData, setRequirementsData] = useState(null);
  const [pipelineData, setPipelineData] = useState(null);
  const [panelsData, setPanelsData] = useState(null);
  const [errors, setErrors] = useState(EMPTY_ERRORS);

  const [hoverReqIndex, setHoverReqIndex] = useState(-1);
  const [activeReqIndex, setActiveReqIndex] = useState(-1);
  const [hoverPipelineIndex, setHoverPipelineIndex] = useState(-1);
  const [activePipelineIndex, setActivePipelineIndex] = useState(-1);
  const [pipelineDrawer, setPipelineDrawer] = useState({
    open: false,
    group: "",
    candidates: [],
  });

  useEffect(() => {
    const raw = searchParams.get("filter");
    const normalized = normalizeFilter(raw);
    if (raw !== normalized) {
      const params = new URLSearchParams(searchParams);
      params.set("filter", normalized);
      setSearchParams(params, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const fetchDashboardData = useCallback(async (filterKey, { silent = false } = {}) => {
    const requestId = Date.now();
    requestIdRef.current = requestId;

    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    const safeGet = async (url, key) => {
      try {
        const response = await api.get(url, { params: { filter: filterKey } });
        return { key, ok: true, data: response.data };
      } catch (error) {
        console.error(`Dashboard API failed: ${key}`, error);
        return { key, ok: false, data: null };
      }
    };

    const [kpiResult, requirementResult, pipelineResult, panelResult] = await Promise.all([
      safeGet("/v1/am/dashboard/kpi-cards", "kpi"),
      safeGet("/v1/am/dashboard/requirements-donut", "requirements"),
      safeGet("/v1/am/dashboard/pipeline-pie", "pipeline"),
      safeGet("/v1/am/dashboard/panels-summary", "panels"),
    ]);

    if (requestIdRef.current !== requestId) return;

    setErrors({
      kpi: !kpiResult.ok,
      requirements: !requirementResult.ok,
      pipeline: !pipelineResult.ok,
      panels: !panelResult.ok,
    });

    if (kpiResult.ok) setKpiData(kpiResult.data);
    if (requirementResult.ok) setRequirementsData(requirementResult.data);
    if (pipelineResult.ok) setPipelineData(pipelineResult.data);
    if (panelResult.ok) setPanelsData(panelResult.data);

    setLastUpdated(new Date());

    if (silent) {
      setRefreshing(false);
    } else {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData(activeFilter, { silent: false });
  }, [activeFilter, fetchDashboardData]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchDashboardData(activeFilter, { silent: true });
    }, AUTO_REFRESH_MS);
    return () => clearInterval(intervalId);
  }, [activeFilter, fetchDashboardData]);

  const handleFilterChange = (nextFilter) => {
    if (nextFilter === activeFilter) return;
    const params = new URLSearchParams(searchParams);
    params.set("filter", nextFilter);
    setSearchParams(params);
  };

  const handleRefresh = () => {
    fetchDashboardData(activeFilter, { silent: false });
  };

  const requirementSegments = useMemo(() => {
    const segments = requirementsData?.segments || [];
    return segments.map((segment) => ({
      ...segment,
      value: Number(segment.count || 0),
      color: REQUIREMENT_COLORS[segment.status] || "#94A3B8",
    }));
  }, [requirementsData]);

  const requirementsTotal = useMemo(
    () => requirementSegments.reduce((sum, item) => sum + (item.value || 0), 0),
    [requirementSegments],
  );
  const isRequirementEmpty = requirementsTotal === 0;

  const pipelineGroups = useMemo(() => {
    const groups = pipelineData?.groups || [];
    return groups.map((group) => ({
      ...group,
      value: Number(group.count || 0),
      color: group.color || PIPELINE_GROUP_COLORS[group.group] || "#94A3B8",
    }));
  }, [pipelineData]);

  const pipelineTotal = Number(pipelineData?.total_candidates || 0);
  const isPipelineEmpty = pipelineTotal === 0 || pipelineGroups.every((group) => group.value === 0);

  const panelSummary = panelsData || {};
  const activeRequirementsPanel = panelSummary.active_requirements || {};
  const pipelineReadyPanel = panelSummary.pipeline_ready || {};
  const consultantPoolPanel = panelSummary.consultant_pool || {};
  const visibleKpiCards = useMemo(
    () =>
      KPI_CARDS.filter((card) => {
        if (!SHOW_CLIENTS_FEATURES && card.key === "total_clients") return false;
        if (
          !SHOW_CONSULTANTS_FEATURES &&
          (card.key === "active_consultants" || card.key === "pending_timesheets")
        ) {
          return false;
        }
        return true;
      }),
    [],
  );

  const activeReqTotal = Number(activeRequirementsPanel.total || 0);
  const withSubmissions = Number(activeRequirementsPanel.with_submissions || 0);
  const reqProgressPct =
    activeReqTotal > 0 ? Math.min(100, Math.round((withSubmissions / activeReqTotal) * 100)) : 0;

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-gray-100 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900">Account Manager Dashboard</h1>
            <p className="mt-1 text-sm text-gray-600">
              Manage client requirements, recruiters, and submissions
            </p>
          </div>
          <ThemeToggle />
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex flex-wrap items-center gap-2">
            {FILTER_OPTIONS.map((option) => {
              const isActive = activeFilter === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => handleFilterChange(option.key)}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                    isActive
                      ? "border-transparent bg-[#6C2BD9] text-white"
                      : "border-gray-300 bg-white text-gray-600 hover:border-gray-400"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            <RefreshCw className={`h-4 w-4 ${(loading || refreshing) ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        <p className="mt-2 text-xs text-gray-500">
          Last updated: {lastUpdated ? lastUpdated.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "--"}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-7">
        {visibleKpiCards.map((config) => (
          <KpiCard
            key={config.key}
            config={config}
            payload={kpiData?.cards?.[config.key] || null}
            loading={loading}
            hasError={errors.kpi}
            onClick={() => config.onClick(navigate)}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {loading ? (
          <>
            <ChartSkeleton />
            <ChartSkeleton />
          </>
        ) : (
          <>
            {errors.requirements ? (
              <ChartErrorState message="Requirements chart data unavailable" />
            ) : (
              <section className="rounded-xl border border-gray-200 bg-white p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">Requirements Status</h2>
                    <p className="text-xs text-gray-500">{requirementsData?.period_label || "--"}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate("/account-manager/requirements")}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                  >
                    Open Requirements
                    <ExternalLink className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="mt-4 h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={
                          isRequirementEmpty
                            ? [{ status: "No data", value: 1, color: "#E5E7EB", count: 0, pct: 0 }]
                            : requirementSegments
                        }
                        dataKey="value"
                        nameKey="status"
                        cx="50%"
                        cy="50%"
                        outerRadius={110}
                        innerRadius={65}
                        paddingAngle={isRequirementEmpty ? 0 : 3}
                        activeIndex={activeReqIndex}
                        activeShape={renderActiveSlice}
                        onMouseEnter={(_, index) => setHoverReqIndex(index)}
                        onMouseLeave={() => setHoverReqIndex(-1)}
                        onClick={(entry, index) => {
                          if (isRequirementEmpty) return;
                          setActiveReqIndex(index);
                          const statusValue = String(entry.status || "")
                            .toLowerCase()
                            .replace(/\s+/g, "_");
                          navigate(`/account-manager/requirements?status=${encodeURIComponent(statusValue)}`);
                        }}
                      >
                        {(isRequirementEmpty
                          ? [{ color: "#E5E7EB" }]
                          : requirementSegments
                        ).map((entry, index) => (
                          <Cell
                            key={`${entry.status}-${index}`}
                            fill={entry.color}
                            opacity={hoverReqIndex === -1 || hoverReqIndex === index ? 1 : 0.35}
                          />
                        ))}
                      </Pie>

                      <Tooltip content={<RequirementsTooltip />} />
                      <text
                        x="50%"
                        y="48%"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="fill-gray-900 text-2xl font-bold"
                      >
                        {isRequirementEmpty ? "No Data" : requirementsTotal}
                      </text>
                      <text
                        x="50%"
                        y="56%"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="fill-gray-500 text-xs"
                      >
                        {isRequirementEmpty ? "No Requirements Yet" : "Total"}
                      </text>
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs">
                  {requirementSegments.map((segment) => (
                    <div key={segment.status} className="inline-flex items-center gap-1 text-gray-700">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: segment.color }}
                      />
                      <span>{segment.status}</span>
                      <span className="font-semibold">{segment.count}</span>
                    </div>
                  ))}
                </div>

                <p className="mt-3 text-center text-xs text-gray-500">
                  All time: {formatNumber(requirementsData?.all_time_total ?? 0)} total
                </p>
              </section>
            )}
            {errors.pipeline ? (
              <ChartErrorState message="Candidate pipeline data unavailable" />
            ) : (
              <section className="rounded-xl border border-gray-200 bg-white p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">Candidate Pipeline</h2>
                    <p className="text-xs text-gray-500">
                      Showing {formatNumber(pipelineTotal)} candidates — {FILTER_LABELS[activeFilter]}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-4 lg:flex-row">
                  <div className="h-[260px] w-full lg:w-[55%]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={
                            isPipelineEmpty
                              ? [{ group: "No data", value: 1, color: "#E5E7EB", count: 0, breakdown: {} }]
                              : pipelineGroups
                          }
                          dataKey="value"
                          nameKey="group"
                          cx="50%"
                          cy="50%"
                          outerRadius={120}
                          innerRadius={0}
                          paddingAngle={isPipelineEmpty ? 0 : 2}
                          activeIndex={activePipelineIndex}
                          activeShape={renderActiveSlice}
                          labelLine={false}
                          label={({ index, x, y, value, payload }) => {
                            if (hoverPipelineIndex !== index || !value) return "";
                            return (
                              <text x={x} y={y} fill="#111827" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
                                {`${payload.group} ${value}`}
                              </text>
                            );
                          }}
                          onMouseEnter={(_, index) => setHoverPipelineIndex(index)}
                          onMouseLeave={() => setHoverPipelineIndex(-1)}
                          onClick={(entry, index) => {
                            if (isPipelineEmpty || !entry.count) return;
                            setActivePipelineIndex(index);
                            setPipelineDrawer({
                              open: true,
                              group: entry.group,
                              candidates: Array.isArray(entry.candidates) ? entry.candidates : [],
                            });
                          }}
                          isAnimationActive
                          animationDuration={400}
                        >
                          {(isPipelineEmpty
                            ? [{ color: "#E5E7EB" }]
                            : pipelineGroups
                          ).map((entry, index) => (
                            <Cell
                              key={`${entry.group}-${index}`}
                              fill={entry.color}
                              opacity={hoverPipelineIndex === -1 || hoverPipelineIndex === index ? 1 : 0.35}
                            />
                          ))}
                        </Pie>
                        <Tooltip content={<PipelineTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="flex-1 space-y-2">
                    {pipelineGroups.map((group, index) => (
                      <button
                        key={group.group}
                        type="button"
                        onClick={() => {
                          if (!group.count) return;
                          setActivePipelineIndex(index);
                          setPipelineDrawer({
                            open: true,
                            group: group.group,
                            candidates: Array.isArray(group.candidates) ? group.candidates : [],
                          });
                        }}
                        className="flex w-full items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-left text-xs hover:bg-gray-50"
                      >
                        <span className="inline-flex items-center gap-2 text-gray-700">
                          <span
                            className="h-2.5 w-2.5 rounded-sm"
                            style={{ backgroundColor: group.color }}
                          />
                          {group.group}
                        </span>
                        <span className="font-semibold text-gray-900">
                          {group.count} ({(group.pct ?? 0).toFixed(1)}%)
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </section>
            )}
          </>
        )}
      </div>

      <div
        className={`grid grid-cols-1 gap-4 ${
          SHOW_CONSULTANTS_FEATURES ? "md:grid-cols-3" : "md:grid-cols-2"
        }`}
      >
        <SummaryPanel
          title="Active Requirements"
          value={activeReqTotal}
          subtitle="Assigned to you and waiting for recruiter action"
          detail={`${withSubmissions} of ${activeReqTotal} have submissions`}
          actionLabel="Review Requirements"
          onAction={() => navigate("/account-manager/requirements")}
          loading={loading}
          hasError={errors.panels}
          progress={errors.panels ? 0 : reqProgressPct}
        />

        <SummaryPanel
          title="Pipeline Ready"
          value={Number(pipelineReadyPanel.total || 0)}
          subtitle="Candidates ready for your review"
          detail={`AM Shortlisted: ${formatNumber(Number(pipelineReadyPanel.am_shortlisted || 0))} | Client Shortlisted: ${formatNumber(Number(pipelineReadyPanel.client_shortlisted || 0))}`}
          actionLabel="Send to Client"
          onAction={() => navigate("/account-manager/candidate-review?status=am_shortlisted")}
          loading={loading}
          hasError={errors.panels}
        />

        {SHOW_CONSULTANTS_FEATURES ? (
          <SummaryPanel
            title="Consultant Pool"
            value={Number(consultantPoolPanel.available || 0)}
            subtitle="Consultants available for placement"
            detail={`Available: ${formatNumber(Number(consultantPoolPanel.available || 0))} | On Bench: ${formatNumber(Number(consultantPoolPanel.on_bench || 0))} | Active: ${formatNumber(Number(consultantPoolPanel.active || 0))}`}
            actionLabel="View Assignments"
            onAction={() => navigate("/account-manager/assignments")}
            loading={loading}
            hasError={errors.panels}
          />
        ) : null}
      </div>

      {pipelineDrawer.open && (
        <div className="fixed inset-0 z-50 bg-black/40">
          <div className="absolute right-0 top-0 h-full w-full max-w-lg overflow-hidden bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{pipelineDrawer.group}</h3>
                <p className="text-xs text-gray-500">
                  {pipelineDrawer.candidates.length} candidate
                  {pipelineDrawer.candidates.length !== 1 ? "s" : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPipelineDrawer({ open: false, group: "", candidates: [] })}
                className="rounded-md p-1 text-gray-500 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="h-[calc(100%-76px)] overflow-y-auto p-4">
              {pipelineDrawer.candidates.length === 0 ? (
                <p className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
                  No candidates found in this group.
                </p>
              ) : (
                <div className="space-y-3">
                  {pipelineDrawer.candidates.map((candidate) => (
                    <div
                      key={`${candidate.candidate_id}-${candidate.status}`}
                      className="rounded-lg border border-gray-200 p-3"
                    >
                      <p className="text-sm font-semibold text-gray-900">{candidate.name || "Unnamed Candidate"}</p>
                      <p className="mt-1 text-xs text-gray-600">
                        Status: {candidate.status_label || statusKeyToLabel(candidate.status)}
                      </p>
                      <p className="mt-1 text-xs text-gray-600">
                        Job: {candidate.job_applied_for || "Not specified"}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
