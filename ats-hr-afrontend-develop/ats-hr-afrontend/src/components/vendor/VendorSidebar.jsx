import React from "react";
import { NavLink } from "react-router-dom";

/**
 * VendorSidebar
 * - Navigation for Vendor Portal
 * - ATS-style, minimal, professional
 */

const navItems = [
  {
    label: "Dashboard",
    path: "/vendor/dashboard",
  },
  {
    label: "Candidates",
    path: "/vendor/candidates",
  },
  {
    label: "Documents",
    path: "/vendor/documents",
  },
  {
    label: "Profile",
    path: "/vendor/profile",
  },
];

export default function VendorSidebar() {
  const linkClass = ({ isActive }) =>
    `block px-4 py-2 rounded-md text-sm font-medium transition ${
      isActive ? "bg-blue-600 text-white" : "text-gray-200 hover:bg-gray-700"
    }`;

  return (
    <aside className="w-64 bg-gray-900 text-white flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-700">
        <h2 className="text-lg font-semibold tracking-wide">Vendor Portal</h2>
        <p className="text-xs text-gray-400 mt-1">Supply Partner Access</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-4 space-y-2">
        {navItems.map((item) => (
          <NavLink key={item.path} to={item.path} className={linkClass}>
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-gray-700 text-xs text-gray-400">
        © {new Date().getFullYear()} ATS Platform
      </div>
    </aside>
  );
}
