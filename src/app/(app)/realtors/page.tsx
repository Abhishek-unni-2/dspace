import { requireModule } from "@/lib/auth-guard";
import ErpLegacyClient from "@/components/erp/ErpLegacyClient";
import AccessRestricted from "@/components/AccessRestricted";

export default async function RealtorsPage() {
  const { user, allowed } = await requireModule("realtors", "view");
  if (!allowed) return <AccessRestricted moduleLabel="Realtors" />;
  return <ErpLegacyClient view="realtors" permissions={user.role.permissions} />;
}
