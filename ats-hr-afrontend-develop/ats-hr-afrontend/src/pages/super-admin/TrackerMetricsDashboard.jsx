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
  Raised: "bg-blue-100 text-blue-700",
  Sent: "bg-purple-100 text-purple-700",
  Paid: "bg-emerald-100 text-emerald-700",
  Pending: "bg-amber-100 text-amber-700",
  Overdue: "bg-red-100 text-red-700",
};

const DONUT_COLORS = ["#7c3aed", "#2563eb", "#10b981", "#f59e0b", "#ef4444", "#0ea5e9"];
const BAR_COLORS = ["#7c3aed", "#2563eb", "#10b981", "#f59e0b", "#ef4444", "#14b8a6", "#6366f1", "#84cc16"];

const SUBMISSION_COLUMNS = [
  "serial_no",
  "submission_date",
  "client_name",
  "requirement_no",
  "am_name",
  "recruiter_name",
  "candidate_name",
  "skill",
  "total_experience",
  "current_location",
  "notice_period",
  "status",
  "remarks",
];

const SELECTION_COLUMNS = [
  "client_name",
  "am_name",
  "recruiter_name",
  "candidate_name",
  "skill_set",
  "date_of_joining",
  "billing_per_day",
  "ctc_per_month",
  "gp_value",
  "gp_percent",
  "status",
  "bgv_final_dt",
  "po_no",
];

const CHANNEL_PARTNER_COLUMNS = [
  "cp_name",
  "candidate_name",
  "skill_set",
  "date_of_joining",
  "cp_billing",
  "routing_fee",
  "infy_billing",
  "margin",
  "status",
  "bgv_with",
  "po_no",
];

const CLIENT_INVOICE_COLUMNS = [
  "client_name",
  "candidate_name",
  "service_month",
  "po_no",
  "invoice_no",
  "invoice_date",
  "invoice_value",
  "gst_amount",
  "total_inv_value",
  "status_display",
  "payment_date",
];

const CP_INVOICE_COLUMNS = [
  "cp_name",
  "candidate_name",
  "service_month",
  "client_inv_no",
  "client_inv_value",
  "client_payment_dt",
  "cp_inv_no",
  "cp_inv_value",
  "payment_status_display",
  "gst_status",
  "net_payable",
  "remarks",
];

const TAB_COLUMNS = {
  submissions: SUBMISSION_COLUMNS,
  selections: SELECTION_COLUMNS,
  channel_partners: CHANNEL_PARTNER_COLUMNS,
  client_invoices: CLIENT_INVOICE_COLUMNS,
  cp_invoices: CP_INVOICE_COLUMNS,
};

