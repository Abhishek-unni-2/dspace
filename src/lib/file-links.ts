import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// Signed, expiring links let a client open one specific uploaded file
// (e.g. from a WhatsApp message) without having a login.
function sign(name: string, exp: number) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set.");
  return createHmac("sha256", secret).update(`${name}.${exp}`).digest("hex").slice(0, 24);
}

export function signedFilePath(name: string, ttlSeconds = 60 * 60 * 24 * 30) {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  return `/api/files/${name}?e=${exp.toString(36)}&s=${sign(name, exp)}`;
}

export function verifyFileSignature(name: string, exp: string | null, sig: string | null) {
  if (!exp || !sig) return false;
  const expNum = parseInt(exp, 36);
  if (!Number.isFinite(expNum) || expNum < Date.now() / 1000) return false;
  const expected = Buffer.from(sign(name, expNum));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
