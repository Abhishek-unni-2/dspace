import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getCurrentUser } from "@/lib/auth-guard";
import { meetsLevel } from "@/lib/permissions";

const NAME_RE = /^[0-9a-f-]{36}\.(?:pdf|png|jpe?g|webp|gif)$/;

// Issues a short-lived token so the browser can upload a big file straight to
// Vercel Blob (serverless functions cap request bodies at ~4.5 MB).
export async function POST(req: Request) {
  const body = (await req.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        const user = await getCurrentUser();
        if (!user || !user.isActive || !meetsLevel(user.role.permissions.projects, "edit")) {
          throw new Error("Not allowed");
        }
        if (!NAME_RE.test(pathname)) throw new Error("Invalid file name");
        return {
          allowedContentTypes: ["application/pdf", "image/png", "image/jpeg", "image/webp", "image/gif"],
          maximumSizeInBytes: 25 * 1024 * 1024,
          addRandomSuffix: false,
          allowOverwrite: false,
        };
      },
      onUploadCompleted: async () => {},
    });
    return Response.json(result);
  } catch (err: any) {
    return Response.json({ error: err?.message || "Upload failed" }, { status: 400 });
  }
}
