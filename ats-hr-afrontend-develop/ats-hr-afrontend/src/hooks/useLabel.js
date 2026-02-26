import { useLabels } from "../context/LabelsContext";

export default function useLabel(key, fallback = "") {
  const { labels } = useLabels();
  const value = labels?.[key];
  if (value === undefined || value === null || value === "") return fallback;
  return value;
}

