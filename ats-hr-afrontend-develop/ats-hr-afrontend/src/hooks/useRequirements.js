import { useState, useEffect } from "react";
import workflowService from "../services/workflowService";
import * as jobService from "../services/jobService";

export const useRequirements = () => {
  const [requirements, setRequirements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchRequirements = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await workflowService.getRecruiterRequirements("assigned");
      setRequirements(data.requirements || []);
    } catch (err) {
      setError(err.message || "Failed to fetch requirements");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequirements();
  }, []);

  return { requirements, loading, error, refetch: fetchRequirements };
};

export const useRequirementDetail = (requirementId) => {
  const [requirement, setRequirement] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!requirementId) return;

    const fetchDetail = async () => {
      setLoading(true);
      setError(null);
      try {
        const data =
          await workflowService.getRecruiterRequirementDetail(requirementId);
        setRequirement(data.requirement || data);
      } catch (err) {
        setError(err.message || "Failed to fetch requirement detail");
      } finally {
        setLoading(false);
      }
    };

    fetchDetail();
  }, [requirementId]);

  return { requirement, loading, error };
};

export const useRequirementCandidatePool = (requirementId) => {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!requirementId) return;

    const fetchCandidates = async () => {
      setLoading(true);
      setError(null);
      try {
        const data =
          await workflowService.runMatch(requirementId, 0);
        setCandidates(data.candidates || []);
      } catch (err) {
        setError(err.message || "Failed to fetch candidates");
      } finally {
        setLoading(false);
      }
    };

    fetchCandidates();
  }, [requirementId]);

  return { candidates, loading, error };
};

export const useSendCandidates = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const sendCandidates = async (requirementId, candidateIds) => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await workflowService.submitCandidates(requirementId, {
        candidate_ids: candidateIds,
      });
      setSuccess(result.message);
      return result;
    } catch (err) {
      setError(err.message || "Failed to send candidates");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { sendCandidates, loading, error, success };
};

export const useAssignedJobs = () => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchAssignedJobs = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await jobService.getAssignedJobs();
      const jobsArray =
        res?.data?.jobs ||
        res?.data?.data?.jobs ||
        res?.data?.requirements ||
        res?.data?.data?.requirements ||
        [];
      setJobs(jobsArray);
    } catch (err) {
      if (err?.response?.status === 403) {
        setError("You do not have access to assigned jobs for this account.");
      } else {
        setError(err?.response?.data?.detail || err.message || "Failed to fetch assigned jobs");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignedJobs();
  }, []);

  return { jobs, loading, error, refetch: fetchAssignedJobs };
};
