// ---------------------------------------------------------------------------
// Ported from the original dspace-erp_1.html single-file mockup, almost
// unchanged: same seed data, same render*/submit*/delete* functions, same
// localStorage persistence. Two differences from the original:
//   1. Navigation between modules is now real Next.js routes (AppShell),
//      not a hash router — so NAV/renderNav/CRUMB were dropped here.
//   2. Every "+ Add", edit and delete control is gated by canEdit(module),
//      driven by the signed-in user's role permissions (server-verified on
//      every page load — see requireModule() in src/lib/auth-guard.ts).
// The underlying data still lives in the browser's localStorage, not
// Postgres — wiring these modules to the database is a follow-up.
// ---------------------------------------------------------------------------

import type { ModuleKey, Permissions } from "@/lib/permissions";

export type ErpView =
  | "dashboard"
  | "projects"
  | "units"
  | "leads"
  | "realtors"
  | "visits"
  | "bookings"
  | "commissions";

let DB: any = null;
let PERMS: Permissions | null = null;
let currentView: ErpView = "dashboard";
let overlayListenerAttached = false;

function canEdit(moduleKey: ModuleKey): boolean {
  return PERMS?.[moduleKey] === "edit";
}

/* ---------------------------- utilities -------------------------------- */
const todayISO = () => new Date().toISOString().slice(0, 10);
function addDays(n: number, base?: string) {
  const d = base ? new Date(base) : new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function isToday(d: string) {
  return d === todayISO();
}
function isThisMonth(d: string) {
  if (!d) return false;
  const a = new Date(d),
    b = new Date();
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}
function formatDate(d: string) {
  if (!d) return "—";
  const dt = new Date(d);
  return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function formatNum(n: any) {
  return Number(n || 0).toLocaleString("en-IN");
}
function formatINR(n: any) {
  n = Number(n || 0);
  return "₹" + n.toLocaleString("en-IN");
}
function formatCr(n: any) {
  n = Number(n || 0);
  if (n >= 10000000) return "₹" + (n / 10000000).toFixed(2).replace(/\.00$/, "") + " Cr";
  if (n >= 100000) return "₹" + (n / 100000).toFixed(2).replace(/\.00$/, "") + " L";
  return formatINR(n);
}
function uid(prefix: string, n: any) {
  return prefix + "-" + String(n).padStart(3, "0");
}
function esc(s: any) {
  return String(s == null ? "" : s).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string
  );
}
function toast(msg: string) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout((window as any).__toastTimer);
  (window as any).__toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
}
function openModal(html: string, wide?: boolean, sm?: boolean) {
  const modal = document.getElementById("modal");
  const overlay = document.getElementById("overlay");
  if (!modal || !overlay) return;
  modal.className = "modal" + (wide ? " modal-wide" : "") + (sm ? " modal-sm" : "");
  modal.innerHTML = html;
  overlay.classList.add("open");
}
function closeModal() {
  document.getElementById("overlay")?.classList.remove("open");
  const modal = document.getElementById("modal");
  if (modal) modal.innerHTML = "";
}

function badge(text: string, kind: string) {
  return `<span class="badge badge-${kind}"><span class="badge-dot"></span>${esc(text)}</span>`;
}
const STATUS_KIND: Record<string, string> = {
  Upcoming: "blue",
  "Under Construction": "amber",
  "Ready to Move": "green",
  Completed: "green",
  "On Hold": "red",
  "Sold Out": "gold",
  Available: "green",
  Reserved: "amber",
  Sold: "blue",
  Hold: "red",
  New: "blue",
  Contacted: "amber",
  "Site Visit Scheduled": "gold",
  Negotiation: "amber",
  Converted: "green",
  Lost: "red",
  Scheduled: "blue",
  "Completed Visit": "green",
  Cancelled: "red",
  "No-show": "red",
  Booked: "blue",
  Confirmed: "green",
  Received: "green",
  Pending: "amber",
  Active: "green",
  Inactive: "slate",
  Registered: "green",
  "Applied / Pending": "amber",
  "Not Applicable": "slate",
  Expired: "red",
};
function stBadge(text: string) {
  return badge(text, STATUS_KIND[text] || "slate");
}

/* ---------------------------- data layer -------------------------------- */
const LS_KEY = "dspace_erp_data_v1";

function seed() {
  const projects = [
    mkProject(1,'Horizon Heights','Express Global Developers','Apartment','Under Construction','Kozhikode','Kinassery','Kozhikode','Kerala',-210,240,300,3,[4,5,6],'2 BHK, 3 BHK','3,650 – 6,900',5800,['Swimming Pool','Gym','Clubhouse','24x7 Security','Covered Parking','Lift','Power Backup']),
    mkProject(2,'Palm County Villas','DSPACE Developers','Villa','Ready to Move','Kannur','Thottada','Kannur','Kerala',-540,-30,-10,2,[7,8],'3 BHK, 4 BHK Villa','1.15 Cr – 1.85 Cr',null,['Landscaped Garden','Jogging Track','Gated Community','Power Backup','Rainwater Harvesting']),
    mkProject(3,'The Address Residences','Express Global Developers','Apartment','Under Construction','Kochi','Kakkanad','Ernakulam','Kerala',-95,300,360,4,[9,10,11],'2 BHK, 3 BHK, Penthouse','6,200 – 12,500',6200,['Rooftop Infinity Pool','Clubhouse','Gym','Kids Play Area','Indoor Games','24x7 Security']),
    mkProject(4,'Greenfield Plots','DSPACE Land Ventures','Plot','Upcoming','Malappuram','Manjeri','Malappuram','Kerala',20,420,null,1,[12],'Residential Plots (3–10 Cents)','12 L – 45 L',null,['Tar Road','Underground Wiring','Boundary Wall','Water Connection']),
    mkProject(5,'Marina Bay Towers','Express Global Developers','Commercial','Under Construction','Kochi','Marine Drive','Ernakulam','Kerala',-160,180,240,5,[13,14],'Office Space, Retail','8,500 – 15,000',8500,['Central AC','24x7 Security','Power Backup','Ample Parking','High-speed Elevators']),
    mkProject(6,'Orchid Meadows','DSPACE Developers','Apartment','Ready to Move','Thrissur','Ayyanthole','Thrissur','Kerala',-620,-60,-40,3,[15,16],'2 BHK, 3 BHK','55 L – 92 L',5400,['Swimming Pool','Clubhouse',"Children's Play Area",'Covered Parking']),
    mkProject(7,'Silver Sands Residency','Express Global Developers','Resort','On Hold','Kozhikode','Kappad','Kozhikode','Kerala',-380,60,120,2,[17],'Studio, 1 BHK (Investment)','38 L – 68 L',7200,['Beach Frontage','Swimming Pool','Restaurant','Concierge']),
    mkProject(8,'Emerald Court','DSPACE Developers','Mixed-use','Under Construction','Trivandrum','Kazhakkoottam','Trivandrum','Kerala',-45,270,330,5,[18,19],'2 BHK, 3 BHK, Retail','48 L – 1.1 Cr',5900,['Gym','Clubhouse','Retail Plaza','24x7 Security','Lift']),
  ];

  const units: any[] = [];
  let u = 1;
  const unitPlan: any[] = [
    [1,'A',6,'2 BHK',1050,'East',5800*1050,['Available','Available','Reserved','Sold','Available','On Hold']],
    [1,'B',4,'3 BHK',1450,'West',5800*1450,['Available','Sold','Reserved','Available']],
    [2,'—',10,'4 BHK Villa',2400,'North',16500000,['Available','Sold','Sold','Available','Reserved','Sold','Available','Available','Sold','Available']],
    [3,'C',8,'3 BHK',1620,'South-East',6200*1620,['Available','Available','Reserved','Sold','Sold','Available','On Hold','Available']],
    [3,'D',4,'Penthouse',2800,'Corner',6200*2800*1.15,['Available','Reserved','Sold','Available']],
    [5,'—',6,'Office Space',900,'East',8500*900,['Available','Reserved','Sold','Available','Available','Sold']],
    [6,'E',6,'2 BHK',980,'West',5400*980,['Sold','Sold','Available','Reserved','Sold','Available']],
    [8,'F',7,'3 BHK',1380,'North',5900*1380,['Available','Available','Reserved','Sold','Available','On Hold','Available']],
  ];
  unitPlan.forEach(([pid, block, count, type, area, facing, priceBase]) => {
    const statuses = unitPlan.find((x) => x[0] === pid && x[3] === type)[7];
    for (let i = 0; i < count; i++) {
      units.push({
        id: uid("UNT", u),
        projectId: uid("DSP", pid),
        unitNo: (block !== "—" ? block : "") + (101 + i + Math.floor(i / 4) * 100),
        floor: Math.floor(i / 4) + 1,
        type,
        area,
        facing,
        price: Math.round(priceBase * (1 + (i % 3) * 0.015)),
        status: statuses[i] || "Available",
        realtorId: i % 5 === 0 ? null : "RLT-" + String((i % 6) + 1).padStart(3, "0"),
      });
      u++;
    }
  });

  const realtors = [
    mkRealtor(1,'Arjun Menon','9847012345','arjun.menon@dspacerealty.com','Independent','Kozhikode',2.0,'Active'),
    mkRealtor(2,'Fathima Rasheed','9847098765','fathima.r@primeproperties.in','Prime Properties','Kochi',1.5,'Active'),
    mkRealtor(3,'Vishnu Prasad','9895112233','vishnu.prasad@gmail.com','Independent','Thrissur',2.0,'Active'),
    mkRealtor(4,'Nandita Suresh','9744556677','nandita.s@urbannest.in','Urban Nest Realty','Trivandrum',1.75,'Active'),
    mkRealtor(5,'Rahul Krishnan','9633441122','rahul.k@gmail.com','Independent','Kannur',2.0,'Inactive'),
    mkRealtor(6,'Sneha Thomas','9847665544','sneha.thomas@espaceadvisors.com','eSpace Advisors','Kochi',1.5,'Active'),
  ];

  const leads = [
    mkLead(1,'Manoj Pillai','9840011122','manoj.pillai@gmail.com','Website',1,'70 L – 90 L','Negotiation',1,-3,2),
    mkLead(2,'Divya Nair','9895223344','divya.nair@yahoo.com','Referral',3,'80 L – 1.1 Cr','Site Visit Scheduled',2,-1,1),
    mkLead(3,'Sajith Kumar','9744332211','sajith.kumar@outlook.com','Walk-in',2,'1.2 Cr – 1.6 Cr','Contacted',1,0,3),
    mkLead(4,'Anjali Varma','9633887766','anjali.varma@gmail.com','Social Media',6,'55 L – 65 L','New',3,0,0),
    mkLead(5,'Rohit Balan','9847556699','rohit.balan@gmail.com','Campaign',5,'40 L – 50 L','Converted',6,-15,25),
    mkLead(6,'Priya Warrier','9895667788','priya.warrier@gmail.com','Website',3,'90 L – 1.3 Cr','Contacted',4,1,5),
    mkLead(7,'Kiran Das','9744998877','kiran.das@gmail.com','Referral',8,'50 L – 75 L','New',2,0,0),
    mkLead(8,'Meera Joseph','9633114455','meera.joseph@gmail.com','Call',4,'12 L – 20 L','Negotiation',3,-2,4),
    mkLead(9,'Suhail Rahman','9847334422','suhail.rahman@gmail.com','Website','','₹8,500/sqft budget','Lost',5,-20,10),
    mkLead(10,'Athira Menon','9895445566','athira.menon@gmail.com','Site Visit Walk-in',1,'85 L – 95 L','Site Visit Scheduled',1,0,1),
    mkLead(11,'Deepak Chandran','9744221133','deepak.c@gmail.com','Campaign',7,'45 L – 60 L','New',6,0,0),
    mkLead(12,'Lakshmi Iyer','9633556688','lakshmi.iyer@gmail.com','Referral',8,'35 L – 42 L','Contacted',2,2,6),
  ];

  const visits = [
    mkVisit(1,2,1,'UNT-001',1,0,'Scheduled'),
    mkVisit(2,10,1,'UNT-002',1,1,'Scheduled'),
    mkVisit(3,3,3,'UNT-022',1,-2,'Completed Visit'),
    mkVisit(4,6,3,'UNT-021',4,-4,'Completed Visit'),
    mkVisit(5,1,1,'UNT-003',1,-6,'Completed Visit'),
    mkVisit(6,8,6,'UNT-041',4,-1,'Scheduled'),
    mkVisit(7,5,5,'UNT-035',6,-20,'Completed Visit'),
    mkVisit(8,9,7,null,5,-25,'No-show'),
    mkVisit(9,4,8,'UNT-047',3,2,'Scheduled'),
    mkVisit(10,12,7,null,2,-3,'Cancelled'),
  ];

  const bookings = [
    mkBooking(1,5,5,'UNT-013',6,-15,4200000,420000,2.0,'Received','Confirmed'),
    mkBooking(2,'','','UNT-006',2,-20,16500000,1500000,2.0,'Received','Confirmed'),
    mkBooking(3,'','','UNT-009',1,-9,6090000,600000,2.0,'Pending','Booked'),
    mkBooking(4,'','','UNT-016',3,-5,10160000,900000,1.5,'Pending','Booked'),
    mkBooking(5,'','','UNT-024',6,-7,7650000,650000,1.5,'Received','Confirmed'),
    mkBooking(6,'','','UNT-004',2,-45,16500000,1500000,2.0,'Received','Confirmed'),
    mkBooking(7,'','','UNT-028',4,-2,9126000,800000,1.75,'Pending','Booked'),
  ];

  return { projects, units, leads, realtors, visits, bookings, counters: { project: 8, unit: units.length, lead: 12, realtor: 6, visit: 10, booking: 7 } };
}

