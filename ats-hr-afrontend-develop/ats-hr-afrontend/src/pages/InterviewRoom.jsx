import React, { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";

import useChatInterview from "../hooks/useChatInterview";
import useAIVideoInterview from "../hooks/useAIVideoInterview";
import useLiveInterview from "../hooks/useLiveInterview";

import FeedbackForm from "../components/interviews/FeedbackForm";

export default function InterviewRoom() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const query = new URLSearchParams(location.search);
  const mode = query.get("mode") || "chat";

  const chat = useChatInterview(id);
  const video = useAIVideoInterview();
  const live = useLiveInterview();

  const [answer, setAnswer] = useState("");

  useEffect(() => {
    if (mode === "chat") {
      chat.loadInterview();
    }
    // eslint-disable-next-line
  }, [id, mode]);

  /* ================= CHAT ================= */

  const renderChat = () => (
    <>
      <div className="bg-white p-6 rounded shadow mb-4">
        <h1 className="text-2xl font-bold">AI Chat Interview</h1>
        <p className="text-gray-600 mt-1">
          Status: <b>{chat.interview?.status || "scheduled"}</b>
        </p>
      </div>

      {/* ✅ COMPLETION MESSAGE */}
      {chat.interview?.status === "completed" && (
        <div className="bg-green-50 text-green-700 p-4 rounded mb-4">
          ✅ Interview completed successfully.
        </div>
      )}

      {chat.error && (
        <div className="bg-red-50 text-red-700 p-3 rounded mb-4">
          {chat.error}
        </div>
      )}

      {chat.interview?.status === "scheduled" && (
        <div className="bg-white p-6 rounded shadow text-center">
          <button
            onClick={chat.startInterview}
            className="bg-indigo-600 text-white px-6 py-2 rounded"
          >
            Start Interview
          </button>
        </div>
      )}

      {chat.conversation.length > 0 && (
        <div className="bg-white p-6 rounded shadow mb-4 max-h-96 overflow-y-auto">
          {chat.conversation.map((m, i) => (
            <div
              key={i}
              className={`mb-3 ${m.type === "answer" && "text-right"}`}
            >
              <div
                className={`inline-block p-3 rounded max-w-xl ${
                  m.type === "question"
                    ? "bg-indigo-100"
                    : m.type === "answer"
                    ? "bg-green-100"
                    : "bg-yellow-100"
                }`}
              >
                <b className="text-sm block mb-1">
                  {m.type === "question"
                    ? "AI"
                    : m.type === "answer"
                    ? "You"
                    : "Feedback"}
                </b>
                {m.text}
              </div>
            </div>
          ))}
        </div>
      )}

      {chat.currentQuestion && (
        <div className="bg-white p-6 rounded shadow">
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            className="w-full border p-3 rounded mb-3"
            rows={4}
            placeholder="Type your answer..."
          />

          <div className="flex gap-3">
            <button
              onClick={() => {
                chat.answerQuestion(answer);
                setAnswer("");
              }}
              className="bg-green-600 text-white px-6 py-2 rounded"
            >
              Submit Answer
            </button>

            <button
              onClick={() => navigate("?mode=video")}
              className="bg-gray-600 text-white px-6 py-2 rounded"
            >
              End Interview
            </button>
          </div>
        </div>
      )}

      {chat.interview?.status === "completed" && (
        <div className="mt-6">
          <FeedbackForm interviewId={id} />
        </div>
      )}
    </>
  );

  /* ================= VIDEO ================= */

  const renderVideo = () => (
    <div className="bg-white p-8 rounded shadow text-center">
      <h2 className="text-2xl font-bold mb-4">AI Video Interview</h2>

      {!video.interviewId && (
        <button
          onClick={() =>
            video.createInterview(
              chat.interview?.candidate_id,
              chat.interview?.job_id
            )
          }
          className="bg-indigo-600 text-white px-6 py-2 rounded"
        >
          Create Video Interview
        </button>
      )}

      {video.interviewId && (
        <>
          <p className="mb-4">
            Question {video.currentIndex + 1} / {video.questions.length}
          </p>

          <button
            onClick={() =>
              video.submitAnswer("https://video.url/sample.mp4", 60)
            }
            className="bg-green-600 text-white px-6 py-2 rounded"
          >
            Submit Dummy Video
          </button>

          {video.currentIndex >= video.questions.length && (
            <button
              onClick={() => navigate("?mode=live")}
              className="bg-gray-600 text-white px-6 py-2 rounded mt-4"
            >
              Complete Video Interview
            </button>
          )}
        </>
      )}
    </div>
  );

  /* ================= LIVE ================= */

  const renderLive = () => (
    <div className="bg-white p-8 rounded shadow text-center">
      <h2 className="text-2xl font-bold mb-4">Live Interview</h2>

      {!live.interviewId && (
        <button
          onClick={() =>
            live.createInterview(
              chat.interview?.candidate_id,
              chat.interview?.job_id
            )
          }
          className="bg-indigo-600 text-white px-6 py-2 rounded"
        >
          Create Live Interview
        </button>
      )}

      {live.meetingUrl && (
        <a
          href={live.meetingUrl}
          target="_blank"
          rel="noreferrer"
          className="block mt-4 bg-green-600 text-white px-6 py-2 rounded"
        >
          Join Meeting
        </a>
      )}
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto p-4">
      {mode === "chat" && renderChat()}
      {mode === "video" && renderVideo()}
      {mode === "live" && renderLive()}
    </div>
  );
}