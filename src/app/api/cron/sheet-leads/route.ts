import { timingSafeEqual } from "node:crypto";
import { getCurrentUser } from "@/lib/auth-guard";
import { meetsLevel } from "@/lib/permissions";
import { syncLeadsFromSheet } from "@/lib/sheet-leads";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function validBearer(req: Request) {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get("authorization") || "";
  if (!secret || !header.startsWith("Bearer ")) return false;
  const a = Buffer.from(header.slice(7));
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Called by the scheduler (Vercel Cron sends `Authorization: Bearer $CRON_SECRET`)
// or by a signed-in user who has edit access to Leads.
async function handle(req: Request) {
  if (!validBearer(req)) {
    const user = await getCurrentUser();
    if (!user || !user.isActive || !meetsLevel(user.role.permissions.leads, "edit")) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  const sheetId = process.env.LEADS_SHEET_ID;
  if (!sheetId) return Response.json({ error: "LEADS_SHEET_ID is not set" }, { status: 500 });
  const fromDate = process.env.LEADS_SYNC_FROM;
  if (!fromDate || !/^\d{4}-\d{2}-\d{2}$/.test(fromDate)) return Response.json({ error: "LEADS_SYNC_FROM (YYYY-MM-DD) is not set" }, { status: 500 });
  try {
    return Response.json(await syncLeadsFromSheet(sheetId, fromDate));
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Sync failed" }, { status: 502 });
  }
}

export const GET = handle;
export const POST = handle;