function mkProject(n: any, name: any, dev: any, type: any, status: any, city: any, locality: any, district: any, state: any, launchOffset: any, expOffset: any, possOffset: any, teamCount: any, realtorIdxs: any, unitTypes: any, priceRange: any, psf: any, amenities: any) {
  const rid = uid("DSP", n);
  return {
    id: rid, name, developer: dev, type, status,
    location: city, locality, district, state,
    mapsUrl: "https://maps.google.com/?q=" + encodeURIComponent(name + " " + city),
    website: "https://" + name.toLowerCase().replace(/[^a-z0-9]+/g, "") + ".com",
    dspaceUrl: "https://dspace.co.in/projects/" + rid.toLowerCase(),
    rera: "K-RERA/PRJ/" + (2024 + (n % 3)) + "/" + (1000 + n * 37),
    reraStatus: status === "Upcoming" ? "Applied / Pending" : "Registered",
    launchDate: addDays(launchOffset), expectedCompletion: addDays(expOffset), possessionDate: addDays(possOffset),
    unitTypes, priceRange, pricePerSqft: psf,
    amenities,
    assignedRealtors: realtorIdxs.map((i: any) => uid("RLT", Math.min(i, 6))),
    notes: "",
  };
}
function mkRealtor(n: any, name: any, phone: any, email: any, agency: any, region: any, rate: any, status: any) {
  return { id: uid("RLT", n), name, phone, email, agency, region, commissionRate: rate, status };
}
function mkLead(n: any, name: any, phone: any, email: any, source: any, projectN: any, budget: any, status: any, realtorN: any, followOffset: any, createdOffsetPast: any) {
  return {
    id: uid("LD", n), name, phone, email, source,
    projectId: projectN ? uid("DSP", projectN) : "",
    budget, status,
    realtorId: realtorN ? uid("RLT", realtorN) : "",
    followUpDate: followOffset !== undefined && followOffset !== null ? addDays(followOffset) : "",
    createdDate: addDays(-createdOffsetPast),
    notes: "",
  };
}
function mkVisit(n: any, leadN: any, projectN: any, unitId: any, realtorN: any, dateOffset: any, status: any) {
  return {
    id: uid("SV", n), leadId: uid("LD", leadN), projectId: uid("DSP", projectN), unitId: unitId || "",
    realtorId: uid("RLT", realtorN), date: addDays(dateOffset), time: ["10:00 AM", "11:30 AM", "2:00 PM", "4:00 PM", "5:30 PM"][n % 5],
    status, feedback: status === "Completed Visit" ? "Interested, comparing with another project." : "",
  };
}
function mkBooking(n: any, leadN: any, realtorNUnused: any, unitId: any, realtorN: any, dateOffset: any, saleValue: any, commission: any, rate: any, commStatus: any, status: any) {
  return {
    id: uid("BK", n), leadId: leadN ? uid("LD", leadN) : "", unitId,
    realtorId: uid("RLT", realtorN), bookingDate: addDays(dateOffset),
    saleValue, tokenAmount: Math.round(saleValue * 0.1), commissionRate: rate, commissionAmount: commission,
    commissionStatus: commStatus, status,
  };
}

function load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      DB = JSON.parse(raw);
      return;
    }
  } catch {
    // ignore corrupt localStorage, fall through to reseed
  }
  DB = seed();
  save();
}
function save() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(DB));
  } catch {
    // storage unavailable (private mode, quota) — non-fatal for this mockup
  }
}
function resetDemoData() {
  DB = seed();
  save();
  toast("Sample data reset");
  render();
}

/* -------- lookups -------- */
const projectById = (id: any) => DB.projects.find((p: any) => p.id === id);
const realtorById = (id: any) => DB.realtors.find((r: any) => r.id === id);
const leadById = (id: any) => DB.leads.find((l: any) => l.id === id);
const unitById = (id: any) => DB.units.find((u: any) => u.id === id);
function unitsOf(projectId: any) {
  return DB.units.filter((u: any) => u.projectId === projectId);
}

/* ---------------------------- render dispatch ---------------------------- */
const RENDERERS: Record<ErpView, () => string> = {
  dashboard: renderDashboard,
  projects: renderProjects,
  units: renderUnits,
  leads: renderLeads,
  realtors: renderRealtors,
  visits: renderVisits,
  bookings: renderBookings,
  commissions: renderCommissions,
};

function render() {
  const root = document.getElementById("view-root");
  if (!root) return;
  const fn = RENDERERS[currentView] || renderDashboard;
  root.innerHTML = fn();
}

/* ---------------------------- DASHBOARD ---------------------------------- */
function dashboardMetrics() {
  const p = DB.projects, u = DB.units, l = DB.leads, r = DB.realtors, v = DB.visits, b = DB.bookings;
  const bookingsThisMonth = b.filter((x: any) => isThisMonth(x.bookingDate));
  const salesValueThisMonth = bookingsThisMonth.reduce((s: number, x: any) => s + Number(x.saleValue || 0), 0);
  const expectedCommission = b.reduce((s: number, x: any) => s + Number(x.commissionAmount || 0), 0);
  const commissionReceived = b.filter((x: any) => x.commissionStatus === "Received").reduce((s: number, x: any) => s + Number(x.commissionAmount || 0), 0);

  const realtorSales: Record<string, number> = {};
  b.forEach((x: any) => {
    realtorSales[x.realtorId] = (realtorSales[x.realtorId] || 0) + Number(x.saleValue || 0);
  });
  let topRealtor: string | null = null, topVal = -1;
  Object.entries(realtorSales).forEach(([rid, val]) => {
    if (val > topVal) { topVal = val; topRealtor = rid; }
  });

  return {
    totalProjects: p.length,
    activeProjects: p.filter((x: any) => x.status === "Under Construction").length,
    upcomingProjects: p.filter((x: any) => x.status === "Upcoming").length,
    totalUnits: u.length,
    availableUnits: u.filter((x: any) => x.status === "Available").length,
    reservedUnits: u.filter((x: any) => x.status === "Reserved").length,
    soldUnits: u.filter((x: any) => x.status === "Sold").length,
    onHoldUnits: u.filter((x: any) => x.status === "On Hold" || x.status === "Hold").length,
    totalLeads: l.length,
    newLeadsToday: l.filter((x: any) => isToday(x.createdDate)).length,
    followUpsDueToday: l.filter((x: any) => isToday(x.followUpDate)).length,
    siteVisitsToday: v.filter((x: any) => isToday(x.date)).length,
    bookingsThisMonth: bookingsThisMonth.length,
    salesValueThisMonth, expectedCommission, commissionReceived,
    activeRealtors: r.filter((x: any) => x.status === "Active").length,
    topRealtor: topRealtor ? realtorById(topRealtor) : null,
    topRealtorVal: topVal,
  };
}

