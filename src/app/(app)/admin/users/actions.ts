"use server";

import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { roles, users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth-guard";
import { hashPassword } from "@/lib/password";
import { NAV_KEYS } from "@/lib/permissions";

// Ticked modules -> stored list. Everything ticked = null (just follow the role,
// so modules added later show up automatically).
function modulesFromForm(formData: FormData): string[] | null {
  const picked = formData.getAll("modules").filter((v): v is string => typeof v === "string" && NAV_KEYS.includes(v));
  return NAV_KEYS.every((k) => picked.includes(k)) ? null : picked;
}

// Accepts "98765 43210", "+91 98765 43210" etc. Stores digits with country code
// (a bare 10-digit number is treated as Indian). Empty = no number.
const phoneField = z
  .string()
  .trim()
  .transform((v) => v.replace(/\D/g, ""))
  .transform((v) => (v.length === 10 ? "91" + v : v.replace(/^0+/, "")))
  .refine((v) => v === "" || (v.length >= 11 && v.length <= 15), "Enter a valid mobile number.");

export type UserFormState = { error?: string; success?: string };

const createSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters.").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  phone: phoneField,
  roleId: z.string().uuid("Choose a role."),
});

export async function createUser(_prev: UserFormState, formData: FormData): Promise<UserFormState> {
  await requireAdmin();
  const parsed = createSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    phone: formData.get("phone") ?? "",
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
    phone: parsed.data.phone,
    modules: modulesFromForm(formData),
    roleId: parsed.data.roleId,
    isActive: true,
  });

  revalidatePath("/admin/users");
  return { success: "User created." };
}

const updateSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters.").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email."),
  phone: phoneField,
  roleId: z.string().uuid("Choose a role."),
  isActive: z.boolean(),
});

export async function updateUser(userId: string, _prev: UserFormState, formData: FormData): Promise<UserFormState> {
  const currentUser = await requireAdmin();
  const parsed = updateSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone") ?? "",
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
      phone: parsed.data.phone,
      modules: modulesFromForm(formData),
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
