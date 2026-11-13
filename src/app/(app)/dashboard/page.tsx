import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth-guard";
import { MODULES } from "@/lib/permissions";
import ErpLegacyClient from "@/components/erp/ErpLegacyClient";

export default async function DashboardPage() {
  const user = await requireUser();
  if (!user.canDashboard) {
    // Dashboard is switched off for this user: land on their first allowed module.
    const first = MODULES.find((m) => user.role.permissions[m.key] !== "none");
    if (first) redirect(`/${first.key}`);
    return <div className="cell-muted" style={{ padding: 30 }}>No modules are enabled for your account. Ask an administrator.</div>;
  }
  return <ErpLegacyClient view="dashboard" permissions={user.role.permissions} />;
}
