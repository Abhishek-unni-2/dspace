import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-guard";

export default async function RootPage() {
  const user = await getCurrentUser();
  redirect(user && user.isActive ? "/dashboard" : "/login");
}
