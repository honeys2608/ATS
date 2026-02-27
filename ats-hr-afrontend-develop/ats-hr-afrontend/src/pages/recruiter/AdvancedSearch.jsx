import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../../api/axios";
import SearchFiltersPanel from "../../components/semantic-search/SearchFiltersPanel";
import CandidateResultsList from "../../components/semantic-search/CandidateResultsList";
import CandidateDetail from "../../components/candidate-profile/CandidateDetail";
import CallFeedbackDrawer from "../../components/call-feedback/CallFeedbackDrawer";
import CustomMessagePanel from "../../components/semantic-search/CustomMessagePanel";
import { SemanticSearchEngine } from "../../services/SemanticSearchEngine";
import candidateService from "../../services/candidateService";
import {
  getCandidateApiId,
  mapCandidateToProfile,
} from "../../utils/candidateProfileUtils";
import "./AdvancedSearch.css";

const searchEngine = new SemanticSearchEngine();
const CANDIDATE_LIMIT = 200;
const QUICK_ACTION_LOCKED_STATUSES = new Set([
  "interview_scheduled",
  "interview_completed",
  "selected",
  "negotiation",
  "offer_extended",
  "offer_accepted",
  "offer_declined",
  "hired",
  "joined",
  "rejected",
  "client_rejected",
]);
const QUICK_ACTION_LOCKED_STATUS_MESSAGES = {
  interview_scheduled: "Actions disabled: interview already scheduled",
  interview_completed: "Actions disabled: interview already completed",
  selected: "Actions disabled: candidate already selected",
  negotiation: "Actions disabled: candidate is in negotiation stage",
  offer_extended: "Actions disabled: offer already extended",
  offer_accepted: "Actions disabled: offer already accepted",
  offer_declined: "Actions disabled: offer already declined",
  hired: "Actions disabled: candidate already hired",
  joined: "Actions disabled: candidate already joined",
  rejected: "Actions disabled: candidate already rejected",
  client_rejected: "Actions disabled: candidate already rejected by client",
};

