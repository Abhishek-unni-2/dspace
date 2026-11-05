import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { list, put } from "@vercel/blob";

// Uploaded files live in Vercel Blob when BLOB_READ_WRITE_TOKEN is set
// (production on Vercel — its filesystem is read-only), and in the local
// uploads/ folder otherwise (development).
export const useBlob = () => !!process.env.BLOB_READ_WRITE_TOKEN;
const LOCAL_DIR = path.join(process.cwd(), "uploads");

export async function saveFile(name: string, data: Buffer, contentType: string) {
  if (useBlob()) {
    await put(name, data, { access: "public", addRandomSuffix: false, allowOverwrite: true, contentType });
    return;
  }
  await mkdir(LOCAL_DIR, { recursive: true });
  await writeFile(path.join(LOCAL_DIR, name), data);
}

export async function loadFile(name: string): Promise<Buffer | null> {
  try {
    if (useBlob()) {
      const { blobs } = await list({ prefix: name, limit: 1 });
      const hit = blobs.find((b) => b.pathname === name);
      if (!hit) return null;
      const res = await fetch(hit.url);
      return res.ok ? Buffer.from(await res.arrayBuffer()) : null;
    }
    return await readFile(path.join(LOCAL_DIR, name));
  } catch {
    return null;
  }
}
