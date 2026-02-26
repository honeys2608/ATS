// src/context/PermissionContext.jsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import api from '../api/axios';
import eventBus from '../utils/eventBus';

const PermissionContext = createContext({
  role: null,
  permissions: [],
  hasPermission: () => false,
  loading: true,
  setPermissions: () => {},
});

export function PermissionProvider({ children }) {
  const [role, setRole] = useState(null);            // ✅ NEW
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      // 1️⃣ Get role
      const meRes = await api.get('/auth/me');
      setRole(meRes.data?.role || null);

      // 2️⃣ Get permissions
      const res = await api.get('/v1/permissions/me');
      const data = res.data || {};
      const modules = data?.modules || {};
      const keys = Array.isArray(data)
        ? data
            .map(item => (typeof item === 'string' ? item : item?.key))
            .filter(Boolean)
        : Object.entries(modules).flatMap(([module, actions]) =>
            (Array.isArray(actions) ? actions : []).map(
              action => `${String(module).toLowerCase()}:${String(action).toLowerCase()}`,
            ),
          );

      setPermissions(keys);
    } catch (err) {
      setRole(null);
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    load();

    const unsubPermissions = eventBus.on('permissions:updated', () => mounted && load());
    const unsubRolePerms = eventBus.on('role-permissions:updated', () => mounted && load());
    const unsubUsers = eventBus.on('users:updated', () => mounted && load());

    return () => {
      mounted = false;
      unsubPermissions();
      unsubRolePerms();
      unsubUsers();
    };
  }, []);

  const hasPermission = (permissionKey) => {
    const key = String(permissionKey || '').toLowerCase();
    return permissions.includes(key);
  };

  return (
    <PermissionContext.Provider
      value={{
        role,              // ✅ exposed
        permissions,
        hasPermission,
        loading,
        setPermissions,
      }}
    >
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermission() {
  return useContext(PermissionContext);
}