function renderDashboard() {
  const m = dashboardMetrics();
  const recentLeads = [...DB.leads].sort((a: any, b: any) => +new Date(b.createdDate) - +new Date(a.createdDate)).slice(0, 5);
  const upcomingVisits = DB.visits
    .filter((v: any) => v.status === "Scheduled" && new Date(v.date) >= new Date(addDays(-1)))
    .sort((a: any, b: any) => +new Date(a.date) - +new Date(b.date))
    .slice(0, 5);

  const realtorRank = [...DB.realtors]
    .map((r: any) => {
      const sales = DB.bookings.filter((b: any) => b.realtorId === r.id).reduce((s: number, x: any) => s + Number(x.saleValue || 0), 0);
      return { ...r, sales };
    })
    .sort((a: any, b: any) => b.sales - a.sales)
    .slice(0, 5);

  const quickActions = [
    canEdit("projects") ? `<button class="btn btn-navy" onclick="openProjectForm()">+ Add Project</button>` : "",
    canEdit("leads") ? `<button class="btn btn-outline" onclick="openLeadForm()">+ Add Lead</button>` : "",
    canEdit("realtors") ? `<button class="btn btn-outline" onclick="openRealtorForm()">+ Add Realtor</button>` : "",
    canEdit("units") ? `<button class="btn btn-outline" onclick="openUnitForm()">+ Add Unit</button>` : "",
    canEdit("visits") ? `<button class="btn btn-outline" onclick="openVisitForm()">+ Add Site Visit</button>` : "",
    canEdit("bookings") ? `<button class="btn btn-outline" onclick="openBookingForm()">+ Add Booking</button>` : "",
  ].join("");

  return `
    <div class="dev-note">UI reference build — dashboard figures below are computed live from the sample dataset (stored in this browser's local storage) so the data relationships are visible. Wiring these modules to the Postgres database is a planned follow-up.</div>

    <div class="command-bar">
      <div class="cb-title">DSPACE COMMAND CENTER</div>
      <div class="cb-item"><div class="cb-label">PROJECTS</div><div class="cb-value">${m.totalProjects}</div></div>
      <div class="cb-item"><div class="cb-label">AVAILABLE</div><div class="cb-value">${m.availableUnits} <span style="font-size:12px;font-weight:600;">UNITS</span></div></div>
      <div class="cb-item"><div class="cb-label">LEADS</div><div class="cb-value">${formatNum(m.totalLeads)}</div></div>
      <div class="cb-item"><div class="cb-label">SITE VISITS</div><div class="cb-value">${DB.visits.length}</div></div>
      <div class="cb-item"><div class="cb-label">BOOKINGS</div><div class="cb-value">${DB.bookings.length}</div></div>
      <div class="cb-item"><div class="cb-label">SALES VALUE</div><div class="cb-value">${formatCr(DB.bookings.reduce((s: number, x: any) => s + Number(x.saleValue || 0), 0))}</div></div>
      <div class="cb-item"><div class="cb-label">COMMISSION</div><div class="cb-value">${formatCr(m.expectedCommission)}</div></div>
    </div>

    ${quickActions ? `<div class="quick-actions">${quickActions}</div>` : ""}

    <div class="section-title">Projects &amp; Inventory</div>
    <div class="kpi-grid">
      ${kpi("Total Projects", m.totalProjects, "across all statuses")}
      ${kpi("Active Projects", m.activeProjects, "under construction", "amber")}
      ${kpi("Upcoming Projects", m.upcomingProjects, "not yet launched", "blue")}
      ${kpi("Total Units", m.totalUnits, "across " + m.totalProjects + " projects")}
      ${kpi("Available Units", m.availableUnits, "ready to sell", "green")}
      ${kpi("Reserved Units", m.reservedUnits, "pending confirmation", "amber")}
      ${kpi("Sold Units", m.soldUnits, "closed sales", "blue")}
      ${kpi("On-Hold Units", m.onHoldUnits, "temporarily blocked", "red")}
    </div>

    <div class="section-title">Leads &amp; Site Visits</div>
    <div class="kpi-grid">
      ${kpi("Total Leads", formatNum(m.totalLeads), "in pipeline")}
      ${kpi("New Leads Today", m.newLeadsToday, todayLabel(), "blue")}
      ${kpi("Follow-ups Due Today", m.followUpsDueToday, todayLabel(), "amber")}
      ${kpi("Site Visits Today", m.siteVisitsToday, todayLabel(), "green")}
    </div>

    <div class="section-title">Sales &amp; Commission</div>
    <div class="kpi-grid">
      ${kpi("Bookings This Month", m.bookingsThisMonth, monthLabel())}
      ${kpi("Sales Value This Month", formatCr(m.salesValueThisMonth), monthLabel(), "green")}
      ${kpi("Expected Commission", formatCr(m.expectedCommission), "across all bookings", "gold")}
      ${kpi("Commission Received", formatCr(m.commissionReceived), "settled to date", "green")}
    </div>

    <div class="section-title">Realtors</div>
    <div class="kpi-grid">
      ${kpi("Active Realtors", m.activeRealtors, "of " + DB.realtors.length + " total")}
      ${kpi("Top Performing Realtor", m.topRealtor ? m.topRealtor.name : "—", m.topRealtor ? formatCr(m.topRealtorVal) + " in sales" : "", "gold")}
    </div>

    <div class="two-col" style="margin-top:22px;">
      <div class="mini-panel">
        <h3>Recently Added Leads</h3>
        ${recentLeads.map((l: any) => `
          <div class="rank-row">
            <div class="rank-badge">${l.source.slice(0, 2).toUpperCase()}</div>
            <div class="rank-name">${esc(l.name)}<div class="cell-muted" style="font-size:11px;">${projectById(l.projectId)?.name || "General inquiry"}</div></div>
            ${stBadge(l.status)}
          </div>`).join("") || emptyRow()}
      </div>
      <div class="mini-panel">
        <h3>Top Realtors (by sales value)</h3>
        ${realtorRank.map((r: any, i: number) => `
          <div class="rank-row">
            <div class="rank-badge ${i === 0 ? "gold" : ""}">${i + 1}</div>
            <div class="rank-name">${esc(r.name)}<div class="cell-muted" style="font-size:11px;">${esc(r.agency)}</div></div>
            <div class="rank-val">${formatCr(r.sales)}</div>
          </div>`).join("") || emptyRow()}
      </div>
    </div>

    <div class="section-title">Upcoming Site Visits</div>
    <div class="panel">
      <div class="table-wrap"><table>
        <thead><tr><th>Lead</th><th>Project</th><th>Realtor</th><th>Date</th><th>Time</th><th>Status</th></tr></thead>
        <tbody>
        ${upcomingVisits.map((v: any) => `
          <tr>
            <td class="cell-strong">${esc(leadById(v.leadId)?.name || "—")}</td>
            <td>${esc(projectById(v.projectId)?.name || "—")}</td>
            <td>${esc(realtorById(v.realtorId)?.name || "—")}</td>
            <td>${formatDate(v.date)}</td>
            <td class="cell-muted">${v.time}</td>
            <td>${stBadge(v.status)}</td>
          </tr>`).join("") || `<tr><td colspan="6">${emptyRow()}</td></tr>`}
        </tbody>
      </table></div>
    </div>
  `;
}
function kpi(label: string, value: any, sub?: string, accent?: string) {
  return `<div class="kpi-card ${accent ? "accent-" + accent : ""}"><div class="kpi-label">${label}</div><div class="kpi-value">${value}</div><div class="kpi-sub">${sub || ""}</div></div>`;
}
function todayLabel() {
  return formatDate(todayISO());
}
function monthLabel() {
  return new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}
function emptyRow() {
  return `<div style="padding:14px 0; color:var(--muted-2); font-size:12.5px;">Nothing to show yet.</div>`;
}

/* ---------------------------- PROJECTS ------------------------------------ */
const PROJECT_TYPES = ["Apartment", "Villa", "Plot", "Commercial", "Land", "Resort", "Mixed-use", "Office", "Retail", "Investment Opportunity"];
const PROJECT_STATUSES = ["Upcoming", "Under Construction", "Ready to Move", "Completed", "On Hold", "Sold Out"];
const RERA_STATUSES = ["Registered", "Applied / Pending", "Not Applicable", "Expired"];
const AMENITY_LIST = ["Swimming Pool", "Gym", "Clubhouse", "Children's Play Area", "Landscaped Garden", "24x7 Security", "Covered Parking", "Lift", "Power Backup", "Rainwater Harvesting", "Indoor Games", "Jogging Track", "Gated Community", "Central AC", "Concierge"];

let projectFilter = { status: "", type: "", q: "" };

