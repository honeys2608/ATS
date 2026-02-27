import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, BriefcaseBusiness, Landmark, Mail, CheckCircle2, Link2, ArrowRight } from "lucide-react";
import { fetchBusinessSetupSummary, fetchMyPermissions, fetchTenants } from "../../services/businessSetupService";

const EMPTY_COUNTS = {
  departments: 0,
  locations: 0,
  designations: 0,
  job_templates: 0,
  hiring_stages: 0,
  branding: 0,
  portal_preferences: 0,
  candidate_email_templates: 0,
  notification_email_templates: 0,
  job_approval_workflows: 0,
  offer_approval_workflows: 0,
  integrations: 0,
};

const MODULES = [
  {
    key: "organization_structure",
    title: "Organization Structure",
    description: "Define departments, locations, and designations",
    icon: Building2,
    actionLabel: "Manage",
    route: "/super-admin/business-setup/org-structure",
    permission: ["org_structure", "manage"],
    bullets: [
      { label: "Departments", key: "departments" },
      { label: "Locations", key: "locations" },
      { label: "Designations", key: "designations" },
    ],
  },
  {
    key: "job_settings",
    title: "Job Settings",
    description: "Standardize jobs and configure hiring stages",
    icon: BriefcaseBusiness,
    actionLabel: "Configure",
    route: "/super-admin/business-setup/job-settings",
    permission: ["job_settings", "manage"],
    bullets: [
      { label: "Job Templates", key: "job_templates" },
      { label: "Hiring Stages", key: "hiring_stages" },
    ],
  },
  {
    key: "company_profile",
    title: "Company Profile",
    description: "Set up branding and portal preferences",
    icon: Landmark,
    actionLabel: "Customize",
    route: "/super-admin/business-setup/company-profile",
    permission: ["company_profile", "manage"],
    bullets: [
      { label: "Branding", key: "branding" },
      { label: "Portal Preferences", key: "portal_preferences" },
    ],
  },
  {
    key: "email_templates",
    title: "Email Templates",
    description: "Customize and standardize system emails",
    icon: Mail,
    actionLabel: "Edit",
    route: "/super-admin/business-setup/email-templates",
    permission: ["email_templates", "manage"],
    bullets: [
      { label: "Candidate Emails", key: "candidate_email_templates" },
      { label: "Notification Emails", key: "notification_email_templates" },
    ],
  },
  {
    key: "approval_workflows",
    title: "Approval Workflows",
    description: "Configure multi-step approval chains",
    icon: CheckCircle2,
    actionLabel: "Set Up",
    route: "/super-admin/business-setup/approval-workflows",
    permission: ["approval_workflows", "manage"],
    bullets: [
      { label: "Job Approval Workflow", key: "job_approval_workflows" },
      { label: "Offer Approval Workflow", key: "offer_approval_workflows" },
    ],
  },
  {
    key: "integrations",
    title: "Integrations",
    description: "Connect with external recruitment platforms",
    icon: Link2,
    actionLabel: "Integrate",
    route: "/super-admin/business-setup/integrations",
    permission: ["integrations", "manage"],
    bullets: [{ label: "LinkedIn/Naukri/Others", key: "integrations" }],
  },
];

export default function BusinessSetup() {
  const navigate = useNavigate();
  const [scope, setScope] = useState("global");
  const [tenantId, setTenantId] = useState("");
  const [tenants, setTenants] = useState([]);
  const [summary, setSummary] = useState(EMPTY_COUNTS);
  const [permissions, setPermissions] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    Promise.allSettled([fetchTenants(), fetchMyPermissions()]).then((results) => {
      if (!mounted) return;
      if (results[0].status === "fulfilled") setTenants(results[0].value || []);
      if (results[1].status === "fulfilled") setPermissions(results[1].value || {});
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    async function loadSummary() {
      setLoading(true);
      setError("");
      try {
        const data = await fetchBusinessSetupSummary(scope, tenantId || undefined);
        if (mounted) setSummary({ ...EMPTY_COUNTS, ...(data || {}) });
      } catch (e) {
        if (mounted) {
          setSummary(EMPTY_COUNTS);
          setError(e?.response?.data?.detail || "Failed to load business setup summary");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    if (scope === "tenant" && !tenantId) {
      setSummary(EMPTY_COUNTS);
      setLoading(false);
      return;
    }
    loadSummary();
    return () => {
      mounted = false;
    };
  }, [scope, tenantId]);

  const hasPermission = useMemo(() => {
    return (moduleName, actionName) => {
      const moduleKey = String(moduleName || "").toLowerCase();
      const actionKey = String(actionName || "").toLowerCase();
      const actions = Array.isArray(permissions?.[moduleKey]) ? permissions[moduleKey] : [];
      return actions.includes(actionKey);
    };
  }, [permissions]);

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-3xl font-extrabold text-slate-900">Business Setup</h2>
        <p className="mt-1 text-sm text-slate-600">Configure organization hierarchy, job setup, branding, templates, approvals and integrations.</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="text-sm font-semibold text-slate-700">Scope</label>
          <select
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={scope}
            onChange={(e) => {
              setScope(e.target.value);
              if (e.target.value === "global") setTenantId("");
            }}
          >
            <option value="global">Global</option>
            <option value="tenant">Tenant</option>
          </select>
          {scope === "tenant" && (
            <select
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
            >
              <option value="">Select Tenant</option>
              {tenants.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>{tenant.name}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {MODULES.map((module) => {
          const Icon = module.icon;
          const canManage = hasPermission(module.permission[0], module.permission[1]);
          return (
            <div key={module.key} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-slate-100 p-2.5 text-slate-700"><Icon size={20} /></div>
                <div>
                  <h3 className="text-2xl font-bold text-slate-900">{module.title}</h3>
                  <p className="text-sm text-slate-600">{module.description}</p>
                </div>
              </div>

              <div className="my-4 border-b border-slate-100" />

              <div className="space-y-2">
                {module.bullets.map((bullet) => (
                  <div key={bullet.label} className="flex items-center gap-2 text-sm text-slate-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                    <span>{bullet.label} ({loading ? "..." : Number(summary[bullet.key] || 0)})</span>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex justify-end">
                {canManage ? (
                  <button
                    type="button"
                    onClick={() => navigate(module.route, { state: { scope, tenantId } })}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-100"
                  >
                    {module.actionLabel} <ArrowRight size={14} />
                  </button>
                ) : (
                  <span className="text-xs text-slate-500">No permission</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
