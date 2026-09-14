import { requireModule } from "@/lib/auth-guard";
import ErpLegacyClient from "@/components/erp/ErpLegacyClient";
import AccessRestricted from "@/components/AccessRestricted";

export default async function UnitsPage() {
  const { user, allowed } = await requireModule("units", "view");
  if (!allowed) return <AccessRestricted moduleLabel="Units" />;
  return <ErpLegacyClient view="units" permissions={user.role.permissions} />;
}
