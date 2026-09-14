"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MODULES, type Permissions } from "@/lib/permissions";
import { logoutAction } from "@/app/login/actions";
import { Icon, type IconKey } from "@/components/icons";

type NavItem = { key: string; label: string; href: string; icon: IconKey };

const MODULE_ICON: Record<string, IconKey> = {
  projects: "projects",
  units: "units",
  leads: "leads",
  realtors: "realtors",
  visits: "visits",
  bookings: "bookings",
  commissions: "commissions",
};

const CRUMB: Record<string, string> = {
  dashboard: "DSPACE Overview",
  projects: "Project Management",
  units: "Unit Inventory",
  leads: "Lead Management",
  realtors: "Realtor Management",
  visits: "Site Visit Scheduling",
  bookings: "Bookings & Sales",
  commissions: "Commission Tracking",
  "admin/users": "User Management",
  "admin/roles": "Roles & Permissions",
};

export default function AppShell({
  user,
  children,
}: {
  user: {
    name: string;
    role: { name: string; isAdmin: boolean; permissions: Permissions };
  };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navItems: NavItem[] = [{ key: "dashboard", label: "Dashboard", href: "/dashboard", icon: "dashboard" }];
  for (const m of MODULES) {
    if (user.role.permissions[m.key] !== "none") {
      navItems.push({ key: m.key, label: m.label, href: `/${m.key}`, icon: MODULE_ICON[m.key] });
    }
  }

  const activeItem =
    [...navItems].sort((a, b) => b.href.length - a.href.length).find((item) => pathname.startsWith(item.href)) ||
    navItems[0];

  let title = activeItem?.label || "Dashboard";
  let crumbKey = activeItem?.key || "dashboard";
  if (pathname.startsWith("/admin/users")) {
    title = "User Management";
    crumbKey = "admin/users";
  } else if (pathname.startsWith("/admin/roles")) {
    title = "Roles & Permissions";
    crumbKey = "admin/roles";
  }

  const initials = user.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");

  return (
    <div className="app">
      <aside className={`sidebar${sidebarOpen ? " open" : ""}`}>
        <div className="sidebar-brand">
          <div className="mark">
            <svg viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.6" strokeLinecap="square">
              <path d="M4 19L12 4L20 19" />
            </svg>
          </div>
          <div>
            <div className="word">DSPΛCE</div>
            <div className="sub">Building Spaces. Creating Futures.</div>
          </div>
        </div>

        <nav className="nav">
          {navItems.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className={`nav-item${activeItem?.key === item.key ? " active" : ""}`}
              onClick={() => setSidebarOpen(false)}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </Link>
          ))}

          {user.role.isAdmin && (
            <>
              <div className="nav-group-label">Admin</div>
              <Link
                href="/admin/users"
                className={`nav-item${pathname.startsWith("/admin/users") ? " active" : ""}`}
                onClick={() => setSidebarOpen(false)}
              >
                <Icon name="admin" />
                <span>Users</span>
              </Link>
              <Link
                href="/admin/roles"
                className={`nav-item${pathname.startsWith("/admin/roles") ? " active" : ""}`}
                onClick={() => setSidebarOpen(false)}
              >
                <Icon name="admin" />
                <span>Roles</span>
              </Link>
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="avatar">{initials || "?"}</div>
          <div className="who">
            <div className="name">{user.name}</div>
            <div className="role">{user.role.name}</div>
          </div>
          <form action={logoutAction}>
            <button type="submit" className="signout" title="Sign out">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <path d="M16 17l5-5-5-5" />
                <path d="M21 12H9" />
              </svg>
            </button>
          </form>
        </div>
      </aside>

      <div className="main">
        <div className="topbar">
          <button className="icon-btn menu-toggle" onClick={() => setSidebarOpen((v) => !v)} aria-label="Toggle menu">
            ☰
          </button>
          <div>
            <h1>{title}</h1>
            <div className="crumb">{CRUMB[crumbKey] || ""}</div>
          </div>
          <div className="topbar-right">
            <div className="search-box">
              🔍 <input placeholder="Search projects, leads, units…" />
            </div>
            <button className="icon-btn" title="Notifications">
              🔔
            </button>
          </div>
        </div>
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
