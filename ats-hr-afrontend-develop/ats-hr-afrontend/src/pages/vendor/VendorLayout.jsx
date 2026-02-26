import React from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";

/**
 * VendorLayout
 * ----------------
 * - Root layout for Vendor Portal (/vendor/*)
 * - Sidebar + main content
 * - ATS-grade, production-ready
 */

export default function VendorLayout() {
  const navigate = useNavigate();

  const navItemClass = ({ isActive }) =>
    `block px-4 py-2 rounded-md text-sm font-medium transition ${
      isActive ? "bg-blue-600 text-white" : "text-gray-200 hover:bg-gray-700"
    }`;

  /* ---------------- LOGOUT ---------------- */
  function handleLogout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("role");
    localStorage.removeItem("user");

    // Redirect + force App.jsx auth reset
    navigate("/login", { replace: true });
    window.location.reload();
  }

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* ================= Sidebar ================= */}
      <aside className="w-64 bg-gray-900 text-white flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold tracking-wide">Vendor Portal</h2>
          <p className="text-xs text-gray-400 mt-1">Supply Partner Access</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-4 space-y-2">
          <NavLink to="/vendor/dashboard" className={navItemClass}>
            Dashboard
          </NavLink>

          <NavLink to="/vendor/candidates" className={navItemClass}>
            Candidates
          </NavLink>

          <NavLink to="/vendor/bgv-assigned" className={navItemClass}>
            Assigned BGV
          </NavLink>

          <NavLink to="/vendor/documents" className={navItemClass}>
            Documents
          </NavLink>

          <NavLink to="/vendor/profile" className={navItemClass}>
            Profile
          </NavLink>
        </nav>

        {/* Logout */}
        <div className="px-4 py-3 border-t border-gray-700">
          <button
            onClick={handleLogout}
            className="w-full text-left text-sm px-4 py-2 rounded-md text-red-400 hover:bg-red-500/10 hover:text-red-300 transition"
          >
            Logout
          </button>
        </div>

        {/* Footer */}
        <div className="px-4 py-2 text-xs text-gray-500 text-center">
          © {new Date().getFullYear()} ATS Platform
        </div>
      </aside>

      {/* ================= Main Content ================= */}
      <main className="flex-1 p-6 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
