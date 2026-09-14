"use server";

import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { roles, users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth-guard";
import { hashPassword } from "@/lib/password";

export type UserFormState = { error?: string; success?: string };

const createSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters.").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  roleId: z.string().uuid("Choose a role."),
});

export async function createUser(_prev: UserFormState, formData: FormData): Promise<UserFormState> {
  await requireAdmin();
  const parsed = createSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    roleId: formData.get("roleId"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || "Invalid input." };

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, parsed.data.email)).limit(1);
  if (existing) return { error: "A user with this email already exists." };

  const [role] = await db.select({ id: roles.id }).from(roles).where(eq(roles.id, parsed.data.roleId)).limit(1);
  if (!role) return { error: "Choose a valid role." };

  const passwordHash = await hashPassword(parsed.data.password);
  await db.insert(users).values({
    name: parsed.data.name,
    email: parsed.data.email,
    passwordHash,
    roleId: parsed.data.roleId,
    isActive: true,
  });

  revalidatePath("/admin/users");
  return { success: "User created." };
}

const updateSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters.").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email."),
  roleId: z.string().uuid("Choose a role."),
  isActive: z.boolean(),
});

export async function updateUser(userId: string, _prev: UserFormState, formData: FormData): Promise<UserFormState> {
  const currentUser = await requireAdmin();
  const parsed = updateSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    roleId: formData.get("roleId"),
    isActive: formData.get("isActive") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || "Invalid input." };

  if (userId === currentUser.id && !parsed.data.isActive) {
    return { error: "You can't deactivate your own account." };
  }

  const [emailClash] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.email, parsed.data.email), ne(users.id, userId)))
    .limit(1);
  if (emailClash) return { error: "A user with this email already exists." };

  const [role] = await db.select({ id: roles.id }).from(roles).where(eq(roles.id, parsed.data.roleId)).limit(1);
  if (!role) return { error: "Choose a valid role." };

  await db
    .update(users)
    .set({
      name: parsed.data.name,
      email: parsed.data.email,
      roleId: parsed.data.roleId,
      isActive: parsed.data.isActive,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  revalidatePath("/admin/users");
  return { success: "User updated." };
}

const resetPasswordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export async function resetUserPassword(userId: string, _prev: UserFormState, formData: FormData): Promise<UserFormState> {
  await requireAdmin();
  const parsed = resetPasswordSchema.safeParse({ password: formData.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || "Invalid input." };

  const passwordHash = await hashPassword(parsed.data.password);
  await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, userId));

  return { success: "Password updated." };
}
