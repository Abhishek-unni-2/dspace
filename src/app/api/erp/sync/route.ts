import { getCurrentUser } from "@/lib/auth-guard";
import { meetsLevel } from "@/lib/permissions";
import { applyChanges, COLLECTIONS, isCollection, loadAll, type Change } from "@/lib/erp-server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !user.isActive) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const raw: unknown = body?.changes;
  if (!Array.isArray(raw) || raw.length > 300) return Response.json({ error: "Bad request" }, { status: 400 });

  const changes: Change[] = [];
  for (const c of raw as any[]) {
    if (!isCollection(c?.collection) || typeof c.id !== "string" || !c.id.startsWith(COLLECTIONS[c.collection as keyof typeof COLLECTIONS].prefix + "-") || c.id.length > 40) {
      return Response.json({ error: "Invalid change" }, { status: 400 });
    }
    if (c.op !== "put" && c.op !== "delete") return Response.json({ error: "Invalid change" }, { status: 400 });
    if (c.op === "put" && (typeof c.data !== "object" || c.data === null || JSON.stringify(c.data).length > 200_000)) {
      return Response.json({ error: "Invalid data" }, { status: 400 });
    }
    // Per-module permission, checked on the server for every change.
    const level = user.role.permissions[COLLECTIONS[c.collection as keyof typeof COLLECTIONS].module];
    if (!meetsLevel(level, "edit")) {
      return Response.json({ error: `You don't have edit access to ${c.collection}.` }, { status: 403 });
    }
    changes.push({ collection: c.collection, id: c.id, op: c.op, data: c.data });
  }

  await applyChanges(user.name, changes);
  return Response.json(await loadAll());
}
