import React, { useEffect, useMemo, useState } from "react";
import {
  Building2,
  BriefcaseBusiness,
  Landmark,
  Mail,
  CheckCircle2,
  Link2,
  Search,
  ArrowRight,
  X,
} from "lucide-react";
import api from "../../api/axios";

const MODULE_CARDS = [
  {
    key: "organization_structure",
    title: "Organization Structure",
    description: "Define departments, locations, and designations",
    cta: "Manage",
    icon: Building2,
    iconTone: "bg-amber-100 text-amber-700",
    ctaTone: "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100",
    bullets: [
      { label: "Departments", countKey: "departments" },
      { label: "Locations", countKey: "locations" },
      { label: "Designations", countKey: "designations" },
    ],
  },
  {
    key: "job_settings",
    title: "Job Settings",
    description: "Standardize jobs and configure hiring stages",
    cta: "Configure",
    icon: BriefcaseBusiness,
    iconTone: "bg-violet-100 text-violet-700",
    ctaTone: "bg-violet-50 text-violet-800 border-violet-200 hover:bg-violet-100",
    bullets: [
      { label: "Job Templates", countKey: "job_templates" },
      { label: "Hiring Stages", countKey: "hiring_stages" },
    ],
  },
  {
    key: "company_profile",
    title: "Company Profile",
    description: "Set up branding and portal preferences",
    cta: "Customize",
    icon: Landmark,
    iconTone: "bg-blue-100 text-blue-700",
    ctaTone: "bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100",
    bullets: [
      { label: "Branding", countKey: "branding_profiles" },
      { label: "Portal Preferences", countKey: "portal_preferences" },
    ],
  },
  {
    key: "email_templates",
    title: "Email Templates",
    description: "Customize and standardize system emails",
    cta: "Edit",
    icon: Mail,
    iconTone: "bg-emerald-100 text-emerald-700",
    ctaTone: "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100",
    bullets: [
      { label: "Candidate Emails", countKey: "candidate_email_templates" },
      { label: "Notification Emails", countKey: "notification_email_templates" },
    ],
  },
  {
    key: "approval_workflows",
    title: "Approval Workflows",
    description: "Configure multi-step approval chains",
    cta: "Set Up",
    icon: CheckCircle2,
    iconTone: "bg-cyan-100 text-cyan-700",
    ctaTone: "bg-cyan-50 text-cyan-800 border-cyan-200 hover:bg-cyan-100",
    bullets: [
      { label: "Job Approval Workflow", countKey: "job_workflows" },
      { label: "Offer Approval Workflow", countKey: "offer_workflows" },
    ],
  },
  {
    key: "integrations",
    title: "Integrations",
    description: "Connect with external recruitment platforms",
    cta: "Integrate",
    icon: Link2,
    iconTone: "bg-yellow-100 text-yellow-700",
    ctaTone: "bg-yellow-50 text-yellow-800 border-yellow-200 hover:bg-yellow-100",
    bullets: [{ label: "LinkedIn, Naukri, & More", countKey: "connected_integrations" }],
  },
];

const EMPTY_COUNTS = {
  departments: 0,
  locations: 0,
  designations: 0,
  job_templates: 0,
  hiring_stages: 0,
  branding_profiles: 0,
  portal_preferences: 0,
  candidate_email_templates: 0,
  notification_email_templates: 0,
  job_workflows: 0,
  offer_workflows: 0,
  connected_integrations: 0,
  total_users: 0,
  active_users: 0,
  inactive_users: 0,
  job_users: 0,
  operations_jobs: 0,
};

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeStats(payload) {
  const stats = payload?.stats || payload?.data || payload || {};
  return {
    ...EMPTY_COUNTS,
    ...stats,
  };
}

