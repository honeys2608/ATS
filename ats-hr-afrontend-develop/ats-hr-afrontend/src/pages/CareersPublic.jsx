// src/pages/CareersPublic.jsx
import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "../api/axios";

const PRIMARY = "text-purple-500";
const ACCENT = "text-emerald-400";

function CareersPublic() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadJobs = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await axios.get("/public/careers/jobs");
        setJobs(res.data || []);
      } catch (err) {
        try {
          const res2 = await axios.get("/v1/jobs");
          setJobs(res2.data || []);
        } catch (err2) {
          setError(err2);
        }
      } finally {
        setLoading(false);
      }
    };

    loadJobs();
  }, []);

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-gray-900">
      <style>{`
        .hero-card {
          background: linear-gradient(135deg, #0b1224 0%, #111827 45%, #1b1740 100%);
        }
        .hero-anim {
          background: linear-gradient(120deg, rgba(124,58,237,0.18), rgba(16,185,129,0.12), rgba(124,58,237,0.18));
          background-size: 200% 200%;
          animation: heroShift 24s ease infinite;
        }
        @keyframes heroShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @media (prefers-reduced-motion: reduce) {
          .hero-anim { animation: none; }
        }
      `}</style>

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 bg-white text-gray-900 shadow-sm z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <nav className="flex items-center gap-3 text-sm font-medium">
            <a
              href="#what-we-do"
              className="px-4 py-2 rounded-full border border-gray-200 text-gray-700 hover:border-purple-300 hover:text-purple-600"
            >
              What We Do
            </a>
            <a
              href="#who-we-are"
              className="px-4 py-2 rounded-full border border-gray-200 text-gray-700 hover:border-purple-300 hover:text-purple-600"
            >
              Who We Are
            </a>
            <a
              href="#jobs"
              className="px-4 py-2 rounded-full bg-purple-600 text-white hover:bg-purple-700"
            >
              Jobs
            </a>
          </nav>
          <div className="text-2xl font-extrabold text-purple-600">ATS-HR</div>
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="px-4 py-2 rounded-full border border-purple-600 text-purple-600 text-sm font-semibold hover:bg-purple-50"
            >
              Login
            </Link>
            <Link
              to="/register"
              className="px-4 py-2 rounded-full bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700"
            >
              Register
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-28 pb-16">
        <div className="max-w-6xl mx-auto px-6">
          <div className="hero-card rounded-3xl shadow-2xl overflow-hidden relative">
            <div className="absolute inset-0 hero-anim" aria-hidden="true" />
            <div className="relative px-8 py-16 md:px-16 text-center text-white">
              <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-[#d9c9ff]">
                Hiring shouldn't feel <span className={ACCENT}>chaotic</span>.
              </h1>
              <p className="mt-4 text-lg text-gray-300">
                ATS-HR brings clarity, confidence, and purpose to the way careers
                grow.
              </p>
              <div className="mt-6 inline-flex items-center px-5 py-2 rounded-full bg-white text-gray-700 text-sm font-medium">
                Because careers deserve thoughtful systems.
              </div>

              <div className="mt-10 flex justify-center">
                <div className="bg-white text-gray-900 rounded-2xl shadow-lg px-8 py-6 max-w-2xl w-full">
                  <div className={`text-sm font-semibold ${PRIMARY}`}>Purpose</div>
                  <p className="mt-3 text-gray-700">
                    ATS-HR exists to bring clarity and trust to hiring and career
                    journeys.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Lower Section Background */}
      <section className="py-12">
        <div className="max-w-6xl mx-auto px-6">
          <div className="bg-[#0b1224] rounded-3xl px-8 py-12 shadow-2xl">
            {/* What We Do */}
            <section id="what-we-do">
              <h2 className="text-3xl font-bold text-[#d9c9ff] text-center">
                What We Do
              </h2>
              <p className="mt-3 text-gray-300 max-w-3xl mx-auto text-center">
                ATS-HR delivers a platform that simplifies recruiting workflows
                while building confidence for candidates.
              </p>

              <div className="mt-8 grid gap-6 md:grid-cols-2">
                <div className="bg-white text-gray-900 rounded-2xl shadow-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Platform Features
                  </h3>
                  <ul className="mt-4 space-y-2 text-gray-700">
                    <li>Structured hiring pipelines with clear stage visibility.</li>
                    <li>Smart matching and filters to surface the right talent faster.</li>
                    <li>Collaborative feedback, notes, and interview scheduling in one place.</li>
                  </ul>
                </div>
                <div className="bg-white text-gray-900 rounded-2xl shadow-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900">
                    What We Solve
                  </h3>
                  <ul className="mt-4 space-y-2 text-gray-700">
                    <li>Recruiters get organized workflows and better decision-making.</li>
                    <li>Candidates experience transparent, human-first hiring.</li>
                    <li>Teams move faster with shared context and clarity.</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Who We Are */}
            <section id="who-we-are" className="mt-12">
              <h2 className="text-3xl font-bold text-[#d9c9ff] text-center">
                Who We Are
              </h2>
              <p className="mt-3 text-gray-300 max-w-3xl mx-auto text-center">
                We are a mission-driven team focused on trust, fairness, and clarity
                in hiring.
              </p>

              <div className="mt-8 grid gap-6 md:grid-cols-2">
                <div className="bg-white text-gray-900 rounded-2xl shadow-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Purpose & Mission
                  </h3>
                  <ul className="mt-4 space-y-2 text-gray-700">
                    <li>Our mission is to make hiring feel thoughtful and transparent.</li>
                    <li>We help teams and candidates build momentum together through clarity and structure.</li>
                  </ul>
                </div>
                <div className="bg-white text-gray-900 rounded-2xl shadow-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Values & Trust
                  </h3>
                  <ul className="mt-4 space-y-2 text-gray-700">
                    <li>We lead with clarity and respect every candidate experience.</li>
                    <li>We build systems that earn long-term trust, not just short-term efficiency.</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Jobs */}
            <section id="jobs" className="mt-12">
              <h2 className="text-3xl font-bold text-[#d9c9ff]">
                Open Opportunities
              </h2>

          {loading ? (
            <div className="mt-6 text-gray-300">Loading openings...</div>
          ) : error ? (
            <div className="mt-6 text-gray-300">
              We could not load openings right now. Please try again later.
            </div>
          ) : jobs.length === 0 ? (
            <div className="mt-6 text-gray-300">
              No active openings right now. Please check back soon.
            </div>
          ) : (
            <div className="mt-6 grid gap-6 md:grid-cols-2">
              {jobs.map((job) => (
                <div
                  key={job.id}
                  className="bg-white text-gray-900 rounded-2xl shadow-lg p-6"
                >
                  <h3 className="text-xl font-semibold text-purple-700">
                    {job.title}
                  </h3>
                  <div className="mt-3 flex flex-wrap gap-2 text-sm">
                    {job.location && (
                      <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 font-semibold">
                        {job.location}
                      </span>
                    )}
                    {job.job_type && (
                      <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 font-semibold">
                        {job.job_type}
                      </span>
                    )}
                  </div>
                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={() => {
                        const token = localStorage.getItem("access_token");
                        if (!token) {
                          navigate("/register");
                          return;
                        }
                        navigate(`/careers/job/${job.id}`);
                      }}
                      className="inline-flex items-center px-4 py-2 rounded-full bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
            </section>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-12 bg-[#0b1224] border-t border-white/10">
        <div className="max-w-6xl mx-auto px-6 py-8 text-sm text-gray-300 flex flex-col md:flex-row items-center justify-between gap-3">
          <div>&copy; ATS-HR</div>
          <div className="flex items-center gap-4">
            <span>Privacy Policy</span>
            <span>Terms</span>
            <span>Contact</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default CareersPublic;
