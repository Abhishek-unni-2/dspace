import { requireModule } from "@/lib/auth-guard";
import ErpLegacyClient from "@/components/erp/ErpLegacyClient";
import AccessRestricted from "@/components/AccessRestricted";

export default async function LeadsPage() {
  const { user, allowed } = await requireModule("leads", "view");
  if (!allowed) return <AccessRestricted moduleLabel="Leads" />;
  return <ErpLegacyClient view="leads" permissions={user.role.permissions} />;
}
