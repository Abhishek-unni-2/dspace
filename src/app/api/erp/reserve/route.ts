import { getCurrentUser } from "@/lib/auth-guard";
import { reserveIds } from "@/lib/erp-server";

export async function POST() {
  const user = await getCurrentUser();
  if (!user || !user.isActive) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json(await reserveIds(25));
}
