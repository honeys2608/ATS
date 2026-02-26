import React, { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download, FileUp, RefreshCcw } from "lucide-react";
import api from "../../api/axios";

const TAB_CONFIG = [
  { key: "submissions", label: "Submissions", endpoint: "/v1/super-admin/tracker/submissions" },
  { key: "selections", label: "Selections", endpoint: "/v1/super-admin/tracker/selections" },
  { key: "channel_partners", label: "Channel Partners", endpoint: "/v1/super-admin/tracker/channel-partners" },
  { key: "client_invoices", label: "Client Invoices", endpoint: "/v1/super-admin/tracker/client-invoices" },
  { key: "cp_invoices", label: "CP Invoices", endpoint: "/v1/super-admin/tracker/cp-invoices" },
];

const STATUS_COLORS = {
  "Profile Submitted": "bg-blue-100 text-blue-700",
  Shortlisted: "bg-purple-100 text-purple-700",
  Selected: "bg-green-100 text-green-700",
  "Screen Reject Internal": "bg-red-100 text-red-700",
  "Screen Reject Client": "bg-red-100 text-red-700",
  "Interview Scheduled": "bg-indigo-100 text-indigo-700",
  Duplicate: "bg-slate-100 text-slate-700",
  "Req on Hold": "bg-amber-100 text-amber-700",
  "Interview No Show": "bg-orange-100 text-orange-700",
  Offered: "bg-teal-100 text-teal-700",
  Joined: "bg-emerald-100 text-emerald-700",
  "Joining No Show": "bg-rose-100 text-rose-700",
  "Interview Reject": "bg-red-100 text-red-700",
  Paid: "bg-emerald-100 text-emerald-700",
  Pending: "bg-amber-100 text-amber-700",
  Overdue: "bg-red-100 text-red-700",
};

const DONUT_COLORS = ["#7c3aed", "#2563eb", "#10b981", "#f59e0b", "#ef4444", "#0ea5e9"];
const BAR_COLORS = ["#7c3aed", "#2563eb", "#10b981", "#f59e0b", "#ef4444", "#14b8a6", "#6366f1", "#84cc16"];

function fmtMoney(value) {
  return `Rs ${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function fmtPct(value) {
  const num = Number(value || 0);
  return `${num > 0 ? "+" : ""}${num.toFixed(1)}%`;
}

function readable(key) {
  return String(key || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function FilterBar({ filters, setFilters, options }) {
  const clients = options?.clients || [];
  const ams = options?.ams || [];
  const recruiters = options?.recruiters || [];
  return (
    <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-6">
      <select
        className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
        value={filters.period}
        onChange={(e) => {
          const nextPeriod = e.target.value;
          setFilters((p) => ({
            ...p,
            period: nextPeriod,
            ...(nextPeriod !== "custom" ? { date_from: "", date_to: "" } : {}),
          }));
        }}
      >
        <option value="today">Today</option>
        <option value="week">This Week</option>
        <option value="month">This Month</option>
        <option value="custom">Custom Range</option>
      </select>
      <select className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm" value={filters.client} onChange={(e) => setFilters((p) => ({ ...p, client: e.target.value }))}>
        <option value="">All clients</option>
        {clients.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <select className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm" value={filters.am} onChange={(e) => setFilters((p) => ({ ...p, am: e.target.value }))}>
        <option value="">All AMs</option>
        {ams.map((a) => <option key={a} value={a}>{a}</option>)}
      </select>
      <select className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm" value={filters.recruiter} onChange={(e) => setFilters((p) => ({ ...p, recruiter: e.target.value }))}>
        <option value="">All recruiters</option>
        {recruiters.map((r) => <option key={r} value={r}>{r}</option>)}
      </select>
      <div className="space-y-1">
        <p className="text-xs font-medium text-slate-500">From Date</p>
        <input
          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
          type="date"
          value={filters.date_from}
          aria-label="From date"
          title="From date"
          onChange={(e) =>
            setFilters((p) => ({ ...p, period: "custom", date_from: e.target.value }))
          }
        />
      </div>
      <div className="space-y-1">
        <p className="text-xs font-medium text-slate-500">To Date</p>
        <input
          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
          type="date"
          value={filters.date_to}
          aria-label="To date"
          title="To date"
          onChange={(e) =>
            setFilters((p) => ({ ...p, period: "custom", date_to: e.target.value }))
          }
        />
      </div>
      <p className="text-xs text-slate-500 md:col-span-6">
        Use From Date and To Date for a custom date range. Selecting any date automatically switches to Custom Range.
      </p>
    </div>
  );
}

function KpiCard({ label, value, change }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-bold text-slate-900">{value}</p>
      {change != null && <p className={`mt-1 text-xs font-semibold ${Number(change) >= 0 ? "text-emerald-700" : "text-red-700"}`}>{fmtPct(change)}</p>}
    </div>
  );
}

function DataTable({ rows, loading, onExportSection }) {
  if (loading) return <p className="text-sm text-slate-500">Loading table...</p>;
  if (!rows.length) return <p className="text-sm text-slate-500">No rows found.</p>;
  const cols = Object.keys(rows[0] || {});
  return (
    <div className="overflow-auto rounded-lg border border-slate-200">
      <table className="min-w-full text-sm">
        <thead className="sticky top-0 bg-slate-100 text-slate-700">
          <tr>{cols.map((c) => <th key={c} className="whitespace-nowrap px-3 py-2 text-left font-semibold">{readable(c)}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => (
            <tr key={`${r.id || idx}`} className={idx % 2 ? "bg-white" : "bg-slate-50"}>
              {cols.map((c) => {
                const v = r[c];
                const isStatus = c.toLowerCase().includes("status");
                return (
                  <td key={`${idx}-${c}`} className="px-3 py-2 align-top text-slate-800">
                    {isStatus ? <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[v] || "bg-slate-100 text-slate-700"}`}>{v || "-"}</span> : <span>{v == null || v === "" ? "-" : String(v)}</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex justify-end border-t border-slate-200 bg-white p-2">
        <button type="button" onClick={onExportSection} className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"><Download className="h-3.5 w-3.5" />Export CSV</button>
      </div>
    </div>
  );
}

