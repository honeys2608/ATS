import React, { useMemo, useState } from "react";
import InputField from "./InputField";
import SelectField from "./SelectField";
import { normalizeEmail, validateEmail, validateFirstName, validatePassword } from "../../utils/validation";

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "suspended", label: "Suspended" },
  { value: "locked", label: "Locked" },
  { value: "pending", label: "Pending" },
];

export default function UserDrawer({
  open,
  mode = "create",
  initialData = null,
  roles = [],
  onClose,
  onSubmit,
  loading = false,
  serverError = "",
}) {
  const [form, setForm] = useState(() => ({
    first_name: initialData?.first_name || "",
    last_name: initialData?.last_name || "",
    email: initialData?.email || "",
    phone: initialData?.phone || "",
    role: initialData?.role || "",
    status: initialData?.status || "active",
    password_mode: "generate",
    password: "",
  }));
  const [errors, setErrors] = useState({});

  React.useEffect(() => {
    if (!open) return;
    setForm({
      first_name: initialData?.first_name || "",
      last_name: initialData?.last_name || "",
      email: initialData?.email || "",
      phone: initialData?.phone || "",
      role: initialData?.role || "",
      status: initialData?.status || "active",
      password_mode: "generate",
      password: "",
    });
    setErrors({});
  }, [open, initialData]);

  const title = mode === "edit" ? "Edit User" : "Create User";
  const roleOptions = useMemo(
    () => roles.map((r) => ({ value: String(r.name || r.role || "").toLowerCase(), label: r.name || r.role })),
    [roles],
  );

  if (!open) return null;

  const runValidation = () => {
    const next = {};
    const firstNameErr = validateFirstName(form.first_name);
    if (firstNameErr) next.first_name = firstNameErr;
    const emailErr = validateEmail(form.email);
    if (emailErr) next.email = emailErr;
    if (!form.role) next.role = "Role is required";
    if (mode === "create" && form.password_mode === "manual") {
      const passwordErr = validatePassword(form.password);
      if (passwordErr) next.password = passwordErr;
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = (e) => {
    e.preventDefault();
    if (!runValidation()) return;
    const payload = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      email: normalizeEmail(form.email),
      phone: form.phone.trim(),
      role: form.role,
      status: form.status,
    };
    if (mode === "create") {
      payload.password_mode = form.password_mode;
      if (form.password_mode === "manual") payload.password = form.password;
    }
    onSubmit(payload);
  };

  return (
    <div className="fixed inset-0 z-50">
      <button className="absolute inset-0 bg-black/40" onClick={onClose} />
      <aside className="absolute right-0 top-0 h-full w-full max-w-xl overflow-y-auto bg-white p-6 shadow-2xl">
        <h2 className="text-xl font-bold text-slate-900">{title}</h2>
        <p className="text-sm text-slate-500">Standard SaaS user identity and access controls.</p>
        {serverError ? <div className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{serverError}</div> : null}
        <form className="mt-5 space-y-4" onSubmit={submit}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <InputField label="First Name" required value={form.first_name} onChange={(v) => setForm((p) => ({ ...p, first_name: v }))} error={errors.first_name} />
            <InputField label="Last Name" value={form.last_name} onChange={(v) => setForm((p) => ({ ...p, last_name: v }))} />
          </div>
          <InputField label="Email" required value={form.email} onChange={(v) => setForm((p) => ({ ...p, email: v }))} error={errors.email} disabled={mode === "edit"} />
          <InputField label="Phone" value={form.phone} onChange={(v) => setForm((p) => ({ ...p, phone: v }))} />
          <SelectField label="Role" required value={form.role} onChange={(v) => setForm((p) => ({ ...p, role: v }))} options={roleOptions} error={errors.role} />
          <SelectField label="Status" value={form.status} onChange={(v) => setForm((p) => ({ ...p, status: v }))} options={STATUS_OPTIONS} />

          {mode === "create" ? (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="mb-2 text-sm font-semibold text-slate-700">Password Setup</p>
              <div className="flex flex-wrap gap-4 text-sm">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    checked={form.password_mode === "generate"}
                    onChange={() => setForm((p) => ({ ...p, password_mode: "generate", password: "" }))}
                  />
                  Generate temporary password
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    checked={form.password_mode === "manual"}
                    onChange={() => setForm((p) => ({ ...p, password_mode: "manual" }))}
                  />
                  Set password manually
                </label>
              </div>
              {form.password_mode === "manual" ? (
                <div className="mt-3">
                  <InputField
                    label="Password"
                    type="password"
                    required
                    value={form.password}
                    onChange={(v) => setForm((p) => ({ ...p, password: v }))}
                    error={errors.password}
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" className="rounded border border-slate-300 px-4 py-2 text-sm" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {loading ? "Saving..." : mode === "edit" ? "Save Changes" : "Create User"}
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}
