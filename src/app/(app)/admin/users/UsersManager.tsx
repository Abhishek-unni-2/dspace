"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { createUser, resetUserPassword, updateUser, type UserFormState } from "./actions";

type UserRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  isActive: boolean;
  roleId: string;
  roleName: string;
  isAdmin: boolean;
};
type RoleOption = { id: string; name: string };

const emptyState: UserFormState = {};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-navy" disabled={pending}>
      {pending ? "Saving…" : label}
    </button>
  );
}

function CreateUserForm({ roles, onDone }: { roles: RoleOption[]; onDone: () => void }) {
  const [state, formAction] = useActionState(createUser, emptyState);

  useEffect(() => {
    if (state.success) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  return (
    <form action={formAction}>
      <div className="modal-body">
        {state.error ? <div className="login-error">{state.error}</div> : null}
        <div className="form-grid">
          <div className="field">
            <label>Full Name *</label>
            <input name="name" required />
          </div>
          <div className="field">
            <label>Email *</label>
            <input name="email" type="email" required />
          </div>
          <div className="field">
            <label>Mobile (for lead SMS alerts)</label>
            <input name="phone" type="tel" placeholder="98765 43210" />
          </div>
          <div className="field">
            <label>Temporary Password *</label>
            <input name="password" type="password" minLength={8} required />
          </div>
          <div className="field">
            <label>Role *</label>
            <select name="roleId" required defaultValue="">
              <option value="" disabled>
                Choose a role…
              </option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      <div className="modal-foot">
        <button type="button" className="btn btn-outline" onClick={onDone}>
          Cancel
        </button>
        <SubmitButton label="Create User" />
      </div>
    </form>
  );
}

function EditUserForm({ user, roles, onDone }: { user: UserRow; roles: RoleOption[]; onDone: () => void }) {
  const boundUpdate = updateUser.bind(null, user.id);
  const boundReset = resetUserPassword.bind(null, user.id);
  const [state, formAction] = useActionState(boundUpdate, emptyState);
  const [resetState, resetAction] = useActionState(boundReset, emptyState);

  useEffect(() => {
    if (state.success) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  return (
    <>
      <form action={formAction}>
        <div className="modal-body">
          {state.error ? <div className="login-error">{state.error}</div> : null}
          <div className="form-grid">
            <div className="field">
              <label>Full Name *</label>
              <input name="name" required defaultValue={user.name} />
            </div>
            <div className="field">
              <label>Email *</label>
              <input name="email" type="email" required defaultValue={user.email} />
            </div>
            <div className="field">
              <label>Mobile (for lead SMS alerts)</label>
              <input name="phone" type="tel" placeholder="98765 43210" defaultValue={user.phone} />
            </div>
            <div className="field">
              <label>Role *</label>
              <select name="roleId" required defaultValue={user.roleId}>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Status</label>
              <label className="chk" style={{ width: "fit-content" }}>
                <input type="checkbox" name="isActive" defaultChecked={user.isActive} />
                Active (can sign in)
              </label>
            </div>
          </div>
        </div>
        <div className="modal-foot">
          <button type="button" className="btn btn-outline" onClick={onDone}>
            Cancel
          </button>
          <SubmitButton label="Save Changes" />
        </div>
      </form>

      <div className="form-section" style={{ padding: "0 22px 20px" }}>
        <div className="form-section-title">Reset Password</div>
        <form action={resetAction} style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
          {resetState.error ? <div className="login-error" style={{ width: "100%" }}>{resetState.error}</div> : null}
          {resetState.success ? (
            <div className="helper-text" style={{ width: "100%", color: "var(--green)" }}>
              {resetState.success}
            </div>
          ) : null}
          <div className="field" style={{ flex: 1, minWidth: 200 }}>
            <label>New Password</label>
            <input name="password" type="password" minLength={8} required />
          </div>
          <button type="submit" className="btn btn-outline btn-sm">
            Set New Password
          </button>
        </form>
      </div>
    </>
  );
}

export default function UsersManager({
  users,
  roles,
  currentUserId,
}: {
  users: UserRow[];
  roles: RoleOption[];
  currentUserId: string;
}) {
  const [modalMode, setModalMode] = useState<"new" | UserRow | null>(null);

  return (
    <>
      <div className="panel">
        <div className="panel-head">
          <h2>
            Users <span className="cell-muted" style={{ fontWeight: 500 }}>({users.length})</span>
          </h2>
          <div className="spacer" />
          <button className="btn btn-navy" onClick={() => setModalMode("new")}>
            + Add User
          </button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Mobile</th>
                <th>Role</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="cell-strong">
                    {u.name} {u.id === currentUserId ? <span className="cell-muted">(you)</span> : null}
                  </td>
                  <td className="cell-muted">{u.email}</td>
                  <td className="cell-muted">{u.phone ? `+${u.phone}` : "—"}</td>
                  <td>
                    {u.roleName} {u.isAdmin ? <span className="badge badge-gold" style={{ marginLeft: 6 }}>Admin</span> : null}
                  </td>
                  <td>
                    {u.isActive ? (
                      <span className="badge badge-green">
                        <span className="badge-dot" />
                        Active
                      </span>
                    ) : (
                      <span className="badge badge-red">
                        <span className="badge-dot" />
                        Disabled
                      </span>
                    )}
                  </td>
                  <td className="row-actions">
                    <button className="btn-ghost btn-sm" onClick={() => setModalMode(u)} title="Edit">
                      ✎
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5}>
                    <div style={{ padding: "14px 0", color: "var(--muted-2)", fontSize: 12.5 }}>No users yet.</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalMode !== null && (
        <div className="overlay open">
          <div className="modal">
            <div className="modal-head">
              <div>
                <h3>{modalMode === "new" ? "Add User" : "Edit User"}</h3>
                <div className="sub">{modalMode === "new" ? "New DSPACE ERP account" : modalMode.email}</div>
              </div>
              <button className="modal-close" onClick={() => setModalMode(null)}>
                ✕
              </button>
            </div>
            {modalMode === "new" ? (
              <CreateUserForm roles={roles} onDone={() => setModalMode(null)} />
            ) : (
              <EditUserForm user={modalMode} roles={roles} onDone={() => setModalMode(null)} />
            )}
          </div>
        </div>
      )}
    </>
  );
}