export default function TrackerMetricsDashboard() {
  const [filters, setFilters] = useState({ period: "month", client: "", am: "", recruiter: "", date_from: "", date_to: "" });
  const [activeTab, setActiveTab] = useState("submissions");
  const [submissionKpis, setSubmissionKpis] = useState({ metrics: {}, change_pct: {} });
  const [filterOptions, setFilterOptions] = useState({ clients: [], ams: [], recruiters: [] });
  const [selectionKpis, setSelectionKpis] = useState({});
  const [invoiceKpis, setInvoiceKpis] = useState({});
  const [byClient, setByClient] = useState([]);
  const [funnel, setFunnel] = useState([]);
  const [funnelConversion, setFunnelConversion] = useState(0);
  const [leaderboard, setLeaderboard] = useState([]);
  const [skills, setSkills] = useState([]);
  const [amPerf, setAmPerf] = useState([]);
  const [tableState, setTableState] = useState({ page: 1, limit: 25, search: "", sort_by: "created_at", sort_dir: "desc", items: [], total: 0, total_pages: 1 });
  const [loading, setLoading] = useState(false);
  const [tableLoading, setTableLoading] = useState(false);
  const [message, setMessage] = useState("");

  const query = useMemo(() => {
    const q = { ...filters };
    const hasCustomDates = Boolean(filters.date_from || filters.date_to);
    if (hasCustomDates) {
      q.period = "custom";
    } else if (filters.period !== "custom") {
      delete q.date_from;
      delete q.date_to;
    }
    Object.keys(q).forEach((k) => q[k] === "" && delete q[k]);
    return q;
  }, [filters]);

  const loadAll = async () => {
    setLoading(true);
    setMessage("");
    try {
      const [sK, selK, invK, cl, fu, lb, sk, am] = await Promise.all([
        api.get("/v1/super-admin/tracker/submission-kpis", { params: query }),
        api.get("/v1/super-admin/tracker/selection-kpis", { params: query }),
        api.get("/v1/super-admin/tracker/invoice-kpis", { params: query }),
        api.get("/v1/super-admin/tracker/submissions-by-client", { params: query }),
        api.get("/v1/super-admin/tracker/status-funnel", { params: query }),
        api.get("/v1/super-admin/tracker/recruiter-leaderboard", { params: query }),
        api.get("/v1/super-admin/tracker/skills-breakdown", { params: query }),
        api.get("/v1/super-admin/tracker/am-performance", { params: query }),
      ]);
      setSubmissionKpis(sK.data || { metrics: {}, change_pct: {} });
      setSelectionKpis(selK.data || {});
      setInvoiceKpis(invK.data || {});
      setByClient(cl.data?.items || []);
      setFunnel(fu.data?.items || []);
      setFunnelConversion(fu.data?.conversion_pct || 0);
      setLeaderboard(lb.data?.items || []);
      setSkills(sk.data?.items || []);
      setAmPerf(am.data?.items || []);
    } catch (e) {
      setMessage(e?.response?.data?.detail || "Failed to load tracker metrics.");
    } finally {
      setLoading(false);
    }
  };

  const loadFilterOptions = async () => {
    try {
      const [trackerRes, amClientsRes, amUsersRes, recruiterUsersRes] = await Promise.allSettled([
        api.get("/v1/super-admin/tracker/filter-options"),
        api.get("/v1/am/clients"),
        api.get("/v1/users?role=account_manager"),
        api.get("/v1/users?role=recruiter"),
      ]);

      const trackerData = trackerRes.status === "fulfilled" ? (trackerRes.value?.data || {}) : {};
      const amClientsRaw = amClientsRes.status === "fulfilled" ? (amClientsRes.value?.data?.clients || []) : [];
      const amUsersRaw = amUsersRes.status === "fulfilled" ? (amUsersRes.value?.data || []) : [];
      const recruiterUsersRaw = recruiterUsersRes.status === "fulfilled" ? (recruiterUsersRes.value?.data || []) : [];

      const clientMap = new Map();
      const addClient = (value) => {
        const name = String(value || "").trim();
        if (!name) return;
        const key = name.toLowerCase();
        if (!clientMap.has(key)) clientMap.set(key, name);
      };

      (trackerData.clients || []).forEach(addClient);
      amClientsRaw.forEach((item) => addClient(item?.client_name || item?.name || item));

      const amMap = new Map();
      const addAm = (value) => {
        const name = String(value || "").trim();
        if (!name) return;
        const key = name.toLowerCase();
        if (!amMap.has(key)) amMap.set(key, name);
      };
      (trackerData.ams || []).forEach(addAm);
      amUsersRaw.forEach((u) => addAm(u?.full_name || u?.username || u?.email));

      const recruiterMap = new Map();
      const addRecruiter = (value) => {
        const name = String(value || "").trim();
        if (!name) return;
        const key = name.toLowerCase();
        if (!recruiterMap.has(key)) recruiterMap.set(key, name);
      };
      (trackerData.recruiters || []).forEach(addRecruiter);
      recruiterUsersRaw.forEach((u) => addRecruiter(u?.full_name || u?.username || u?.email));

      setFilterOptions({
        clients: Array.from(clientMap.values()).sort((a, b) => a.localeCompare(b)),
        ams: Array.from(amMap.values()).sort((a, b) => a.localeCompare(b)),
        recruiters: Array.from(recruiterMap.values()).sort((a, b) => a.localeCompare(b)),
      });
    } catch (_) {
      setFilterOptions({ clients: [], ams: [], recruiters: [] });
    }
  };

  const loadTable = async () => {
    const tab = TAB_CONFIG.find((t) => t.key === activeTab);
    if (!tab) return;
    setTableLoading(true);
    try {
      const params = { ...query, ...tableState, page: tableState.page, limit: tableState.limit, search: tableState.search };
      const res = await api.get(tab.endpoint, { params });
      const d = res.data || {};
      setTableState((p) => ({ ...p, items: d.items || [], total: d.total || 0, total_pages: d.total_pages || 1 }));
    } catch (e) {
      setMessage(e?.response?.data?.detail || "Failed to load table.");
      setTableState((p) => ({ ...p, items: [] }));
    } finally {
      setTableLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [query]);

  useEffect(() => {
    loadFilterOptions();
  }, []);

  useEffect(() => {
    loadTable();
  }, [activeTab, query, tableState.page, tableState.limit, tableState.sort_by, tableState.sort_dir]);

  const onImport = async (ev) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
      await api.post("/v1/super-admin/tracker/import", formData, { headers: { "Content-Type": "multipart/form-data" } });
      setMessage("Tracker imported successfully.");
      await Promise.all([loadAll(), loadTable(), loadFilterOptions()]);
    } catch (e) {
      setMessage(e?.response?.data?.detail || "Import failed.");
    } finally {
      ev.target.value = "";
    }
  };

  const onExport = async () => {
    try {
      const tab = TAB_CONFIG.find((t) => t.key === activeTab);
      const res = await api.get("/v1/super-admin/tracker/export", { params: { section: tab?.key || "submissions" }, responseType: "blob" });
      const url = URL.createObjectURL(new Blob([res.data], { type: "text/csv" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `${tab?.key || "submissions"}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setMessage(e?.response?.data?.detail || "Export failed.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Tracker Metrics Dashboard</h2>
          <p className="text-sm text-slate-500">Recruitment pipeline, GP, channel partner and invoice intelligence.</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-700">
            <FileUp className="h-4 w-4" />
            Import Tracker
            <input type="file" accept=".xlsx,.xlsm" className="hidden" onChange={onImport} />
          </label>
          <button type="button" onClick={loadAll} className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"><RefreshCcw className="h-4 w-4" />Refresh</button>
        </div>
      </div>

      <FilterBar filters={filters} setFilters={setFilters} options={filterOptions} />
      {message && <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">{message}</p>}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4 xl:grid-cols-8">
        {["total", "shortlisted", "interviews", "selected", "joined", "rejected", "on_hold", "duplicates"].map((k) => (
          <KpiCard key={k} label={readable(k)} value={submissionKpis.metrics?.[k] || 0} change={submissionKpis.change_pct?.[k]} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
        <KpiCard label="Joined Count" value={selectionKpis.joined || 0} />
        <KpiCard label="Total Gross Profit" value={fmtMoney(selectionKpis.total_gp)} />
        <KpiCard label="Average GP %" value={`${Number(selectionKpis.avg_gp_pct || 0).toFixed(2)}%`} />
        <KpiCard label="BGV Pending" value={selectionKpis.bgv_pending || 0} />
        <KpiCard label="Monthly Billing" value={fmtMoney(selectionKpis.monthly_billing)} />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
        <KpiCard label="Total Invoiced" value={fmtMoney(invoiceKpis.total_invoiced)} />
        <KpiCard label="Paid Amount" value={fmtMoney(invoiceKpis.paid)} />
        <KpiCard label="Outstanding Amount" value={fmtMoney(invoiceKpis.outstanding)} />
        <KpiCard label="GST Total" value={fmtMoney(invoiceKpis.gst_total)} />
        <KpiCard label="CP Payables Pending" value={fmtMoney(invoiceKpis.cp_payable_pending)} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="mb-2 text-sm font-semibold text-slate-800">Submissions by Client</p><div className="h-64">{loading ? <p className="text-sm text-slate-500">Loading...</p> : <ResponsiveContainer width="100%" height="100%"><BarChart data={byClient}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="client_name" /><YAxis /><Tooltip /><Bar dataKey="count">{byClient.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}</Bar></BarChart></ResponsiveContainer>}</div></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="mb-2 text-sm font-semibold text-slate-800">Pipeline Funnel (Conversion {Number(funnelConversion || 0).toFixed(1)}%)</p><div className="h-64">{loading ? <p className="text-sm text-slate-500">Loading...</p> : <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={funnel} dataKey="count" nameKey="status_group" innerRadius={50} outerRadius={90} label>{funnel.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer>}</div></div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="mb-2 text-sm font-semibold text-slate-800">Recruiter Leaderboard</p><div className="space-y-2">{(leaderboard || []).slice(0, 8).map((r) => <div key={r.recruiter_name} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-sm"><span className="font-medium text-slate-800">{r.recruiter_name}</span><span className="text-slate-600">Joined {r.joined} | Conv {Number(r.conversion_pct || 0).toFixed(1)}%</span></div>)}</div></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="mb-2 text-sm font-semibold text-slate-800">Submissions by Skill</p><div className="space-y-2">{(skills || []).map((s) => <div key={s.skill} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-sm"><span className="font-medium text-slate-800">{s.skill}</span><span className="text-slate-600">{s.count} | {Number(s.acceptance_rate || 0).toFixed(1)}%</span></div>)}</div></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="mb-2 text-sm font-semibold text-slate-800">AM Performance</p><div className="space-y-2">{(amPerf || []).slice(0, 8).map((a) => <div key={a.am_name} className="rounded-md bg-slate-50 px-3 py-2 text-sm"><p className="font-medium text-slate-800">{a.am_name}</p><p className="text-slate-600">Sub {a.submissions} | Sel {a.selections} | GP {fmtMoney(a.total_gp)}</p></div>)}</div></div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {TAB_CONFIG.map((tab) => (
            <button key={tab.key} type="button" onClick={() => { setActiveTab(tab.key); setTableState((p) => ({ ...p, page: 1 })); }} className={`rounded-md px-3 py-2 text-sm font-semibold ${activeTab === tab.key ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>{tab.label}</button>
          ))}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <input className="rounded-md border border-slate-200 px-3 py-2 text-sm" placeholder="Search..." value={tableState.search} onChange={(e) => setTableState((p) => ({ ...p, search: e.target.value }))} />
            <select className="rounded-md border border-slate-200 px-3 py-2 text-sm" value={tableState.limit} onChange={(e) => setTableState((p) => ({ ...p, page: 1, limit: Number(e.target.value) }))}><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option></select>
          </div>
        </div>
        <DataTable rows={tableState.items || []} loading={tableLoading} onExportSection={onExport} />
        <div className="mt-3 flex items-center justify-between text-sm text-slate-600">
          <p>Showing {(tableState.page - 1) * tableState.limit + 1} - {Math.min(tableState.page * tableState.limit, tableState.total || 0)} of {tableState.total || 0}</p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setTableState((p) => ({ ...p, page: Math.max(1, p.page - 1) }))} disabled={tableState.page <= 1} className="rounded-md border border-slate-300 px-2 py-1 disabled:opacity-40">Prev</button>
            <span>Page {tableState.page} / {tableState.total_pages || 1}</span>
            <button type="button" onClick={() => setTableState((p) => ({ ...p, page: Math.min(p.total_pages || 1, p.page + 1) }))} disabled={tableState.page >= (tableState.total_pages || 1)} className="rounded-md border border-slate-300 px-2 py-1 disabled:opacity-40">Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}
