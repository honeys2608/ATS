import { useEffect, useState, useCallback, useRef } from "react";
import api from "../api/axios";
import eventBus from "../utils/eventBus";

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

export default function useCandidates({
  initialIsDirect = undefined,
  pageSize = 25,
} = {}) {
  const [candidates, setCandidates] = useState([]);
  const [filters, setFilters] = useState({
    q: "",
    status: "",
    job_id: "",
    applied_job: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(pageSize);
  const [total, setTotal] = useState(0);

  const [isDirect, setIsDirect] = useState(initialIsDirect);

  const filtersRef = useRef(filters);
  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  const fetchCandidates = useCallback(
    async (overrideParams = {}) => {
      try {
        setLoading(true);
        setError(null);

        const p = {
          page: overrideParams.page ?? page,
          limit: overrideParams.limit ?? limit,
          ...(overrideParams.filters ?? filtersRef.current),
        };

        const effectiveIsDirect =
          "is_direct" in overrideParams ? overrideParams.is_direct : isDirect;
        if (typeof effectiveIsDirect !== "undefined")
          p.is_direct = effectiveIsDirect;

        const params = {};
        if (p.page) params.page = p.page;
        if (p.limit) params.limit = p.limit;
        if (p.q) params.q = p.q;
        if (p.status) params.status = p.status;
        if (p.job_id) params.job_id = p.job_id;
        if (p.applied_job) params.applied_job = p.applied_job;
        if (typeof p.is_direct !== "undefined") params.is_direct = p.is_direct;

        const res = await api.get("/v1/candidates", { params });

        const body = res.data ?? {};
        let items = [];
        let totalCount = 0;

        if (Array.isArray(body)) {
          items = body;
          totalCount = body.length;
        } else if (body.data && Array.isArray(body.data.items)) {
          items = body.data.items;
          totalCount = body.data.total ?? body.data.meta?.total ?? items.length;
        } else if (Array.isArray(body.data)) {
          items = body.data;
          totalCount = items.length;
        } else if (Array.isArray(body.items)) {
          items = body.items;
          totalCount = body.total ?? items.length;
        } else {
          const maybeArr = body.data ?? body.items;
          if (Array.isArray(maybeArr)) {
            items = maybeArr;
            totalCount = body.total ?? maybeArr.length;
          } else {
            items = [];
            totalCount = 0;
          }
        }

        setCandidates(Array.isArray(items) ? items : []);
        setTotal(Number(totalCount ?? 0));
        setPage(Number(p.page ?? 1));
        setLimit(Number(p.limit ?? pageSize));

        return { items, total: totalCount };
      } catch (err) {
        console.error("fetchCandidates error:", err);
        setError(err);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [isDirect, limit, page, pageSize],
  );

  useEffect(() => {
    fetchCandidates({ page: 1, limit, filters });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, isDirect]);

  useEffect(() => {
    const unsubCandidates = eventBus.on("candidates:updated", () =>
      fetchCandidates({ page, limit }),
    );
    const unsubJobs = eventBus.on("jobs:updated", () =>
      fetchCandidates({ page, limit }),
    );
    const unsubRolePerms = eventBus.on("role-permissions:updated", () =>
      fetchCandidates({ page, limit }),
    );

    return () => {
      unsubCandidates();
      unsubJobs();
      unsubRolePerms();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchCandidates, page, limit]);

  const pollForParsed = async (id, { attempts = 12, interval = 2000 } = {}) => {
    if (!id) return null;
    for (let i = 0; i < attempts; i++) {
      try {
        const res = await api.get(`/v1/candidates/${id}`);
        const candidate = res.data?.data ?? res.data;
        if (candidate) {
          if (
            candidate.parsed_resume &&
            Object.keys(candidate.parsed_resume).length > 0
          ) {
            return candidate;
          }
        }
      } catch {}
      await sleep(interval);
    }

    try {
      const res = await api.get(`/v1/candidates/${id}`);
      return res.data?.data ?? res.data;
    } catch {
      return null;
    }
  };

  // ----------------------------------------
  // Upload resume and create candidate
  // ----------------------------------------
  const uploadCandidate = async (
    formData,
    { poll = true, onProgress } = {},
  ) => {
    try {
      // 🔧 ONLY FIX ADDED — NOTHING ELSE CHANGED
      if (formData instanceof FormData && !formData.has("file")) {
        if (formData.has("resume")) {
          formData.append("file", formData.get("resume"));
          formData.delete("resume");
        }
        if (formData.has("resumeFile")) {
          formData.append("file", formData.get("resumeFile"));
          formData.delete("resumeFile");
        }
      }
      // 🔧 normalize resume key for backend
      if (formData instanceof FormData && !formData.has("file")) {
        if (formData.has("resume")) {
          formData.append("file", formData.get("resume"));
          formData.delete("resume");
        }
        if (formData.has("resumeFile")) {
          formData.append("file", formData.get("resumeFile"));
          formData.delete("resumeFile");
        }
      }

      const res = await api.post("/v1/candidates", formData, {
        onUploadProgress: (evt) => {
          if (!evt.lengthComputable) return;
          const pct = Math.round((evt.loaded * 100) / evt.total);
          if (typeof onProgress === "function") onProgress(pct);
        },
      });

      const created = res.data?.data ?? res.data ?? null;
      const id =
        created?.id ?? created?.candidate_id ?? created?.candidate?.id ?? null;

      if (
        created &&
        created.parsed_resume &&
        Object.keys(created.parsed_resume).length > 0
      ) {
        setCandidates((prev) => [
          created,
          ...prev.filter((c) => String(c.id) !== String(created.id)),
        ]);
        eventBus.emit("candidates:updated", { candidate: created });
        return created;
      }

      const optimistic = created ?? {
        id: id ?? `tmp_${Date.now()}`,
        uploaded_at: new Date().toISOString(),
      };

      setCandidates((prev) => [optimistic, ...prev]);

      if (!id || !poll) {
        eventBus.emit("candidates:updated", { candidate: optimistic });
        return optimistic;
      }

      const fullCandidate = await pollForParsed(id);
      if (fullCandidate) {
        setCandidates((prev) =>
          prev.map((c) => (String(c.id) === String(id) ? fullCandidate : c)),
        );
        eventBus.emit("candidates:updated", { candidate: fullCandidate });
        return fullCandidate;
      }

      eventBus.emit("candidates:updated", { candidate: optimistic });
      return optimistic;
    } catch (err) {
      console.error("uploadCandidate error:", err);
      const message =
        err?.response?.data?.detail ??
        err?.response?.data ??
        err.message ??
        "Upload failed";
      throw new Error(
        typeof message === "string" ? message : JSON.stringify(message),
      );
    }
  };

  const createCandidate = async (payload = {}) => {
    try {
      const res = await api.post("/v1/candidates", payload);
      const created = res.data?.data ?? res.data ?? null;
      const entry = created ?? { id: `tmp_${Date.now()}`, ...payload };
      setCandidates((prev) => [entry, ...prev]);
      eventBus.emit("candidates:updated", { candidate: entry });
      return entry;
    } catch (err) {
      console.error("createCandidate error:", err);
      throw err;
    }
  };

  const updateCandidate = async (id, payload) => {
    try {
      const res = await api.put(`/v1/candidates/${id}`, payload);
      const updated = res.data?.data ?? res.data;
      setCandidates((prev) =>
        prev.map((c) => (String(c.id) === String(id) ? updated : c)),
      );
      eventBus.emit("candidates:updated", { candidate: updated });
      return updated;
    } catch (err) {
      console.error("updateCandidate error:", err);
      throw err;
    }
  };

  const updateStatus = async (id, status) => {
    try {
      const res = await api.put(`/v1/candidates/${id}/status`, { status });
      const updated = res.data?.data ?? res.data;
      setCandidates((prev) =>
        prev.map((c) => (String(c.id) === String(id) ? { ...c, status } : c)),
      );
      eventBus.emit("candidates:updated", { candidateId: id, status });
      return updated;
    } catch (err) {
      console.error("updateStatus error:", err);
      throw err;
    }
  };

  const refresh = async () => await fetchCandidates({ page, limit });

  return {
    candidates,
    loading,
    error,
    filters,
    setFilters,
    page,
    limit,
    total,
    setPage,
    setLimit,
    setIsDirect,
    isDirect,
    fetchCandidates,
    fetch: fetchCandidates,
    refresh,
    uploadCandidate,
    createCandidate,
    updateCandidate,
    updateStatus,
    setCandidates,
  };
}