const toNumber = (value) => {
  const parsed = Number(String(value ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

const sortCandidates = (items, sortBy) => {
  const list = [...items];
  switch (sortBy) {
    case "experience":
      return list.sort(
        (a, b) =>
          toNumber(b.experience_years || b.experience || b.total_experience) -
          toNumber(a.experience_years || a.experience || a.total_experience),
      );
    case "salary":
      return list.sort(
        (a, b) =>
          toNumber(b.expected_ctc || b.expected_salary || b.current_ctc) -
          toNumber(a.expected_ctc || a.expected_salary || a.current_ctc),
      );
    case "recent":
      return list.sort(
        (a, b) =>
          new Date(b.updated_at || b.created_at || 0).getTime() -
          new Date(a.updated_at || a.created_at || 0).getTime(),
      );
    case "name":
      return list.sort((a, b) =>
        String(a.full_name || a.name || "").localeCompare(
          String(b.full_name || b.name || ""),
        ),
      );
    case "relevance":
    default:
      return list.sort(
        (a, b) =>
          Number(b.semantic_score || b.match_score || 0) -
          Number(a.semantic_score || a.match_score || 0),
      );
  }
};

const toErrorText = (error, fallback = "Unable to load candidates for semantic search.") => {
  const detail = error?.response?.data?.detail;
  if (typeof detail === "string" && detail.trim()) return detail;
  if (Array.isArray(detail)) {
    const lines = detail
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") return item.msg || item.message || "";
        return "";
      })
      .filter(Boolean);
    if (lines.length) return lines.join(", ");
  }
  if (detail && typeof detail === "object") {
    return detail.msg || detail.message || JSON.stringify(detail);
  }
  if (typeof error?.message === "string" && error.message.trim()) return error.message;
  return fallback;
};

export default function AdvancedSearch() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [allCandidates, setAllCandidates] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [sortBy, setSortBy] = useState("relevance");
  const [error, setError] = useState("");
  const [initialFilters, setInitialFilters] = useState(null);
  const [detailCandidate, setDetailCandidate] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showCallFeedbackDrawer, setShowCallFeedbackDrawer] = useState(false);
  const [feedbackCandidate, setFeedbackCandidate] = useState(null);
  const [feedbackInitialData, setFeedbackInitialData] = useState(null);
  const [messagePanel, setMessagePanel] = useState({
    open: false,
    recipient: "am",
    candidate: null,
  });

  const loadCandidates = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await candidateService.listCandidates({ limit: CANDIDATE_LIMIT });
      const rows = Array.isArray(data) ? data : (data?.items || []);
      setAllCandidates(rows);
      setResults(rows);
    } catch (loadErr) {
      setError(toErrorText(loadErr));
      setAllCandidates([]);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCandidates();
  }, [loadCandidates]);

  useEffect(() => {
    const keywordParam = searchParams.get("keywords");
    const keywordList = keywordParam
      ? keywordParam.split(",").map((item) => item.trim()).filter(Boolean)
      : [];
    setQuery(searchParams.get("q") || "");
    setInitialFilters(
      keywordList.length > 0 ? { keywords: keywordList } : null,
    );
  }, [searchParams]);

  const handleSearch = useCallback(
    ({ query: q = "", ...filters }) => {
      const matched = searchEngine.search(q, filters, allCandidates);
      setResults(matched);
      setQuery(q);

      const next = new URLSearchParams(searchParams);
      if (q) next.set("q", q);
      else next.delete("q");
      setSearchParams(next, { replace: true });
    },
    [allCandidates, searchParams, setSearchParams],
  );

  const sortedResults = useMemo(
    () => sortCandidates(results, sortBy),
    [results, sortBy],
  );
  const detailProfile = useMemo(
    () => (detailCandidate ? mapCandidateToProfile(detailCandidate, true) : null),
    [detailCandidate],
  );
  const isQuickActionsDisabled = useMemo(() => {
    const status = String(
      detailCandidate?.status ||
      detailCandidate?.application_status ||
      detailProfile?.status ||
      "",
    )
      .trim()
      .toLowerCase();
    return QUICK_ACTION_LOCKED_STATUSES.has(status);
  }, [detailCandidate, detailProfile]);
  const quickActionsDisabledMessage = useMemo(() => {
    const status = String(
      detailCandidate?.status ||
      detailCandidate?.application_status ||
      detailProfile?.status ||
      "",
    )
      .trim()
      .toLowerCase();
    return QUICK_ACTION_LOCKED_STATUS_MESSAGES[status] || "";
  }, [detailCandidate, detailProfile]);

  const updateCandidateInList = useCallback((list, updatedCandidate) => {
    const updatedId = String(
      updatedCandidate?.id ||
      updatedCandidate?._id ||
      updatedCandidate?.candidate_id ||
      "",
    ).trim();
    if (!updatedId) return list;
    return list.map((item) => {
      const itemId = String(item?.id || item?._id || item?.candidate_id || "").trim();
      if (itemId !== updatedId) return item;
      return { ...item, ...updatedCandidate };
    });
  }, []);

  const refreshDetailCandidate = useCallback(async () => {
    if (!detailCandidate) return;
    const apiId = getCandidateApiId(detailCandidate);
    if (!apiId) return;
    try {
      const detail = await candidateService.getCandidateById(apiId);
      if (detail && typeof detail === "object") {
        setDetailCandidate((prev) => ({ ...(prev || {}), ...(detail || {}) }));
        setAllCandidates((prev) => updateCandidateInList(prev, detail));
        setResults((prev) => updateCandidateInList(prev, detail));
      }
    } catch {
      // keep current detail snapshot if refresh fails
    }
  }, [detailCandidate, updateCandidateInList]);

  const handleViewDetails = useCallback(async (candidate) => {
    const candidateId = candidate?.id || candidate?.candidate_id || candidate?._id || "";
    if (!candidateId) return;

    setDetailLoading(true);
    setDetailCandidate(candidate);
    try {
      const fullCandidate = await candidateService.getCandidateById(candidateId);
      const normalizedFullCandidate =
        fullCandidate && typeof fullCandidate === "object"
          ? (fullCandidate.candidate && typeof fullCandidate.candidate === "object"
            ? fullCandidate.candidate
            : fullCandidate)
          : null;
      if (normalizedFullCandidate) {
        const merged = { ...candidate, ...normalizedFullCandidate };
        setDetailCandidate(merged);
        setAllCandidates((prev) => updateCandidateInList(prev, merged));
        setResults((prev) => updateCandidateInList(prev, merged));
      }
    } catch (detailErr) {
      setDetailCandidate(candidate);
    } finally {
      setDetailLoading(false);
    }
  }, [updateCandidateInList]);

  const openFeedbackDrawer = useCallback((candidate, feedback = null) => {
    setFeedbackCandidate(candidate);
    setFeedbackInitialData(feedback || null);
    setShowCallFeedbackDrawer(true);
  }, []);

  const resolveAccountManagerFromCandidate = useCallback((candidate) => ({
    id:
      candidate?.account_manager_id ||
      candidate?.account_manager?.id ||
      candidate?.account_manager?.am_id ||
      "",
    name:
      candidate?.account_manager_name ||
      candidate?.account_manager?.name ||
      candidate?.account_manager?.am_name ||
      "",
    email:
      candidate?.account_manager_email ||
      candidate?.account_manager?.email ||
      candidate?.account_manager?.am_email ||
      "",
  }), []);

  const handleOpenMessagePanel = useCallback((candidate, recipient) => {
    if (!candidate) return;
    setMessagePanel({ open: true, recipient, candidate });
  }, []);

  const handleSendMessage = useCallback(async (message) => {
    const target = messagePanel.candidate;
    const apiId = getCandidateApiId(target);
    if (!apiId) throw new Error("Candidate ID not found");

    const deliveryMode = message?.deliveryMode || "email";
    const shouldSendEmail = deliveryMode === "email" || deliveryMode === "both";
    const shouldSendPortalNote = deliveryMode === "portal_note" || deliveryMode === "both";
    const recipient = message?.recipient || messagePanel.recipient || "candidate";
    const subject = String(message?.subject || "").trim();
    const body = String(message?.body || "").trim();
    const to = String(message?.to || "").trim();
    const cc = String(message?.cc || "").trim();

    if (!body) throw new Error("Message body is required");

    if (shouldSendPortalNote) {
      const recipientLabel = recipient === "am" ? "Account Manager" : "Candidate";
      const noteText = subject
        ? `[Message to ${recipientLabel}] ${subject}\n${body}`
        : `[Message to ${recipientLabel}] ${body}`;
      await candidateService.addCandidateNote(apiId, { note: noteText });
    }

    if (shouldSendEmail) {
      if (recipient === "candidate") {
        const form = new FormData();
        form.append("subject", subject || "Candidate Update");
        form.append("message_body", body);
        form.append("candidate_ids", apiId);
        await api.post("/v1/candidates/email/send", form, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      } else {
        const am = resolveAccountManagerFromCandidate(target);
        const recipientEmail = to || am.email;
        if (!recipientEmail) {
          throw new Error("Account Manager email is not mapped for this candidate");
        }
        const query = new URLSearchParams();
        if (subject) query.set("subject", subject);
        if (body) query.set("body", body);
        if (cc) query.set("cc", cc);
        window.open(
          `mailto:${encodeURIComponent(recipientEmail)}?${query.toString()}`,
          "_blank",
        );
      }
    }

    await loadCandidates();
    await refreshDetailCandidate();
  }, [loadCandidates, messagePanel.candidate, messagePanel.recipient, refreshDetailCandidate, resolveAccountManagerFromCandidate]);

  return (
    <div className="semantic-search-page">
      <div className="semantic-search-page__header">
        <div>
          <h1 className="semantic-search-page__title">Semantic Search</h1>
          <p className="semantic-search-page__subtitle">
            Smart filtering and relevance scoring across every candidate profile.
          </p>
        </div>
        <div className="semantic-search-page__header-actions">
          <button type="button" className="semantic-search-refresh" onClick={loadCandidates}>
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="semantic-search-page__context">
          <span className="semantic-search-page__context-text">{error}</span>
        </div>
      )}

      <div className="semantic-search-page__content">
        <SearchFiltersPanel
          onSearch={handleSearch}
          loading={loading}
          initialQuery={query}
          initialKeywords={initialFilters?.keywords}
          initialFilters={initialFilters}
          showSmartHint={false}
        />
        <CandidateResultsList
          candidates={sortedResults}
          loading={loading}
          sortBy={sortBy}
          onSortChange={setSortBy}
          onViewDetails={handleViewDetails}
        />
      </div>

      {detailCandidate && detailProfile && (
        <CandidateDetail
          candidate={detailCandidate}
          profile={detailProfile}
          loading={detailLoading}
          onClose={() => {
            setDetailCandidate(null);
            setDetailLoading(false);
          }}
          onOpenFeedback={openFeedbackDrawer}
          onMessageAm={(candidate) => handleOpenMessagePanel(candidate, "am")}
          onMessageCandidate={(candidate) =>
            handleOpenMessagePanel(candidate, "candidate")
          }
          hideStatusControls
          hideSendToAMAction
          hideScheduleInterviewAction
          hideOpenFullProfileAction
          quickActionsDisabled={isQuickActionsDisabled}
          quickActionsDisabledMessage={quickActionsDisabledMessage}
        />
      )}

      {showCallFeedbackDrawer && feedbackCandidate && (
        <CallFeedbackDrawer
          isOpen={showCallFeedbackDrawer}
          candidateId={getCandidateApiId(feedbackCandidate)}
          candidateName={
            feedbackCandidate.full_name || feedbackCandidate.name || "Candidate"
          }
          initialData={feedbackInitialData}
          onClose={() => {
            setShowCallFeedbackDrawer(false);
            setFeedbackInitialData(null);
          }}
          onSuccess={() => {
            setShowCallFeedbackDrawer(false);
            setFeedbackInitialData(null);
            loadCandidates();
            refreshDetailCandidate();
          }}
        />
      )}

      {messagePanel.open && messagePanel.candidate && (
        <CustomMessagePanel
          candidate={messagePanel.candidate}
          recipient={messagePanel.recipient}
          onClose={() =>
            setMessagePanel({ open: false, recipient: "am", candidate: null })
          }
          onSend={async (payload) => {
            try {
              await handleSendMessage(payload);
            } catch (sendErr) {
              alert(sendErr?.message || "Failed to send message");
              return;
            }
            setMessagePanel({ open: false, recipient: "am", candidate: null });
          }}
        />
      )}
    </div>
  );
}
