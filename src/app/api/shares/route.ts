import { randomBytes } from "node:crypto";
import { db } from "@/db";
import { shares, type SharePayload } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth-guard";

const FILE_RE = /^[0-9a-f-]{36}\.(?:pdf|png|jpe?g|webp|gif)$/;
const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !user.isActive) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const b = await req.json().catch(() => null);
  if (!b || typeof b !== "object") return Response.json({ error: "Bad request" }, { status: 400 });

  const payload: SharePayload = {
    title: str(b.title, 200),
    subtitle: str(b.subtitle, 300),
    note: str(b.note, 1000),
    clientName: str(b.clientName, 100),
    sections: (Array.isArray(b.sections) ? b.sections : []).slice(0, 20).map((s: any) => ({
      heading: str(s?.heading, 100),
      lines: (Array.isArray(s?.lines) ? s.lines : []).slice(0, 40).map((l: unknown) => str(l, 500)),
    })),
    files: (Array.isArray(b.files) ? b.files : [])
      .slice(0, 40)
      .map((f: any) => ({ name: str(f?.name, 200), file: str(f?.file, 80) }))
      .filter((f: { file: string }) => FILE_RE.test(f.file)),
  };
  if (!payload.title) return Response.json({ error: "title required" }, { status: 400 });

  const id = randomBytes(9).toString("base64url");
  await db.insert(shares).values({ id, payload });
  return Response.json({ url: `${new URL(req.url).origin}/share/${id}` });
}
