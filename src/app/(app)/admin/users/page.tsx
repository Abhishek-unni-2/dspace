import { eq } from "drizzle-orm";
import { db } from "@/db";
import { roles, users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth-guard";
import UsersManager from "./UsersManager";

export default async function UsersPage() {
  const currentUser = await requireAdmin();

  const userRows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      isActive: users.isActive,
      roleId: users.roleId,
      roleName: roles.name,
      isAdmin: roles.isAdmin,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .orderBy(users.createdAt);

  const roleRows = await db.select({ id: roles.id, name: roles.name }).from(roles).orderBy(roles.name);

  return <UsersManager users={userRows} roles={roleRows} currentUserId={currentUser.id} />;
}
