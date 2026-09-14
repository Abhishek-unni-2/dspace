// One-time bootstrap: creates the Administrator role (full access to every
// module) and a first admin user, from env vars. Safe to re-run — it skips
// anything that already exists.
//
// Usage: npm run db:seed

import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "./index";
import { roles, users } from "./schema";
import { fullAccess } from "@/lib/permissions";
import { hashPassword } from "@/lib/password";

async function main() {
  const adminName = process.env.ADMIN_NAME || "Admin";
  const adminEmail = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || "";

  if (!adminEmail || !adminPassword) {
    throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD in your .env before seeding.");
  }

  let [adminRole] = await db.select().from(roles).where(eq(roles.name, "Administrator")).limit(1);

  if (!adminRole) {
    [adminRole] = await db
      .insert(roles)
      .values({
        name: "Administrator",
        description: "Full access to every module, plus user and role management.",
        isAdmin: true,
        permissions: fullAccess(),
      })
      .returning();
    console.log(`Created "Administrator" role.`);
  } else {
    console.log(`"Administrator" role already exists — leaving it as-is.`);
  }

  const [existingUser] = await db.select().from(users).where(eq(users.email, adminEmail)).limit(1);

  if (existingUser) {
    console.log(`User ${adminEmail} already exists — skipping user creation.`);
  } else {
    const passwordHash = await hashPassword(adminPassword);
    await db.insert(users).values({
      name: adminName,
      email: adminEmail,
      passwordHash,
      roleId: adminRole.id,
      isActive: true,
    });
    console.log(`Created admin user ${adminEmail}.`);
  }

  console.log("Seed complete.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