function getDisplayCount(value) {
  if (value === null || value === undefined) return 0;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

export default function BusinessSetup() {
  const [stats, setStats] = useState(EMPTY_COUNTS);
  const [loading, setLoading] = useState(true);
  const [activeModule, setActiveModule] = useState(null);

  useEffect(() => {
    let mounted = true;

    const loadStats = async () => {
      try {
        const results = await Promise.allSettled([
          api.get("/api/stats/summary"),
          api.get("/v1/super-admin/system-settings"),
          api.get("/v1/super-admin/dashboard"),
          api.get("/v1/users"),
        ]);

        const summaryRes = results[0].status === "fulfilled" ? results[0].value?.data : null;
        const settingsRes = results[1].status === "fulfilled" ? results[1].value?.data : [];
        const dashboardRes = results[2].status === "fulfilled" ? results[2].value?.data : {};
        const usersRes = results[3].status === "fulfilled" ? results[3].value?.data : [];

        const next = normalizeStats(summaryRes);
        const rows = asArray(settingsRes);
        const businessRows = rows.filter((row) => String(row?.module_name || "") === "business_setup");
        const users = asArray(usersRes?.items || usersRes?.data || usersRes);

        const byKey = (key) => businessRows.find((row) => String(row?.setting_key || "") === key)?.setting_value;
        const countOf = (key) => asArray(byKey(key)).length;

        const activeUsersCount = users.filter((item) => Boolean(item?.is_active ?? item?.active)).length;

        const merged = {
          ...next,
          departments: next.departments || countOf("departments"),
          locations: next.locations || countOf("locations"),
          designations: next.designations || countOf("designations"),
          job_templates: next.job_templates || countOf("job_templates"),
          hiring_stages: next.hiring_stages || countOf("hiring_stages"),
          branding_profiles: next.branding_profiles || (byKey("company_profile") ? 1 : 0),
          portal_preferences: next.portal_preferences || (byKey("portal_preferences") ? 1 : 0),
          candidate_email_templates:
            next.candidate_email_templates || countOf("email_templates_candidate"),
          notification_email_templates:
            next.notification_email_templates || countOf("email_templates_notification"),
          job_workflows: next.job_workflows || countOf("approval_workflow_job"),
          offer_workflows: next.offer_workflows || countOf("approval_workflow_offer"),
          connected_integrations: next.connected_integrations || countOf("integrations"),
          total_users: next.total_users || users.length || dashboardRes?.active_clients || 0,
          active_users: next.active_users || activeUsersCount,
          inactive_users:
            next.inactive_users ||
            Math.max((next.total_users || users.length || 0) - activeUsersCount, 0),
          job_users: next.job_users || dashboardRes?.active_jobs || 0,
          operations_jobs:
            next.operations_jobs ||
            (Number(dashboardRes?.active_jobs || 0) + Number(dashboardRes?.recruiter_productivity || 0)),
        };

        if (mounted) {
          setStats(merged);
        }
      } catch {
        if (mounted) setStats(EMPTY_COUNTS);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadStats();
    return () => {
      mounted = false;
    };
  }, []);

  const moduleList = useMemo(() => MODULE_CARDS, []);

  return (
    <div className="space-y-5 pb-14">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-3xl font-extrabold text-slate-900">Business Setup</h2>
        <p className="mt-1 text-sm text-slate-600">
          Configure organizational hierarchy, job settings, and portal details.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {moduleList.map((module) => {
          const Icon = module.icon;
          return (
            <div
              key={module.key}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className={`rounded-xl p-2.5 ${module.iconTone}`}>
                    <Icon size={20} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-slate-900">{module.title}</h3>
                    <p className="text-sm text-slate-600">{module.description}</p>
                  </div>
                </div>
              </div>

              <div className="my-4 border-b border-slate-100" />

              <div className="space-y-2">
                {module.bullets.map((bullet) => (
                  <div key={bullet.label} className="flex items-center gap-2 text-sm text-slate-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                    <span>
                      {bullet.label} ({loading ? "..." : getDisplayCount(stats[bullet.countKey])})
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => setActiveModule(module)}
                  className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm font-semibold transition ${module.ctaTone}`}
                >
                  {module.cta} <ArrowRight size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="sticky bottom-0 z-20 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="grid grid-cols-2 gap-3 text-sm text-slate-700 md:grid-cols-3 xl:grid-cols-6">
          <div>Total Users: <span className="font-semibold">{getDisplayCount(stats.total_users)}</span></div>
          <div>Active: <span className="font-semibold text-emerald-700">{getDisplayCount(stats.active_users)}</span></div>
          <div>Inactive: <span className="font-semibold text-amber-700">{getDisplayCount(stats.inactive_users)}</span></div>
          <div>Job Users: <span className="font-semibold">{getDisplayCount(stats.job_users)}</span></div>
          <div>Oper. & Jobs: <span className="font-semibold">{getDisplayCount(stats.operations_jobs)}</span></div>
          <div className="inline-flex items-center gap-2"><Search size={15} /> Search</div>
        </div>
      </div>

      {activeModule && (
        <div className="fixed inset-0 z-40">
          <button
            type="button"
            className="absolute inset-0 bg-black/35"
            onClick={() => setActiveModule(null)}
            aria-label="Close overlay"
          />
          <aside className="absolute right-0 top-0 h-full w-full max-w-2xl overflow-auto border-l border-slate-200 bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-2xl font-bold text-slate-900">{activeModule.title}</h3>
                <p className="text-sm text-slate-600">{activeModule.description}</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveModule(null)}
                className="rounded-md border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
              >
                <X size={16} />
              </button>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                Module Snapshot
              </h4>
              <div className="mt-3 space-y-2 text-sm text-slate-700">
                {activeModule.bullets.map((bullet) => (
                  <div key={bullet.label} className="flex items-center justify-between">
                    <span>{bullet.label}</span>
                    <span className="font-semibold">{getDisplayCount(stats[bullet.countKey])}</span>
                  </div>
                ))}
              </div>
            </div>

            <p className="mt-4 rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
              This panel is ready for full module forms and workflows. Current implementation restores the business setup landing experience and connects live counters.
            </p>
          </aside>
        </div>
      )}
    </div>
  );
}
