import "server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { activityLog, erpCounters, erpRecords } from "@/db/schema";
import type { ModuleKey } from "@/lib/permissions";

export type Collection = "projects" | "units" | "leads" | "realtors" | "visits" | "bookings";

export const COLLECTIONS: Record<Collection, { module: ModuleKey; counter: string; prefix: string; label: string }> = {
  projects: { module: "projects", counter: "project", prefix: "DSP", label: "Project" },
  units: { module: "units", counter: "unit", prefix: "UNT", label: "Unit" },
  leads: { module: "leads", counter: "lead", prefix: "LD", label: "Lead" },
  realtors: { module: "realtors", counter: "realtor", prefix: "RLT", label: "Realtor" },
  visits: { module: "visits", counter: "visit", prefix: "SV", label: "Site visit" },
  bookings: { module: "bookings", counter: "booking", prefix: "BK", label: "Booking" },
};

export const isCollection = (c: unknown): c is Collection => typeof c === "string" && c in COLLECTIONS;

export type Change = { collection: Collection; id: string; op: "put" | "delete"; data?: Record<string, any> };

type Rec = Record<string, any>;

export async function loadAll() {
  const rows = await db.select().from(erpRecords).orderBy(erpRecords.createdAt, erpRecords.id);
  const out: Record<Collection, Rec[]> = { projects: [], units: [], leads: [], realtors: [], visits: [], bookings: [] };
  for (const r of rows) if (isCollection(r.collection)) out[r.collection].push(r.data);
  const activity = await db.select().from(activityLog).orderBy(desc(activityLog.id)).limit(30);
  return { collections: out, activity };
}

async function getRecs(collection: Collection): Promise<Rec[]> {
  const rows = await db.select().from(erpRecords).where(eq(erpRecords.collection, collection));
  return rows.map((r) => r.data);
}

async function putRec(collection: Collection, id: string, data: Rec, by: string) {
  await db
    .insert(erpRecords)
    .values({ collection, id, data, updatedBy: by })
    .onConflictDoUpdate({ target: [erpRecords.collection, erpRecords.id], set: { data, updatedAt: new Date(), updatedBy: by } });
}

async function log(userName: string, action: string, collection: Collection, recordId: string, summary: string) {
  await db.insert(activityLog).values({ userName, action, collection, recordId, summary });
}

function nameOf(collection: Collection, d: Rec) {
  switch (collection) {
    case "units": return d.unitNo ? `unit ${d.unitNo}` : "";
    case "visits": return d.date ? `on ${d.date}` : "";
    case "bookings": return d.saleValue ? `₹${Number(d.saleValue).toLocaleString("en-IN")}` : "";
    default: return d.name || "";
  }
}

const todayISO = () => new Date().toISOString().slice(0, 10);
const addDaysISO = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// Reserve a block of IDs for a client. Blocks are handed out atomically, so
// two people adding records at the same time never collide.
export async function reserveIds(n: number) {
  const out: Record<string, { start: number; end: number }> = {};
  for (const c of Object.values(COLLECTIONS)) {
    const [row] = await db
      .insert(erpCounters)
      .values({ name: c.counter, value: n })
      .onConflictDoUpdate({ target: erpCounters.name, set: { value: sql`${erpCounters.value} + ${n}` } })
      .returning();
    out[c.counter] = { start: row.value - n + 1, end: row.value };
  }
  return out;
}

// ---------------------------------------------------------------------------
export async function applyChanges(userName: string, changes: Change[]) {
  const touchedUnits = new Set<string>();
  const touchedLeadsByBooking = new Set<string>();
  const touchedLeadsByVisit = new Set<string>();
  const completedVisitLeads = new Set<string>();

  const realtors = changes.some((c) => c.collection === "bookings" && c.op === "put") ? await getRecs("realtors") : [];

  // Deleting a project removes its units too.
  const deletedProjects = changes.filter((c) => c.collection === "projects" && c.op === "delete").map((c) => c.id);
  if (deletedProjects.length) {
    const units = await getRecs("units");
    for (const u of units) {
      if (deletedProjects.includes(u.projectId)) {
        await db.delete(erpRecords).where(and(eq(erpRecords.collection, "units"), eq(erpRecords.id, u.id)));
        await log(userName, "deleted", "units", u.id, `Deleted unit ${u.unitNo || u.id} (project removed)`);
      }
    }
  }

  for (const ch of changes) {
    const meta = COLLECTIONS[ch.collection];
    const [existing] = await db
      .select()
      .from(erpRecords)
      .where(and(eq(erpRecords.collection, ch.collection), eq(erpRecords.id, ch.id)))
      .limit(1);
    const before = existing?.data;

    if (ch.op === "delete") {
      if (!before) continue;
      await db.delete(erpRecords).where(and(eq(erpRecords.collection, ch.collection), eq(erpRecords.id, ch.id)));
      await log(userName, "deleted", ch.collection, ch.id, `Deleted ${meta.label.toLowerCase()} ${ch.id} ${nameOf(ch.collection, before)}`.trim());
      if (ch.collection === "bookings") {
        if (before.unitId) touchedUnits.add(before.unitId);
        if (before.leadId) touchedLeadsByBooking.add(before.leadId);
      }
      if (ch.collection === "visits" && before.leadId) touchedLeadsByVisit.add(before.leadId);
      continue;
    }

    const data: Rec = { ...(ch.data || {}), id: ch.id };

    // Commission defaults: use the realtor's rate, and calculate the amount.
    if (ch.collection === "bookings") {
      if (!Number(data.commissionRate)) {
        const r = realtors.find((x) => x.id === data.realtorId);
        if (r) data.commissionRate = Number(r.commissionRate || 0);
      }
      if (!Number(data.commissionAmount)) {
        data.commissionAmount = Math.round((Number(data.saleValue || 0) * Number(data.commissionRate || 0)) / 100);
      }
    }

    await putRec(ch.collection, ch.id, data, userName);
    await log(
      userName,
      before ? "updated" : "created",
      ch.collection,
      ch.id,
      `${before ? "Updated" : "Added"} ${meta.label.toLowerCase()} ${ch.id} ${nameOf(ch.collection, data)}`.trim()
    );

    if (ch.collection === "bookings") {
      if (data.unitId) touchedUnits.add(data.unitId);
      if (before?.unitId && before.unitId !== data.unitId) touchedUnits.add(before.unitId);
      if (data.leadId) touchedLeadsByBooking.add(data.leadId);
      if (before?.leadId && before.leadId !== data.leadId) touchedLeadsByBooking.add(before.leadId);
    }
    if (ch.collection === "visits") {
      if (data.leadId) touchedLeadsByVisit.add(data.leadId);
      if (data.status === "Completed Visit" && before?.status !== "Completed Visit" && data.leadId) completedVisitLeads.add(data.leadId);
    }
  }

  await runAutomations(touchedUnits, touchedLeadsByVisit, touchedLeadsByBooking, completedVisitLeads);
}

