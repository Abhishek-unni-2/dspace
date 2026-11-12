import { sql } from "drizzle-orm";
import { db } from "@/db";
import { roles, users } from "@/db/schema";
import { normalizePermissions } from "@/lib/permissions";
import RolesManager from "./RolesManager";

export default async function RolesPage() {
  const roleRows = await db
    .select({
      id: roles.id,
      name: roles.name,
      description: roles.description,
      isAdmin: roles.isAdmin,
      receivesLeads: roles.receivesLeads,
      permissions: roles.permissions,
      userCount: sql<number>`(select count(*)::int from ${users} where ${users.roleId} = ${roles.id})`,
    })
    .from(roles)
    .orderBy(roles.createdAt);

  const data = roleRows.map((r) => ({ ...r, permissions: normalizePermissions(r.permissions) }));

  return <RolesManager roles={data} />;
}
