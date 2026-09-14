import { requireModule } from "@/lib/auth-guard";
import ErpLegacyClient from "@/components/erp/ErpLegacyClient";
import AccessRestricted from "@/components/AccessRestricted";

export default async function ProjectsPage() {
  const { user, allowed } = await requireModule("projects", "view");
  if (!allowed) return <AccessRestricted moduleLabel="Projects" />;
  return <ErpLegacyClient view="projects" permissions={user.role.permissions} />;
}
