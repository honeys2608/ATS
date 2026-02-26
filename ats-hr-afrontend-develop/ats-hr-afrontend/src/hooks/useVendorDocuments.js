import { useCallback, useEffect, useState } from "react";
import { getVendorDocuments } from "../services/vendorDocumentService";

/**
 * useVendorDocuments
 * - Fetches vendor compliance documents
 * - Handles loading & error state
 * - Provides reload method
 */
export default function useVendorDocuments() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDocuments = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await getVendorDocuments();
      setDocuments(res || []);
    } catch (err) {
      console.error(err);
      setError("Failed to load vendor documents");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  return {
    documents,
    loading,
    error,
    reload: loadDocuments,
  };
}
