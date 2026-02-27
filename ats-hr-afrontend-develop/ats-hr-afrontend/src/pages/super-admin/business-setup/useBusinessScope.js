import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { fetchTenants } from "../../../services/businessSetupService";

export default function useBusinessScope() {
  const location = useLocation();
  const [scope, setScope] = useState(location.state?.scope || "global");
  const [tenantId, setTenantId] = useState(location.state?.tenantId || "");
  const [tenants, setTenants] = useState([]);

  useEffect(() => {
    let mounted = true;
    fetchTenants()
      .then((items) => {
        if (mounted) setTenants(items || []);
      })
      .catch(() => {
        if (mounted) setTenants([]);
      });
    return () => {
      mounted = false;
    };
  }, []);

  return {
    scope,
    tenantId,
    tenants,
    setScope: (next) => {
      setScope(next);
      if (next === "global") setTenantId("");
    },
    setTenantId,
  };
}
