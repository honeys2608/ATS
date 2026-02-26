import React, { useEffect, useState } from "react";
import api from "../api/axios";
import { useLocation } from "react-router-dom";

import CandidateProfile from "./candidate/CandidateProfile";
import ApplyJobs from "./candidate/ApplyJobs";
import AppliedJobs from "./candidate/AppliedJobs";
import CandidateNotifications from "./candidate/CandidateNotifications";

const TABS = {
  DASHBOARD: "dashboard",
  NOTIFICATIONS: "notifications",
  PROFILE: "profile",
  APPLY: "apply",
  APPLIED: "applied",
};

function Stat({ title, value, helper }) {
  return (
    <div className="bg-white p-4 rounded shadow">
      <p className="text-sm text-gray-500">{title}</p>
      <p className="text-2xl font-bold">{value}</p>
      {helper && <p className="text-xs text-gray-500 mt-1">{helper}</p>}
    </div>
  );
}

function CandidateDashboardHome() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    applications: 0,
    newJobs: 0,
    profileCompletion: 0,
    interviewStatus: "No Interview Scheduled",
    interviewDate: null,
  });

  const formatDateTime = (value) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  useEffect(() => {
    api
      .get("/v1/candidate/dashboard-summary")
      .then((res) => {
        const data = res.data || {};
        setStats({
          applications: data.total_applications ?? 0,
          newJobs: data.new_jobs ?? 0,
          profileCompletion: data.profile_completion ?? 0,
          interviewStatus: data.next_interview_status || "No Interview Scheduled",
          interviewDate: data.next_interview_date || null,
        });
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading dashboard...</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Stat title="Profile Completion %" value={`${stats.profileCompletion}%`} />
        <Stat title="Total Applications" value={stats.applications} />
        <Stat title="New Jobs" value={stats.newJobs} />
        <Stat
          title="Interview Status"
          value={stats.interviewStatus}
          helper={formatDateTime(stats.interviewDate)}
        />
      </div>
    </div>
  );
}

export default function CandidateDashboard() {
  const location = useLocation();

  const [activeTab, setActiveTab] = useState(TABS.DASHBOARD);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    api.get("/v1/candidate/me").then((res) => setProfile(res.data?.data));
  }, []);

  useEffect(() => {
    const path = location.pathname;
    if (path.includes("/candidate/notifications")) {
      setActiveTab(TABS.NOTIFICATIONS);
      return;
    }
    if (path.includes("/candidate/complete-profile")) {
      setActiveTab(TABS.PROFILE);
      return;
    }
    if (path.includes("/candidate/apply-jobs")) {
      setActiveTab(TABS.APPLY);
      return;
    }
    if (path.includes("/candidate/applied-jobs")) {
      setActiveTab(TABS.APPLIED);
      return;
    }
    setActiveTab(TABS.DASHBOARD);
  }, [location.pathname]);

  const renderContent = () => {
    switch (activeTab) {
      case TABS.DASHBOARD:
        return (
          <CandidateDashboardHome />
        );
      case TABS.NOTIFICATIONS:
        return <CandidateNotifications />;
      case TABS.PROFILE:
        return <CandidateProfile />;
      case TABS.APPLY:
        return <ApplyJobs />;
      case TABS.APPLIED:
        return <AppliedJobs />;
      default:
        return <CandidateDashboardHome />;
    }
  };

  return (
    <div className="space-y-6">
      {profile && (
        <div className="flex items-center gap-4">
          <img
            src={
              profile.photo_url
                ? `http://localhost:8000/${profile.photo_url}`
                : "https://ui-avatars.com/api/?name=Candidate"
            }
            className="w-12 h-12 rounded-full object-cover"
            alt="Profile"
          />
          <div>
            <p className="font-semibold">{profile.full_name}</p>
            <p className="text-sm text-gray-500">{profile.email}</p>
          </div>
        </div>
      )}
      {renderContent()}
    </div>
  );
}
