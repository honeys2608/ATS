// src/pages/account-manager/AccountManagerDashboard.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";
import { Users, Briefcase, Send, Clock, UserCheck } from "lucide-react";

export default function AccountManagerDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState({
    clients: 0,
    openJobs: 0,
    submissions: 0,
    sentToClient: 0,
    feedbackPending: 0,
  });

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);

      const jobsRes = await api.get("/v1/jobs");
      const jobs = jobsRes.data || [];

      setStats({
        clients: new Set(jobs.map((j) => j.client_id)).size,
        openJobs: jobs.filter((j) => j.status !== "closed").length,
        submissions: 0,
        sentToClient: 0,
        feedbackPending: 0,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-gray-500">Loading dashboard…</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Account Manager Dashboard
        </h1>
        <p className="text-sm text-gray-500">
          Client requirements, recruiter coordination & submissions
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Stat icon={<Users />} title="Clients" value={stats.clients} />
        <Stat
          icon={<Briefcase />}
          title="Open Requirements"
          value={stats.openJobs}
        />
        <Stat
          icon={<UserCheck />}
          title="Recruiter Submissions"
          value={stats.submissions}
        />
        <Stat
          icon={<Send />}
          title="Sent to Client"
          value={stats.sentToClient}
        />
        <Stat
          icon={<Clock />}
          title="Feedback Pending"
          value={stats.feedbackPending}
        />
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <h2 className="font-semibold text-gray-800 mb-4">Quick Actions</h2>

        <div className="flex flex-wrap gap-3">
          <Action
            label="View Client Requirements"
            onClick={() => navigate("/recruitment/jobs")}
          />
          <Action
            label="Assign Recruiters"
            onClick={() => navigate("/recruitment/jobs")}
          />
          <Action
            label="Review Submissions"
            onClick={() => navigate("/recruitment/jobs")}
          />
          <Action
            label="Track Client Feedback"
            onClick={() => navigate("/interviews")}
          />
        </div>
      </div>

      {/* Assigned Requirements Table */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-gray-800">Assigned Requirements</h2>
        </div>

        <div className="p-6 text-sm text-gray-500 text-center">
          No requirements assigned yet
        </div>
      </div>
    </div>
  );
}

/* ---------- UI COMPONENTS ---------- */

function Stat({ icon, title, value }) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-4 hover:shadow transition">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
        <div className="text-blue-600">{icon}</div>
      </div>
    </div>
  );
}

function Action({ label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
    >
      {label}
    </button>
  );
}
