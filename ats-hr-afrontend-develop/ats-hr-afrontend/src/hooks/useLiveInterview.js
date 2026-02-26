import { useState, useCallback } from "react";
import {
  createLiveInterview,
  joinLiveInterview,
  startLiveInterview,
  endLiveInterview,
  updateLiveInterviewRecording,
} from "../services/liveInterview.service";

/**
 * ======================================
 * LIVE INTERVIEW HOOK
 * Backend: /v1/live-interviews
 * ======================================
 */

export default function useLiveInterview() {
  const [interviewId, setInterviewId] = useState(null);
  const [meetingUrl, setMeetingUrl] = useState(null);
  const [recordingEnabled, setRecordingEnabled] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /* --------------------------------
     CREATE LIVE INTERVIEW
  -------------------------------- */
  const createInterview = useCallback(async (candidateId, jobId) => {
    try {
      setLoading(true);
      setError(null);

      const res = await createLiveInterview({
        candidate_id: candidateId,
        job_id: jobId,
        recording_enabled: true,
      });

      setInterviewId(res.data.interview_id);
      setMeetingUrl(res.data.meeting_url);
      setRecordingEnabled(res.data.recording_enabled);
    } catch (err) {
      setError("Failed to create live interview");
    } finally {
      setLoading(false);
    }
  }, []);

  /* --------------------------------
     JOIN LIVE INTERVIEW
  -------------------------------- */
  const joinInterview = useCallback(async () => {
    if (!interviewId) return;

    try {
      setLoading(true);
      setError(null);

      const res = await joinLiveInterview(interviewId);
      setMeetingUrl(res.data.meeting_url);
      setRecordingEnabled(res.data.recording_enabled);
    } catch (err) {
      setError("Failed to join live interview");
    } finally {
      setLoading(false);
    }
  }, [interviewId]);

  /* --------------------------------
     START LIVE INTERVIEW
  -------------------------------- */
  const startInterview = useCallback(async () => {
    if (!interviewId) return;

    try {
      setLoading(true);
      setError(null);

      await startLiveInterview(interviewId);
    } catch (err) {
      setError("Failed to start live interview");
    } finally {
      setLoading(false);
    }
  }, [interviewId]);

  /* --------------------------------
     END LIVE INTERVIEW
  -------------------------------- */
  const endInterview = useCallback(async () => {
    if (!interviewId) return;

    try {
      setLoading(true);
      setError(null);

      await endLiveInterview(interviewId);
    } catch (err) {
      setError("Failed to end live interview");
    } finally {
      setLoading(false);
    }
  }, [interviewId]);

  /* --------------------------------
     UPDATE RECORDING URL (OPTIONAL)
  -------------------------------- */
  const saveRecording = useCallback(
    async (recordingUrl) => {
      if (!interviewId || !recordingEnabled) return;

      try {
        await updateLiveInterviewRecording(interviewId, recordingUrl);
      } catch (err) {
        console.error("Failed to update recording");
      }
    },
    [interviewId, recordingEnabled]
  );

  return {
    interviewId,
    meetingUrl,
    recordingEnabled,

    loading,
    error,

    createInterview,
    joinInterview,
    startInterview,
    endInterview,
    saveRecording,
  };
}