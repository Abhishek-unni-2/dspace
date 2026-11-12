import { getCurrentUser } from "@/lib/auth-guard";
import { loadAll } from "@/lib/erp-server";

export const dynamic = "force-dynamic";

// Any signed-in, active user can read the shared data (the dashboard and
// cross-module name lookups need it); writes are permission-checked in /sync.
export async function GET() {
  const user = await getCurrentUser();
  if (!user || !user.isActive) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json({ ...(await loadAll({ id: user.id, name: user.name, isAdmin: user.role.isAdmin })), me: { id: user.id, name: user.name, isAdmin: user.role.isAdmin } });
}
