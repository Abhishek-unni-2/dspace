import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getCurrentUser } from "@/lib/auth-guard";
import { meetsLevel } from "@/lib/permissions";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");
const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED = new Set(["pdf", "png", "jpg", "jpeg", "webp", "gif"]);

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !user.isActive || !meetsLevel(user.role.permissions.projects, "edit")) {
    return Response.json({ error: "Not allowed" }, { status: 403 });
  }

  const form = await req.formData();
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (!files.length) return Response.json({ error: "No files" }, { status: 400 });

  await mkdir(UPLOAD_DIR, { recursive: true });
  const saved: { name: string; url: string; size: number }[] = [];

  for (const file of files) {
    const ext = (file.name.split(".").pop() || "").toLowerCase();
    if (!ALLOWED.has(ext)) {
      return Response.json({ error: `${file.name}: only PDF and image files are allowed` }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return Response.json({ error: `${file.name}: larger than 25 MB` }, { status: 400 });
    }
    const stored = `${randomUUID()}.${ext}`;
    await writeFile(path.join(UPLOAD_DIR, stored), Buffer.from(await file.arrayBuffer()));
    saved.push({ name: file.name, url: `/api/files/${stored}`, size: file.size });
  }
  return Response.json({ files: saved });
}
