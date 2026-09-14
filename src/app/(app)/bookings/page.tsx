import { requireModule } from "@/lib/auth-guard";
import ErpLegacyClient from "@/components/erp/ErpLegacyClient";
import AccessRestricted from "@/components/AccessRestricted";

export default async function BookingsPage() {
  const { user, allowed } = await requireModule("bookings", "view");
  if (!allowed) return <AccessRestricted moduleLabel="Bookings" />;
  return <ErpLegacyClient view="bookings" permissions={user.role.permissions} />;
}
