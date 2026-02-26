import React, { useEffect, useMemo, useRef, useState } from "react";

const clampPage = (value, min, max) => {
  const next = Number(value);
  if (!Number.isFinite(next)) return min;
  return Math.min(max, Math.max(min, Math.trunc(next)));
};

export default function PaginatedCardGrid({
  items = [],
  renderCard,
  totalPages = 1,
  currentPage = 1,
  onPageChange,
  pageSize = 9,
  totalRecords,
  loading = false,
  error = null,
  onRetry,
  emptyMessage = "No records found.",
  onPageSizeChange,
  pageSizeOptions = [9, 18, 27],
  showGoToPage = true,
  keyExtractor,
  className = "",
}) {
  const firstRenderRef = useRef(true);
  const [animate, setAnimate] = useState(false);
  const [gotoValue, setGotoValue] = useState(String(currentPage || 1));

  const safeItems = Array.isArray(items) ? items : [];
  const safePageSize = Math.max(1, Number(pageSize) || 9);
  const safeTotalRecords = Number.isFinite(totalRecords)
    ? Number(totalRecords)
    : safeItems.length;
  const safeTotalPages = Math.max(1, Number(totalPages) || 1);

  const isServerPaginated =
    safeTotalPages > 1 &&
    safeTotalRecords > safeItems.length &&
    safeItems.length <= safePageSize;

  const visibleItems = useMemo(() => {
    if (isServerPaginated) return safeItems;
    const start = (currentPage - 1) * safePageSize;
    const end = start + safePageSize;
    return safeItems.slice(start, end);
  }, [safeItems, currentPage, safePageSize, isServerPaginated]);

  useEffect(() => {
    if (!onPageChange) return;
    if (currentPage > safeTotalPages) {
      onPageChange(safeTotalPages);
    }
  }, [currentPage, safeTotalPages, onPageChange]);

  useEffect(() => {
    setGotoValue(String(currentPage || 1));

    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      return;
    }

    setAnimate(true);
    const timer = setTimeout(() => setAnimate(false), 220);
    window.scrollTo({ top: 0, behavior: "smooth" });
    return () => clearTimeout(timer);
  }, [currentPage]);

  const showPagination = safeTotalRecords > safePageSize && safeTotalPages > 1;
  const canPrev = currentPage > 1;
  const canNext = currentPage < safeTotalPages;

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: safePageSize }).map((_, idx) => (
          <div
            key={`skeleton-${idx}`}
            className="h-44 rounded-xl border border-gray-200 bg-white animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-700">{error}</p>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium bg-red-600 text-white hover:bg-red-700"
          >
            Retry
          </button>
        ) : null}
      </div>
    );
  }

  if (!safeItems.length) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-600">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      <div
        className={`transition-all duration-200 ${
          animate ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"
        }`}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {visibleItems.map((item, idx) => (
            <React.Fragment
              key={keyExtractor ? keyExtractor(item, idx) : item?.id || `${idx}-${currentPage}`}
            >
              {renderCard(item, idx)}
            </React.Fragment>
          ))}
        </div>
      </div>

      {showPagination ? (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="text-sm text-gray-600">
              Page <span className="font-semibold">{currentPage}</span> of{" "}
              <span className="font-semibold">{safeTotalPages}</span>
              {" | "}
              <span className="font-semibold">{safeTotalRecords}</span> total records
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {onPageSizeChange ? (
                <select
                  value={safePageSize}
                  onChange={(event) => onPageSizeChange(Number(event.target.value))}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                >
                  {pageSizeOptions.map((option) => (
                    <option key={option} value={option}>
                      {option} / page
                    </option>
                  ))}
                </select>
              ) : null}

              {showGoToPage ? (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (!onPageChange) return;
                    onPageChange(clampPage(gotoValue, 1, safeTotalPages));
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    type="number"
                    min="1"
                    max={safeTotalPages}
                    value={gotoValue}
                    onChange={(event) => setGotoValue(event.target.value)}
                    className="w-20 rounded-lg border border-gray-300 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                    aria-label="Go to page"
                  />
                  <button
                    type="submit"
                    className="rounded-lg border border-[var(--color-primary)] px-3 py-2 text-sm text-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-white transition-colors"
                  >
                    Go
                  </button>
                </form>
              ) : null}

              <button
                type="button"
                onClick={() => onPageChange?.(currentPage - 1)}
                disabled={!canPrev}
                className="h-10 w-10 rounded-full border border-[var(--color-primary)] text-[var(--color-primary)] shadow-sm hover:shadow-md hover:bg-[var(--color-primary)] hover:text-white disabled:border-gray-200 disabled:text-gray-400 disabled:bg-gray-50 disabled:shadow-none transition-all"
                aria-label="Previous page"
              >
                &larr;
              </button>

              <div className="rounded-full bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-700 shadow-[0_0_0_3px_rgba(16,185,129,0.18)]">
                {currentPage} / {safeTotalPages}
              </div>

              <button
                type="button"
                onClick={() => onPageChange?.(currentPage + 1)}
                disabled={!canNext}
                className="h-10 w-10 rounded-full border border-[var(--color-primary)] text-[var(--color-primary)] shadow-sm hover:shadow-md hover:bg-[var(--color-primary)] hover:text-white disabled:border-gray-200 disabled:text-gray-400 disabled:bg-gray-50 disabled:shadow-none transition-all"
                aria-label="Next page"
              >
                &rarr;
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
