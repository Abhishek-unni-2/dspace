import { readFile } from "node:fs/promises";
import path from "node:path";
import { getCurrentUser } from "@/lib/auth-guard";
import { verifyFileSignature } from "@/lib/file-links";

const TYPES: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

export async function GET(req: Request, ctx: RouteContext<"/api/files/[name]">) {
  const { name } = await ctx.params;
  const q = new URL(req.url).searchParams;
  // Either a logged-in user, or a valid signed share link.
  if (!verifyFileSignature(name, q.get("e"), q.get("s"))) {
    const user = await getCurrentUser();
    if (!user || !user.isActive) return new Response("Unauthorized", { status: 401 });
  }
  // Only server-generated names (uuid.ext) are valid — blocks path traversal.
  if (!/^[0-9a-f-]{36}\.(pdf|png|jpe?g|webp|gif)$/.test(name)) {
    return new Response("Not found", { status: 404 });
  }
  try {
    const data = await readFile(path.join(process.cwd(), "uploads", name));
    const ext = name.split(".").pop()!;
    return new Response(data, {
      headers: { "Content-Type": TYPES[ext], "Content-Disposition": "inline", "X-Content-Type-Options": "nosniff" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
