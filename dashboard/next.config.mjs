import path from "path";
import { fileURLToPath } from "url";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

// Next only auto-loads .env* from dashboard/; voice server uses repo-root .env — load both so DATABASE_URL is shared.
loadEnvConfig(repoRoot);
loadEnvConfig(__dirname);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // pg uses native bindings; bundling it with the App Router often breaks DB reads at runtime.
  experimental: {
    // These packages use native Node.js APIs incompatible with Next.js webpack bundler.
    serverComponentsExternalPackages: ["pg", "pdf-parse", "pdfjs-dist"],
  },
};

export default nextConfig;
