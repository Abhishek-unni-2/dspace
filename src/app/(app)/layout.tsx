import { requireUser } from "@/lib/auth-guard";
import AppShell from "@/components/AppShell";

export default async function AppGroupLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <AppShell
      user={{
        name: user.name,
        canDashboard: user.canDashboard,
        role: { name: user.role.name, isAdmin: user.role.isAdmin, permissions: user.role.permissions },
      }}
    >
      {children}
    </AppShell>
  );
}
