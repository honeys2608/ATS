import { useCallback, useEffect, useState } from "react";
import { getVendorDashboard } from "../services/vendorService";

/**
 * useVendorDashboard
 * - Fetches vendor dashboard KPIs
 * - Handles loading & error state
 * - Provides reload method
 */
export default function useVendorDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await getVendorDashboard();
      setData(res);
    } catch (err) {
      console.error(err);
      setError("Failed to load vendor dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  return {
    data,
    loading,
    error,
    reload: loadDashboard,
  };
}