function renderProjects() {
  const list = DB.projects.filter(
    (p: any) =>
      (!projectFilter.status || p.status === projectFilter.status) &&
      (!projectFilter.type || p.type === projectFilter.type) &&
      (!projectFilter.q || (p.name + p.id + p.location).toLowerCase().includes(projectFilter.q.toLowerCase()))
  );
  const editable = canEdit("projects");
  return `
    <div class="panel">
      <div class="panel-head">
        <h2>All Projects <span class="cell-muted" style="font-weight:500;">(${list.length})</span></h2>
        <div class="spacer"></div>
        <div class="filter-row">
          <input placeholder="Search project / location…" value="${esc(projectFilter.q)}" oninput="projectFilter.q=this.value; render();">
          <select onchange="projectFilter.status=this.value; render();">
            <option value="">All statuses</option>
            ${PROJECT_STATUSES.map((s) => `<option ${projectFilter.status === s ? "selected" : ""}>${s}</option>`).join("")}
          </select>
          <select onchange="projectFilter.type=this.value; render();">
            <option value="">All types</option>
            ${PROJECT_TYPES.map((s) => `<option ${projectFilter.type === s ? "selected" : ""}>${s}</option>`).join("")}
          </select>
        </div>
        ${editable ? `<button class="btn btn-navy" onclick="openProjectForm()">+ Add Project</button>` : ""}
      </div>
      <div class="table-wrap"><table>
        <thead><tr>
          <th>Project ID</th><th>Name</th><th>Type</th><th>Status</th><th>Location</th>
          <th>Units (Avail/Total)</th><th>RERA</th><th>Possession</th><th></th>
        </tr></thead>
        <tbody>
        ${list.map((p: any) => {
          const us = unitsOf(p.id);
          const avail = us.filter((u: any) => u.status === "Available").length;
          return `<tr style="cursor:pointer;" onclick="viewProject('${p.id}')">
            <td class="cell-strong">${p.id}</td>
            <td class="cell-strong">${esc(p.name)}<div class="cell-muted" style="font-size:11.5px;">${esc(p.developer)}</div></td>
            <td>${p.type}</td>
            <td>${stBadge(p.status)}</td>
            <td>${esc(p.locality)}, ${esc(p.location)}</td>
            <td>${avail} / ${us.length}</td>
            <td>${stBadge(p.reraStatus)}</td>
            <td class="cell-muted">${formatDate(p.possessionDate)}</td>
            <td class="row-actions" onclick="event.stopPropagation()">
              ${editable ? `<button class="btn-ghost btn-sm" onclick="openProjectForm('${p.id}')" title="Edit">✎</button>
              <button class="btn-danger-ghost btn-sm" onclick="deleteProject('${p.id}')" title="Delete">🗑</button>` : ""}
            </td>
          </tr>`;
        }).join("") || `<tr><td colspan="9">${emptyRow()}</td></tr>`}
        </tbody>
      </table></div>
    </div>
  `;
}

function viewProject(id: any) {
  const p = projectById(id);
  if (!p) return;
  const us = unitsOf(id);
  const stCount = (s: string) => us.filter((u: any) => u.status === s).length;
  openModal(
    `
    <div class="modal-head">
      <div>
        <h3>${esc(p.name)} <span class="cell-muted" style="font-weight:500; font-size:13px;">· ${p.id}</span></h3>
        <div class="sub">${esc(p.developer)} · ${esc(p.locality)}, ${esc(p.location)}, ${esc(p.state)}</div>
      </div>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div class="form-section">
        <div class="form-section-title">Overview</div>
        <div class="form-grid cols-3">
          <div class="field"><label>Status</label><div>${stBadge(p.status)}</div></div>
          <div class="field"><label>Type</label><div>${p.type}</div></div>
          <div class="field"><label>RERA Status</label><div>${stBadge(p.reraStatus)}</div></div>
          <div class="field"><label>RERA Number</label><div>${esc(p.rera)}</div></div>
          <div class="field"><label>Launch Date</label><div>${formatDate(p.launchDate)}</div></div>
          <div class="field"><label>Expected Completion</label><div>${formatDate(p.expectedCompletion)}</div></div>
          <div class="field"><label>Possession Date</label><div>${formatDate(p.possessionDate)}</div></div>
          <div class="field"><label>Price Range</label><div>${esc(p.priceRange)}${p.pricePerSqft ? ` <span class="cell-muted">(₹${formatNum(p.pricePerSqft)}/sqft)</span>` : ""}</div></div>
          <div class="field"><label>Links</label><div><a href="${p.mapsUrl}" target="_blank" style="color:var(--blue);">Maps</a> · <a href="${p.website}" target="_blank" style="color:var(--blue);">Website</a> · <a href="${p.dspaceUrl}" target="_blank" style="color:var(--blue);">DSPACE Page</a></div></div>
        </div>
      </div>
      <div class="form-section">
        <div class="form-section-title">Unit Snapshot</div>
        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);">
          ${kpi("Total", us.length)}
          ${kpi("Available", stCount("Available"), "", "green")}
          ${kpi("Reserved", stCount("Reserved"), "", "amber")}
          ${kpi("Sold", stCount("Sold"), "", "blue")}
        </div>
      </div>
      <div class="form-section">
        <div class="form-section-title">Units in this project</div>
        <div class="table-wrap"><table>
          <thead><tr><th>Unit No</th><th>Floor</th><th>Type</th><th>Area (sqft)</th><th>Facing</th><th>Price</th><th>Status</th><th>Realtor</th></tr></thead>
          <tbody>${us.map((u: any) => `<tr>
              <td class="cell-strong">${esc(u.unitNo)}</td><td>${u.floor}</td><td>${u.type}</td><td>${formatNum(u.area)}</td>
              <td>${u.facing}</td><td>${formatCr(u.price)}</td><td>${stBadge(u.status)}</td><td>${esc(realtorById(u.realtorId)?.name || "—")}</td>
            </tr>`).join("") || `<tr><td colspan="8">${emptyRow()}</td></tr>`}</tbody>
        </table></div>
        ${canEdit("units") ? `<div style="margin-top:12px;"><button class="btn btn-outline btn-sm" onclick="closeModal(); openUnitForm(null, '${p.id}')">+ Add Unit to this Project</button></div>` : ""}
      </div>
      <div class="form-section">
        <div class="form-section-title">Amenities</div>
        <div style="display:flex; flex-wrap:wrap; gap:6px;">${p.amenities.map((a: string) => badge(a, "slate")).join("")}</div>
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-outline" onclick="closeModal()">Close</button>
      ${canEdit("projects") ? `<button class="btn btn-navy" onclick="closeModal(); openProjectForm('${p.id}')">Edit Project</button>` : ""}
    </div>
  `,
    true
  );
}

function openProjectForm(id?: any) {
  if (!canEdit("projects")) return;
  const p = id ? projectById(id) : null;
  const v = p || { name: "", developer: "", type: "Apartment", status: "Upcoming", location: "", locality: "", district: "", state: "Kerala", mapsUrl: "", website: "", dspaceUrl: "", rera: "", reraStatus: "Applied / Pending", launchDate: "", expectedCompletion: "", possessionDate: "", unitTypes: "", priceRange: "", pricePerSqft: "", amenities: [], notes: "" };

  openModal(
    `
    <div class="modal-head">
      <div><h3>${p ? "Edit Project" : "Add Project"}</h3><div class="sub">${p ? p.id : "New Project ID will be auto-generated (DSP-XXX)"}</div></div>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <form id="project-form" onsubmit="return submitProject(event, ${p ? `'${p.id}'` : "null"})">
    <div class="modal-body">

      <div class="form-section">
        <div class="form-section-title">Basic Information</div>
        <div class="form-grid">
          <div class="field"><label>Project ID</label><input value="${p ? p.id : "auto-generated on save"}" disabled></div>
          <div class="field"><label>Project Name *</label><input name="name" required value="${esc(v.name)}"></div>
          <div class="field"><label>Developer Name *</label><input name="developer" required value="${esc(v.developer)}"></div>
          <div class="field"><label>Project Type *</label><select name="type">${PROJECT_TYPES.map((t) => `<option ${v.type === t ? "selected" : ""}>${t}</option>`).join("")}</select></div>
          <div class="field"><label>Project Status *</label><select name="status">${PROJECT_STATUSES.map((t) => `<option ${v.status === t ? "selected" : ""}>${t}</option>`).join("")}</select></div>
        </div>
      </div>

      <div class="form-section">
        <div class="form-section-title">Location</div>
        <div class="form-grid cols-3">
          <div class="field"><label>Location / City *</label><input name="location" required value="${esc(v.location)}"></div>
          <div class="field"><label>Locality *</label><input name="locality" required value="${esc(v.locality)}"></div>
          <div class="field"><label>District *</label><input name="district" required value="${esc(v.district)}"></div>
          <div class="field"><label>State *</label><input name="state" required value="${esc(v.state)}"></div>
          <div class="field full"><label>Google Maps Location <span class="opt">(URL)</span></label><input name="mapsUrl" value="${esc(v.mapsUrl)}" placeholder="https://maps.google.com/…"></div>
          <div class="field"><label>Project Website <span class="opt">(URL)</span></label><input name="website" value="${esc(v.website)}"></div>
          <div class="field"><label>DSPACE Project URL <span class="opt">(URL)</span></label><input name="dspaceUrl" value="${esc(v.dspaceUrl)}"></div>
        </div>
      </div>

      <div class="form-section">
        <div class="form-section-title">RERA &amp; Timeline</div>
        <div class="form-grid cols-3">
          <div class="field"><label>RERA Number</label><input name="rera" value="${esc(v.rera)}"></div>
          <div class="field"><label>RERA Status</label><select name="reraStatus">${RERA_STATUSES.map((t) => `<option ${v.reraStatus === t ? "selected" : ""}>${t}</option>`).join("")}</select></div>
          <div class="field"></div>
          <div class="field"><label>Launch Date</label><input type="date" name="launchDate" value="${v.launchDate}"></div>
          <div class="field"><label>Expected Completion</label><input type="date" name="expectedCompletion" value="${v.expectedCompletion}"></div>
          <div class="field"><label>Possession Date</label><input type="date" name="possessionDate" value="${v.possessionDate}"></div>
        </div>
      </div>

      <div class="form-section">
        <div class="form-section-title">Pricing &amp; Configuration</div>
        <div class="form-grid cols-3">
          <div class="field full"><label>Unit Types Available <span class="opt">(comma-separated, e.g. 2 BHK, 3 BHK)</span></label><input name="unitTypes" value="${esc(v.unitTypes)}"></div>
          <div class="field"><label>Price Range</label><input name="priceRange" placeholder="e.g. 55 L – 92 L" value="${esc(v.priceRange)}"></div>
          <div class="field"><label>Price / Sqft <span class="opt">(₹, optional)</span></label><input type="number" name="pricePerSqft" value="${v.pricePerSqft || ""}"></div>
        </div>
      </div>

      <div class="form-section">
        <div class="form-section-title">Amenities</div>
        <div class="checkbox-grid">
          ${AMENITY_LIST.map((a) => `<label class="chk"><input type="checkbox" name="amenities" value="${a}" ${v.amenities.includes(a) ? "checked" : ""}> ${a}</label>`).join("")}
        </div>
      </div>

      <div class="form-section">
        <div class="form-section-title">Media &amp; Documents</div>
        <div class="form-grid">
          <div class="file-btn">📄 Upload Brochure (PDF)</div>
          <div class="file-btn">🗺️ Upload Master Plan</div>
          <div class="file-btn">📐 Upload Floor Plans</div>
          <div class="file-btn">🖼️ Upload Project Images (gallery)</div>
        </div>
        <div class="helper-text">File upload is illustrative in this mockup — wire to real storage (S3 / Cloudinary etc.) on integration.</div>
      </div>

      <div class="form-section">
        <div class="form-section-title">Notes</div>
        <div class="field"><textarea name="notes" placeholder="Internal remarks…">${esc(v.notes)}</textarea></div>
      </div>

    </div>
    <div class="modal-foot">
      <button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button>
      <button type="submit" class="btn btn-navy">${p ? "Save Changes" : "Create Project"}</button>
    </div>
    </form>
  `,
    true
  );
}

