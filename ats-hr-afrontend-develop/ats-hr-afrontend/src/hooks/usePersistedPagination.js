import { useEffect, useMemo, useState } from "react";

const PAGE_SIZE_OPTIONS = [9, 18, 27];

const toPositiveNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export default function usePersistedPagination(
  storageKey,
  { defaultPage = 1, defaultLimit = 9 } = {},
) {
  const pageKey = `${storageKey}:page`;
  const limitKey = `${storageKey}:limit`;

  const [page, setPage] = useState(() =>
    toPositiveNumber(sessionStorage.getItem(pageKey), defaultPage),
  );
  const [limit, setLimitState] = useState(() => {
    const stored = toPositiveNumber(sessionStorage.getItem(limitKey), defaultLimit);
    return PAGE_SIZE_OPTIONS.includes(stored) ? stored : defaultLimit;
  });

  useEffect(() => {
    sessionStorage.setItem(pageKey, String(page));
  }, [page, pageKey]);

  useEffect(() => {
    sessionStorage.setItem(limitKey, String(limit));
  }, [limit, limitKey]);

  const setLimit = (nextLimit) => {
    const parsed = toPositiveNumber(nextLimit, defaultLimit);
    setLimitState(PAGE_SIZE_OPTIONS.includes(parsed) ? parsed : defaultLimit);
  };

  const pageSizeOptions = useMemo(() => PAGE_SIZE_OPTIONS, []);

  return {
    page,
    setPage,
    limit,
    setLimit,
    pageSizeOptions,
  };
}
