import { jwtVerify } from "jose";
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";

// Cheap, DB-free gate that runs before every request: is there a
// validly-signed session cookie at all? The real, per-module permission
// check (which needs a fresh DB read) happens in the page/layout Server
// Components via requireUser()/requireModule() — this just keeps
// unauthenticated requests from reaching the app shell at all.
const PUBLIC_PATHS = ["/login", "/share"];

function getSecretKey() {
  return new TextEncoder().encode(process.env.SESSION_SECRET);
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  // Signed share links for uploaded files are verified inside the route itself.
  if (pathname.startsWith("/api/files/") && req.nextUrl.searchParams.has("s")) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  let valid = false;
  if (token) {
    try {
      await jwtVerify(token, getSecretKey());
      valid = true;
    } catch {
      valid = false;
    }
  }

  if (!valid) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
