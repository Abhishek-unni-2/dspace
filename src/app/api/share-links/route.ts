import { getCurrentUser } from "@/lib/auth-guard";
import { signedFilePath } from "@/lib/file-links";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !user.isActive) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const urls: unknown = body?.urls;
  if (!Array.isArray(urls)) return Response.json({ error: "urls required" }, { status: 400 });

  const origin = new URL(req.url).origin;
  const links: Record<string, string> = {};
  for (const u of urls) {
    const m = typeof u === "string" && u.match(/^\/api\/files\/([0-9a-f-]{36}\.(?:pdf|png|jpe?g|webp|gif))$/);
    if (m) links[u] = origin + signedFilePath(m[1]);
  }
  return Response.json({ links });
}
