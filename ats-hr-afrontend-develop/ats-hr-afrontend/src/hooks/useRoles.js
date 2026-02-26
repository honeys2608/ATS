// src/hooks/useRoles.js
import { useState, useEffect } from 'react';
import api from '../api/axios';
import eventBus from '../utils/eventBus';

export default function useRoles() {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalRecords: 0,
    limit: 9,
  });

  // fetch all roles
  const fetch = async (params = {}) => {
    setLoading(true);
    try {
      const res = await api.get('/v1/roles', { params });
      const payload = res.data;
      const list = Array.isArray(payload)
        ? payload
        : (payload?.data || payload?.roles || []);

      setRoles(Array.isArray(list) ? list : []);

      const limit =
        Number(params.limit) ||
        Number(payload?.limit) ||
        pagination.limit ||
        9;
      const totalRecords =
        payload?.totalRecords ??
        payload?.total ??
        (Array.isArray(list) ? list.length : 0);
      const totalPages =
        payload?.totalPages ??
        Math.max(1, Math.ceil((totalRecords || 0) / Math.max(1, limit)));
      const currentPage = payload?.currentPage ?? (Number(params.page) || 1);

      setPagination({
        currentPage,
        totalPages,
        totalRecords,
        limit,
      });
      setError(null);
      return Array.isArray(list) ? list : [];
    } catch (err) {
      setError(err);
      setRoles([]);
      setPagination({
        currentPage: 1,
        totalPages: 1,
        totalRecords: 0,
        limit: Number(params.limit) || 9,
      });
      return [];
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch();
  }, []);

  const createRole = async (payload) => {
    const res = await api.post('/v1/roles', payload);
    setRoles(r => [res.data, ...r]);
    setPagination((prev) => ({
      ...prev,
      totalRecords: prev.totalRecords + 1,
    }));
    // notify app
    eventBus.emit('roles:updated', { role: res.data });
    return res.data;
  };

  const updateRole = async (id, payload) => {
    const res = await api.put(`/v1/roles/${id}`, payload);
    setRoles(r => r.map(x => x.id === id ? res.data : x));
    eventBus.emit('roles:updated', { role: res.data });
    return res.data;
  };

  const deleteRole = async (id) => {
    await api.delete(`/v1/roles/${id}`);
    setRoles(r => r.filter(x => x.id !== id));
    setPagination((prev) => ({
      ...prev,
      totalRecords: Math.max(0, prev.totalRecords - 1),
    }));
    eventBus.emit('roles:updated', { roleId: id });
  };

  // Returns normalized array of permission keys (strings)
  const fetchRolePermissions = async (roleId) => {
    const res = await api.get(`/v1/roles/${roleId}/permissions`);
    const data = res.data || [];
    // normalize: strings or objects { key }
    const keys = data.map(d => (typeof d === 'string' ? d : d.key)).filter(Boolean);
    return keys;
  };

  // setRolePermissions expects array of permission keys
  const setRolePermissions = async (roleId, permissionKeys = []) => {
    const res = await api.put(`/v1/roles/${roleId}/permissions`, { permissionKeys });
    // notify app of change
    eventBus.emit('role-permissions:updated', { roleId, permissionKeys });
    // Also emit generic update so lists refresh if needed
    eventBus.emit('roles:updated', { roleId });
    return res.data;
  };

  return {
    roles,
    loading,
    error,
    pagination,
    fetch,
    createRole,
    updateRole,
    deleteRole,
    fetchRolePermissions,
    setRolePermissions,
    setRoles,
  };
}