// ---------------------------------------------------------------------------
// Workflow rules — run on the server so they apply the same way for every
// user, regardless of which modules that user is allowed to edit.
async function runAutomations(
  unitIds: Set<string>,
  visitLeadIds: Set<string>,
  bookingLeadIds: Set<string>,
  completedVisitLeadIds: Set<string>
) {
  if (!unitIds.size && !visitLeadIds.size && !bookingLeadIds.size) return;
  const bookings = await getRecs("bookings");
  const visits = await getRecs("visits");

  // 1. Booking -> unit status
  if (unitIds.size) {
    const units = await getRecs("units");
    for (const uid of unitIds) {
      const u = units.find((x) => x.id === uid);
      if (!u) continue;
      const active = bookings.filter((b) => b.unitId === uid && b.status !== "Cancelled");
      let target: string | null = null;
      if (active.some((b) => b.status === "Confirmed")) target = "Sold";
      else if (active.length) target = "Reserved";
      else if (u.status === "Sold" || u.status === "Reserved") target = "Available";
      if (target && target !== u.status) {
        await putRec("units", uid, { ...u, status: target }, "Automation");
        await log("Automation", "auto", "units", uid, `Unit ${u.unitNo || uid} set to ${target} (booking update)`);
      }
    }
  }

  // 2. Visit -> lead status / follow-up, then 3. Booking -> lead status
  const leadIds = new Set([...visitLeadIds, ...bookingLeadIds]);
  if (leadIds.size) {
    const leads = await getRecs("leads");
    for (const lid of leadIds) {
      const lead = leads.find((x) => x.id === lid);
      if (!lead) continue;
      const next = { ...lead };
      const reasons: string[] = [];

      if (visitLeadIds.has(lid) && !["Converted", "Lost"].includes(next.status)) {
        const mine = visits.filter((v) => v.leadId === lid);
        const hasScheduled = mine.some((v) => v.status === "Scheduled");
        const hasCompleted = mine.some((v) => v.status === "Completed Visit");
        if (hasScheduled && ["New", "Contacted"].includes(next.status)) {
          next.status = "Site Visit Scheduled";
        } else if (!hasScheduled && hasCompleted && ["New", "Contacted", "Site Visit Scheduled"].includes(next.status)) {
          next.status = "Negotiation";
        } else if (!hasScheduled && next.status === "Site Visit Scheduled") {
          next.status = "Contacted";
        }
        if (next.status !== lead.status) reasons.push("site visit update");
      }
      if (completedVisitLeadIds.has(lid) && (!next.followUpDate || next.followUpDate < todayISO())) {
        next.followUpDate = addDaysISO(2);
        reasons.push("follow-up set after visit");
      }

      if (bookingLeadIds.has(lid)) {
        const active = bookings.some((b) => b.leadId === lid && b.status !== "Cancelled");
        if (active && next.status !== "Converted") {
          next.status = "Converted";
          reasons.push("booking created");
        } else if (!active && next.status === "Converted") {
          next.status = "Negotiation";
          reasons.push("booking cancelled");
        }
      }

      if (JSON.stringify(next) !== JSON.stringify(lead)) {
        await putRec("leads", lid, next, "Automation");
        const parts = [] as string[];
        if (next.status !== lead.status) parts.push(`status → ${next.status}`);
        if (next.followUpDate !== lead.followUpDate) parts.push(`follow-up → ${next.followUpDate}`);
        await log("Automation", "auto", "leads", lid, `Lead ${lead.name || lid}: ${parts.join(", ")} (${reasons.join("; ")})`);
      }
    }
  }
}
