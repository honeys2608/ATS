import React from "react";
import { NavLink } from "react-router-dom";

const AccountManagerLayout = ({ children }) => {
  return (
    <div className="flex">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-800 text-white h-screen p-4">
        <nav className="space-y-4">
          <NavLink
            to="/account-manager/dashboard"
            className="block py-2 px-4 rounded hover:bg-gray-700"
          >
            Dashboard
          </NavLink>
          <NavLink
            to="/account-manager/assigned-jobs"
            className="block py-2 px-4 rounded hover:bg-gray-700"
          >
            Assigned Jobs
          </NavLink>
          <NavLink
            to="/account-manager/candidate-intake"
            className="block py-2 px-4 rounded hover:bg-gray-700"
          >
            Candidate Intake
          </NavLink>
          <NavLink
            to="/account-manager/interview-calendar"
            className="block py-2 px-4 rounded hover:bg-gray-700"
          >
            Interview Calendar
          </NavLink>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 bg-gray-100">{children}</main>
    </div>
  );
};

export default AccountManagerLayout;