function submitProject(e: Event, existingId: any) {
  e.preventDefault();
  if (!canEdit("projects")) return false;
  const f = new FormData(e.target as HTMLFormElement);
  const amenities = f.getAll("amenities");
  const data = {
    name: f.get("name"), developer: f.get("developer"), type: f.get("type"), status: f.get("status"),
    location: f.get("location"), locality: f.get("locality"), district: f.get("district"), state: f.get("state"),
    mapsUrl: f.get("mapsUrl"), website: f.get("website"), dspaceUrl: f.get("dspaceUrl"),
    rera: f.get("rera"), reraStatus: f.get("reraStatus"),
    launchDate: f.get("launchDate"), expectedCompletion: f.get("expectedCompletion"), possessionDate: f.get("possessionDate"),
    unitTypes: f.get("unitTypes"), priceRange: f.get("priceRange"), pricePerSqft: f.get("pricePerSqft") || null,
    amenities, notes: f.get("notes"),
  };
  if (existingId) {
    Object.assign(projectById(existingId), data);
    toast("Project updated");
  } else {
    const id = uid("DSP", ++DB.counters.project);
    DB.projects.push({ id, ...data, assignedRealtors: [] });
    toast("Project created");
  }
  save();
  closeModal();
  render();
  return false;
}

function deleteProject(id: any) {
  if (!canEdit("projects")) return;
  if (!confirm("Delete this project and all its units? This cannot be undone.")) return;
  DB.projects = DB.projects.filter((p: any) => p.id !== id);
  DB.units = DB.units.filter((u: any) => u.projectId !== id);
  save();
  render();
  toast("Project deleted");
}

/* ---------------------------- UNITS ---------------------------------- */
const UNIT_STATUSES = ["Available", "Reserved", "Sold", "On Hold"];
let unitFilter = { project: "", status: "", q: "" };

function renderUnits() {
  const list = DB.units.filter(
    (u: any) =>
      (!unitFilter.project || u.projectId === unitFilter.project) &&
      (!unitFilter.status || u.status === unitFilter.status) &&
      (!unitFilter.q || (u.unitNo + u.type).toLowerCase().includes(unitFilter.q.toLowerCase()))
  );
  const editable = canEdit("units");
  return `
    <div class="panel">
      <div class="panel-head">
        <h2>All Units <span class="cell-muted" style="font-weight:500;">(${list.length})</span></h2>
        <div class="spacer"></div>
        <div class="filter-row">
          <input placeholder="Search unit no / type…" value="${esc(unitFilter.q)}" oninput="unitFilter.q=this.value; render();">
          <select onchange="unitFilter.project=this.value; render();">
            <option value="">All projects</option>
            ${DB.projects.map((p: any) => `<option value="${p.id}" ${unitFilter.project === p.id ? "selected" : ""}>${p.name}</option>`).join("")}
          </select>
          <select onchange="unitFilter.status=this.value; render();">
            <option value="">All statuses</option>
            ${UNIT_STATUSES.map((s) => `<option ${unitFilter.status === s ? "selected" : ""}>${s}</option>`).join("")}
          </select>
        </div>
        ${editable ? `<button class="btn btn-navy" onclick="openUnitForm()">+ Add Unit</button>` : ""}
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>Unit ID</th><th>Project</th><th>Unit No</th><th>Type</th><th>Floor</th><th>Area (sqft)</th><th>Facing</th><th>Price</th><th>Status</th><th>Realtor</th><th></th></tr></thead>
        <tbody>
        ${list.map((u: any) => `<tr>
          <td class="cell-strong">${u.id}</td>
          <td>${esc(projectById(u.projectId)?.name || "—")}</td>
          <td class="cell-strong">${esc(u.unitNo)}</td>
          <td>${u.type}</td><td>${u.floor}</td><td>${formatNum(u.area)}</td><td>${u.facing}</td>
          <td>${formatCr(u.price)}</td><td>${stBadge(u.status)}</td>
          <td>${esc(realtorById(u.realtorId)?.name || "—")}</td>
          <td class="row-actions">
            ${editable ? `<button class="btn-ghost btn-sm" onclick="openUnitForm('${u.id}')" title="Edit">✎</button>
            <button class="btn-danger-ghost btn-sm" onclick="deleteUnit('${u.id}')" title="Delete">🗑</button>` : ""}
          </td>
        </tr>`).join("") || `<tr><td colspan="11">${emptyRow()}</td></tr>`}
        </tbody>
      </table></div>
    </div>
  `;
}

function openUnitForm(id?: any, presetProjectId?: any) {
  if (!canEdit("units")) return;
  const u = id ? unitById(id) : null;
  const v = u || { projectId: presetProjectId || DB.projects[0]?.id || "", unitNo: "", floor: 1, type: "2 BHK", area: "", facing: "East", price: "", status: "Available", realtorId: "" };
  openModal(`
    <div class="modal-head">
      <div><h3>${u ? "Edit Unit" : "Add Unit"}</h3><div class="sub">${u ? u.id : "New Unit"}</div></div>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <form onsubmit="return submitUnit(event, ${u ? `'${u.id}'` : "null"})">
    <div class="modal-body">
      <div class="form-grid">
        <div class="field"><label>Project *</label><select name="projectId" required>${DB.projects.map((p: any) => `<option value="${p.id}" ${v.projectId === p.id ? "selected" : ""}>${p.name} (${p.id})</option>`).join("")}</select></div>
        <div class="field"><label>Unit No *</label><input name="unitNo" required value="${esc(v.unitNo)}" placeholder="e.g. A-304"></div>
        <div class="field"><label>Floor</label><input type="number" name="floor" value="${v.floor}"></div>
        <div class="field"><label>Unit Type *</label><input name="type" required value="${esc(v.type)}" placeholder="2 BHK / Villa / Plot…"></div>
        <div class="field"><label>Area (sqft) *</label><input type="number" name="area" required value="${v.area}"></div>
        <div class="field"><label>Facing</label><select name="facing">${["East", "West", "North", "South", "North-East", "North-West", "South-East", "South-West", "Corner"].map((f) => `<option ${v.facing === f ? "selected" : ""}>${f}</option>`).join("")}</select></div>
        <div class="field"><label>Price (₹) *</label><input type="number" name="price" required value="${v.price}"></div>
        <div class="field"><label>Status *</label><select name="status">${UNIT_STATUSES.map((s) => `<option ${v.status === s ? "selected" : ""}>${s}</option>`).join("")}</select></div>
        <div class="field full"><label>Assigned Realtor <span class="opt">(optional)</span></label><select name="realtorId"><option value="">— Unassigned —</option>${DB.realtors.map((r: any) => `<option value="${r.id}" ${v.realtorId === r.id ? "selected" : ""}>${r.name}</option>`).join("")}</select></div>
      </div>
    </div>
    <div class="modal-foot">
      <button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button>
      <button type="submit" class="btn btn-navy">${u ? "Save Changes" : "Add Unit"}</button>
    </div>
    </form>
  `);
}
function submitUnit(e: Event, existingId: any) {
  e.preventDefault();
  if (!canEdit("units")) return false;
  const f = new FormData(e.target as HTMLFormElement);
  const data = { projectId: f.get("projectId"), unitNo: f.get("unitNo"), floor: Number(f.get("floor") || 1), type: f.get("type"), area: Number(f.get("area")), facing: f.get("facing"), price: Number(f.get("price")), status: f.get("status"), realtorId: f.get("realtorId") || "" };
  if (existingId) {
    Object.assign(unitById(existingId), data);
    toast("Unit updated");
  } else {
    DB.units.push({ id: uid("UNT", ++DB.counters.unit), ...data });
    toast("Unit added");
  }
  save();
  closeModal();
  render();
  return false;
}
function deleteUnit(id: any) {
  if (!canEdit("units")) return;
  if (!confirm("Delete this unit?")) return;
  DB.units = DB.units.filter((u: any) => u.id !== id);
  save();
  render();
  toast("Unit deleted");
}

