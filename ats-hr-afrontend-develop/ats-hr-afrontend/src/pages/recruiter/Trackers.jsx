import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import TrackerTable from "./TrackerTable";
import TrackerForm from "./TrackerForm";

export default function Trackers() {
  const location = useLocation();
  const isAdmin = location.pathname.includes("/admin/");
  const tableRef = useRef();

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {isAdmin ? "Recruiter Tracker Management" : "Recruiter Tracker"}
            </h1>
            <p className="text-gray-600 mt-2">
              {isAdmin
                ? "Manage and monitor all recruiter tracking activities"
                : "Spreadsheet-style tracker for daily recruitment operations"}
            </p>
          </div>
        </div>

        {/* Data Entry Form */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <TrackerForm
            isAdmin={isAdmin}
            onSubmit={(newEntry) => {
              // Pass the new entry to the table
              if (tableRef.current && tableRef.current.addEntry) {
                tableRef.current.addEntry(newEntry);
              }
            }}
          />
        </div>

        {/* Tracker Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <TrackerTable ref={tableRef} isAdmin={isAdmin} />
        </div>
      </div>
    </div>
  );
}

