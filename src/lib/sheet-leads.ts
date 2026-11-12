import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { activityLog, erpCounters, erpRecords, roles, users } from "@/db/schema";

// One-way import of Meta (Facebook / Instagram) lead-ad rows from a Google
// Sheet into the ERP "leads" collection. The sheet must be shared as
// "Anyone with the link" so its CSV export can be read without a login.
// Every tab of the spreadsheet is imported. Already-imported rows are skipped
// (matched on the Meta lead id, e.g. "l:1061232753165822"), so it is safe to
// run as often as you like. Columns the team fills in by hand (BDE, remarks,
// follow-ups) are never read or overwritten.

type Rec = Record<string, any>;
const AUTHOR = "Google Sheet sync";

// Minimal RFC-4180 CSV parser (quoted fields, escaped quotes, newlines in cells).
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else inQuotes = false;
      } else cell += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      rows.push(row); row = [];
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

async function listTabs(sheetId: string): Promise<{ name: string; gid: string }[]> {
  const res = await fetch(`https://docs.google.com/spreadsheets/d/${sheetId}/htmlview`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Could not open the sheet (HTTP ${res.status}). Is it shared with "Anyone with the link"?`);
  const html = await res.text();
  const tabs: { name: string; gid: string }[] = [];
  for (const m of html.matchAll(/items\.push\(\{name:\s*"((?:[^"\\]|\\.)*)"[^}]*?gid:\s*"(\d+)"/g)) {
    tabs.push({ name: m[1].replace(/\\x([0-9a-f]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16))).trim(), gid: m[2] });
  }
  if (!tabs.length) throw new Error("Could not find any tabs in the sheet.");
  return tabs;
}

async function fetchTab(sheetId: string, gid: string): Promise<string[][]> {
  const res = await fetch(`https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Could not read tab ${gid} (HTTP ${res.status})`);
  return parseCsv(await res.text());
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
const clean = (s: string | undefined) => (s ?? "").trim();

// Meta prefixes values: phone "p:+9199…", ids "l:…". Strip that.
const cleanPhone = (s: string) => clean(s).replace(/^p:/i, "").trim();
const prettyTimeline = (s: string) => clean(s).replace(/_/g, " ");

export type SheetSyncResult = {
  tabs: { name: string; rows: number; imported: number }[];
  imported: number;
  skippedExisting: number;
  skippedTest: number;
  skippedOld: number;
  projectsCreated?: number;
  assigned?: number;
};

export async function syncLeadsFromSheet(sheetId: string, fromDate: string): Promise<SheetSyncResult> {
  const tabs = await listTabs(sheetId);

  // Existing leads → which Meta ids are already in the ERP.
  const existingRows = await db.select({ data: erpRecords.data }).from(erpRecords).where(eq(erpRecords.collection, "leads"));
  const known = new Set(existingRows.map((r) => r.data?.metaLeadId).filter(Boolean) as string[]);
  const projectRows = await db.select({ data: erpRecords.data }).from(erpRecords).where(eq(erpRecords.collection, "projects"));
  const projects = projectRows.map((r) => r.data);

  // Every sheet tab is a project. Reuse the project already linked to the tab
  // (or one with the same name); otherwise create it, named exactly like the tab.
  const tabProject: Record<string, string> = {};
  const newProjects: { tab: string; data: Rec }[] = [];
  const projectFor = (tabName: string) => {
    if (tabName in tabProject) return tabProject[tabName];
    const found = projects.find((p) => p.sheetTab === tabName) ?? projects.find((p) => String(p.name || "").trim().toLowerCase() === tabName.toLowerCase());
    if (found) return (tabProject[tabName] = found.id);
    newProjects.push({ tab: tabName, data: {} });
    return (tabProject[tabName] = ""); // id assigned below, once the counter is reserved
  };

  type Pending = { tab: string; data: Rec };
  const pending: Pending[] = [];
  const result: SheetSyncResult = { tabs: [], imported: 0, skippedExisting: 0, skippedTest: 0, skippedOld: 0 };

  for (const tab of tabs) {
    const rows = await fetchTab(sheetId, tab.gid);
    const headerIdx = rows.findIndex((r) => r.some((c) => norm(c) === "id") && r.some((c) => norm(c) === "fullname"));
    const tabStat = { name: tab.name, rows: 0, imported: 0 };
    result.tabs.push(tabStat);
    if (headerIdx < 0) continue;
    projectFor(tab.name);

    const col: Record<string, number> = {};
    // First occurrence wins (the sheet has a stray second "id" column in one tab).
    rows[headerIdx].forEach((h, i) => { const k = norm(h); if (k && !(k in col)) col[k] = i; });
    const get = (r: string[], k: string) => clean(r[col[k]]);
    const timelineKey = Object.keys(col).find((k) => k.startsWith("whenareyou")) || "";

    for (const r of rows.slice(headerIdx + 1)) {
      // Normally the "id" column; one tab has a mangled header, so fall back to the first cell.
      const metaId = /^l:\d+$/.test(get(r, "id")) ? get(r, "id") : clean(r[0]);
      if (!/^l:\d+$/.test(metaId)) continue; // blank rows / "NON QUALIFIED LEADS" dividers
      tabStat.rows++;
      const name = get(r, "fullname");
      if (name.startsWith("<test lead") || get(r, "isorganic").toLowerCase() === "true") { result.skippedTest++; continue; }
      // Only leads created on/after the start date; older history stays in the sheet.
      if (get(r, "createdtime").slice(0, 10) < fromDate) { result.skippedOld++; continue; }
      if (known.has(metaId)) { result.skippedExisting++; continue; }
      known.add(metaId);

      const formName = get(r, "formname");
      const campaign = get(r, "campaignname");
      const adset = get(r, "adsetname");
      const platform = get(r, "platform");
      const city = get(r, "city");
      const timeline = timelineKey ? prettyTimeline(get(r, timelineKey)) : "";
      const created = get(r, "createdtime").slice(0, 10);

      const notes = [
        city && `City: ${city}`,
        timeline && `Planning to invest: ${timeline}`,
        formName && `Form: ${formName}`,
        (get(r, "adname") || adset) && `Ad: ${[get(r, "adname"), adset].filter(Boolean).join(" / ")}`,
        `Imported from Google Sheet tab "${tab.name}"`,
      ].filter(Boolean).join("\n");

      pending.push({
        tab: tab.name,
        data: {
          name,
          phone: cleanPhone(get(r, "phonenumber")),
          email: get(r, "email"),
          source: "Campaign",
          projectId: "", // filled in below from the tab
          budget: "",
          status: "New",
          realtorId: "",
          followUpDate: "",
          notes,
          createdDate: /^\d{4}-\d{2}-\d{2}$/.test(created) ? created : new Date().toISOString().slice(0, 10),
          metaLeadId: metaId,
          platform: platform === "ig" ? "Instagram" : platform === "fb" ? "Facebook" : platform,
          campaign,
          sheetTab: tab.name,
        },
      });
      tabStat.imported++;
    }
  }

  // Create projects for tabs that don't have one yet.
  if (newProjects.length) {
    const [pc] = await db
      .insert(erpCounters)
      .values({ name: "project", value: newProjects.length })
      .onConflictDoUpdate({ target: erpCounters.name, set: { value: sql`${erpCounters.value} + ${newProjects.length}` } })
      .returning();
    const first = pc.value - newProjects.length + 1;
    const rows = newProjects.map((np, i) => {
      const id = `DSP-${String(first + i).padStart(3, "0")}`;
      tabProject[np.tab] = id;
      return {
        collection: "projects",
        id,
        updatedBy: AUTHOR,
        data: {
          id, name: np.tab, developer: "", type: "Apartment", status: "Upcoming", location: "", locality: "", district: "", state: "",
          mapsUrl: "", website: "", dspaceUrl: "", rera: "", reraStatus: "Not Applicable", launchDate: "", expectedCompletion: "", possessionDate: "",
          unitTypes: "", priceRange: "", pricePerSqft: null, amenities: [], files: [], assignedRealtors: [],
          notes: "Created automatically from the Google Sheet tab.", sheetTab: np.tab,
        } as Rec,
      };
    });
    await db.insert(erpRecords).values(rows);
    await db.insert(activityLog).values({
      userName: AUTHOR, action: "auto", collection: "projects", recordId: rows[0].id,
      summary: `Created ${rows.length} project${rows.length === 1 ? "" : "s"} from Google Sheet tabs: ${newProjects.map((n) => n.tab).join(", ")}`,
    });
  }
  for (const p of pending) p.data.projectId = tabProject[p.tab] || "";

  if (pending.length) {
    // Reserve a block of lead IDs atomically so we never clash with users adding leads.
    const [counter] = await db
      .insert(erpCounters)
      .values({ name: "lead", value: pending.length })
      .onConflictDoUpdate({ target: erpCounters.name, set: { value: sql`${erpCounters.value} + ${pending.length}` } })
      .returning();
    const start = counter.value - pending.length + 1;

    // Oldest first so ids follow the order leads came in.
    pending.sort((a, b) => a.data.createdDate.localeCompare(b.data.createdDate));

    // Round-robin across active users whose role is marked "receives leads".
    // The pointer is stored in erp_counters so rotation continues between runs.
    const team = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .innerJoin(roles, eq(users.roleId, roles.id))
      .where(and(eq(users.isActive, true), eq(roles.receivesLeads, true)))
      .orderBy(users.createdAt, users.id);
    let cursor = 0;
    if (team.length) {
      const [rr] = await db
        .insert(erpCounters)
        .values({ name: "lead_rr", value: pending.length })
        .onConflictDoUpdate({ target: erpCounters.name, set: { value: sql`${erpCounters.value} + ${pending.length}` } })
        .returning();
      cursor = rr.value - pending.length;
    }
    const today = new Date().toISOString().slice(0, 10);
    const values = pending.map((p, i) => {
      const id = `LD-${String(start + i).padStart(3, "0")}`;
      const data: Rec = { ...p.data, id };
      if (team.length) {
        const u = team[(cursor + i) % team.length];
        Object.assign(data, { assignedTo: u.id, assignedToName: u.name, assignedDate: today, status: "Assigned" });
      }
      return { collection: "leads", id, data, updatedBy: AUTHOR };
    });
    result.assigned = team.length ? values.length : 0;
    for (let i = 0; i < values.length; i += 100) await db.insert(erpRecords).values(values.slice(i, i + 100));
    await db.insert(activityLog).values({
      userName: AUTHOR,
      action: "auto",
      collection: "leads",
      recordId: values[0].id,
      summary: `Imported ${values.length} new lead${values.length === 1 ? "" : "s"} from Google Sheet${team.length ? `, assigned across ${team.length} user${team.length === 1 ? "" : "s"}` : " (no users set to receive leads)"}`,
    });
    result.imported = values.length;
  }
  result.projectsCreated = newProjects.length;
  return result;
}
