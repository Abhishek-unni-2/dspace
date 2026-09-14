"use server";

import { and, eq, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { roles, users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth-guard";
import { MODULES, noAccess } from "@/lib/permissions";

const levelSchema = z.enum(["none", "view", "edit"]);

function permissionsFromFormData(formData: FormData) {
  const perms = noAccess();
  for (const m of MODULES) {
    const parsed = levelSchema.safeParse(formData.get(`perm_${m.key}`));
    if (parsed.success) perms[m.key] = parsed.data;
  }
  return perms;
}

const roleSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters.").max(80),
  description: z.string().trim().max(300).optional(),
});

export type RoleFormState = { error?: string; success?: string };

export async function createRole(_prev: RoleFormState, formData: FormData): Promise<RoleFormState> {
  await requireAdmin();
  const parsed = roleSchema.safeParse({ name: formData.get("name"), description: formData.get("description") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || "Invalid input." };

  const [existing] = await db.select({ id: roles.id }).from(roles).where(eq(roles.name, parsed.data.name)).limit(1);
  if (existing) return { error: "A role with this name already exists." };

  await db.insert(roles).values({
    name: parsed.data.name,
    description: parsed.data.description || "",
    isAdmin: false,
    permissions: permissionsFromFormData(formData),
  });

  revalidatePath("/admin/roles");
  return { success: "Role created." };
}

export async function updateRole(roleId: string, _prev: RoleFormState, formData: FormData): Promise<RoleFormState> {
  await requireAdmin();
  const parsed = roleSchema.safeParse({ name: formData.get("name"), description: formData.get("description") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || "Invalid input." };

  const [role] = await db.select().from(roles).where(eq(roles.id, roleId)).limit(1);
  if (!role) return { error: "Role not found." };

  const [nameClash] = await db
    .select({ id: roles.id })
    .from(roles)
    .where(and(eq(roles.name, parsed.data.name), ne(roles.id, roleId)))
    .limit(1);
  if (nameClash) return { error: "A role with this name already exists." };

  await db
    .update(roles)
    .set({
      name: parsed.data.name,
      description: parsed.data.description || "",
      // The Administrator role always keeps full access to every module —
      // its permission grid is read-only in the UI, but this is guarded
      // server-side too so it can never be downgraded by a crafted request.
      permissions: role.isAdmin ? role.permissions : permissionsFromFormData(formData),
      updatedAt: new Date(),
    })
    .where(eq(roles.id, roleId));

  revalidatePath("/admin/roles");
  return { success: "Role updated." };
}

export async function deleteRole(roleId: string): Promise<{ error?: string }> {
  await requireAdmin();
  const [role] = await db.select().from(roles).where(eq(roles.id, roleId)).limit(1);
  if (!role) return { error: "Role not found." };
  if (role.isAdmin) return { error: "The Administrator role can't be deleted." };

  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(users).where(eq(users.roleId, roleId));
  if (count > 0) return { error: `${count} user(s) still have this role — reassign them first.` };

  await db.delete(roles).where(eq(roles.id, roleId));
  revalidatePath("/admin/roles");
  return {};
}
