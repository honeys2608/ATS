import React, { useEffect, useState } from "react";
import { getResource, postResource } from "../../../services/businessSetupService";
import useBusinessScope from "./useBusinessScope";
import ScopeControls from "./ScopeControls";

const PROVIDERS = ["linkedin", "naukri", "indeed", "smtp", "sendgrid", "google_calendar", "webhooks"];

export default function BusinessSetupIntegrations() {
  const { scope, tenantId, tenants, setScope, setTenantId } = useBusinessScope();
  const [items, setItems] = useState([]);
  const [logs, setLogs] = useState([]);
  const [selectedProvider, setSelectedProvider] = useState("");
  const [error, setError] = useState("");

  const scoped = { scope, tenant_id: scope === "tenant" ? tenantId : undefined };

  const load = async () => {
    if (scope === "tenant" && !tenantId) {
      setItems([]);
      return;
    }
    try {
      const res = await getResource("/v1/super-admin/integrations", scoped);
      setItems(res?.items || []);
    } catch {
      setError("Failed to load integrations");
    }
  };

  useEffect(() => {
    load();
  }, [scope, tenantId]);

  const connect = async (provider, connectMode) => {
    try {
      await postResource(`/v1/super-admin/integrations/${provider}/${connectMode ? "connect" : "disconnect"}`, scoped);
      load();
      setSelectedProvider(provider);
      const logsRes = await getResource(`/v1/super-admin/integrations/${provider}/logs`, scoped);
      setLogs(logsRes?.items || []);
    } catch {
      setError("Integration action failed");
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Integrations</h2>
        <p className="text-sm text-slate-600">Connect or disconnect platform integrations per scope.</p>
      </div>

      <ScopeControls scope={scope} tenantId={tenantId} tenants={tenants} onScopeChange={setScope} onTenantChange={setTenantId} />

      {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {PROVIDERS.map((provider) => {
            const row = items.find((item) => item.provider === provider);
            const isConnected = row?.status === "connected";
            return (
              <div key={provider} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3">
                <div>
                  <div className="font-semibold capitalize text-slate-900">{provider.replace("_", " ")}</div>
                  <div className="text-xs text-slate-600">Status: {row?.status || "disconnected"}</div>
                </div>
                <div className="flex gap-2">
                  {isConnected ? (
                    <button className="rounded border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700" onClick={() => connect(provider, false)}>Disconnect</button>
                  ) : (
                    <button className="rounded border border-emerald-300 px-3 py-1.5 text-xs font-semibold text-emerald-700" onClick={() => connect(provider, true)}>Connect</button>
                  )}
                  <button className="rounded border border-slate-300 px-3 py-1.5 text-xs" onClick={async () => {
                    setSelectedProvider(provider);
                    const logsRes = await getResource(`/v1/super-admin/integrations/${provider}/logs`, scoped);
                    setLogs(logsRes?.items || []);
                  }}>Logs</button>
                </div>
              </div>
            );
          })}
        </div>
        <div className="rounded-lg border border-slate-200 p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">{selectedProvider ? `${selectedProvider} Logs` : "Integration Logs"}</h3>
          <div className="mt-3 space-y-2 text-xs text-slate-700">
            {logs.length === 0 ? <p className="text-slate-500">No logs</p> : logs.map((log) => (
              <div key={log.id} className="rounded border border-slate-200 bg-slate-50 p-2">
                <div className="font-semibold">{log.status}</div>
                <div>{log.message}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
