import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // This project lives inside a much larger directory tree that has its own
  // lockfile further up — pin the workspace root explicitly so Next/Turbopack
  // doesn't have to guess (and warn about it on every build).
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
