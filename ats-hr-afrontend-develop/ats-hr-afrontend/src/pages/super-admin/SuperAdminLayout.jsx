import React, { useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Building2,
  Users,
  ShieldCheck,
  Settings,
  BarChart3,
  Wallet,
  FileText,
  Activity,
  SlidersHorizontal,
  LineChart,
  GitBranch,
  Languages,
} from "lucide-react";

const NAV_ITEMS = [
  { label: "Dashboard", to: "/super-admin/dashboard", icon: LayoutDashboard },
  { label: "Business Setup", to: "/super-admin/business-setup", icon: SlidersHorizontal },
  { label: "Clients & Tenants", to: "/super-admin/clients", icon: Building2 },
  { label: "Admin Management", to: "/super-admin/admin-management", icon: Users },
  { label: "Roles & Permissions", to: "/super-admin/roles-permissions", icon: ShieldCheck },
  { label: "Tracker Metrics", to: "/super-admin/tracker-dashboard", icon: LineChart },
  { label: "Workflow Builder", to: "/super-admin/workflow-builder", icon: GitBranch },
  { label: "Nomenclature", to: "/super-admin/nomenclature", icon: Languages },
  { label: "User Management", to: "/super-admin/users", icon: Users },
  { label: "Operations Analytics", to: "/super-admin/operations-analytics", icon: BarChart3 },
  { label: "Finance & Billing", to: "/super-admin/finance-billing", icon: Wallet },
  { label: "Compliance & Security", to: "/super-admin/compliance-security", icon: Activity },
  { label: "System Settings", to: "/super-admin/system-settings", icon: Settings },
  { label: "Audit Logs", to: "/super-admin/audit-logs", icon: FileText },
];

const titleMap = {
  "/super-admin/dashboard": "Super Admin Dashboard",
  "/super-admin/business-setup": "Business Setup",
  "/super-admin/clients": "Clients & Tenants",
  "/super-admin/admin-management": "Admin Management",
  "/super-admin/roles-permissions": "Roles & Permissions",
  "/super-admin/tracker-dashboard": "Tracker Metrics",
  "/super-admin/workflow-builder": "Workflow Builder",
  "/super-admin/nomenclature": "Nomenclature Manager",
  "/super-admin/users": "User Management",
  "/super-admin/operations-analytics": "Operations Analytics",
  "/super-admin/finance-billing": "Finance & Billing",
  "/super-admin/compliance-security": "Compliance & Security",
  "/super-admin/system-settings": "System Settings",
  "/super-admin/audit-logs": "Audit Logs",
};

export default function SuperAdminLayout({ onLogout, children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const pageTitle = useMemo(() => {
    const exact = titleMap[location.pathname];
    if (exact) return exact;
    const found = NAV_ITEMS.find((item) => location.pathname.startsWith(item.to));
    return found ? found.label : "Super Admin";
  }, [location.pathname]);

  const navItem =
    "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition";
  const active = "bg-white text-slate-900 shadow";
  const inactive = "text-white/90 hover:bg-white/15";

  const searchResults = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return [];
    return NAV_ITEMS.filter((item) => item.label.toLowerCase().includes(term)).slice(0, 6);
  }, [search]);

  const runSearch = () => {
    if (searchResults.length === 0) return;
    const query = search.trim();
    const target = searchResults[0].to;
    navigate(query ? `${target}?q=${encodeURIComponent(query)}` : target);
    setSearchOpen(false);
  };

  return (
    <div className="min-h-screen flex bg-slate-100">
      <aside className="w-72 flex-shrink-0 bg-gradient-to-b from-purple-700 to-emerald-600 text-white flex flex-col shadow-lg">
        <div className="px-6 py-5 border-b border-white/20">
          <div className="text-lg font-extrabold">ATS-HR</div>
          <div className="text-xs text-white/80">Super Admin - Governance</div>
        </div>
        <nav className="flex-1 px-4 py-4 space-y-2 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `${navItem} ${isActive ? active : inactive}`
                }
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
        <div className="px-4 py-4 border-t border-white/20">
          <button
            className="w-full rounded-md bg-white/15 hover:bg-white/25 px-3 py-2 text-sm font-semibold"
            onClick={onLogout}
          >
            Logout
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-6 justify-between">
          <div>
            <div className="text-sm text-slate-500">Super Admin</div>
            <h1 className="text-xl font-extrabold text-slate-900">{pageTitle}</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
              Production
            </span>
            <div className="relative">
              <input
                value={search}
                onFocus={() => setSearchOpen(true)}
                onBlur={() => setTimeout(() => setSearchOpen(false), 120)}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setSearchOpen(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    runSearch();
                  }
                }}
                placeholder="Search clients, admins, users"
                className="w-64 rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              {searchOpen && search.trim() && (
                <div className="absolute right-0 top-11 z-10 w-72 overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg">
                  {searchResults.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-slate-500">No matches</div>
                  ) : (
                    searchResults.map((result) => (
                      <button
                        key={result.to}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          const query = search.trim();
                          navigate(query ? `${result.to}?q=${encodeURIComponent(query)}` : result.to);
                          setSearchOpen(false);
                        }}
                        className="block w-full border-b border-slate-100 px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 last:border-b-0"
                      >
                        {result.label}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Logout
            </button>
          </div>
        </header>

        <main className="flex-1 p-6 overflow-auto bg-slate-100">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            {children ? children : <Outlet />}
          </div>
        </main>
      </div>
    </div>
  );
}
