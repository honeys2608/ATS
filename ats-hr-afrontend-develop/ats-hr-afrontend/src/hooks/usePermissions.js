import { useEffect, useMemo, useState } from "react";
import api from "../api/axios";

export default function usePermissions() {
  const [matrix, setMatrix] = useState({});
  const [loading, setLoading] = useState(false);
  const role = String(localStorage.getItem("role") || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      setLoading(true);
      try {
        const res = await api.get("/v1/config/permissions");
        if (mounted) setMatrix(res?.data?.permissions || {});
      } catch (_) {
        if (mounted) setMatrix({});
      } finally {
        if (mounted) setLoading(false);
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, []);

  const can = useMemo(() => {
    return (resource, action) => {
      const r = String(resource || "").toLowerCase();
      const a = String(action || "").toLowerCase();
      if (!r || !a) return false;
      if (role === "super_admin") return true;
      const actions = matrix?.[role]?.[r] || [];
      return actions.includes(a);
    };
  }, [matrix, role]);

  return { role, loading, permissions: matrix?.[role] || {}, can };
}
