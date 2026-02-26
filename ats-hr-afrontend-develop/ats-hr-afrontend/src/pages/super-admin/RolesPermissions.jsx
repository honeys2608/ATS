import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  Filter,
  Import,
  Lock,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Shield,
  Trash2,
  Unlock,
  X,
} from "lucide-react";
import api from "../../api/axios";
import { normalizeText, validateFeatureName } from "../../utils/recruiterValidations";

const RESERVED = new Set(["super_admin", "admin", "candidate"]);
const PAGE_SIZES = [25, 50, 100, 500];
const DEFAULT_ACTIONS = ["create", "view", "update", "delete"];
const CRITICAL_MODULES = new Set(["settings", "roles_permissions", "system_settings", "users"]);
const ROLE_DESCRIPTIONS = {
  super_admin: "Full governance access across tenants and policies.",
  admin: "Operational administration for hiring workflows.",
  recruiter: "Day-to-day recruitment and candidate management access.",
  account_manager: "Client and account ownership operations.",
  candidate: "Self-service candidate portal permissions.",
};
const MODULE_LABELS = {
  candidates: "Candidates",
  client: "Clients",
  finance: "Finance",
  interviews: "Interviews",
  job_applications: "Job Applications",
  jobs: "Jobs",
};
const ACTION_LABELS = {
  create: "Add",
  view: "View",
  update: "Edit",
  delete: "Delete",
};
const ACTION_ICONS = {
  create: "\u2795",
  update: "\u270F\uFE0F",
  view: "\u{1F441}",
  delete: "\u{1F5D1}",
};

const defaultRecordFilters = {
  search: "",
  role_name: "",
  module_name: "",
  action_name: "",
  status: "all",
  date_from: "",
  date_to: "",
  sort_by: "created_at",
  sort_order: "desc",
};

function formatDate(value) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "-";
  }
}