/* ---------------------------- LEADS ---------------------------------- */
const LEAD_SOURCES = ["Website", "Referral", "Walk-in", "Social Media", "Call", "Campaign", "Site Visit Walk-in"];
const LEAD_STATUSES = ["New", "Contacted", "Site Visit Scheduled", "Negotiation", "Converted", "Lost"];
let leadFilter = { status: "", realtor: "", q: "" };

function renderLeads() {
  const list = DB.leads.filter(
    (l: any) =>
      (!leadFilter.status || l.status === leadFilter.status) &&
      (!leadFilter.realtor || l.realtorId === leadFilter.realtor) &&
      (!leadFilter.q || (l.name + l.phone + l.email).toLowerCase().includes(leadFilter.q.toLowerCase()))
  );
  const editable = canEdit("leads");
  return `
    <div class="panel">
      <div class="panel-head">
        <h2>All Leads <span class="cell-muted" style="font-weight:500;">(${list.length})</span></h2>
        <div class="spacer"></div>
        <div class="filter-row">
          <input placeholder="Search name / phone / email…" value="${esc(leadFilter.q)}" oninput="leadFilter.q=this.value; render();">
          <select onchange="leadFilter.status=this.value; render();">
            <option value="">All statuses</option>
            ${LEAD_STATUSES.map((s) => `<option ${leadFilter.status === s ? "selected" : ""}>${s}</option>`).join("")}
          </select>
          <select onchange="leadFilter.realtor=this.value; render();">
            <option value="">All realtors</option>
            ${DB.realtors.map((r: any) => `<option value="${r.id}" ${leadFilter.realtor === r.id ? "selected" : ""}>${r.name}</option>`).join("")}
          </select>
        </div>
        ${editable ? `<button class="btn btn-navy" onclick="openLeadForm()">+ Add Lead</button>` : ""}
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>Lead</th><th>Contact</th><th>Source</th><th>Interested Project</th><th>Budget</th><th>Status</th><th>Realtor</th><th>Follow-up</th><th>Created</th><th></th></tr></thead>
        <tbody>
        ${list.map((l: any) => `<tr>
          <td class="cell-strong">${esc(l.name)}</td>
          <td class="cell-muted">${esc(l.phone)}<br>${esc(l.email)}</td>
          <td>${badge(l.source, "slate")}</td>
          <td>${esc(projectById(l.projectId)?.name || "General inquiry")}</td>
          <td>${esc(l.budget)}</td>
          <td>${stBadge(l.status)}</td>
          <td>${esc(realtorById(l.realtorId)?.name || "—")}</td>
          <td class="${isToday(l.followUpDate) ? "" : "cell-muted"}">${l.followUpDate ? formatDate(l.followUpDate) : "—"}${isToday(l.followUpDate) ? ' <b style="color:var(--amber)">· today</b>' : ""}</td>
          <td class="cell-muted">${formatDate(l.createdDate)}</td>
          <td class="row-actions">
            ${editable ? `<button class="btn-ghost btn-sm" onclick="openLeadForm('${l.id}')" title="Edit">✎</button>
            <button class="btn-danger-ghost btn-sm" onclick="deleteLead('${l.id}')" title="Delete">🗑</button>` : ""}
          </td>
        </tr>`).join("") || `<tr><td colspan="10">${emptyRow()}</td></tr>`}
        </tbody>
      </table></div>
    </div>
  `;
}
function openLeadForm(id?: any) {
  if (!canEdit("leads")) return;
  const l = id ? leadById(id) : null;
  const v = l || { name: "", phone: "", email: "", source: "Website", projectId: "", budget: "", status: "New", realtorId: "", followUpDate: "", notes: "" };
  openModal(`
    <div class="modal-head">
      <div><h3>${l ? "Edit Lead" : "Add Lead"}</h3><div class="sub">${l ? l.id : "New Lead"}</div></div>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <form onsubmit="return submitLead(event, ${l ? `'${l.id}'` : "null"})">
    <div class="modal-body">
      <div class="form-grid">
        <div class="field"><label>Full Name *</label><input name="name" required value="${esc(v.name)}"></div>
        <div class="field"><label>Phone *</label><input name="phone" required value="${esc(v.phone)}"></div>
        <div class="field"><label>Email</label><input type="email" name="email" value="${esc(v.email)}"></div>
        <div class="field"><label>Source</label><select name="source">${LEAD_SOURCES.map((s) => `<option ${v.source === s ? "selected" : ""}>${s}</option>`).join("")}</select></div>
        <div class="field"><label>Interested Project</label><select name="projectId"><option value="">General inquiry</option>${DB.projects.map((p: any) => `<option value="${p.id}" ${v.projectId === p.id ? "selected" : ""}>${p.name}</option>`).join("")}</select></div>
        <div class="field"><label>Budget Range</label><input name="budget" value="${esc(v.budget)}" placeholder="e.g. 60 L – 80 L"></div>
        <div class="field"><label>Status</label><select name="status">${LEAD_STATUSES.map((s) => `<option ${v.status === s ? "selected" : ""}>${s}</option>`).join("")}</select></div>
        <div class="field"><label>Assigned Realtor</label><select name="realtorId"><option value="">— Unassigned —</option>${DB.realtors.map((r: any) => `<option value="${r.id}" ${v.realtorId === r.id ? "selected" : ""}>${r.name}</option>`).join("")}</select></div>
        <div class="field"><label>Follow-up Date</label><input type="date" name="followUpDate" value="${v.followUpDate}"></div>
        <div class="field full"><label>Notes</label><textarea name="notes">${esc(v.notes)}</textarea></div>
      </div>
    </div>
    <div class="modal-foot">
      <button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button>
      <button type="submit" class="btn btn-navy">${l ? "Save Changes" : "Add Lead"}</button>
    </div>
    </form>
  `);
}
function submitLead(e: Event, existingId: any) {
  e.preventDefault();
  if (!canEdit("leads")) return false;
  const f = new FormData(e.target as HTMLFormElement);
  const data = { name: f.get("name"), phone: f.get("phone"), email: f.get("email"), source: f.get("source"), projectId: f.get("projectId") || "", budget: f.get("budget"), status: f.get("status"), realtorId: f.get("realtorId") || "", followUpDate: f.get("followUpDate"), notes: f.get("notes") };
  if (existingId) {
    Object.assign(leadById(existingId), data);
    toast("Lead updated");
  } else {
    DB.leads.push({ id: uid("LD", ++DB.counters.lead), ...data, createdDate: todayISO() });
    toast("Lead added");
  }
  save();
  closeModal();
  render();
  return false;
}
function deleteLead(id: any) {
  if (!canEdit("leads")) return;
  if (!confirm("Delete this lead?")) return;
  DB.leads = DB.leads.filter((l: any) => l.id !== id);
  save();
  render();
  toast("Lead deleted");
}

/* ---------------------------- REALTORS ---------------------------------- */
let realtorFilter = { status: "", q: "" };
function realtorStats(rid: any) {
  const leadsCount = DB.leads.filter((l: any) => l.realtorId === rid).length;
  const visitsCount = DB.visits.filter((v: any) => v.realtorId === rid).length;
  const bookings = DB.bookings.filter((b: any) => b.realtorId === rid);
  const sales = bookings.reduce((s: number, x: any) => s + Number(x.saleValue || 0), 0);
  const commission = bookings.reduce((s: number, x: any) => s + Number(x.commissionAmount || 0), 0);
  return { leadsCount, visitsCount, bookingsCount: bookings.length, sales, commission };
}
function renderRealtors() {
  const list = DB.realtors.filter(
    (r: any) =>
      (!realtorFilter.status || r.status === realtorFilter.status) &&
      (!realtorFilter.q || (r.name + r.agency + r.region).toLowerCase().includes(realtorFilter.q.toLowerCase()))
  );
  const editable = canEdit("realtors");
  return `
    <div class="panel">
      <div class="panel-head">
        <h2>All Realtors <span class="cell-muted" style="font-weight:500;">(${list.length})</span></h2>
        <div class="spacer"></div>
        <div class="filter-row">
          <input placeholder="Search name / agency / region…" value="${esc(realtorFilter.q)}" oninput="realtorFilter.q=this.value; render();">
          <select onchange="realtorFilter.status=this.value; render();">
            <option value="">All statuses</option>
            <option ${realtorFilter.status === "Active" ? "selected" : ""}>Active</option>
            <option ${realtorFilter.status === "Inactive" ? "selected" : ""}>Inactive</option>
          </select>
        </div>
        ${editable ? `<button class="btn btn-navy" onclick="openRealtorForm()">+ Add Realtor</button>` : ""}
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>Realtor</th><th>Contact</th><th>Agency</th><th>Region</th><th>Comm. Rate</th><th>Leads</th><th>Visits</th><th>Bookings</th><th>Sales Value</th><th>Commission Earned</th><th>Status</th><th></th></tr></thead>
        <tbody>
        ${list.map((r: any) => {
          const s = realtorStats(r.id);
          return `<tr>
          <td class="cell-strong">${esc(r.name)}</td>
          <td class="cell-muted">${esc(r.phone)}<br>${esc(r.email)}</td>
          <td>${esc(r.agency)}</td><td>${esc(r.region)}</td><td>${r.commissionRate}%</td>
          <td>${s.leadsCount}</td><td>${s.visitsCount}</td><td>${s.bookingsCount}</td>
          <td>${formatCr(s.sales)}</td><td>${formatCr(s.commission)}</td>
          <td>${stBadge(r.status)}</td>
          <td class="row-actions">
            ${editable ? `<button class="btn-ghost btn-sm" onclick="openRealtorForm('${r.id}')" title="Edit">✎</button>
            <button class="btn-danger-ghost btn-sm" onclick="deleteRealtor('${r.id}')" title="Delete">🗑</button>` : ""}
          </td>
        </tr>`;
        }).join("") || `<tr><td colspan="12">${emptyRow()}</td></tr>`}
        </tbody>
      </table></div>
    </div>
  `;
}
function openRealtorForm(id?: any) {
  if (!canEdit("realtors")) return;
  const r = id ? realtorById(id) : null;
  const v = r || { name: "", phone: "", email: "", agency: "", region: "", commissionRate: 2, status: "Active" };
  openModal(`
    <div class="modal-head">
      <div><h3>${r ? "Edit Realtor" : "Add Realtor"}</h3><div class="sub">${r ? r.id : "New Realtor"}</div></div>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <form onsubmit="return submitRealtor(event, ${r ? `'${r.id}'` : "null"})">
    <div class="modal-body">
      <div class="form-grid">
        <div class="field"><label>Full Name *</label><input name="name" required value="${esc(v.name)}"></div>
        <div class="field"><label>Phone *</label><input name="phone" required value="${esc(v.phone)}"></div>
        <div class="field"><label>Email</label><input type="email" name="email" value="${esc(v.email)}"></div>
        <div class="field"><label>Agency <span class="opt">(or "Independent")</span></label><input name="agency" value="${esc(v.agency)}"></div>
        <div class="field"><label>Region</label><input name="region" value="${esc(v.region)}"></div>
        <div class="field"><label>Commission Rate (%)</label><input type="number" step="0.1" name="commissionRate" value="${v.commissionRate}"></div>
        <div class="field"><label>Status</label><select name="status"><option ${v.status === "Active" ? "selected" : ""}>Active</option><option ${v.status === "Inactive" ? "selected" : ""}>Inactive</option></select></div>
      </div>
    </div>
    <div class="modal-foot">
      <button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button>
      <button type="submit" class="btn btn-navy">${r ? "Save Changes" : "Add Realtor"}</button>
    </div>
    </form>
  `);
}
function submitRealtor(e: Event, existingId: any) {
  e.preventDefault();
  if (!canEdit("realtors")) return false;
  const f = new FormData(e.target as HTMLFormElement);
  const data = { name: f.get("name"), phone: f.get("phone"), email: f.get("email"), agency: f.get("agency"), region: f.get("region"), commissionRate: Number(f.get("commissionRate") || 0), status: f.get("status") };
  if (existingId) {
    Object.assign(realtorById(existingId), data);
    toast("Realtor updated");
  } else {
    DB.realtors.push({ id: uid("RLT", ++DB.counters.realtor), ...data });
    toast("Realtor added");
  }
  save();
  closeModal();
  render();
  return false;
}
function deleteRealtor(id: any) {
  if (!canEdit("realtors")) return;
  if (!confirm("Delete this realtor?")) return;
  DB.realtors = DB.realtors.filter((r: any) => r.id !== id);
  save();
  render();
  toast("Realtor deleted");
}