function fmtMoney(value) {
  return `Rs ${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function fmtPct(value, signed = false) {
  const num = Number(value || 0);
  return `${signed && num > 0 ? "+" : ""}${num.toFixed(1)}%`;
}

function readable(key) {
  return String(key || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusClass(value) {
  return STATUS_COLORS[value] || "bg-slate-100 text-slate-700";
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
      <input
        className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
        type="date"
        value={filters.date_from}
        onChange={(e) => setFilters((p) => ({ ...p, period: "custom", date_from: e.target.value }))}
      />
      <input
        className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
        type="date"
        value={filters.date_to}
        onChange={(e) => setFilters((p) => ({ ...p, period: "custom", date_to: e.target.value }))}
      />
    </div>
  );
}

function KpiCard({ label, value, change, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-violet-300 hover:shadow"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-bold text-slate-900">{value}</p>
      {change != null && <p className={`mt-1 text-xs font-semibold ${Number(change) >= 0 ? "text-emerald-700" : "text-red-700"}`}>{fmtPct(change, true)}</p>}
    </button>
  );
}

function formatCell(tab, column, value) {
  if (value == null || value === "") return "-";
  if (["billing_per_day", "ctc_per_month", "gp_value", "cp_billing", "routing_fee", "infy_billing", "margin", "invoice_value", "gst_amount", "total_inv_value", "client_inv_value", "cp_inv_value", "net_payable"].includes(column)) {
    return fmtMoney(value);
  }
  if (column === "gp_percent") {
    return fmtPct(value);
  }
  return String(value);
}

function TableSummary({ activeTab, rows }) {
  if (!rows.length) return null;

  if (activeTab === "selections") {
    const totalBilling = rows.reduce((sum, r) => sum + Number(r.billing_per_day || 0), 0);
    const totalCtc = rows.reduce((sum, r) => sum + Number(r.ctc_per_month || 0), 0);
    const totalGp = rows.reduce((sum, r) => sum + Number(r.gp_value || 0), 0);
    const gpRows = rows.filter((r) => r.gp_percent != null);
    const avgGpPct = gpRows.length ? gpRows.reduce((sum, r) => sum + Number(r.gp_percent || 0), 0) / gpRows.length : 0;
    return <p className="mt-2 text-xs text-slate-600">Summary: Billing/Day {fmtMoney(totalBilling)} | CTC/Month {fmtMoney(totalCtc)} | GP {fmtMoney(totalGp)} | Avg GP% {fmtPct(avgGpPct)}</p>;
  }

  if (activeTab === "client_invoices") {
    const inv = rows.reduce((sum, r) => sum + Number(r.invoice_value || 0), 0);
    const gst = rows.reduce((sum, r) => sum + Number(r.gst_amount || 0), 0);
    const total = rows.reduce((sum, r) => sum + Number(r.total_inv_value || 0), 0);
    return <p className="mt-2 text-xs text-slate-600">Summary: Invoice {fmtMoney(inv)} | GST {fmtMoney(gst)} | Total {fmtMoney(total)}</p>;
  }

  return null;
}

function DataTable({ activeTab, rows, loading, onExportSection }) {
  if (loading) return <p className="text-sm text-slate-500">Loading table...</p>;
  if (!rows.length) return <p className="text-sm text-slate-500">No rows found.</p>;

  const cols = TAB_COLUMNS[activeTab] || Object.keys(rows[0] || {});

  return (
    <>
      <div className="overflow-auto rounded-lg border border-slate-200">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 bg-slate-100 text-slate-700">
            <tr>{cols.map((c) => <th key={c} className="whitespace-nowrap px-3 py-2 text-left font-semibold">{readable(c)}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={`${r.id || idx}`} className={idx % 2 ? "bg-white" : "bg-slate-50"}>
                {cols.map((c) => {
                  const value = r[c];
                  const statusLike = c.toLowerCase().includes("status");
                  const gpPercent = c === "gp_percent";
                  const gpNum = Number(value || 0);
                  const gpClass = gpNum >= 25 ? "text-emerald-700" : gpNum >= 15 ? "text-amber-700" : "text-red-700";
                  return (
                    <td key={`${idx}-${c}`} className="px-3 py-2 align-top text-slate-800">
                      {statusLike ? (
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusClass(value)}`}>{value || "-"}</span>
                      ) : gpPercent ? (
                        <span className={`font-semibold ${gpClass}`}>{fmtPct(value)}</span>
                      ) : (
                        <span>{formatCell(activeTab, c, value)}</span>
                      )}
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
      <TableSummary activeTab={activeTab} rows={rows} />
    </>
  );
}

