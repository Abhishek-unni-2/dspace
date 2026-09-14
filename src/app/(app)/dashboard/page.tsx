import { requireUser } from "@/lib/auth-guard";
import ErpLegacyClient from "@/components/erp/ErpLegacyClient";

export default async function DashboardPage() {
  const user = await requireUser();
  return <ErpLegacyClient view="dashboard" permissions={user.role.permissions} />;
}
