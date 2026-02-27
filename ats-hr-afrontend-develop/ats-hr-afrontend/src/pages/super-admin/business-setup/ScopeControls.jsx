import React from "react";

export default function ScopeControls({ scope, tenantId, tenants, onScopeChange, onTenantChange }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="text-sm font-semibold text-slate-700">Scope</label>
      <select
        className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        value={scope}
        onChange={(e) => onScopeChange(e.target.value)}
      >
        <option value="global">Global</option>
        <option value="tenant">Tenant</option>
      </select>
      {scope === "tenant" && (
        <select
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          value={tenantId}
          onChange={(e) => onTenantChange(e.target.value)}
        >
          <option value="">Select Tenant</option>
          {tenants.map((tenant) => (
            <option key={tenant.id} value={tenant.id}>
              {tenant.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
