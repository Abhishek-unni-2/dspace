// Single source of truth for the ERP's modules and role permission levels.
// The Dashboard itself is always reachable by any signed-in user; only the
// modules below are configurable per role. Each module's individual "quick
// action" / add / edit / delete controls are gated by the same level.

export const MODULES = [
  { key: "projects", label: "Projects" },
  { key: "units", label: "Units" },
  { key: "leads", label: "Leads" },
  { key: "realtors", label: "Realtors" },
  { key: "visits", label: "Site Visits" },
  { key: "bookings", label: "Bookings" },
  { key: "commissions", label: "Commissions" },
] as const;

// What can be switched on/off per user: the Dashboard plus every module.
export const NAV_MODULES = [{ key: "dashboard", label: "Dashboard" }, ...MODULES] as const;
export const NAV_KEYS: string[] = NAV_MODULES.map((m) => m.key);

export type ModuleKey = (typeof MODULES)[number]["key"];

export type AccessLevel = "none" | "view" | "edit";

export type Permissions = Record<ModuleKey, AccessLevel>;

export const ACCESS_LEVELS: { value: AccessLevel; label: string }[] = [
  { value: "none", label: "No access" },
  { value: "view", label: "View only" },
  { value: "edit", label: "Full access" },
];

export function noAccess(): Permissions {
  return MODULES.reduce((acc, m) => {
    acc[m.key] = "none";
    return acc;
  }, {} as Permissions);
}

export function fullAccess(): Permissions {
  return MODULES.reduce((acc, m) => {
    acc[m.key] = "edit";
    return acc;
  }, {} as Permissions);
}

export function isModuleKey(value: string): value is ModuleKey {
  return MODULES.some((m) => m.key === value);
}

export function meetsLevel(level: AccessLevel | undefined, min: "view" | "edit"): boolean {
  if (!level || level === "none") return false;
  if (min === "view") return true;
  return level === "edit";
}

// Normalizes a permissions object coming from the database (or a form) so
// that every module key is present and holds a valid access level, even if
// the stored JSON is stale (e.g. a module was added after the role was
// created).
export function normalizePermissions(input: unknown): Permissions {
  const result = noAccess();
  if (input && typeof input === "object") {
    for (const m of MODULES) {
      const raw = (input as Record<string, unknown>)[m.key];
      if (raw === "view" || raw === "edit" || raw === "none") {
        result[m.key] = raw;
      }
    }
  }
  return result;
}
