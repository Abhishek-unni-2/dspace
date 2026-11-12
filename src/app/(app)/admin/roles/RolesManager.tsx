"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { ACCESS_LEVELS, MODULES, type Permissions } from "@/lib/permissions";
import { createRole, deleteRole, updateRole, type RoleFormState } from "./actions";

type RoleRow = {
  id: string;
  name: string;
  description: string;
  isAdmin: boolean;
  receivesLeads: boolean;
  permissions: Permissions;
  userCount: number;
};

const emptyState: RoleFormState = {};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-navy" disabled={pending}>
      {pending ? "Saving…" : label}
    </button>
  );
}

function RoleForm({ role, onDone }: { role: RoleRow | null; onDone: () => void }) {
  const action = role ? updateRole.bind(null, role.id) : createRole;
  const [state, formAction] = useActionState(action, emptyState);

  useEffect(() => {
    if (state.success) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  return (
    <form action={formAction}>
      <div className="modal-body">
        {state.error ? <div className="login-error">{state.error}</div> : null}
        <div className="form-section">
          <div className="form-grid">
            <div className="field">
              <label>Role Name *</label>
              <input name="name" required maxLength={80} defaultValue={role?.name} disabled={role?.isAdmin} />
            </div>
            <div className="field full">
              <label>
                Description <span className="opt">(optional)</span>
              </label>
              <input name="description" maxLength={300} defaultValue={role?.description} />
            </div>
          </div>
        </div>

        <div className="form-section">
          <div className="form-section-title">Lead Assignment</div>
          <label className="perm-radio">
            <input type="checkbox" name="receivesLeads" defaultChecked={role?.receivesLeads ?? false} />
            Auto-assign new leads to users in this role (shared equally, round-robin)
          </label>
        </div>

        <div className="form-section">
          <div className="form-section-title">Module Access</div>
          {role?.isAdmin ? (
            <p className="helper-text" style={{ marginTop: 0 }}>
              The Administrator role always has full access to every module — this can&apos;t be changed.
            </p>
          ) : null}
          <div className="table-wrap">
            <table className="perm-grid">
              <thead>
                <tr>
                  <th>Module</th>
                  <th>Access</th>
                </tr>
              </thead>
              <tbody>
                {MODULES.map((m) => (
                  <tr key={m.key}>
                    <td className="module-name">{m.label}</td>
                    <td>
                      <div className="perm-radio-group">
                        {ACCESS_LEVELS.map((lvl) => (
                          <label className="perm-radio" key={lvl.value}>
                            <input
                              type="radio"
                              name={`perm_${m.key}`}
                              value={lvl.value}
                              disabled={role?.isAdmin}
                              defaultChecked={
                                role ? role.permissions[m.key] === lvl.value : lvl.value === "none"
                              }
                            />
                            {lvl.label}
                          </label>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div className="modal-foot">
        <button type="button" className="btn btn-outline" onClick={onDone}>
          Cancel
        </button>
        <SubmitButton label={role ? "Save Changes" : "Create Role"} />
      </div>
    </form>
  );
}

export default function RolesManager({ roles }: { roles: RoleRow[] }) {
  const [editing, setEditing] = useState<RoleRow | null | "new">(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete(role: RoleRow) {
    if (!confirm(`Delete the "${role.name}" role?`)) return;
    setDeleteError(null);
    const res = await deleteRole(role.id);
    if (res.error) setDeleteError(res.error);
  }

  return (
    <>
      {deleteError ? (
        <div className="login-error" style={{ marginBottom: 14 }}>
          {deleteError}
        </div>
      ) : null}

      <div className="panel">
        <div className="panel-head">
          <h2>
            Roles <span className="cell-muted" style={{ fontWeight: 500 }}>({roles.length})</span>
          </h2>
          <div className="spacer" />
          <button className="btn btn-navy" onClick={() => setEditing("new")}>
            + Add Role
          </button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Description</th>
                <th>Users</th>
                <th>Gets leads</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {roles.map((r) => (
                <tr key={r.id}>
                  <td className="cell-strong">
                    {r.name} {r.isAdmin ? <span className="badge badge-gold" style={{ marginLeft: 6 }}>Admin</span> : null}
                  </td>
                  <td className="cell-muted">{r.description || "—"}</td>
                  <td>{r.userCount}</td>
                  <td>{r.receivesLeads ? <span className="badge badge-green">Yes</span> : <span className="cell-muted">—</span>}</td>
                  <td className="row-actions">
                    <button className="btn-ghost btn-sm" onClick={() => setEditing(r)} title="Edit">
                      ✎
                    </button>
                    {!r.isAdmin && (
                      <button className="btn-danger-ghost btn-sm" onClick={() => handleDelete(r)} title="Delete">
                        🗑
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {roles.length === 0 && (
                <tr>
                  <td colSpan={5}>
                    <div style={{ padding: "14px 0", color: "var(--muted-2)", fontSize: 12.5 }}>No roles yet.</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editing !== null && (
        <div className="overlay open">
          <div className="modal modal-wide">
            <div className="modal-head">
              <div>
                <h3>{editing === "new" ? "Add Role" : "Edit Role"}</h3>
                <div className="sub">
                  {editing === "new" ? "Pick which ERP modules this role can see and edit." : editing.name}
                </div>
              </div>
              <button className="modal-close" onClick={() => setEditing(null)}>
                ✕
              </button>
            </div>
            <RoleForm role={editing === "new" ? null : editing} onDone={() => setEditing(null)} />
          </div>
        </div>
      )}
    </>
  );
}
