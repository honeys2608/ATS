import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../../api/axios";

function formatWorkflowActionLabel(action) {
  return String(action || "")
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatRelativeTime(value) {
  if (!value) return "--";
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return "--";
  const now = Date.now();
  const diffMs = now - target.getTime();
  const diffMinutes = Math.max(1, Math.floor(diffMs / 60000));
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function formatMoney(value) {
  const n = Number(value || 0);
  return `Rs ${n.toLocaleString("en-IN")}`;
}

export default function FinanceBilling() {
  const [summary, setSummary] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [workflowLogs, setWorkflowLogs] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [busyInvoiceId, setBusyInvoiceId] = useState("");
  const [message, setMessage] = useState("");
  const [searchParams] = useSearchParams();
  const query = (searchParams.get("q") || "").trim().toLowerCase();

  const loadSummary = () => {
    return api
      .get("/v1/super-admin/finance/summary")
      .then((res) => setSummary(res.data || {}))
      .catch(() => setSummary({}));
  };

  const loadInvoices = (status = "all") => {
    const params = status && status !== "all" ? { status } : undefined;
    return api
      .get("/v1/invoices", { params })
      .then((res) => {
        const rows = res.data;
        setInvoices(Array.isArray(rows) ? rows : []);
      })
      .catch(() => setInvoices([]));
  };

  useEffect(() => {
    let mounted = true;

    Promise.allSettled([
      api.get("/v1/super-admin/finance/summary"),
      api.get("/v1/invoices"),
      api.get("/v1/recruiter/workflow-logs", { params: { limit: 20 } }),
    ]).then((results) => {
      if (!mounted) return;
      const summaryResult = results[0];
      const invoicesResult = results[1];
      const workflowResult = results[2];

      if (summaryResult.status === "fulfilled") {
        setSummary(summaryResult.value?.data || {});
      } else {
        setSummary({});
      }

      if (invoicesResult.status === "fulfilled") {
        const rows = invoicesResult.value?.data;
        setInvoices(Array.isArray(rows) ? rows : []);
      } else {
        setInvoices([]);
      }

      if (workflowResult.status === "fulfilled") {
        const feed = workflowResult.value?.data?.logs;
        setWorkflowLogs(Array.isArray(feed) ? feed : []);
      } else {
        setWorkflowLogs([]);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    loadInvoices(statusFilter);
  }, [statusFilter]);

  const onUpdateInvoiceStatus = async (invoiceId, nextStatus) => {
    setBusyInvoiceId(invoiceId);
    setMessage("");
    try {
      await api.put(`/v1/invoices/${invoiceId}/status`, null, {
        params: { status: nextStatus },
      });
      await Promise.allSettled([loadSummary(), loadInvoices(statusFilter)]);
      setMessage(`Invoice status updated to ${nextStatus}.`);
    } catch (_error) {
      setMessage("Failed to update invoice status.");
    } finally {
      setBusyInvoiceId("");
    }
  };

  const paidAmount = Number(summary?.paid_amount || 0);
  const totalAmount = Number(summary?.total_amount || 0);
  const collectionRate = useMemo(() => {
    if (totalAmount <= 0) return 0;
    return (paidAmount / totalAmount) * 100;
  }, [paidAmount, totalAmount]);

  const filteredInvoices = useMemo(() => {
    if (!query) return invoices;
    return invoices.filter((inv) =>
      [
        inv?.invoice_number,
        inv?.client_name,
        inv?.amount,
        inv?.status,
        inv?.due_date,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [invoices, query]);

  const filteredWorkflowLogs = useMemo(() => {
    if (!query) return workflowLogs;
    return workflowLogs.filter((log) =>
      [
        log?.action,
        log?.recruiter_name,
        log?.candidate_id,
        log?.job_id,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [workflowLogs, query]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-purple-700 via-indigo-600 to-emerald-500 px-6 py-6 text-white shadow-lg">
        <h2 className="text-3xl font-extrabold">Finance & Billing</h2>
        <p className="mt-1 text-white/90">Invoice exposure, collections, and finance operations</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-purple-200 bg-purple-50 p-4">
          <div className="text-xs uppercase tracking-wide text-slate-600">Total Invoices</div>
          <div className="mt-1 text-3xl font-extrabold text-purple-700">{summary?.total_invoices ?? "--"}</div>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <div className="text-xs uppercase tracking-wide text-slate-600">Total Amount</div>
          <div className="mt-1 text-3xl font-extrabold text-blue-700">{formatMoney(summary?.total_amount)}</div>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="text-xs uppercase tracking-wide text-slate-600">Pending Amount</div>
          <div className="mt-1 text-3xl font-extrabold text-amber-700">{formatMoney(summary?.pending_amount)}</div>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="text-xs uppercase tracking-wide text-slate-600">Collection Rate</div>
          <div className="mt-1 text-3xl font-extrabold text-emerald-700">{collectionRate.toFixed(1)}%</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-slate-900">Invoices</h3>
              <p className="mt-1 text-sm text-slate-500">Live invoice table with quick status actions.</p>
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-md border border-slate-200 px-2 py-1 text-xs"
            >
              <option value="all">All</option>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>
          {message && (
            <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
              {message}
            </div>
          )}
          <div className="mt-4 overflow-auto rounded-lg border border-slate-200">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2 text-left">Invoice</th>
                  <th className="px-3 py-2 text-left">Client</th>
                  <th className="px-3 py-2 text-left">Amount</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Due Date</th>
                  <th className="px-3 py-2 text-left">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.slice(0, 12).map((inv) => (
                  <tr key={inv.id} className="border-t border-slate-200">
                    <td className="px-3 py-2 font-medium text-slate-900">{inv.invoice_number || inv.id}</td>
                    <td className="px-3 py-2 text-slate-700">{inv.client_name || "--"}</td>
                    <td className="px-3 py-2 text-slate-700">{formatMoney(inv.amount)}</td>
                    <td className="px-3 py-2 text-slate-700">{inv.status || "--"}</td>
                    <td className="px-3 py-2 text-slate-700">{inv.due_date || "--"}</td>
                    <td className="px-3 py-2">
                      {(inv.status || "").toLowerCase() === "paid" ? (
                        <span className="rounded bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">
                          Paid
                        </span>
                      ) : (
                        <button
                          disabled={busyInvoiceId === inv.id}
                          onClick={() => onUpdateInvoiceStatus(inv.id, "paid")}
                          className="rounded bg-emerald-600 px-2 py-1 text-xs font-semibold text-white disabled:opacity-50"
                        >
                          {busyInvoiceId === inv.id ? "Saving..." : "Mark Paid"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredInvoices.length === 0 && (
                  <tr>
                    <td className="px-3 py-5 text-center text-slate-500" colSpan="6">
                      {query ? "No invoices match this search." : "No invoice rows available."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xl font-semibold text-emerald-800">Activity Tracking</h3>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
              {filteredWorkflowLogs.length}
            </span>
          </div>
          <div className="space-y-2">
            {filteredWorkflowLogs.length === 0 ? (
              <p className="text-sm text-emerald-700/80">No recruiter workflow activity yet</p>
            ) : (
              filteredWorkflowLogs.slice(0, 8).map((log) => (
                <div key={log.id} className="rounded-lg border border-emerald-100 bg-white p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">{formatWorkflowActionLabel(log.action)}</p>
                    <span className="whitespace-nowrap text-xs text-slate-500">{formatRelativeTime(log.timestamp)}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">Recruiter: {log.recruiter_name || "--"}</p>
                  <p className="text-xs text-slate-600">
                    Candidate: {log.candidate_id || "--"} | Job: {log.job_id || "--"}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