function downloadTextFile(filename, content, mimeType = "text/plain") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function formatKeyLabel(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getModuleLabel(moduleName) {
  if (!moduleName) return "";
  const key = String(moduleName).trim().toLowerCase();
  return MODULE_LABELS[key] || formatKeyLabel(key);
}

function getActionLabel(actionName) {
  if (!actionName) return "";
  const key = String(actionName).trim().toLowerCase();
  return ACTION_LABELS[key] || formatKeyLabel(key);
}

function getActionChipLabel(actionName) {
  const key = String(actionName || "").trim().toLowerCase();
  const icon = ACTION_ICONS[key] || "\u2022";
  return `${icon} ${getActionLabel(actionName)}`.trim();
}

function getRoleLabel(roleName) {
  const raw = String(roleName || "").trim();
  const cleaned = raw.replace(/^[\u2713\u2714]\s*/u, "").replace(/^check\s+/i, "");
  return formatKeyLabel(cleaned);
}

function validateRoleNameInput(value) {
  return validateFeatureName(normalizeText(value).toLowerCase(), "Role name", {
    pattern: /^[a-z0-9_ ]+$/,
    patternMessage: "Role name can only contain lowercase letters, numbers, spaces, and underscores.",
  });
}

export default function RolesPermissions() {
  const [searchParams] = useSearchParams();
  const initialGlobalQuery = (searchParams.get("q") || "").trim();

  const [globalSearch, setGlobalSearch] = useState(initialGlobalQuery);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [assignmentError, setAssignmentError] = useState("");
  const [toasts, setToasts] = useState([]);

  const [roleSummary, setRoleSummary] = useState([]);
  const [roleIdsByName, setRoleIdsByName] = useState({});
  const [roleSearch, setRoleSearch] = useState("");
  const [selectedRoleName, setSelectedRoleName] = useState("");
  const [roleMenuOpen, setRoleMenuOpen] = useState("");
  const [activeRoleHoverCard, setActiveRoleHoverCard] = useState("");
  const [detailsModalRole, setDetailsModalRole] = useState(null);
  const [systemOverviewModalOpen, setSystemOverviewModalOpen] = useState(false);
  const [editRoleModal, setEditRoleModal] = useState({ open: false, role: null, name: "" });
  const [editPermissionModal, setEditPermissionModal] = useState({
    open: false,
    id: "",
    role_name: "",
    module_name: "",
    action_name: "",
  });
  const [detailsPermissionForm, setDetailsPermissionForm] = useState({
    module_name: "",
    action_name: "",
  });
  const [detailsCreateError, setDetailsCreateError] = useState("");
  const [detailsModalPos, setDetailsModalPos] = useState({ x: 0, y: 0 });
  const [isDraggingDetailsModal, setIsDraggingDetailsModal] = useState(false);

  const [matrix, setMatrix] = useState({});
  const [matrixSearch, setMatrixSearch] = useState("");
  const [matrixView, setMatrixView] = useState("grid");
  const [collapsedModules, setCollapsedModules] = useState({});
  const [collapsedPermissionGroups, setCollapsedPermissionGroups] = useState({});

  const [assignmentForm, setAssignmentForm] = useState({ module_name: "", actions: {} });
  const [selectedRecordIds, setSelectedRecordIds] = useState(new Set());

  const [recordFilters, setRecordFilters] = useState(defaultRecordFilters);
  const [filterDraft, setFilterDraft] = useState(defaultRecordFilters);
  const [recordItems, setRecordItems] = useState([]);
  const [recordPage, setRecordPage] = useState(1);
  const [recordLimit, setRecordLimit] = useState(25);
  const [recordTotal, setRecordTotal] = useState(0);
  const [recordTotalPages, setRecordTotalPages] = useState(1);
  const [filterOptions, setFilterOptions] = useState({ roles: [], modules: [], actions: [] });
  const [rowMenuOpen, setRowMenuOpen] = useState("");

  const [rolePermissions, setRolePermissions] = useState([]);
  const [historyPreview, setHistoryPreview] = useState(null);
  const [activityLog, setActivityLog] = useState([]);

  const importInputRef = useRef(null);
  const detailsDragRef = useRef({ originX: 0, originY: 0, startX: 0, startY: 0 });

  const pushActivity = (text) => {
    setActivityLog((prev) => [{ text, at: new Date().toISOString() }, ...prev].slice(0, 12));
  };

  const loadRoles = async () => {
    const [rolesRes, summaryRes] = await Promise.all([
      api.get("/v1/roles"),
      api.get("/v1/permissions-matrix/roles-summary", { params: { search: "" } }),
    ]);

    const roleRows = Array.isArray(rolesRes?.data)
      ? rolesRes.data
      : Array.isArray(rolesRes?.data?.roles)
        ? rolesRes.data.roles
        : [];
    setRoleIdsByName(
      roleRows.reduce((acc, role) => {
        if (role?.name && role?.id != null) acc[role.name] = role.id;
        return acc;
      }, {}),
    );

    const summaryRows = Array.isArray(summaryRes?.data?.items) ? summaryRes.data.items : [];
    const idMap = new Map(roleRows.map((r) => [r.name, r.id]));
    const merged = summaryRows.map((row) => ({ ...row, id: idMap.get(row.name) || null }));
    setRoleSummary(merged);

    if (!selectedRoleName && merged.length) setSelectedRoleName(merged[0].name);
  };

  const loadMatrix = async () => {
    const res = await api.get("/v1/permissions-matrix");
    setMatrix(res?.data?.matrix || {});
  };

  const loadRecords = async (filters, page, limit) => {
    setRecordsLoading(true);
    const query = {
      ...filters,
      search: [filters.search, globalSearch].filter(Boolean).join(" ").trim(),
      page,
      limit,
    };
    try {
      const res = await api.get("/v1/permissions-matrix/list", { params: query });
      const payload = res?.data || {};
      setRecordItems(Array.isArray(payload.items) ? payload.items : []);
      setRecordTotal(Number(payload.total || 0));
      setRecordTotalPages(Number(payload.total_pages || 1));
      setFilterOptions(payload.filters || { roles: [], modules: [], actions: [] });
      setSelectedRecordIds(new Set());
    } finally {
      setRecordsLoading(false);
    }
  };

  const loadRolePermissions = async (roleName) => {
    if (!roleName) {
      setRolePermissions([]);
      return;
    }
    const res = await api.get("/v1/permissions-matrix/list", {
      params: { role_name: roleName, page: 1, limit: 500, sort_by: "module_name", sort_order: "asc" },
    });
    setRolePermissions(Array.isArray(res?.data?.items) ? res.data.items : []);
  };

  useEffect(() => {
    setInitialLoading(true);
    Promise.all([
      loadRoles(),
      loadMatrix(),
      loadRecords(recordFilters, recordPage, recordLimit),
      loadRolePermissions(selectedRoleName),
    ])
      .catch((error) => setMessage(error?.response?.data?.detail || "Failed to load roles & permissions."))
      .finally(() => setInitialLoading(false));
  }, []);

  useEffect(() => {
    if (!message) return;
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, text: message }].slice(-4));
    const timeout = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2600);
    return () => clearTimeout(timeout);
  }, [message]);

  useEffect(() => {
    loadRecords(recordFilters, recordPage, recordLimit).catch((error) => {
      setMessage(error?.response?.data?.detail || "Failed to load permission records.");
    });
  }, [recordFilters, recordPage, recordLimit, globalSearch]);

  useEffect(() => {
    loadRolePermissions(selectedRoleName).catch(() => setRolePermissions([]));
  }, [selectedRoleName]);

  const selectedRole = useMemo(
    () => roleSummary.find((r) => r.name === selectedRoleName) || null,
    [roleSummary, selectedRoleName],
  );

  const filteredRoles = useMemo(() => {
    const needle = [roleSearch, globalSearch].filter(Boolean).join(" ").toLowerCase().trim();
    if (!needle) return roleSummary;
    return roleSummary.filter((role) => role.name.toLowerCase().includes(needle));
  }, [roleSummary, roleSearch, globalSearch]);

  const matrixRows = useMemo(() => {
    const rows = Object.entries(matrix || {}).map(([moduleName, actions]) => ({
      moduleName,
      actions: Object.entries(actions || {}).map(([actionName, roleNames]) => ({
        actionName,
        roleNames: Array.isArray(roleNames) ? roleNames : [],
      })),
    }));

    const needle = [matrixSearch, globalSearch].filter(Boolean).join(" ").toLowerCase().trim();
    if (!needle) return rows;

    return rows
      .map((row) => ({
        ...row,
        actions: row.actions.filter((a) =>
          [row.moduleName, a.actionName, ...(a.roleNames || [])].join(" ").toLowerCase().includes(needle),
        ),
      }))
      .filter((row) => row.actions.length > 0 || row.moduleName.toLowerCase().includes(needle));
  }, [matrix, matrixSearch, globalSearch]);

  const moduleOptions = useMemo(() => {
    return Array.from(new Set([...Object.keys(matrix || {}), ...(filterOptions.modules || [])])).sort();
  }, [matrix, filterOptions.modules]);

  const availableActionsForModule = useMemo(() => {
    const moduleName = assignmentForm.module_name;
    const moduleActions = moduleName ? Object.keys(matrix[moduleName] || {}) : [];
    return Array.from(new Set([...moduleActions, ...DEFAULT_ACTIONS])).sort();
  }, [assignmentForm.module_name, matrix]);
  const actionOptions = useMemo(() => {
    return Array.from(new Set([...(filterOptions.actions || []), ...DEFAULT_ACTIONS])).sort();
  }, [filterOptions.actions]);

  const selectedRows = useMemo(
    () => recordItems.filter((row) => selectedRecordIds.has(row.id)),
    [recordItems, selectedRecordIds],
  );

  const groupedRolePermissions = useMemo(() => {
    const grouped = rolePermissions.reduce((acc, item) => {
      const key = item.module_name || "unknown";
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {});
    return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));
  }, [rolePermissions]);

  const modalRolePermissions = useMemo(() => {
    if (!detailsModalRole?.name) return [];
    return rolePermissions.filter((p) => p.role_name === detailsModalRole.name);
  }, [rolePermissions, detailsModalRole]);
  const groupedModalRolePermissions = useMemo(() => {
    const grouped = modalRolePermissions.reduce((acc, item) => {
      const key = item.module_name || "unknown";
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {});
    return Object.entries(grouped)
      .map(([moduleName, items]) => ({
        moduleName,
        items: [...items].sort((a, b) => (a.action_name || "").localeCompare(b.action_name || "")),
      }))
      .sort((a, b) => a.moduleName.localeCompare(b.moduleName));
  }, [modalRolePermissions]);
  const modalRoleModuleOptions = useMemo(() => {
    const roleName = detailsModalRole?.name;
    const roleModules = [];
    if (roleName) {
      matrixRows.forEach((row) => {
        const hasRole = row.actions.some((actionRow) => (actionRow.roleNames || []).includes(roleName));
        if (hasRole) roleModules.push(row.moduleName);
      });
    }
    const allModules = Array.from(new Set([...(moduleOptions || []), ...matrixRows.map((row) => row.moduleName)]));
    const preferred = Array.from(new Set(roleModules)).sort();
    const rest = allModules.filter((moduleName) => !preferred.includes(moduleName)).sort();
    return [...preferred, ...rest];
  }, [detailsModalRole, matrixRows, moduleOptions]);

  const modalRoleActionOptions = useMemo(() => {
    const moduleName = (detailsPermissionForm.module_name || "").trim().toLowerCase();
    if (!moduleName) return [];
    const row = matrixRows.find((item) => String(item.moduleName || "").trim().toLowerCase() === moduleName);
    const actions = row ? row.actions.map((actionRow) => actionRow.actionName) : [];
    if (actions.length > 0) {
      return Array.from(new Set(actions)).sort();
    }
    return [...DEFAULT_ACTIONS];
  }, [detailsPermissionForm.module_name, matrixRows]);

  const accessOverviewRows = useMemo(() => {
    return groupedRolePermissions
      .map(([moduleName, items]) => ({
        moduleName,
        actions: Array.from(new Set(items.map((item) => item.action_name))).sort(),
      }))
      .sort((a, b) => a.moduleName.localeCompare(b.moduleName));
  }, [groupedRolePermissions]);

  const matrixGridRows = useMemo(() => {
    return matrixRows.map((row) => {
      const actionMap = {};
      row.actions.forEach((a) => {
        actionMap[a.actionName] = a.roleNames || [];
      });
      return {
        moduleName: row.moduleName,
        canCreate: (actionMap.create || []).includes(selectedRoleName),
        canView: (actionMap.view || []).includes(selectedRoleName),
        canUpdate: (actionMap.update || []).includes(selectedRoleName),
        canDelete: (actionMap.delete || []).includes(selectedRoleName),
      };
    });
  }, [matrixRows, selectedRoleName]);
  const matrixRoleColumns = useMemo(() => {
    const fromSummary = (roleSummary || []).map((r) => r.name).filter(Boolean);
    const fromMatrix = new Set();
    matrixRows.forEach((row) => {
      row.actions.forEach((actionRow) => {
        (actionRow.roleNames || []).forEach((roleName) => fromMatrix.add(roleName));
      });
    });
    return Array.from(new Set([...fromSummary, ...Array.from(fromMatrix)])).sort((a, b) => a.localeCompare(b));
  }, [roleSummary, matrixRows]);

  const matrixRoleGridRows = useMemo(() => {
    return matrixRows.map((row) => {
      const roleActionMap = {};
      matrixRoleColumns.forEach((roleName) => {
        roleActionMap[roleName] = [];
      });

      row.actions.forEach((actionRow) => {
        (actionRow.roleNames || []).forEach((roleName) => {
          if (!roleActionMap[roleName]) roleActionMap[roleName] = [];
          roleActionMap[roleName].push(actionRow.actionName);
        });
      });

      Object.keys(roleActionMap).forEach((roleName) => {
        roleActionMap[roleName] = Array.from(new Set(roleActionMap[roleName])).sort();
      });

      return {
        moduleName: row.moduleName,
        roleActionMap,
      };
    });
  }, [matrixRows, matrixRoleColumns]);

  const allAssignmentActionsSelected = availableActionsForModule.every(
    (actionName) => Boolean(assignmentForm.actions[actionName]),
  );

  const onCreateRole = async () => {
    const raw = window.prompt("Create role: enter role name");
    const name = normalizeText(raw).toLowerCase();
    const roleNameError = validateRoleNameInput(name);
    if (roleNameError) {
      setMessage(roleNameError);
      return;
    }
    const duplicateRole = (roleSummary || []).some(
      (role) => normalizeText(role?.name).toLowerCase() === name,
    );
    if (duplicateRole) {
      setMessage("Duplicate Feature name under the same Sub-Category is not allowed.");
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      await api.post("/v1/roles", { name, description: "" });
      setSelectedRoleName(name);
      pushActivity(`Created role '${name}'`);
      await loadRoles();
    } catch (error) {
      setMessage(error?.response?.data?.detail || "Failed to create role.");
    } finally {
      setBusy(false);
    }
  };

  const cloneRolePermissions = async (sourceRole, targetRole) => {
    let page = 1;
    let totalPages = 1;
    while (page <= totalPages) {
      const res = await api.get("/v1/permissions-matrix/list", {
        params: { role_name: sourceRole, page, limit: 500, sort_by: "created_at", sort_order: "asc" },
      });
      const payload = res?.data || {};
      const rows = Array.isArray(payload.items) ? payload.items : [];
      totalPages = Number(payload.total_pages || 1);

      for (const row of rows) {
        try {
          await api.post("/v1/permissions-matrix", {
            role_name: targetRole,
            module_name: row.module_name,
            action_name: row.action_name,
          });
        } catch {
          // ignore duplicate rows
        }
      }
      page += 1;
    }
  };

  const onRoleAction = async (role, action) => {
    if (!role) return;
    setRoleMenuOpen("");
    const resolvedRoleId = role?.id ?? roleIdsByName?.[role?.name];
    const resolvedRole = { ...role, id: resolvedRoleId };

    if (!resolvedRole.id && (action === "edit" || action === "archive" || action === "delete")) {
      setMessage("Role action unavailable: role id not found.");
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      if (action === "edit") {
        const name = normalizeText(window.prompt("Rename role", resolvedRole.name)).toLowerCase();
        const roleNameError = validateRoleNameInput(name);
        if (roleNameError) {
          setMessage(roleNameError);
          return;
        }
        const duplicateRole = (roleSummary || []).some(
          (item) =>
            normalizeText(item?.name).toLowerCase() === name &&
            normalizeText(item?.name).toLowerCase() !== normalizeText(resolvedRole.name).toLowerCase(),
        );
        if (duplicateRole) {
          setMessage("Duplicate Feature name under the same Sub-Category is not allowed.");
          return;
        }
        if (!name || name === resolvedRole.name) return;
        await api.put(`/v1/roles/${resolvedRole.id}`, { name, description: "" });
        setSelectedRoleName(name);
        pushActivity(`Renamed role '${resolvedRole.name}' -> '${name}'`);
      }

      if (action === "duplicate") {
        const duplicateName = normalizeText(
          window.prompt("Duplicate role as", `${resolvedRole.name}_copy`),
        ).toLowerCase();
        const duplicateRoleNameError = validateRoleNameInput(duplicateName);
        if (duplicateRoleNameError) {
          setMessage(duplicateRoleNameError);
          return;
        }
        const duplicateRole = (roleSummary || []).some(
          (item) => normalizeText(item?.name).toLowerCase() === duplicateName,
        );
        if (duplicateRole) {
          setMessage("Duplicate Feature name under the same Sub-Category is not allowed.");
          return;
        }
        await api.post("/v1/roles", { name: duplicateName, description: "" });
        await cloneRolePermissions(resolvedRole.name, duplicateName);
        setSelectedRoleName(duplicateName);
        pushActivity(`Duplicated role '${resolvedRole.name}' into '${duplicateName}'`);
      }

      if (action === "archive") {
        const archivedName = `${resolvedRole.name}_archived_${Date.now().toString().slice(-6)}`;
        await api.put(`/v1/roles/${resolvedRole.id}`, { name: archivedName, description: "" });
        setSelectedRoleName(archivedName);
        pushActivity(`Archived role '${resolvedRole.name}'`);
      }

      if (action === "delete") {
        if (RESERVED.has(resolvedRole.name)) {
          setMessage("Reserved role cannot be deleted.");
          return;
        }
        const ok = window.confirm(`Delete role '${resolvedRole.name}'? This cannot be undone.`);
        if (!ok) return;
        await api.delete(`/v1/roles/${resolvedRole.id}`);
        setSelectedRoleName("");
        pushActivity(`Deleted role '${resolvedRole.name}'`);
      }

      await Promise.all([loadRoles(), loadMatrix(), loadRecords(recordFilters, recordPage, recordLimit)]);
    } catch (error) {
      setMessage(error?.response?.data?.detail || "Role action failed.");
    } finally {
      setBusy(false);
    }
  };

  const onRoleCardClick = (roleName) => {
    setSelectedRoleName(roleName);
    setActiveRoleHoverCard((prev) => (prev === roleName ? "" : roleName));
  };

  const onOpenDetails = (role) => {
    setSelectedRoleName(role.name);
    setActiveRoleHoverCard("");
    setDetailsModalPos({ x: 0, y: 0 });
    setDetailsPermissionForm({ module_name: "", action_name: "" });
    setDetailsCreateError("");
    setDetailsModalRole(role);
    loadRolePermissions(role.name).catch(() => {});
  };

  const onOpenEditRole = (role) => {
    setActiveRoleHoverCard("");
    setEditRoleModal({ open: true, role, name: role?.name || "" });
  };

  const onSaveEditRole = async () => {
    const role = editRoleModal.role;
    if (!role) return;
    const newName = normalizeText(editRoleModal.name).toLowerCase();
    const roleNameError = validateRoleNameInput(newName);
    if (roleNameError) {
      setMessage(roleNameError);
      return;
    }
    const duplicateRole = (roleSummary || []).some(
      (item) =>
        normalizeText(item?.name).toLowerCase() === newName &&
        normalizeText(item?.name).toLowerCase() !== normalizeText(role.name).toLowerCase(),
    );
    if (duplicateRole) {
      setMessage("Duplicate Feature name under the same Sub-Category is not allowed.");
      return;
    }
    if (newName === role.name) {
      setEditRoleModal({ open: false, role: null, name: "" });
      return;
    }

    const resolvedRoleId = role?.id ?? roleIdsByName?.[role?.name];
    if (!resolvedRoleId) {
      setMessage("Cannot edit role: role id not found.");
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      await api.put(`/v1/roles/${resolvedRoleId}`, { name: newName, description: "" });
      setSelectedRoleName(newName);
      setEditRoleModal({ open: false, role: null, name: "" });
      pushActivity(`Renamed role '${role.name}' -> '${newName}'`);
      await Promise.all([loadRoles(), loadMatrix(), loadRecords(recordFilters, recordPage, recordLimit)]);
    } catch (error) {
      setMessage(error?.response?.data?.detail || "Failed to edit role.");
    } finally {
      setBusy(false);
    }
  };

  const onOpenEditPermission = (permission) => {
    setEditPermissionModal({
      open: true,
      id: permission?.id || "",
      role_name: permission?.role_name || selectedRoleName || "",
      module_name: permission?.module_name || "",
      action_name: permission?.action_name || "",
    });
  };

  const onCreatePermissionInDetails = async () => {
    if (!detailsModalRole?.name) return;
    const module_name = (detailsPermissionForm.module_name || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_");
    const action_name = (detailsPermissionForm.action_name || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_");
    if (!module_name || !action_name) {
      setDetailsCreateError("Module and action are required.");
      return;
    }

    setBusy(true);
    setMessage("");
    setDetailsCreateError("");
    try {
      await api.post("/v1/permissions-matrix", {
        role_name: detailsModalRole.name,
        module_name,
        action_name,
      });
      setDetailsPermissionForm({ module_name: "", action_name: "" });
      pushActivity(`Created permission '${detailsModalRole.name} | ${module_name} | ${action_name}'`);
      await Promise.all([
        loadRecords(recordFilters, recordPage, recordLimit),
        loadMatrix(),
        loadRolePermissions(detailsModalRole.name),
        loadRoles(),
      ]);
    } catch (error) {
      const detail = error?.response?.data?.detail || "Failed to create permission.";
      setDetailsCreateError(detail);
      setMessage(detail);
    } finally {
      setBusy(false);
    }
  };

  const onDeletePermissionInDetails = async (permission) => {
    if (!permission?.id) return;
    const ok = window.confirm(
      `Are you sure you want to delete '${permission.module_name} | ${permission.action_name}'?`,
    );
    if (!ok) return;

    setBusy(true);
    setMessage("");
    try {
      await api.delete(`/v1/permissions-matrix/${permission.id}`);
      pushActivity(`Removed permission '${permission.id}'`);
      await Promise.all([
        loadRecords(recordFilters, recordPage, recordLimit),
        loadMatrix(),
        loadRolePermissions(detailsModalRole?.name || selectedRoleName),
        loadRoles(),
      ]);
    } catch (error) {
      setMessage(error?.response?.data?.detail || "Failed to remove permission.");
    } finally {
      setBusy(false);
    }
  };

  const onSaveEditPermission = async () => {
    if (!editPermissionModal.id) return;
    const payload = {
      role_name: (editPermissionModal.role_name || "").trim(),
      module_name: (editPermissionModal.module_name || "").trim(),
      action_name: (editPermissionModal.action_name || "").trim(),
    };

    if (!payload.role_name || !payload.module_name || !payload.action_name) {
      setMessage("Role, module and action are required.");
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      await api.put(`/v1/permissions-matrix/${editPermissionModal.id}`, payload);
      setEditPermissionModal({
        open: false,
        id: "",
        role_name: "",
        module_name: "",
        action_name: "",
      });
      pushActivity(`Edited permission '${payload.role_name} | ${payload.module_name} | ${payload.action_name}'`);
      await Promise.all([
        loadRecords(recordFilters, recordPage, recordLimit),
        loadMatrix(),
        loadRolePermissions(detailsModalRole?.name || selectedRoleName),
        loadRoles(),
      ]);
    } catch (error) {
      setMessage(error?.response?.data?.detail || "Failed to edit permission.");
    } finally {
      setBusy(false);
    }
  };

  const onStartDetailsDrag = (event) => {
    event.preventDefault();
    detailsDragRef.current = {
      originX: detailsModalPos.x,
      originY: detailsModalPos.y,
      startX: event.clientX,
      startY: event.clientY,
    };
    setIsDraggingDetailsModal(true);
  };

  useEffect(() => {
    if (!isDraggingDetailsModal) return;
    const onMouseMove = (event) => {
      const dx = event.clientX - detailsDragRef.current.startX;
      const dy = event.clientY - detailsDragRef.current.startY;
      setDetailsModalPos({
        x: detailsDragRef.current.originX + dx,
        y: detailsDragRef.current.originY + dy,
      });
    };
    const onMouseUp = () => setIsDraggingDetailsModal(false);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [isDraggingDetailsModal]);

  const onAssignmentActionToggle = (actionName, checked) => {
    setAssignmentError("");
    setAssignmentForm((prev) => ({
      ...prev,
      actions: { ...prev.actions, [actionName]: checked },
    }));
  };

  const onAddPermission = async () => {
    setAssignmentError("");
    if (!selectedRoleName) {
      setAssignmentError("Select a role first.");
      return;
    }
    const moduleName = assignmentForm.module_name.trim().toLowerCase().replace(/\s+/g, "_");
    const enabledActions = Object.entries(assignmentForm.actions)
      .filter(([, checked]) => checked)
      .map(([action]) => action.toLowerCase().replace(/\s+/g, "_"));

    if (!moduleName || enabledActions.length === 0) {
      setAssignmentError("Select module and at least one action.");
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      for (const actionName of enabledActions) {
        try {
          await api.post("/v1/permissions-matrix", {
            role_name: selectedRoleName,
            module_name: moduleName,
            action_name: actionName,
          });
        } catch {
          // ignore duplicate
        }
      }
      pushActivity(`Assigned ${enabledActions.length} permission(s) to '${selectedRoleName}' on '${moduleName}'`);
      setAssignmentForm({ module_name: moduleName, actions: {} });
      await Promise.all([
        loadRecords(recordFilters, recordPage, recordLimit),
        loadMatrix(),
        loadRolePermissions(selectedRoleName),
        loadRoles(),
      ]);
    } catch (error) {
      setMessage(error?.response?.data?.detail || "Failed to add permission.");
    } finally {
      setBusy(false);
    }
  };

  const onQuickRemovePermission = async (permissionId) => {
    setBusy(true);
    setMessage("");
    try {
      await api.delete(`/v1/permissions-matrix/${permissionId}`);
      pushActivity(`Removed permission '${permissionId}'`);
      await Promise.all([
        loadRecords(recordFilters, recordPage, recordLimit),
        loadMatrix(),
        loadRolePermissions(selectedRoleName),
        loadRoles(),
      ]);
    } catch (error) {
      setMessage(error?.response?.data?.detail || "Failed to remove permission.");
    } finally {
      setBusy(false);
    }
  };

  const onApplyFilters = () => {
    setRecordPage(1);
    setRecordFilters({ ...filterDraft });
  };

  const onResetFilters = () => {
    setFilterDraft(defaultRecordFilters);
    setRecordFilters(defaultRecordFilters);
    setRecordPage(1);
  };

  const onToggleSelectAllVisible = (checked) => {
    if (checked) {
      setSelectedRecordIds(new Set(recordItems.map((row) => row.id)));
      return;
    }
    setSelectedRecordIds(new Set());
  };

  const onToggleSelectRow = (rowId, checked) => {
    setSelectedRecordIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(rowId);
      else next.delete(rowId);
      return next;
    });
  };

  const onBulkRemove = async () => {
    if (!selectedRows.length) return;
    const ok = window.confirm(`Remove ${selectedRows.length} permission record(s)?`);
    if (!ok) return;

    setBusy(true);
    setMessage("");
    try {
      await api.post("/v1/permissions-matrix/bulk-delete", { ids: selectedRows.map((row) => row.id) });
      pushActivity(`Bulk removed ${selectedRows.length} permission(s)`);
      await Promise.all([
        loadRecords(recordFilters, recordPage, recordLimit),
        loadMatrix(),
        loadRolePermissions(selectedRoleName),
        loadRoles(),
      ]);
    } catch (error) {
      setMessage(error?.response?.data?.detail || "Bulk remove failed.");
    } finally {
      setBusy(false);
    }
  };

  const onBulkLock = async (lock) => {
    if (!selectedRows.length) return;
    setBusy(true);
    setMessage("");
    try {
      await api.post("/v1/permissions-matrix/bulk-lock", {
        ids: selectedRows.map((row) => row.id),
        lock,
      });
      pushActivity(`${lock ? "Locked" : "Unlocked"} ${selectedRows.length} permission(s)`);
      await loadRecords(recordFilters, recordPage, recordLimit);
    } catch (error) {
      setMessage(error?.response?.data?.detail || "Bulk lock action failed.");
    } finally {
      setBusy(false);
    }
  };

  const onBulkEdit = async () => {
    if (!selectedRows.length) return;
    const newAction = (window.prompt("Bulk edit action name (e.g., view/update/delete)") || "").trim();
    if (!newAction) return;

    setBusy(true);
    setMessage("");
    try {
      for (const row of selectedRows) {
        await api.put(`/v1/permissions-matrix/${row.id}`, {
          role_name: row.role_name,
          module_name: row.module_name,
          action_name: newAction,
        });
      }
      pushActivity(`Bulk edited ${selectedRows.length} permission(s) to action '${newAction}'`);
      await Promise.all([
        loadRecords(recordFilters, recordPage, recordLimit),
        loadMatrix(),
        loadRolePermissions(selectedRoleName),
      ]);
    } catch (error) {
      setMessage(error?.response?.data?.detail || "Bulk edit failed.");
    } finally {
      setBusy(false);
    }
  };

  const onExportCurrent = async () => {
    setBusy(true);
    setMessage("");
    try {
      const query = {
        ...recordFilters,
        search: [recordFilters.search, globalSearch].filter(Boolean).join(" ").trim(),
      };
      const res = await api.get("/v1/permissions-matrix/export", { params: query, responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = "permissions_export.csv";
      a.click();
      URL.revokeObjectURL(url);
      pushActivity("Exported filtered permission records");
    } catch (error) {
      setMessage(error?.response?.data?.detail || "Export failed.");
    } finally {
      setBusy(false);
    }
  };

  const onExportSelected = () => {
    if (!selectedRows.length) return;
    const lines = ["id,role_name,module_name,action_name,status,last_updated"];
    selectedRows.forEach((row) => {
      lines.push(
        [row.id, row.role_name, row.module_name, row.action_name, row.status, row.updated_at]
          .map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`)
          .join(","),
      );
    });
    downloadTextFile("permissions_selected.csv", lines.join("\n"), "text/csv");
    pushActivity(`Exported ${selectedRows.length} selected permission(s)`);
  };

  const onRowAction = async (row, action) => {
    setRowMenuOpen("");

    if (action === "history") {
      try {
        const res = await api.get(`/v1/permissions-matrix/history/${row.id}`);
        setHistoryPreview(res?.data || null);
      } catch {
        setHistoryPreview({ permission_id: row.id, events: [] });
      }
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      if (action === "edit") {
        const roleName = (window.prompt("Role", row.role_name) || "").trim();
        const moduleName = (window.prompt("Module", row.module_name) || "").trim();
        const actionName = (window.prompt("Action", row.action_name) || "").trim();
        if (!roleName || !moduleName || !actionName) return;
        await api.put(`/v1/permissions-matrix/${row.id}`, {
          role_name: roleName,
          module_name: moduleName,
          action_name: actionName,
        });
        pushActivity(`Edited permission '${row.id}'`);
      }

      if (action === "remove") {
        const ok = window.confirm("Remove this permission?");
        if (!ok) return;
        await api.delete(`/v1/permissions-matrix/${row.id}`);
        pushActivity(`Removed permission '${row.id}'`);
      }

      if (action === "clone") {
        const targetRole = (window.prompt("Clone to role", row.role_name) || "").trim();
        if (!targetRole) return;
        await api.post("/v1/permissions-matrix", {
          role_name: targetRole,
          module_name: row.module_name,
          action_name: row.action_name,
        });
        pushActivity(`Cloned permission '${row.id}' to role '${targetRole}'`);
      }

      await Promise.all([
        loadRecords(recordFilters, recordPage, recordLimit),
        loadMatrix(),
        loadRolePermissions(selectedRoleName),
        loadRoles(),
      ]);
    } catch (error) {
      setMessage(error?.response?.data?.detail || "Permission action failed.");
    } finally {
      setBusy(false);
    }
  };

  const onImportPermissions = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (lines.length <= 1) {
      setMessage("CSV has no permission rows.");
      return;
    }

    const header = lines[0].toLowerCase();
    const hasHeader = header.includes("role") && header.includes("module") && header.includes("action");
    const dataLines = hasHeader ? lines.slice(1) : lines;

    setBusy(true);
    setMessage("");
    try {
      let imported = 0;
      for (const line of dataLines) {
        const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
        const role_name = cols[0];
        const module_name = cols[1];
        const action_name = cols[2];
        if (!role_name || !module_name || !action_name) continue;
        try {
          await api.post("/v1/permissions-matrix", { role_name, module_name, action_name });
          imported += 1;
        } catch {
          // skip invalid rows
        }
      }

      pushActivity(`Imported ${imported} permission(s) from CSV`);
      setMessage(`Import completed. Added ${imported} permission(s).`);
      await Promise.all([
        loadRecords(recordFilters, recordPage, recordLimit),
        loadMatrix(),
        loadRolePermissions(selectedRoleName),
        loadRoles(),
      ]);
    } catch (error) {
      setMessage(error?.response?.data?.detail || "Import failed.");
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  };

  const allVisibleSelected = recordItems.length > 0 && recordItems.every((row) => selectedRecordIds.has(row.id));
  const searchInputClass =
    "w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2.5 pl-10 pr-10 text-sm text-slate-800 shadow-sm outline-none transition focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-100";

  return (
    <div className="space-y-4 bg-slate-50/60 p-1">
      <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Roles &amp; Permissions</h1>
            <p className="text-sm text-slate-500">Manage role access and system security</p>
          </div>

          <div className="flex w-full flex-col gap-2 xl:w-auto xl:min-w-[560px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                placeholder="Search roles, modules, permissions"
                className={searchInputClass}
                aria-label="Global search"
              />
              {globalSearch && (
                <button
                  type="button"
                  onClick={() => setGlobalSearch("")}
                  className="absolute right-2 top-2 rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Clear global search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setMatrixView("grid");
                  setSystemOverviewModalOpen(true);
                }}
                className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <Shield className="h-4 w-4" />
                System Access Overview
              </button>
              <button type="button" onClick={onCreateRole} disabled={busy} className="inline-flex items-center gap-2 rounded-md bg-violet-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:opacity-60"><Plus className="h-4 w-4" />Create Role</button>
              <button type="button" onClick={onExportCurrent} disabled={busy} className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"><Download className="h-4 w-4" />Export</button>
              <button type="button" onClick={() => importInputRef.current?.click()} disabled={busy} className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"><Import className="h-4 w-4" />Import Permissions</button>
              <input ref={importInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onImportPermissions} />
            </div>
          </div>
        </div>
      </div>

      <div className="fixed right-6 top-6 z-50 space-y-2">
        {toasts.map((toast) => (
          <div key={toast.id} className="rounded-lg bg-slate-900/95 px-3 py-2 text-sm text-white shadow-lg transition-all">
            {toast.text}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4">
        <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">Role Management</h3>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">{filteredRoles.length}</span>
          </div>

          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input value={roleSearch} onChange={(e) => setRoleSearch(e.target.value)} placeholder="Search role" className={searchInputClass} />
            {roleSearch && (
              <button
                type="button"
                onClick={() => setRoleSearch("")}
                className="absolute right-2 top-2 rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Clear role search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="max-h-[640px] space-y-2 overflow-auto pr-1">
            {initialLoading && (
              <>
                <div className="h-20 animate-pulse rounded-lg bg-slate-100" />
                <div className="h-20 animate-pulse rounded-lg bg-slate-100" />
                <div className="h-20 animate-pulse rounded-lg bg-slate-100" />
              </>
            )}
            {!initialLoading && filteredRoles.map((role) => {
              const isActive = role.name === selectedRoleName;
              const protectedRole = RESERVED.has(role.name);
              const isArchived = String(role.name || "").includes("_archived_");
              return (
                <div key={role.name} title={ROLE_DESCRIPTIONS[role.name] || "Custom role"} className={`relative rounded-lg p-3 shadow-sm ring-1 transition hover:-translate-y-0.5 hover:shadow ${isActive ? "bg-violet-50 ring-violet-300" : "bg-white ring-slate-200"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <button type="button" onClick={() => onRoleCardClick(role.name)} className="flex-1 text-left">
                      <div className="flex items-center gap-2">
                        <Shield className={`h-4 w-4 ${protectedRole ? "text-amber-600" : "text-violet-600"}`} />
                        <p className="text-sm font-semibold text-slate-900">{role.name}</p>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">{role.permissions_count || 0}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${isArchived ? "bg-slate-100 text-slate-600 ring-1 ring-slate-200" : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"}`}>
                          {isArchived ? "archived" : "active"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">Modified: {formatDate(role.last_modified)}</p>
                    </button>

                    <div className="relative">
                      <button type="button" onClick={() => setRoleMenuOpen((prev) => (prev === role.name ? "" : role.name))} className="rounded-md border border-slate-200 p-1 text-slate-600" aria-label={`Actions for ${role.name}`}><MoreVertical className="h-4 w-4" /></button>
                      {roleMenuOpen === role.name && (
                        <div className="absolute right-0 z-20 mt-1 w-36 rounded-md border border-slate-200 bg-white p-1 shadow-lg">
                          <button type="button" onClick={() => onRoleAction(role, "edit")} className="w-full rounded px-2 py-1 text-left text-xs hover:bg-slate-100">Edit</button>
                          <button type="button" onClick={() => onRoleAction(role, "duplicate")} className="w-full rounded px-2 py-1 text-left text-xs hover:bg-slate-100">Duplicate</button>
                          <button type="button" onClick={() => onRoleAction(role, "archive")} className="w-full rounded px-2 py-1 text-left text-xs hover:bg-slate-100">Archive</button>
                          <button type="button" onClick={() => onRoleAction(role, "delete")} className="w-full rounded px-2 py-1 text-left text-xs text-red-700 hover:bg-red-50">Delete</button>
                        </div>
                      )}
                    </div>
                  </div>

                  {activeRoleHoverCard === role.name && (
                    <div className="mt-3 rounded-xl bg-gradient-to-br from-violet-50 via-white to-slate-50 p-3 shadow-lg ring-1 ring-violet-200 transition-all duration-200">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Quick Actions</p>
                        <button
                          type="button"
                          onClick={() => setActiveRoleHoverCard("")}
                          className="rounded-md px-2 py-0.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                        >
                          Close
                        </button>
                      </div>

                      <p className="text-xs text-slate-600">
                        {ROLE_DESCRIPTIONS[role.name] || "Custom role with configurable access."}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Permissions: {role.permissions_count || 0} | Updated: {formatDate(role.last_modified)}
                      </p>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => onOpenDetails(role)}
                          className="rounded-md bg-violet-600 px-2 py-1 text-xs font-semibold text-white hover:bg-violet-700"
                        >
                          View Details
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenEditRole(role)}
                          className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => onRoleAction(role, "duplicate")}
                          className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                        >
                          Duplicate
                        </button>
                        <button
                          type="button"
                          onClick={() => onRoleAction(role, "archive")}
                          className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                        >
                          Archive
                        </button>
                        <button
                          type="button"
                          onClick={() => onRoleAction(role, "delete")}
                          className="rounded-md bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 ring-1 ring-red-200 hover:bg-red-100"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">Permission Table</h3>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">{recordTotal}</span>
          </div>

          <div className="rounded-lg p-3 ring-1 ring-slate-200">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
              <div className="relative xl:col-span-2">
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input value={filterDraft.search} onChange={(e) => setFilterDraft((prev) => ({ ...prev, search: e.target.value }))} placeholder="Search module, role, action" className={searchInputClass} />
                {filterDraft.search && (
                  <button
                    type="button"
                    onClick={() => setFilterDraft((prev) => ({ ...prev, search: "" }))}
                    className="absolute right-2 top-2 rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                    aria-label="Clear permission table search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <select value={filterDraft.role_name} onChange={(e) => setFilterDraft((prev) => ({ ...prev, role_name: e.target.value }))} className="rounded-md border border-slate-200 px-3 py-2 text-sm"><option value="">All roles</option>{(filterOptions.roles || []).map((value) => <option key={value} value={value}>{value}</option>)}</select>
              <select value={filterDraft.module_name} onChange={(e) => setFilterDraft((prev) => ({ ...prev, module_name: e.target.value }))} className="rounded-md border border-slate-200 px-3 py-2 text-sm"><option value="">All modules</option>{(filterOptions.modules || []).map((value) => <option key={value} value={value}>{getModuleLabel(value)}</option>)}</select>
              <select value={filterDraft.action_name} onChange={(e) => setFilterDraft((prev) => ({ ...prev, action_name: e.target.value }))} className="rounded-md border border-slate-200 px-3 py-2 text-sm"><option value="">All actions</option>{(filterOptions.actions || []).map((value) => <option key={value} value={value}>{getActionLabel(value)}</option>)}</select>
              <input type="datetime-local" value={filterDraft.date_from} onChange={(e) => setFilterDraft((prev) => ({ ...prev, date_from: e.target.value }))} className="rounded-md border border-slate-200 px-3 py-2 text-sm" />
              <input type="datetime-local" value={filterDraft.date_to} onChange={(e) => setFilterDraft((prev) => ({ ...prev, date_to: e.target.value }))} className="rounded-md border border-slate-200 px-3 py-2 text-sm" />
              <select value={`${filterDraft.sort_by}:${filterDraft.sort_order}`} onChange={(e) => { const [sort_by, sort_order] = e.target.value.split(":"); setFilterDraft((prev) => ({ ...prev, sort_by, sort_order })); }} className="rounded-md border border-slate-200 px-3 py-2 text-sm"><option value="created_at:desc">Newest first</option><option value="created_at:asc">Oldest first</option><option value="role_name:asc">Role A-Z</option><option value="module_name:asc">Module A-Z</option><option value="action_name:asc">Action A-Z</option></select>
            </div>

            <div className="mt-2 flex flex-wrap justify-end gap-2">
              <button type="button" onClick={onResetFilters} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700">Reset Filters</button>
              <button type="button" onClick={onApplyFilters} className="inline-flex items-center gap-2 rounded-md bg-violet-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-violet-700"><Filter className="h-4 w-4" />Apply Filters</button>
            </div>
          </div>

          {selectedRows.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-indigo-200 bg-indigo-50 p-2">
              <p className="text-sm font-semibold text-indigo-900">{selectedRows.length} selected</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={onBulkEdit} disabled={busy} className="rounded bg-white px-2 py-1 text-xs font-semibold text-slate-700 disabled:opacity-60">Bulk Edit</button>
                <button type="button" onClick={onBulkRemove} disabled={busy} className="inline-flex items-center gap-1 rounded bg-red-100 px-2 py-1 text-xs font-semibold text-red-700 disabled:opacity-60"><Trash2 className="h-3 w-3" />Bulk Remove</button>
                <button type="button" onClick={onExportSelected} className="rounded bg-white px-2 py-1 text-xs font-semibold text-slate-700">Export Selected</button>
                <button type="button" onClick={() => onBulkLock(true)} disabled={busy} className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700 disabled:opacity-60"><Lock className="h-3 w-3" />Lock Permissions</button>
                <button type="button" onClick={() => onBulkLock(false)} disabled={busy} className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700 disabled:opacity-60"><Unlock className="h-3 w-3" />Unlock</button>
              </div>
            </div>
          )}

          <div className="mt-3 max-h-[520px] overflow-x-auto overflow-y-auto rounded-lg ring-1 ring-slate-200">
            <table className="min-w-[980px] text-left text-sm">
              <thead className="sticky top-0 bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-3 py-2"><input type="checkbox" checked={allVisibleSelected} onChange={(e) => onToggleSelectAllVisible(e.target.checked)} /></th>
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2">Module</th>
                  <th className="px-3 py-2">Action</th>
                  <th className="px-3 py-2">Assigned By</th>
                  <th className="px-3 py-2">Last Updated</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {recordsLoading && (
                  <>
                    <tr><td colSpan={8} className="px-3 py-3"><div className="h-8 animate-pulse rounded bg-slate-100" /></td></tr>
                    <tr><td colSpan={8} className="px-3 py-3"><div className="h-8 animate-pulse rounded bg-slate-100" /></td></tr>
                    <tr><td colSpan={8} className="px-3 py-3"><div className="h-8 animate-pulse rounded bg-slate-100" /></td></tr>
                  </>
                )}
                {!recordsLoading && recordItems.map((row, idx) => (
                  <tr key={row.id} className={`border-t border-slate-200 text-slate-800 transition hover:bg-violet-50 ${idx % 2 ? "bg-white" : "bg-slate-50/60"}`}>
                    <td className="px-3 py-2"><input type="checkbox" checked={selectedRecordIds.has(row.id)} onChange={(e) => onToggleSelectRow(row.id, e.target.checked)} /></td>
                    <td className="px-3 py-2 font-medium">{row.role_name}</td>
                    <td className="px-3 py-2">{getModuleLabel(row.module_name)}</td>
                    <td className="px-3 py-2">{getActionLabel(row.action_name)}</td>
                    <td className="px-3 py-2">{row.assigned_by || "system"}</td>
                    <td className="px-3 py-2">{formatDate(row.updated_at || row.created_at)}</td>
                    <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${row.status === "locked" ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200" : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"}`}>{row.status || "active"}</span></td>
                    <td className="px-3 py-2">
                      <div className="relative">
                        <button type="button" onClick={() => setRowMenuOpen((prev) => (prev === row.id ? "" : row.id))} className="rounded-md border border-slate-200 p-1 text-slate-600" aria-label={`Actions for permission ${row.id}`}><MoreVertical className="h-4 w-4" /></button>
                        {rowMenuOpen === row.id && (
                          <div className="absolute right-0 z-30 mt-1 w-40 rounded-md border border-slate-200 bg-white p-1 shadow-lg">
                            <button type="button" onClick={() => onRowAction(row, "edit")} className="w-full rounded px-2 py-1 text-left text-xs hover:bg-slate-100">Edit permission</button>
                            <button type="button" onClick={() => onRowAction(row, "remove")} className="w-full rounded px-2 py-1 text-left text-xs text-red-700 hover:bg-red-50">Remove permission</button>
                            <button type="button" onClick={() => onRowAction(row, "history")} className="w-full rounded px-2 py-1 text-left text-xs hover:bg-slate-100">View audit history</button>
                            <button type="button" onClick={() => onRowAction(row, "clone")} className="w-full rounded px-2 py-1 text-left text-xs hover:bg-slate-100">Clone permission</button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!recordsLoading && recordItems.length === 0 && <tr><td colSpan={8} className="px-3 py-8 text-center text-sm text-slate-500">No permission records found.</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate-600">Showing {(recordPage - 1) * recordLimit + 1}-{Math.min(recordPage * recordLimit, recordTotal)} of {recordTotal}</p>
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-600">Page size</label>
              <select value={recordLimit} onChange={(e) => { setRecordLimit(Number(e.target.value)); setRecordPage(1); }} className="rounded border border-slate-300 px-2 py-1 text-sm">{PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}</select>
              <button type="button" onClick={() => setRecordPage((p) => Math.max(1, p - 1))} disabled={recordPage <= 1} className="rounded border border-slate-300 px-2 py-1 text-sm disabled:opacity-40">Prev</button>
              <span className="text-sm text-slate-700">Page {recordPage} / {recordTotalPages}</span>
              <button type="button" onClick={() => setRecordPage((p) => Math.min(recordTotalPages, p + 1))} disabled={recordPage >= recordTotalPages} className="rounded border border-slate-300 px-2 py-1 text-sm disabled:opacity-40">Next</button>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-md border border-slate-200 p-3">
              <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Audit Log</p>
              <div className="max-h-36 space-y-1 overflow-auto">
                {activityLog.map((item, idx) => <p key={`${item.at}-${idx}`} className="text-xs text-slate-600">{formatDate(item.at)} - {item.text}</p>)}
                {activityLog.length === 0 && <p className="text-xs text-slate-500">No recent activity.</p>}
              </div>
            </div>

            <div className="rounded-md border border-slate-200 p-3">
              <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Permission History</p>
              {!historyPreview && <p className="text-xs text-slate-500">Select a row action: View audit history.</p>}
              {historyPreview && (
                <div className="max-h-36 space-y-1 overflow-auto">
                  {(historyPreview.events || []).map((event, idx) => <p key={`${event.at}-${idx}`} className="text-xs text-slate-600">{formatDate(event.at)} - {event.event} by {event.by}</p>)}
                  {(!historyPreview.events || historyPreview.events.length === 0) && <p className="text-xs text-slate-500">No audit events found.</p>}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      {systemOverviewModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/45 p-4">
          <div className="flex min-h-full items-start justify-center py-6">
            <div className="flex h-[88vh] w-full max-w-6xl flex-col rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-violet-200">
              <div className="mb-4 flex items-start justify-between rounded-lg bg-slate-50 px-3 py-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">System Access</p>
                  <h3 className="text-2xl font-bold text-slate-900">Role Permission Matrix</h3>
                  <p className="text-sm text-slate-600">System-wide RBAC configuration.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSystemOverviewModalOpen(false)}
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Close
                </button>
              </div>

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setMatrixView("list")} className={`rounded px-3 py-1.5 text-sm ${matrixView === "list" ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-700"}`}>List</button>
                    <button type="button" onClick={() => setMatrixView("grid")} className={`rounded px-3 py-1.5 text-sm ${matrixView === "grid" ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-700"}`}>Grid</button>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const all = {};
                        matrixRows.forEach((row) => {
                          all[row.moduleName] = true;
                        });
                        setCollapsedModules(all);
                      }}
                      className="rounded bg-slate-100 px-3 py-1.5 text-sm text-slate-700"
                    >
                      Collapse All
                    </button>
                    <button type="button" onClick={() => setCollapsedModules({})} className="rounded bg-slate-100 px-3 py-1.5 text-sm text-slate-700">
                      Expand All
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <input value={matrixSearch} onChange={(e) => setMatrixSearch(e.target.value)} placeholder="Search inside matrix" className={searchInputClass} />
                  {matrixSearch && (
                    <button
                      type="button"
                      onClick={() => setMatrixSearch("")}
                      className="absolute right-2 top-2 rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                      aria-label="Clear matrix search"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  {matrixView === "list" &&
                    matrixRows.map((row) => {
                      const collapsed = Boolean(collapsedModules[row.moduleName]);
                      return (
                        <div key={row.moduleName} className="rounded border border-slate-200 p-2">
                          <button type="button" onClick={() => setCollapsedModules((prev) => ({ ...prev, [row.moduleName]: !prev[row.moduleName] }))} className="flex w-full items-center justify-between text-left">
                            <span className="inline-flex items-center gap-1 text-sm font-semibold text-slate-800">
                              {CRITICAL_MODULES.has(row.moduleName) && <Lock className="h-3.5 w-3.5 text-amber-600" />}
                              {getModuleLabel(row.moduleName)}
                            </span>
                            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                          {!collapsed && (
                            <div className="mt-2 space-y-1">
                              {row.actions.map((actionRow) => (
                                <div key={`${row.moduleName}-${actionRow.actionName}`} className="text-sm text-slate-600">
                                  <span className="font-semibold text-slate-700">{getActionLabel(actionRow.actionName)}</span>
                                  {" : "}
                                  {actionRow.roleNames.length ? actionRow.roleNames.map(getRoleLabel).join(", ") : "No role"}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}

                  {matrixView === "grid" && (
                    <div className="overflow-auto rounded-md ring-1 ring-slate-200">
                      <table className="min-w-full text-sm">
                        <thead className="bg-slate-100 text-slate-700">
                          <tr>
                            <th className="sticky left-0 z-10 min-w-[200px] bg-slate-100 px-3 py-2 text-left font-semibold">Module</th>
                            {matrixRoleColumns.map((roleName) => (
                              <th key={`col-${roleName}`} className="min-w-[140px] px-3 py-2 text-left font-semibold">
                                {getRoleLabel(roleName)}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {matrixRoleGridRows.map((row, idx) => (
                            <tr key={row.moduleName} className={idx % 2 ? "bg-white" : "bg-slate-50"}>
                              <td className="sticky left-0 z-10 bg-inherit px-3 py-2 font-semibold text-slate-800">{getModuleLabel(row.moduleName)}</td>
                              {matrixRoleColumns.map((roleName) => {
                                const actions = row.roleActionMap[roleName] || [];
                                return (
                                  <td key={`${row.moduleName}-${roleName}`} className="px-3 py-2 align-top text-slate-700">
                                    {actions.length ? actions.map(getActionLabel).join(", ") : <span className="text-slate-300">-</span>}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {detailsModalRole && (
        <div className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-slate-900/45 p-4">
          <div className="flex min-h-full items-start justify-center py-6">
          <div
            style={{ transform: `translate(${detailsModalPos.x}px, ${detailsModalPos.y}px)` }}
            className="flex h-[88vh] w-full max-w-5xl flex-col rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-violet-200 transition-transform"
          >
            <div
              onMouseDown={onStartDetailsDrag}
              className="mb-4 flex cursor-move items-start justify-between rounded-lg bg-slate-50 px-2 py-2"
            >
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Role Details</p>
                <h3 className="text-2xl font-bold text-slate-900">{detailsModalRole.name}</h3>
                <p className="text-sm text-slate-600">
                  Permissions: {detailsModalRole.permissions_count || 0} | Last modified: {formatDate(detailsModalRole.last_modified)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDetailsModalPos({ x: 0, y: 0 })}
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Reset Position
                </button>
                <button
                  type="button"
                  onClick={() => setDetailsModalRole(null)}
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pr-1" onWheel={(e) => e.stopPropagation()}>
              <div className="rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Create Permission</p>
                <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-[1fr_1fr_auto]">
                  <input
                    value={detailsPermissionForm.module_name}
                    onChange={(e) =>
                      setDetailsPermissionForm((prev) => ({ ...prev, module_name: e.target.value, action_name: "" }))
                    }
                    list="details-module-options"
                    placeholder="Module"
                    className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                  />
                  <input
                    value={detailsPermissionForm.action_name}
                    onChange={(e) =>
                      setDetailsPermissionForm((prev) => ({ ...prev, action_name: e.target.value }))
                    }
                    list={modalRoleActionOptions.length > 0 ? "details-action-options" : "action-options"}
                    placeholder={detailsPermissionForm.module_name?.trim() ? "Action" : "Select module first"}
                    disabled={!detailsPermissionForm.module_name?.trim()}
                    className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={onCreatePermissionInDetails}
                    disabled={busy}
                    className="rounded-md bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
                  >
                    Create
                  </button>
                </div>
                {detailsCreateError && (
                  <p className="mt-2 text-xs font-semibold text-red-600">{detailsCreateError}</p>
                )}
                <datalist id="details-module-options">
                  {(modalRoleModuleOptions.length ? modalRoleModuleOptions : moduleOptions).map((moduleName) => (
                    <option key={`details-module-${moduleName}`} value={moduleName} />
                  ))}
                </datalist>
                <datalist id="details-action-options">
                  {modalRoleActionOptions.map((actionName) => (
                    <option key={`details-action-${actionName}`} value={actionName} />
                  ))}
                </datalist>
              </div>

              <div className="rounded-lg bg-white p-3 ring-1 ring-slate-200">
                <p className="mb-2 text-sm font-semibold text-slate-900">Role Permissions</p>
                <div className="space-y-2">
                  {groupedModalRolePermissions.map((group) => (
                    <div key={group.moduleName} className="rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200">
                      <div>
                        <p className="text-base font-semibold text-slate-900">{getModuleLabel(group.moduleName)}</p>
                        <p className="text-xs text-slate-500">{group.items.length} permissions</p>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {group.items.map((permission) => (
                          <div
                            key={permission.id}
                            className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-sm ring-1 ring-slate-200"
                          >
                            <span className="font-medium text-slate-800">{getActionChipLabel(permission.action_name)}</span>
                            <button
                              type="button"
                              onClick={() => onOpenEditPermission(permission)}
                              className="rounded p-1 text-violet-700 transition hover:bg-violet-100"
                              title={`Edit ${getActionLabel(permission.action_name)} on ${getModuleLabel(permission.module_name)}`}
                              aria-label={`Edit ${getActionLabel(permission.action_name)} on ${getModuleLabel(permission.module_name)}`}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeletePermissionInDetails(permission)}
                              className="rounded p-1 text-red-700 transition hover:bg-red-100"
                              title={`Delete ${getActionLabel(permission.action_name)} on ${getModuleLabel(permission.module_name)}`}
                              aria-label={`Delete ${getActionLabel(permission.action_name)} on ${getModuleLabel(permission.module_name)}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  {groupedModalRolePermissions.length === 0 && (
                    <p className="py-3 text-sm text-slate-500">No permissions for this role.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
          </div>
        </div>
      )}

      {editRoleModal.open && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/45 p-4">
          <div className="flex min-h-full items-start justify-center py-10">
          <div className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-violet-200">
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Edit Role</p>
              <h3 className="text-xl font-bold text-slate-900">Update role details</h3>
            </div>

            <label className="mb-2 block text-sm font-semibold text-slate-700">Role name</label>
            <input
              value={editRoleModal.name}
              onChange={(e) => setEditRoleModal((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              autoFocus
            />

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditRoleModal({ open: false, role: null, name: "" })}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onSaveEditRole}
                disabled={busy}
                className="rounded-md bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
              >
                Save Changes
              </button>
            </div>
          </div>
          </div>
        </div>
      )}

      {editPermissionModal.open && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/45 p-4">
          <div className="flex min-h-full items-start justify-center py-10">
            <div className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-violet-200">
              <div className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Edit Permission</p>
                <h3 className="text-xl font-bold text-slate-900">Update permission mapping</h3>
              </div>

              <div className="space-y-3">
                <input
                  value={editPermissionModal.role_name}
                  onChange={(e) => setEditPermissionModal((prev) => ({ ...prev, role_name: e.target.value }))}
                  placeholder="role_name"
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                />
                <input
                  value={editPermissionModal.module_name}
                  onChange={(e) => setEditPermissionModal((prev) => ({ ...prev, module_name: e.target.value }))}
                  list="module-options"
                  placeholder="module_name"
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                />
                <input
                  value={editPermissionModal.action_name}
                  onChange={(e) => setEditPermissionModal((prev) => ({ ...prev, action_name: e.target.value }))}
                  list="action-options"
                  placeholder="action_name"
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                />
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setEditPermissionModal({
                      open: false,
                      id: "",
                      role_name: "",
                      module_name: "",
                      action_name: "",
                    })
                  }
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={onSaveEditPermission}
                  disabled={busy}
                  className="rounded-md bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
                >
                  Save Permission
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <datalist id="action-options">
        {actionOptions.map((actionName) => (
          <option key={actionName} value={actionName} />
        ))}
      </datalist>
      <datalist id="module-options">
        {moduleOptions.map((moduleName) => (
          <option key={moduleName} value={moduleName} />
        ))}
      </datalist>
    </div>
  );
}
