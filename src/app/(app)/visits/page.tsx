import { requireModule } from "@/lib/auth-guard";
import ErpLegacyClient from "@/components/erp/ErpLegacyClient";
import AccessRestricted from "@/components/AccessRestricted";

export default async function VisitsPage() {
  const { user, allowed } = await requireModule("visits", "view");
  if (!allowed) return <AccessRestricted moduleLabel="Site Visits" />;
  return <ErpLegacyClient view="visits" permissions={user.role.permissions} />;
}
