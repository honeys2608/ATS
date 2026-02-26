import React, { createContext, useContext, useMemo } from "react";

const LabelsContext = createContext({
  labels: {},
  loading: false,
  refreshLabels: async () => {},
});

export function LabelsProvider({ children }) {
  const value = useMemo(
    () => ({ labels: {}, loading: false, refreshLabels: async () => {} }),
    [],
  );
  return <LabelsContext.Provider value={value}>{children}</LabelsContext.Provider>;
}

export function useLabels() {
  return useContext(LabelsContext);
}