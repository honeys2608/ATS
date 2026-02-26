import React from "react";

/**
 * ParsedResumeViewer
 * ------------------
 * Displays parsed resume data safely
 *
 * Expected parsedResume shape (from backend):
 * {
 *   summary,
 *   skills,
 *   experience,
 *   education,
 *   projects,
 *   certifications,
 *   raw_text
 * }
 */

export default function ParsedResumeViewer({ parsedResume }) {
  if (!parsedResume) {
    return (
      <div className="p-4 text-sm text-gray-500">
        No parsed resume data available.
      </div>
    );
  }

  const renderList = (items) => {
    if (!items || !Array.isArray(items) || items.length === 0) {
      return <span className="text-gray-400">—</span>;
    }
    return (
      <ul className="list-disc pl-5 space-y-1">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    );
  };

  return (
    <div className="space-y-6">

      {/* SUMMARY */}
      {parsedResume.summary && (
        <Section title="Professional Summary">
          <p className="text-sm text-gray-700 whitespace-pre-line">
            {parsedResume.summary}
          </p>
        </Section>
      )}

      {/* SKILLS */}
      <Section title="Skills">
        {Array.isArray(parsedResume.skills)
          ? (
            <div className="flex flex-wrap gap-2">
              {parsedResume.skills.map((skill, i) => (
                <span
                  key={i}
                  className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-700"
                >
                  {skill}
                </span>
              ))}
            </div>
          )
          : renderList(parsedResume.skills)}
      </Section>

      {/* EXPERIENCE */}
      <Section title="Experience">
        {renderList(parsedResume.experience)}
      </Section>

      {/* EDUCATION */}
      <Section title="Education">
        {renderList(parsedResume.education)}
      </Section>

      {/* PROJECTS */}
      {parsedResume.projects && (
        <Section title="Projects">
          {renderList(parsedResume.projects)}
        </Section>
      )}

      {/* CERTIFICATIONS */}
      {parsedResume.certifications && (
        <Section title="Certifications">
          {renderList(parsedResume.certifications)}
        </Section>
      )}

      {/* RAW TEXT (COLLAPSIBLE) */}
      {parsedResume.raw_text && (
        <details className="border rounded-lg p-3 bg-gray-50">
          <summary className="cursor-pointer font-medium text-sm">
            View Raw Resume Text
          </summary>
          <pre className="mt-3 text-xs text-gray-600 whitespace-pre-wrap">
            {parsedResume.raw_text}
          </pre>
        </details>
      )}

    </div>
  );
}

/* ----------------------------------------
   Reusable Section Wrapper
---------------------------------------- */

function Section({ title, children }) {
  return (
    <div className="border rounded-lg p-4 bg-white shadow-sm">
      <h3 className="font-semibold text-sm mb-2 text-gray-800">
        {title}
      </h3>
      <div className="text-sm text-gray-700">
        {children}
      </div>
    </div>
  );
}
