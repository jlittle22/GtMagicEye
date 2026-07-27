import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Otherwise Next.js walks up looking for a lockfile and finds an unrelated
  // ~/pnpm-lock.yaml outside this repo, misdetecting the monorepo root.
  turbopack: {
    root: path.join(__dirname, ".."),
  },
};

export default nextConfig;