/* ---------------------------- SITE VISITS ---------------------------------- */
const VISIT_STATUSES = ["Scheduled", "Completed Visit", "Cancelled", "No-show"];
let visitFilter = { status: "", q: "" };
function renderVisits() {
  const list = [...DB.visits].filter((v: any) => !visitFilter.status || v.status === visitFilter.status).sort((a: any, b: any) => +new Date(b.date) - +new Date(a.date));
  const editable = canEdit("visits");
  return `
    <div class="panel">
      <div class="panel-head">
        <h2>All Site Visits <span class="cell-muted" style="font-weight:500;">(${list.length})</span></h2>
        <div class="spacer"></div>
        <div class="filter-row">
          <select onchange="visitFilter.status=this.value; render();">
            <option value="">All statuses</option>
            ${VISIT_STATUSES.map((s) => `<option ${visitFilter.status === s ? "selected" : ""}>${s}</option>`).join("")}
          </select>
        </div>
        ${editable ? `<button class="btn btn-navy" onclick="openVisitForm()">+ Add Site Visit</button>` : ""}
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>Visit ID</th><th>Lead</th><th>Project</th><th>Unit</th><th>Realtor</th><th>Date</th><th>Time</th><th>Status</th><th></th></tr></thead>
        <tbody>
        ${list.map((v: any) => `<tr>
          <td class="cell-strong">${v.id}</td>
          <td>${esc(leadById(v.leadId)?.name || "—")}</td>
          <td>${esc(projectById(v.projectId)?.name || "—")}</td>
          <td>${esc(v.unitId || "—")}</td>
          <td>${esc(realtorById(v.realtorId)?.name || "—")}</td>
          <td class="${isToday(v.date) ? "" : "cell-muted"}">${formatDate(v.date)}${isToday(v.date) ? ' <b style="color:var(--amber)">· today</b>' : ""}</td>
          <td class="cell-muted">${v.time}</td>
          <td>${stBadge(v.status)}</td>
          <td class="row-actions">
            ${editable ? `<button class="btn-ghost btn-sm" onclick="openVisitForm('${v.id}')" title="Edit">✎</button>
            <button class="btn-danger-ghost btn-sm" onclick="deleteVisit('${v.id}')" title="Delete">🗑</button>` : ""}
          </td>
        </tr>`).join("") || `<tr><td colspan="9">${emptyRow()}</td></tr>`}
        </tbody>
      </table></div>
    </div>
  `;
}
function openVisitForm(id?: any) {
  if (!canEdit("visits")) return;
  const vi = id ? DB.visits.find((x: any) => x.id === id) : null;
  const v = vi || { leadId: "", projectId: DB.projects[0]?.id || "", unitId: "", realtorId: "", date: todayISO(), time: "11:00 AM", status: "Scheduled", feedback: "" };
  openModal(`
    <div class="modal-head">
      <div><h3>${vi ? "Edit Site Visit" : "Add Site Visit"}</h3><div class="sub">${vi ? vi.id : "New Site Visit"}</div></div>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <form onsubmit="return submitVisit(event, ${vi ? `'${vi.id}'` : "null"})">
    <div class="modal-body">
      <div class="form-grid">
        <div class="field"><label>Lead *</label><select name="leadId" required><option value="">Select lead…</option>${DB.leads.map((l: any) => `<option value="${l.id}" ${v.leadId === l.id ? "selected" : ""}>${l.name}</option>`).join("")}</select></div>
        <div class="field"><label>Project *</label><select name="projectId" required>${DB.projects.map((p: any) => `<option value="${p.id}" ${v.projectId === p.id ? "selected" : ""}>${p.name}</option>`).join("")}</select></div>
        <div class="field"><label>Unit <span class="opt">(optional)</span></label><input name="unitId" value="${esc(v.unitId)}" placeholder="e.g. UNT-004"></div>
        <div class="field"><label>Realtor *</label><select name="realtorId" required>${DB.realtors.map((r: any) => `<option value="${r.id}" ${v.realtorId === r.id ? "selected" : ""}>${r.name}</option>`).join("")}</select></div>
        <div class="field"><label>Date *</label><input type="date" name="date" required value="${v.date}"></div>
        <div class="field"><label>Time</label><input name="time" value="${esc(v.time)}" placeholder="e.g. 11:00 AM"></div>
        <div class="field"><label>Status</label><select name="status">${VISIT_STATUSES.map((s) => `<option ${v.status === s ? "selected" : ""}>${s}</option>`).join("")}</select></div>
        <div class="field full"><label>Feedback / Notes</label><textarea name="feedback">${esc(v.feedback)}</textarea></div>
      </div>
    </div>
    <div class="modal-foot">
      <button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button>
      <button type="submit" class="btn btn-navy">${vi ? "Save Changes" : "Schedule Visit"}</button>
    </div>
    </form>
  `);
}
function submitVisit(e: Event, existingId: any) {
  e.preventDefault();
  if (!canEdit("visits")) return false;
  const f = new FormData(e.target as HTMLFormElement);
  const data = { leadId: f.get("leadId"), projectId: f.get("projectId"), unitId: f.get("unitId") || "", realtorId: f.get("realtorId"), date: f.get("date"), time: f.get("time"), status: f.get("status"), feedback: f.get("feedback") };
  if (existingId) {
    Object.assign(DB.visits.find((x: any) => x.id === existingId), data);
    toast("Site visit updated");
  } else {
    DB.visits.push({ id: uid("SV", ++DB.counters.visit), ...data });
    toast("Site visit scheduled");
  }
  save();
  closeModal();
  render();
  return false;
}
function deleteVisit(id: any) {
  if (!canEdit("visits")) return;
  if (!confirm("Delete this site visit?")) return;
  DB.visits = DB.visits.filter((x: any) => x.id !== id);
  save();
  render();
  toast("Site visit deleted");
}

