import "server-only";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { roles, users } from "@/db/schema";
import { getSessionUserId } from "@/lib/session";
import { type ModuleKey, type Permissions, meetsLevel, normalizePermissions } from "@/lib/permissions";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  role: {
    id: string;
    name: string;
    isAdmin: boolean;
    permissions: Permissions;
  };
  // Dashboard switched on for this user (per-user module list, see Admin -> Users).
  canDashboard: boolean;
};

// Re-reads the user + role from the database on every call so that a
// permission change or account deactivation made by an admin takes effect
// on the user's very next request — sessions only store the user id, never
// their permissions.
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const userId = await getSessionUserId();
  if (!userId) return null;

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      isActive: users.isActive,
      roleId: roles.id,
      roleName: roles.name,
      isAdmin: roles.isAdmin,
      permissions: roles.permissions,
      modules: users.modules,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(eq(users.id, userId))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  // Per-user module list narrows what the role allows (never widens it). The
  // Administrator role is exempt so an admin can't lock themselves out.
  const perms = normalizePermissions(row.permissions);
  let canDashboard = true;
  if (!row.isAdmin && Array.isArray(row.modules)) {
    const allowed = new Set(row.modules);
    for (const key of Object.keys(perms) as ModuleKey[]) if (!allowed.has(key)) perms[key] = "none";
    canDashboard = allowed.has("dashboard");
  }

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    isActive: row.isActive,
    role: {
      id: row.roleId,
      name: row.roleName,
      isAdmin: row.isAdmin,
      permissions: perms,
    },
    canDashboard,
  };
}

// Requires a signed-in, active user. Redirects to /login otherwise. Use at
// the top of the authenticated layout, and any page that doesn't need a
// finer-grained module check.
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user || !user.isActive) {
    redirect("/login");
  }
  return user;
}

// Requires the current user's role to grant at least `min` access to
// `moduleKey`. Returns the resolved level so pages can further tailor what
// they render (e.g. hide the "+ Add" button when level === "view").
export async function requireModule(
  moduleKey: ModuleKey,
  min: "view" | "edit" = "view"
): Promise<{ user: CurrentUser; allowed: boolean; level: "none" | "view" | "edit" }> {
  const user = await requireUser();
  const level = user.role.permissions[moduleKey] ?? "none";
  return { user, allowed: meetsLevel(level, min), level };
}

// Requires the current user's role to be the admin role. Redirects
// non-admins back to the dashboard rather than showing a blank page.
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!user.role.isAdmin) {
    redirect("/dashboard");
  }
  return user;
}
