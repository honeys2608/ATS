import React, { useMemo } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Wallet,
  Users,
  Briefcase,
  CalendarDays,
  Settings,
  LogOut,
  UserRoundSearch,
} from "lucide-react";
import usePermissions from "../../hooks/usePermissions";

const NAV_ITEMS = [
  {
    label: "Dashboard",
    to: "/dashboard",
    module: "dashboard",
    action: "view",
    icon: LayoutDashboard,
  },
  {
    label: "Finance",
    to: "/finance",
    module: "finance",
    action: "view",
    icon: Wallet,
  },
  {
    label: "Users",
    to: "/users",
    module: "users",
    action: "view",
    icon: Users,
  },
  {
    label: "Candidate Profiles",
    to: "/candidate-profile",
    module: "candidates",
    action: "view",
    icon: UserRoundSearch,
  },
  {
    label: "Jobs",
    to: "/jobs",
    module: "jobs",
    action: "view",
    icon: Briefcase,
  },
  {
    label: "Interviews",
    to: "/interviews",
    module: "interviews",
    action: "view",
    icon: CalendarDays,
  },
  {
    label: "Settings",
    to: "/settings",
    module: "settings",
    action: "view",
    icon: Settings,
  },
];

const normalizeRole = (role) =>
  String(role || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

export default function CustomRoleLayout({ onLogout, role, children }) {
  const navigate = useNavigate();
  const { can, permissions } = usePermissions();
  const roleLabel = normalizeRole(role).replace(/_/g, " ");

  const hasModuleAccess = (module, action) => {
    const moduleKey = String(module || "").toLowerCase();
    const moduleActions = Array.isArray(permissions?.[moduleKey])
      ? permissions[moduleKey]
      : [];

    // Show module in custom-role navigation when any permission exists for it.
    // This ensures newly created users can see the page tied to assigned actions like jobs:create.
    return moduleActions.length > 0 || can(moduleKey, action);
  };

  const navItems = useMemo(
    () => NAV_ITEMS.filter((item) => hasModuleAccess(item.module, item.action)),
    [permissions, can],
  );

  const navItemClass = ({ isActive }) =>
    `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
      isActive
        ? "bg-white text-slate-900 shadow"
        : "text-white/90 hover:bg-white/15 hover:text-white"
    }`;

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("role");
    localStorage.removeItem("user");
    if (onLogout) onLogout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex min-h-screen">
        <aside className="w-72 bg-gradient-to-b from-indigo-700 via-violet-600 to-cyan-600 p-5 text-white">
          <h2 className="text-2xl font-bold">Role Portal</h2>
          <p className="mt-1 text-sm text-white/80 capitalize">{roleLabel}</p>

          <nav className="mt-8 space-y-2">
            {navItems.length > 0 ? (
              navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink key={item.to} to={item.to} className={navItemClass}>
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </NavLink>
                );
              })
            ) : (
              <p className="rounded-lg bg-white/10 p-3 text-sm text-white/90">
                No navigation available for current permissions.
              </p>
            )}
          </nav>

          <button
            type="button"
            onClick={handleLogout}
            className="mt-8 flex w-full items-center justify-center gap-2 rounded-lg border border-white/35 bg-white/10 px-3 py-2 text-sm font-semibold hover:bg-white/20"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </aside>

        <main className="flex-1 p-6">{children || <Outlet />}</main>
      </div>
    </div>
  );
}
