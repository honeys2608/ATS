import React, { useEffect, useState } from "react";
import api from "../../api/axios";

export default function CandidateEmails() {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEmails();
  }, []);

  async function loadEmails() {
    setLoading(true);
    try {
      const res = await api.get("/v1/candidate/me");
      const logs = res.data?.email_logs ?? [];
      // newest first
      setEmails(
        [...logs].sort(
          (a, b) => new Date(b.sent_at) - new Date(a.sent_at)
        )
      );
    } catch (err) {
      console.error("Failed to load emails", err);
      setEmails([]);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div>Loading emails...</div>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Emails</h2>

      {emails.length === 0 ? (
        <div className="text-gray-600">
          You have not received any emails yet.
        </div>
      ) : (
        <div className="space-y-3">
          {emails.map((e, i) => (
            <div
              key={i}
              className="bg-white border rounded-lg p-4 shadow-sm"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold">
                    {e.subject || "No Subject"}
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(e.sent_at).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="mt-3 text-sm text-gray-700 whitespace-pre-line">
                {e.body}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
