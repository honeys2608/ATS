import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "../../api/axios";

export default function AIChatInterview() {
  const { interviewId } = useParams();
  const navigate = useNavigate();

  const [interview, setInterview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [answer, setAnswer] = useState("");
  const [sessionStarted, setSessionStarted] = useState(false);
  const [interviewEnded, setInterviewEnded] = useState(false);
  const [finalScore, setFinalScore] = useState(null);
  const [conversationHistory, setConversationHistory] = useState([]);

  useEffect(() => {
    loadInterview();
  }, [interviewId]);

  async function loadInterview() {
    try {
      setLoading(true);
      const res = await axios.get(`/v1/interviews/${interviewId}`);
      setInterview(res.data);
    } catch (err) {
      console.error("Failed to load interview", err);
      alert("Failed to load interview details");
      navigate("/interviews");
    } finally {
      setLoading(false);
    }
  }

  async function startInterview() {
    try {
      const res = await axios.post(`/v1/interviews/${interviewId}/start`);
      setCurrentQuestion(res.data.question);
      setSessionStarted(true);
      setConversationHistory([]);
    } catch (err) {
      alert("Failed to start interview: " + err.response?.data?.detail);
    }
  }

  async function submitAnswer() {
    if (!answer.trim()) {
      alert("Please provide an answer");
      return;
    }

    try {
      const res = await axios.post(`/v1/interviews/${interviewId}/answer`, {
        answer: answer,
      });

      // Add to conversation history
      setConversationHistory([
        ...conversationHistory,
        {
          type: "question",
          text: currentQuestion,
        },
        {
          type: "answer",
          text: answer,
        },
      ]);

      setAnswer("");

      // Check if interview is finished
      if (res.data.message === "Interview finished") {
        setInterviewEnded(true);
      } else {
        setCurrentQuestion(res.data.question);
      }
    } catch (err) {
      alert("Failed to submit answer: " + err.response?.data?.detail);
    }
  }

  async function completeInterview() {
    try {
      const res = await axios.post(`/v1/interviews/${interviewId}/complete`);
      setFinalScore(res.data.final_score);
      alert("Interview completed! Thank you for participating.");
      setTimeout(() => navigate("/interviews"), 2000);
    } catch (err) {
      alert("Failed to complete interview");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-purple-600 to-blue-600">
        <div className="text-center text-white">
          <p className="text-2xl font-bold mb-4">Loading Interview...</p>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
        </div>
      </div>
    );
  }

  if (!interview) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-xl text-red-600">Interview not found</p>
      </div>
    );
  }

  return (
    <div className="ai-chat-interview min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {interview.submission?.job?.title}
              </h1>
              <p className="text-gray-600 mt-1">
                AI Chat Interview - Powered by Advanced AI
              </p>
            </div>
            <button
              onClick={() => navigate("/interviews")}
              className="px-4 py-2 text-gray-700 hover:text-gray-900"
            >
              ← Back to Interviews
            </button>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="p-3 bg-blue-50 rounded-lg">
              <p className="text-xs font-semibold text-blue-700 uppercase">
                Status
              </p>
              <p className="text-lg font-bold text-gray-900 mt-1">
                {!sessionStarted
                  ? "Ready to Start"
                  : interviewEnded
                    ? "Completed"
                    : "In Progress"}
              </p>
            </div>

            <div className="p-3 bg-green-50 rounded-lg">
              <p className="text-xs font-semibold text-green-700 uppercase">
                Questions Answered
              </p>
              <p className="text-lg font-bold text-gray-900 mt-1">
                {conversationHistory.filter((h) => h.type === "answer").length}
              </p>
            </div>

            {finalScore !== null && (
              <div className="p-3 bg-purple-50 rounded-lg">
                <p className="text-xs font-semibold text-purple-700 uppercase">
                  Final Score
                </p>
                <p className="text-lg font-bold text-gray-900 mt-1">
                  {finalScore.toFixed(1)}/100
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Conversation Area */}
        {sessionStarted && !interviewEnded && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            {/* Previous Q&A */}
            {conversationHistory.length > 0 && (
              <div className="mb-8 max-h-96 overflow-y-auto bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-4">
                  Conversation History
                </h3>
                <div className="space-y-4">
                  {conversationHistory.map((item, idx) => (
                    <div key={idx} className="mb-4">
                      {item.type === "question" && (
                        <div className="bg-blue-50 p-3 rounded-lg mb-2">
                          <p className="text-xs font-semibold text-blue-700 uppercase mb-1">
                            Question
                          </p>
                          <p className="text-gray-900">{item.text}</p>
                        </div>
                      )}
                      {item.type === "answer" && (
                        <div className="bg-green-50 p-3 rounded-lg">
                          <p className="text-xs font-semibold text-green-700 uppercase mb-1">
                            Your Answer
                          </p>
                          <p className="text-gray-900">{item.text}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Current Question */}
            {currentQuestion && (
              <div className="mb-6">
                <div className="bg-gradient-to-r from-purple-100 to-blue-100 p-6 rounded-lg mb-6">
                  <h2 className="text-lg font-bold text-gray-900 mb-4">
                    {currentQuestion}
                  </h2>
                </div>

                {/* Answer Input */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Your Answer
                  </label>
                  <textarea
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.ctrlKey && e.key === "Enter") {
                        submitAnswer();
                      }
                    }}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none resize-none"
                    placeholder="Type your answer here... (Ctrl+Enter to submit)"
                    rows="5"
                  />
                </div>

                <button
                  onClick={submitAnswer}
                  className="mt-4 px-6 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition w-full"
                >
                  Submit Answer →
                </button>
              </div>
            )}
          </div>
        )}

        {/* Interview Completion */}
        {interviewEnded && (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <div className="mb-6">
              <div className="text-6xl mb-4">✅</div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                Interview Complete!
              </h2>
              <p className="text-gray-600 text-lg">
                Thank you for completing the AI interview. Click below to finish
                and return to your dashboard.
              </p>
            </div>

            <button
              onClick={completeInterview}
              className="px-8 py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition text-lg"
            >
              Complete Interview & View Results
            </button>
          </div>
        )}

        {/* Start Interview Button */}
        {!sessionStarted && (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Ready to Start?
              </h2>
              <p className="text-gray-600 mb-4">
                This is an AI-powered chat interview where you'll answer
                questions related to the job position. Take your time and
                provide thoughtful answers.
              </p>
              <ul className="text-left max-w-md mx-auto text-gray-700 space-y-2 mb-6">
                <li className="flex items-center">
                  <span className="text-green-600 font-bold mr-2">✓</span>
                  Questions are tailored to the job
                </li>
                <li className="flex items-center">
                  <span className="text-green-600 font-bold mr-2">✓</span>
                  Take your time with each answer
                </li>
                <li className="flex items-center">
                  <span className="text-green-600 font-bold mr-2">✓</span>
                  AI will evaluate your responses
                </li>
                <li className="flex items-center">
                  <span className="text-green-600 font-bold mr-2">✓</span>
                  Instant feedback after completion
                </li>
              </ul>
            </div>

            <button
              onClick={startInterview}
              className="px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold rounded-lg hover:from-purple-700 hover:to-blue-700 transition text-lg shadow-lg"
            >
              Start Interview →
            </button>
          </div>
        )}

        {/* Interview Instructions */}
        {interview.notes && (
          <div className="bg-blue-50 border-l-4 border-blue-500 p-6 rounded-lg mt-6">
            <h3 className="font-semibold text-blue-900 mb-2">Instructions</h3>
            <p className="text-blue-800">{interview.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
