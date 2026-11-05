import { randomUUID } from "node:crypto";
import { getCurrentUser } from "@/lib/auth-guard";
import { meetsLevel } from "@/lib/permissions";
import { saveFile, useBlob } from "@/lib/storage";

const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED = new Set(["pdf", "png", "jpg", "jpeg", "webp", "gif"]);

// Tells the browser how to upload: straight to Vercel Blob (large files), or
// through this route (local development).
export async function GET() {
  const user = await getCurrentUser();
  if (!user || !user.isActive) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json({ direct: useBlob() });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !user.isActive || !meetsLevel(user.role.permissions.projects, "edit")) {
    return Response.json({ error: "Not allowed" }, { status: 403 });
  }

  try {
    const form = await req.formData();
    const files = form.getAll("files").filter((f): f is File => f instanceof File);
    if (!files.length) return Response.json({ error: "No files" }, { status: 400 });

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
      await saveFile(stored, Buffer.from(await file.arrayBuffer()), file.type || "application/octet-stream");
      saved.push({ name: file.name, url: `/api/files/${stored}`, size: file.size });
    }
    return Response.json({ files: saved });
  } catch (err) {
    console.error("upload failed", err);
    return Response.json({ error: "Upload failed on the server" }, { status: 500 });
  }
}
