import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api/axios";

export default function InterviewChat() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [messages, setMessages] = useState([]);
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(true);
  const [finished, setFinished] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [blocked, setBlocked] = useState(null);

  useEffect(() => {
    startInterview();
  }, []);

  useEffect(() => {
    const handler = (event) => {
      if (!finished) {
        event.preventDefault();
        event.returnValue =
          "You have an ongoing interview. Progress is saved.";
      }
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [finished]);

  const startInterview = async () => {
    try {
      const res = await api.post(`/v1/interviews/${id}/start`);

      const transcript = res.data?.transcript || [];
      const incoming = [
        { from: "system", text: "AI Interview Started" },
        ...transcript.flatMap((item) => [
          { from: "bot", text: item.question },
          { from: "user", text: item.answer },
        ]),
      ];

      const firstQ =
        res.data?.question?.question_text ||
        res.data?.question ||
        null;

      if (firstQ) {
        incoming.push({ from: "bot", text: firstQ });
      }

      setSessionId(res.data?.session_id || null);
      setMessages(incoming);

      if (!firstQ && res.data?.status === "completed") {
        setFinished(true);
        navigate(`/interviews/${id}/feedback`);
      }
    } catch (error) {
      const msg =
        error?.response?.data?.detail || "Interview is not available yet.";
      let scheduledAt = null;
      try {
        const interviewRes = await api.get(`/v1/interviews/${id}`);
        scheduledAt = interviewRes?.data?.scheduled_at || null;
      } catch (_) {
        scheduledAt = null;
      }
      setBlocked({
        title: "Interview Not Available",
        message: msg,
        scheduledAt,
      });
    } finally {
      setLoading(false);
    }
  };

  const sendAnswer = async () => {
    if (!answer.trim()) return;

    const userAns = answer;
    setAnswer("");

    setMessages((prev) => [...prev, { from: "user", text: userAns }]);

    try {
      const res = await api.post(`/v1/interviews/${id}/answer`, {
        answer: userAns,
      });

      const next =
        res.data?.next_question?.question_text ||
        res.data?.next_question ||
        "";

      if (next) {
        setMessages((prev) => [...prev, { from: "bot", text: next }]);
      } else if (res.data?.is_last_question) {
        try {
          await api.post(`/v1/interviews/${id}/complete`);
        } catch (completeErr) {
          // safe fallback: even if complete fails, still allow navigation
          console.error("Complete interview failed", completeErr);
        }
        setFinished(true);
        navigate(`/interviews/${id}/feedback`);
      }
    } catch (err) {
      alert("Failed to submit answer");
    }
  };

  if (loading)
    return <h2 className="p-6">Checking interview availability...</h2>;

  if (blocked) {
    const formatDateTime = (value) => {
      if (!value) return "Not Scheduled";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return "Not Scheduled";
      return date.toLocaleString(undefined, {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    };

    return (
      <div className="min-h-screen bg-gray-900/40 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          <h3 className="text-lg font-bold mb-2">{blocked.title}</h3>
          <p className="text-sm text-gray-600 mb-4">{blocked.message}</p>
          {blocked.scheduledAt && (
            <div className="text-sm text-gray-700 mb-4">
              Available from:{" "}
              <span className="font-semibold">
                {formatDateTime(blocked.scheduledAt)}
              </span>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button
              onClick={() => navigate("/candidate/dashboard")}
              className="px-4 py-2 bg-gray-800 text-white rounded"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">AI Interview</h1>

      <div className="border rounded p-4 h-[400px] overflow-y-auto bg-gray-50">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`p-2 my-1 rounded ${
              m.from === "bot"
                ? "bg-blue-100 text-blue-900"
                : m.from === "user"
                ? "bg-green-100 text-green-900 text-right"
                : "bg-gray-300 text-black text-center"
            }`}
          >
            {m.text}
          </div>
        ))}
      </div>

      {!finished && (
        <div className="mt-4 flex gap-2">
          <input
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            className="border p-2 flex-1 rounded"
            placeholder="Type your answer..."
          />

          <button
            onClick={sendAnswer}
            className="bg-blue-600 text-white px-4 py-2 rounded"
          >
            Send
          </button>
        </div>
      )}
    </div>
  );
}