/* ---------------------------- BOOKINGS ---------------------------------- */
const BOOKING_STATUSES = ["Booked", "Confirmed", "Cancelled"];
const COMMISSION_STATUSES = ["Pending", "Received"];
let bookingFilter = { status: "", q: "" };
function renderBookings() {
  const list = [...DB.bookings].filter((b: any) => !bookingFilter.status || b.status === bookingFilter.status).sort((a: any, b: any) => +new Date(b.bookingDate) - +new Date(a.bookingDate));
  const editable = canEdit("bookings");
  return `
    <div class="panel">
      <div class="panel-head">
        <h2>All Bookings <span class="cell-muted" style="font-weight:500;">(${list.length})</span></h2>
        <div class="spacer"></div>
        <div class="filter-row">
          <select onchange="bookingFilter.status=this.value; render();">
            <option value="">All statuses</option>
            ${BOOKING_STATUSES.map((s) => `<option ${bookingFilter.status === s ? "selected" : ""}>${s}</option>`).join("")}
          </select>
        </div>
        ${editable ? `<button class="btn btn-navy" onclick="openBookingForm()">+ Add Booking</button>` : ""}
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>Booking ID</th><th>Unit</th><th>Project</th><th>Realtor</th><th>Booking Date</th><th>Sale Value</th><th>Token Amt</th><th>Commission</th><th>Comm. Status</th><th>Status</th><th></th></tr></thead>
        <tbody>
        ${list.map((b: any) => {
          const u = unitById(b.unitId);
          return `<tr>
          <td class="cell-strong">${b.id}</td>
          <td>${esc(u?.unitNo || b.unitId)}</td>
          <td>${esc(projectById(u?.projectId)?.name || "—")}</td>
          <td>${esc(realtorById(b.realtorId)?.name || "—")}</td>
          <td class="cell-muted">${formatDate(b.bookingDate)}</td>
          <td class="cell-strong">${formatCr(b.saleValue)}</td>
          <td>${formatCr(b.tokenAmount)}</td>
          <td>${formatCr(b.commissionAmount)} <span class="cell-muted">(${b.commissionRate}%)</span></td>
          <td>${stBadge(b.commissionStatus)}</td>
          <td>${stBadge(b.status)}</td>
          <td class="row-actions">
            ${editable ? `<button class="btn-ghost btn-sm" onclick="openBookingForm('${b.id}')" title="Edit">✎</button>
            <button class="btn-danger-ghost btn-sm" onclick="deleteBooking('${b.id}')" title="Delete">🗑</button>` : ""}
          </td>
        </tr>`;
        }).join("") || `<tr><td colspan="11">${emptyRow()}</td></tr>`}
        </tbody>
      </table></div>
    </div>
  `;
}
function openBookingForm(id?: any) {
  if (!canEdit("bookings")) return;
  const bk = id ? DB.bookings.find((x: any) => x.id === id) : null;
  const v = bk || { leadId: "", unitId: "", realtorId: "", bookingDate: todayISO(), saleValue: "", tokenAmount: "", commissionRate: 2, commissionAmount: "", commissionStatus: "Pending", status: "Booked" };
  openModal(`
    <div class="modal-head">
      <div><h3>${bk ? "Edit Booking" : "Add Booking"}</h3><div class="sub">${bk ? bk.id : "New Booking"}</div></div>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <form onsubmit="return submitBooking(event, ${bk ? `'${bk.id}'` : "null"})">
    <div class="modal-body">
      <div class="form-grid">
        <div class="field"><label>Lead / Buyer <span class="opt">(optional)</span></label><select name="leadId"><option value="">— Direct buyer —</option>${DB.leads.map((l: any) => `<option value="${l.id}" ${v.leadId === l.id ? "selected" : ""}>${l.name}</option>`).join("")}</select></div>
        <div class="field"><label>Unit *</label><select name="unitId" required>${DB.units.map((u: any) => `<option value="${u.id}" ${v.unitId === u.id ? "selected" : ""}>${u.unitNo} — ${projectById(u.projectId)?.name} (${u.id})</option>`).join("")}</select></div>
        <div class="field"><label>Realtor *</label><select name="realtorId" required>${DB.realtors.map((r: any) => `<option value="${r.id}" ${v.realtorId === r.id ? "selected" : ""}>${r.name}</option>`).join("")}</select></div>
        <div class="field"><label>Booking Date *</label><input type="date" name="bookingDate" required value="${v.bookingDate}"></div>
        <div class="field"><label>Sale Value (₹) *</label><input type="number" name="saleValue" required value="${v.saleValue}"></div>
        <div class="field"><label>Token / Booking Amount (₹)</label><input type="number" name="tokenAmount" value="${v.tokenAmount}"></div>
        <div class="field"><label>Commission Rate (%)</label><input type="number" step="0.1" name="commissionRate" value="${v.commissionRate}"></div>
        <div class="field"><label>Commission Amount (₹)</label><input type="number" name="commissionAmount" value="${v.commissionAmount}" placeholder="Leave blank to auto-calc"></div>
        <div class="field"><label>Commission Status</label><select name="commissionStatus">${COMMISSION_STATUSES.map((s) => `<option ${v.commissionStatus === s ? "selected" : ""}>${s}</option>`).join("")}</select></div>
        <div class="field"><label>Booking Status</label><select name="status">${BOOKING_STATUSES.map((s) => `<option ${v.status === s ? "selected" : ""}>${s}</option>`).join("")}</select></div>
      </div>
    </div>
    <div class="modal-foot">
      <button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button>
      <button type="submit" class="btn btn-navy">${bk ? "Save Changes" : "Add Booking"}</button>
    </div>
    </form>
  `);
}
function submitBooking(e: Event, existingId: any) {
  e.preventDefault();
  if (!canEdit("bookings")) return false;
  const f = new FormData(e.target as HTMLFormElement);
  const saleValue = Number(f.get("saleValue") || 0);
  const rate = Number(f.get("commissionRate") || 0);
  const commissionAmount = f.get("commissionAmount") ? Number(f.get("commissionAmount")) : Math.round((saleValue * rate) / 100);
  const data = { leadId: f.get("leadId") || "", unitId: f.get("unitId"), realtorId: f.get("realtorId"), bookingDate: f.get("bookingDate"), saleValue, tokenAmount: Number(f.get("tokenAmount") || 0), commissionRate: rate, commissionAmount, commissionStatus: f.get("commissionStatus"), status: f.get("status") };
  if (existingId) {
    Object.assign(DB.bookings.find((x: any) => x.id === existingId), data);
    toast("Booking updated");
  } else {
    DB.bookings.push({ id: uid("BK", ++DB.counters.booking), ...data });
    const u = unitById(data.unitId);
    if (u) u.status = "Sold";
    toast("Booking added");
  }
  save();
  closeModal();
  render();
  return false;
}
function deleteBooking(id: any) {
  if (!canEdit("bookings")) return;
  if (!confirm("Delete this booking?")) return;
  DB.bookings = DB.bookings.filter((x: any) => x.id !== id);
  save();
  render();
  toast("Booking deleted");
}

/* ---------------------------- COMMISSIONS ---------------------------------- */
function renderCommissions() {
  const totalExpected = DB.bookings.reduce((s: number, x: any) => s + Number(x.commissionAmount || 0), 0);
  const totalReceived = DB.bookings.filter((x: any) => x.commissionStatus === "Received").reduce((s: number, x: any) => s + Number(x.commissionAmount || 0), 0);
  const totalPending = totalExpected - totalReceived;

  const byRealtor = DB.realtors
    .map((r: any) => {
      const bs = DB.bookings.filter((b: any) => b.realtorId === r.id);
      const expected = bs.reduce((s: number, x: any) => s + Number(x.commissionAmount || 0), 0);
      const received = bs.filter((x: any) => x.commissionStatus === "Received").reduce((s: number, x: any) => s + Number(x.commissionAmount || 0), 0);
      return { r, count: bs.length, expected, received, pending: expected - received };
    })
    .filter((x: any) => x.count > 0)
    .sort((a: any, b: any) => b.expected - a.expected);

  return `
    <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr); margin-bottom:22px;">
      ${kpi("Expected Commission", formatCr(totalExpected), "across all bookings", "gold")}
      ${kpi("Commission Received", formatCr(totalReceived), "settled to date", "green")}
      ${kpi("Commission Pending", formatCr(totalPending), "awaiting settlement", "amber")}
    </div>

    <div class="panel" style="margin-bottom:20px;">
      <div class="panel-head"><h2>By Realtor</h2></div>
      <div class="table-wrap"><table>
        <thead><tr><th>Realtor</th><th>Agency</th><th>Bookings</th><th>Expected</th><th>Received</th><th>Pending</th></tr></thead>
        <tbody>
        ${byRealtor.map((x: any) => `<tr>
          <td class="cell-strong">${esc(x.r.name)}</td><td>${esc(x.r.agency)}</td><td>${x.count}</td>
          <td>${formatCr(x.expected)}</td><td style="color:var(--green); font-weight:700;">${formatCr(x.received)}</td>
          <td style="color:var(--amber); font-weight:700;">${formatCr(x.pending)}</td>
        </tr>`).join("") || `<tr><td colspan="6">${emptyRow()}</td></tr>`}
        </tbody>
      </table></div>
    </div>

    <div class="panel">
      <div class="panel-head"><h2>All Booking Commissions</h2></div>
      <div class="table-wrap"><table>
        <thead><tr><th>Booking</th><th>Realtor</th><th>Sale Value</th><th>Rate</th><th>Commission</th><th>Status</th><th>Booking Date</th></tr></thead>
        <tbody>
        ${DB.bookings.map((b: any) => `<tr>
          <td class="cell-strong">${b.id}</td>
          <td>${esc(realtorById(b.realtorId)?.name || "—")}</td>
          <td>${formatCr(b.saleValue)}</td><td>${b.commissionRate}%</td>
          <td class="cell-strong">${formatCr(b.commissionAmount)}</td>
          <td>${stBadge(b.commissionStatus)}</td><td class="cell-muted">${formatDate(b.bookingDate)}</td>
        </tr>`).join("") || `<tr><td colspan="7">${emptyRow()}</td></tr>`}
        </tbody>
      </table></div>
    </div>
  `;
}

/* ---------------------------- mount / globals ---------------------------- */
// Templates above use plain HTML onclick/onchange attribute strings (kept
// verbatim from the original mockup), so the functions and filter objects
// they reference must exist on `window` — this is the only bridge needed;
// the render functions themselves keep talking to `DB` via normal module
// closures.
function publishGlobals() {
  Object.assign(window as any, {
    render,
    resetDemoData,
    viewProject,
    openProjectForm, submitProject, deleteProject,
    openUnitForm, submitUnit, deleteUnit,
    openLeadForm, submitLead, deleteLead,
    openRealtorForm, submitRealtor, deleteRealtor,
    openVisitForm, submitVisit, deleteVisit,
    openBookingForm, submitBooking, deleteBooking,
    closeModal,
    projectFilter, unitFilter, leadFilter, realtorFilter, visitFilter, bookingFilter,
  });
}

export function mountErp(view: ErpView, permissions: Permissions) {
  currentView = view;
  PERMS = permissions;
  publishGlobals();
  load();

  if (!overlayListenerAttached) {
    document.getElementById("overlay")?.addEventListener("click", (e) => {
      if ((e.target as HTMLElement).id === "overlay") closeModal();
    });
    overlayListenerAttached = true;
  }

  render();
}
