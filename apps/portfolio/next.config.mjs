import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname, "../.."),
  transpilePackages: ["@portfolio/shared-ui", "@portfolio/shared-types"],
  async rewrites() {
    const devportal =
      process.env.DEVPORTAL_URL ?? "http://127.0.0.1:4600";
    const flags = process.env.FEATURE_FLAGS_URL ?? "http://127.0.0.1:4500";
    return [
      {
        source: "/api/demos/devportal/:path*",
        destination: `${devportal}/:path*`,
      },
      {
        source: "/api/demos/flags/:path*",
        destination: `${flags}/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/demos/:path*",
        headers: [{ key: "X-Frame-Options", value: "SAMEORIGIN" }],
      },
      {
        source: "/((?!demos).*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
