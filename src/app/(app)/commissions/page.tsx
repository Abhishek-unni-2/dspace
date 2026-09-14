import { requireModule } from "@/lib/auth-guard";
import ErpLegacyClient from "@/components/erp/ErpLegacyClient";
import AccessRestricted from "@/components/AccessRestricted";

export default async function CommissionsPage() {
  const { user, allowed } = await requireModule("commissions", "view");
  if (!allowed) return <AccessRestricted moduleLabel="Commissions" />;
  return <ErpLegacyClient view="commissions" permissions={user.role.permissions} />;
}
