import { useState } from "react";
import axios from "../api/axios";

export default function useCandidateMatching() {
  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState([]);
  const [error, setError] = useState(null);

  const getMatches = async (jobId, limit = 10) => {
    try {
      setLoading(true);
      setError(null);

      const res = await axios.post("/v1/candidates/match", {
        job_id: jobId,
        limit,
      });

      setMatches(res.data || []);
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.detail || "Unable to fetch matches.");
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    matches,
    error,
    getMatches,
  };
}
