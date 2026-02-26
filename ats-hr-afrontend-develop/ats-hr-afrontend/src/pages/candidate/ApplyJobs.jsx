import React, { useEffect, useState } from "react";
import axios from "../../api/axios";
import { useNavigate } from "react-router-dom";

const isValidIndianPhone = (phone) => {
  if (!phone) return false;
  const cleaned = phone.replace(/\s+/g, "");
  return /^(\+91)?[6-9]\d{9}$/.test(cleaned);
};

export default function ApplyJobs() {
  const navigate = useNavigate();

  const [jobs, setJobs] = useState([]);
  const [appliedJobs, setAppliedJobs] = useState(new Set());
  const [profile, setProfile] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /* ---------------------------------------------------
     Load candidate profile
  --------------------------------------------------- */
  const loadProfile = async () => {
    try {
      const res = await axios.get("/v1/candidate/me");
      setProfile(res.data?.data);
    } catch (err) {
      console.error("loadProfile", err);
    }
  };

  /* ---------------------------------------------------
     Load jobs
  --------------------------------------------------- */
  const loadJobs = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await axios.get("/v1/jobs", {
        params: { public: true, limit: 100 },
      });

      console.log("Jobs API Response:", res.data);

      // Try multiple ways to extract jobs from response
      let items = [];
      if (Array.isArray(res.data)) {
        items = res.data;
      } else if (res.data?.jobs && Array.isArray(res.data.jobs)) {
        items = res.data.jobs;
      } else if (res.data?.data && Array.isArray(res.data.data)) {
        items = res.data.data;
      } else if (res.data?.items && Array.isArray(res.data.items)) {
        items = res.data.items;
      }

      setJobs(items);
      if (items.length === 0) {
        setError("No jobs available at the moment");
      }
    } catch (err) {
      console.error("loadJobs error:", err);
      setError("Failed to load jobs. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  /* ---------------------------------------------------
     Load candidate applications
  --------------------------------------------------- */
  const loadMyApplications = async () => {
    try {
      const res = await axios.get("/v1/candidate/me/applications");
      const apps = res.data?.applications ?? [];

      const appliedSet = new Set(apps.map((a) => a.job_id ?? a.jobId));
      setAppliedJobs(appliedSet);
    } catch {
      console.warn("Could not load applied jobs");
    }
  };

  useEffect(() => {
    loadProfile();
    loadJobs();
    loadMyApplications();
  }, []);

  /* ---------------------------------------------------
     Apply job (PROFILE CHECK ENFORCED)
  --------------------------------------------------- */
  const handleApply = async (jobId) => {
    // 🔒 PHONE VALIDATION
    if (!profile?.phone || !isValidIndianPhone(profile.phone)) {
      alert("Please add a valid Indian mobile number in your profile");
      navigate("/candidate/profile");
      return;
    }

    try {
      const res = await axios.post("/v1/candidate/me/apply", {
        job_id: jobId,
      });

      alert(res.data?.message || "Applied Successfully!");

      setAppliedJobs((prev) => new Set(prev).add(jobId));
    } catch (err) {
      if (err.response?.status === 409) {
        alert("You have already applied for this job");
        return;
      }

      alert(
        err.response?.data?.detail ||
          err.response?.data?.message ||
          "Failed to apply for job",
      );
    }
  };

  if (loading) return <div className="p-4">Loading jobs...</div>;
  if (error) return <div className="p-4 text-red-600">{error}</div>;
  if (!jobs.length) return <div className="p-4">No open roles found.</div>;

  const profileIncomplete = profile && !profile.profile_completed;

  return (
    <div className="space-y-4 p-4">
      {/* PROFILE WARNING */}
      {profileIncomplete && (
        <div className="bg-yellow-100 border border-yellow-300 p-3 rounded text-sm">
          ⚠️ Your profile is incomplete (
          {profile.profile_strength_percentage ??
            profile.profile_completion ??
            0}
          %).
          <button
            onClick={() => navigate("/candidate/profile")}
            className="ml-2 text-blue-600 underline"
          >
            Complete profile
          </button>
          to apply for jobs.
        </div>
      )}

      {jobs.map((job) => {
        const jobId = job.id ?? job.job_id;
        const isApplied = appliedJobs.has(jobId);

        return (
          <div
            key={jobId}
            className="bg-white p-4 rounded shadow flex justify-between items-start"
          >
            <div className="max-w-[70%]">
              <div className="font-semibold text-lg">
                {job.title ?? job.job_title}
              </div>
              <div className="text-sm text-gray-600">
                {job.location ?? job.location_city ?? "Remote"}
              </div>
              {job.short_description && (
                <div className="text-sm mt-2">{job.short_description}</div>
              )}
            </div>

            <div className="flex flex-col items-end gap-2">
              {isApplied ? (
                <button
                  disabled
                  className="px-4 py-1 text-sm rounded bg-gray-300 text-gray-700 cursor-not-allowed"
                >
                  Applied
                </button>
              ) : (
                <button
                  disabled={profileIncomplete}
                  onClick={() => handleApply(jobId)}
                  className={`px-4 py-1 text-sm rounded text-white ${
                    profileIncomplete
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-green-600 hover:bg-green-700"
                  }`}
                >
                  Apply
                </button>
              )}

              <a
                href={`/careers/job/${jobId}`}
                className="text-sm text-blue-600"
              >
                View details
              </a>
            </div>
          </div>
        );
      })}
    </div>
  );
}