export default function TrackerMetricsDashboard() {
  const [filters, setFilters] = useState({ period: "month", client: "", am: "", recruiter: "", date_from: "", date_to: "" });
  const [activeTab, setActiveTab] = useState("submissions");
  const [tabFilters, setTabFilters] = useState({ status_group: "", status: "", bgv_pending: "", payment_status: "", client_name: "", recruiter_name: "" });
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
    if (hasCustomDates) q.period = "custom";
    else if (filters.period !== "custom") {
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
      const res = await api.get("/v1/super-admin/tracker/filter-options");
      setFilterOptions(res.data || { clients: [], ams: [], recruiters: [] });
    } catch {
      setFilterOptions({ clients: [], ams: [], recruiters: [] });
    }
  };

  const loadTable = async () => {
    const tab = TAB_CONFIG.find((t) => t.key === activeTab);
    if (!tab) return;
    setTableLoading(true);
    try {
      const params = {
        ...query,
        ...tableState,
        page: tableState.page,
        limit: tableState.limit,
        search: tableState.search,
      };
      if (activeTab === "submissions" && tabFilters.status_group) params.status_group = tabFilters.status_group;
      if (activeTab === "submissions" && tabFilters.status) params.status = tabFilters.status;
      if (activeTab === "selections" && tabFilters.bgv_pending) params.bgv_pending = true;
      if (activeTab === "cp_invoices" && tabFilters.payment_status) params.payment_status = tabFilters.payment_status;
      if (tabFilters.client_name) params.client = tabFilters.client_name;
      if (tabFilters.recruiter_name) params.recruiter = tabFilters.recruiter_name;

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
  }, [activeTab, query, tableState.page, tableState.limit, tableState.sort_by, tableState.sort_dir, tabFilters]);

  const onImport = async (ev) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
      await api.post("/v1/super-admin/tracker/submissions/import", formData, { headers: { "Content-Type": "multipart/form-data" } });
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

  const applySubmissionStatusGroup = (statusGroup) => {
    setActiveTab("submissions");
    setTabFilters((p) => ({ ...p, status_group: statusGroup, status: "", bgv_pending: "", payment_status: "" }));
    setTableState((p) => ({ ...p, page: 1 }));
  };

  const applySelectionBgvPending = () => {
    setActiveTab("selections");
    setTabFilters((p) => ({ ...p, status_group: "", status: "", bgv_pending: "1", payment_status: "" }));
    setTableState((p) => ({ ...p, page: 1 }));
  };

  const applyInvoicePending = () => {
    setActiveTab("cp_invoices");
    setTabFilters((p) => ({ ...p, payment_status: "pending", status_group: "", status: "", bgv_pending: "" }));
    setTableState((p) => ({ ...p, page: 1 }));
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
          <button type="button" onClick={() => { setTabFilters({ status_group: "", status: "", bgv_pending: "", payment_status: "", client_name: "", recruiter_name: "" }); loadAll(); }} className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"><RefreshCcw className="h-4 w-4" />Refresh</button>
        </div>
      </div>

      <FilterBar filters={filters} setFilters={setFilters} options={filterOptions} />
      {message && <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">{message}</p>}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4 xl:grid-cols-8">
        <KpiCard label="Total Submissions" value={submissionKpis.metrics?.total || 0} change={submissionKpis.change_pct?.total} onClick={() => applySubmissionStatusGroup("total")} />
        <KpiCard label="Shortlisted" value={submissionKpis.metrics?.shortlisted || 0} change={submissionKpis.change_pct?.shortlisted} onClick={() => applySubmissionStatusGroup("shortlisted")} />
        <KpiCard label="Interviews" value={submissionKpis.metrics?.interviews || 0} change={submissionKpis.change_pct?.interviews} onClick={() => applySubmissionStatusGroup("interviews")} />
        <KpiCard label="Selected / Offered" value={submissionKpis.metrics?.selected || 0} change={submissionKpis.change_pct?.selected} onClick={() => applySubmissionStatusGroup("selected")} />
        <KpiCard label="Joined" value={submissionKpis.metrics?.joined || 0} change={submissionKpis.change_pct?.joined} onClick={() => applySubmissionStatusGroup("joined")} />
        <KpiCard label="Rejected (All)" value={submissionKpis.metrics?.rejected || 0} change={submissionKpis.change_pct?.rejected} onClick={() => applySubmissionStatusGroup("rejected")} />
        <KpiCard label="Duplicates" value={submissionKpis.metrics?.duplicates || 0} change={submissionKpis.change_pct?.duplicates} onClick={() => applySubmissionStatusGroup("duplicates")} />
        <KpiCard label="On Hold" value={submissionKpis.metrics?.on_hold || 0} change={submissionKpis.change_pct?.on_hold} onClick={() => applySubmissionStatusGroup("on_hold")} />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
        <KpiCard label="Joined Count" value={selectionKpis.joined || 0} onClick={() => setActiveTab("selections")} />
        <KpiCard label="Total GP" value={fmtMoney(selectionKpis.total_gp)} onClick={() => setActiveTab("selections")} />
        <KpiCard label="Avg GP %" value={`${Number(selectionKpis.avg_gp_pct || 0).toFixed(2)}%`} onClick={() => setActiveTab("selections")} />
        <KpiCard label="BGV Pending" value={selectionKpis.bgv_pending || 0} onClick={applySelectionBgvPending} />
        <KpiCard label="Monthly Billing Value" value={fmtMoney(selectionKpis.monthly_billing)} onClick={() => setActiveTab("selections")} />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
        <KpiCard label="Total Invoiced" value={fmtMoney(invoiceKpis.total_invoiced)} onClick={() => setActiveTab("client_invoices")} />
        <KpiCard label="Paid" value={fmtMoney(invoiceKpis.paid)} onClick={() => setActiveTab("client_invoices")} />
        <KpiCard label="Outstanding" value={fmtMoney(invoiceKpis.outstanding)} onClick={() => setActiveTab("client_invoices")} />
        <KpiCard label="GST Total" value={fmtMoney(invoiceKpis.gst_total)} onClick={() => setActiveTab("client_invoices")} />
        <KpiCard label="CP Payable Pending" value={fmtMoney(invoiceKpis.cp_payable_pending)} onClick={applyInvoicePending} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="mb-2 text-sm font-semibold text-slate-800">Submissions by Client</p>
          <div className="h-64">
            {loading ? <p className="text-sm text-slate-500">Loading...</p> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byClient}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="client_name" />
                  <YAxis />
                  <Tooltip formatter={(v, _name, p) => [v, p?.payload?.status_breakdown ? JSON.stringify(p.payload.status_breakdown) : "count"]} />
                  <Bar dataKey="count" onClick={(d) => { if (!d?.client_name) return; setFilters((p) => ({ ...p, client: d.client_name })); setActiveTab("submissions"); setTabFilters((p) => ({ ...p, client_name: d.client_name })); setTableState((p) => ({ ...p, page: 1 })); }}>
                    {byClient.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="mb-2 text-sm font-semibold text-slate-800">Status Funnel (Conversion {Number(funnelConversion || 0).toFixed(1)}%)</p>
          <div className="h-64">
            {loading ? <p className="text-sm text-slate-500">Loading...</p> : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={funnel} dataKey="count" nameKey="status_group" innerRadius={50} outerRadius={90} label>
                    {funnel.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="mb-2 text-sm font-semibold text-slate-800">Recruiter Leaderboard</p>
          <div className="space-y-2">
            {(leaderboard || []).slice(0, 8).map((r) => (
              <button key={r.recruiter_name} type="button" className="flex w-full items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-left text-sm hover:bg-slate-100" onClick={() => { setFilters((p) => ({ ...p, recruiter: r.recruiter_name })); setActiveTab("submissions"); setTabFilters((p) => ({ ...p, recruiter_name: r.recruiter_name })); setTableState((p) => ({ ...p, page: 1 })); }}>
                <span className="font-medium text-slate-800">{r.recruiter_name}</span>
                <span className="text-slate-600">Joined {r.joined} | Conv {Number(r.conversion_pct || 0).toFixed(1)}%</span>
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="mb-2 text-sm font-semibold text-slate-800">Submissions by Skill</p>
          <div className="space-y-2">
            {(skills || []).map((s) => (
              <div key={s.skill} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-sm">
                <span className="font-medium text-slate-800">{s.skill}</span>
                <span className="text-slate-600">{s.count} | {Number(s.acceptance_rate || 0).toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="mb-2 text-sm font-semibold text-slate-800">AM Performance</p>
          <div className="space-y-2">
            {(amPerf || []).slice(0, 8).map((a) => (
              <div key={a.am_name} className="rounded-md bg-slate-50 px-3 py-2 text-sm">
                <p className="font-medium text-slate-800">{a.am_name}</p>
                <p className="text-slate-600">Sub {a.submissions} | Sel {a.selections} | GP {fmtMoney(a.total_gp)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {TAB_CONFIG.map((tab) => (
            <button key={tab.key} type="button" onClick={() => { setActiveTab(tab.key); setTableState((p) => ({ ...p, page: 1 })); }} className={`rounded-md px-3 py-2 text-sm font-semibold ${activeTab === tab.key ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>{tab.label}</button>
          ))}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <input className="rounded-md border border-slate-200 px-3 py-2 text-sm" placeholder="Search candidate/email/skill..." value={tableState.search} onChange={(e) => setTableState((p) => ({ ...p, search: e.target.value, page: 1 }))} />
            <select className="rounded-md border border-slate-200 px-3 py-2 text-sm" value={tableState.limit} onChange={(e) => setTableState((p) => ({ ...p, page: 1, limit: Number(e.target.value) }))}><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option></select>
          </div>
        </div>
        <DataTable activeTab={activeTab} rows={tableState.items || []} loading={tableLoading} onExportSection={onExport} />
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
