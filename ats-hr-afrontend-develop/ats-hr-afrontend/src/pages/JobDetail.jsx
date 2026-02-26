// src/pages/JobDetail.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getJob } from "../services/jobService";
import {
  FiArrowLeft,
  FiMapPin,
  FiDollarSign,
  FiClock,
  FiAward,
} from "react-icons/fi";

export default function JobDetail() {
  const { id } = useParams();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await getJob(id);
        if (!mounted) return;
        // backend might return { data: job } or job directly
        setJob(res.data?.data ?? res.data ?? null);
      } catch (err) {
        console.error("Failed to fetch job", err);
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id]);

  if (loading)
    return <div className="p-6 text-center">Loading job details...</div>;
  if (!job)
    return <div className="p-6 text-center text-red-600">Job not found</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 mb-4"
          >
            <FiArrowLeft /> Back
          </button>
          <h1 className="text-3xl font-bold text-gray-900">{job.title}</h1>
          <p className="text-gray-600 mt-2">{job.company_name || "Company"}</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="grid grid-cols-3 gap-4 mb-8">
          {/* Location */}
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="flex items-center gap-2 text-gray-600 mb-2">
              <FiMapPin className="text-lg" />
              <span className="text-sm font-semibold">Location</span>
            </div>
            <p className="text-gray-900 font-medium">
              {job.location || "Remote"}
            </p>
          </div>

          {/* Salary */}
          {job.salary_range && (
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <div className="flex items-center gap-2 text-gray-600 mb-2">
                <FiDollarSign className="text-lg" />
                <span className="text-sm font-semibold">Salary Range</span>
              </div>
              <p className="text-gray-900 font-medium">{job.salary_range}</p>
            </div>
          )}

          {/* Experience */}
          {job.min_experience || job.max_experience ? (
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <div className="flex items-center gap-2 text-gray-600 mb-2">
                <FiClock className="text-lg" />
                <span className="text-sm font-semibold">Experience</span>
              </div>
              <p className="text-gray-900 font-medium">
                {job.min_experience || 0} - {job.max_experience || "N/A"} years
              </p>
            </div>
          ) : null}
        </div>

        {/* Description */}
        <div className="bg-white p-6 rounded-lg shadow-sm mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            About the Role
          </h2>
          <div className="text-gray-700 leading-relaxed prose prose-sm max-w-none">
            {typeof job.description === "string" &&
            job.description.includes("<") ? (
              <div dangerouslySetInnerHTML={{ __html: job.description }} />
            ) : (
              <p>{job.description || "No description available"}</p>
            )}
          </div>
        </div>

        {/* Skills Required */}
        {job.skills && job.skills.length > 0 && (
          <div className="bg-white p-6 rounded-lg shadow-sm mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <FiAward /> Required Skills
            </h2>
            <div className="flex flex-wrap gap-2">
              {(Array.isArray(job.skills) ? job.skills : []).map(
                (skill, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm font-medium"
                  >
                    {skill}
                  </span>
                ),
              )}
            </div>
          </div>
        )}

        {/* Job Details */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          {job.department && (
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h3 className="text-sm font-semibold text-gray-600 mb-2">
                Department
              </h3>
              <p className="text-gray-900 font-medium">{job.department}</p>
            </div>
          )}

          {job.job_type && (
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h3 className="text-sm font-semibold text-gray-600 mb-2">
                Job Type
              </h3>
              <p className="text-gray-900 font-medium">{job.job_type}</p>
            </div>
          )}

          {job.apply_by && (
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h3 className="text-sm font-semibold text-gray-600 mb-2">
                Apply By
              </h3>
              <p className="text-gray-900 font-medium">
                {new Date(job.apply_by).toLocaleDateString()}
              </p>
            </div>
          )}

          {job.sla_days && (
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h3 className="text-sm font-semibold text-gray-600 mb-2">
                SLA Days
              </h3>
              <p className="text-gray-900 font-medium">{job.sla_days} days</p>
            </div>
          )}
        </div>

        {/* Apply Button */}
        <div className="flex gap-3">
          {/* <button
            onClick={() => {
              const token = localStorage.getItem("auth_token");
              if (!token) navigate(`/careers/register?job=${job.id}`);
              else navigate(`/candidate?applyJob=${job.id}`);
            }}
            className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition"
          >
            Apply Now
          </button> */}
          <button
            onClick={() => navigate(-1)}
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition"
          >
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
}
