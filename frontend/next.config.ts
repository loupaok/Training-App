import type { NextConfig } from "next";
import path from "node:path";

const BACKEND_ORIGIN = process.env.BACKEND_ORIGIN || "http://localhost:5000";
const scriptSources = process.env.NODE_ENV === "production"
  ? "'self' 'unsafe-inline'"
  : "'self' 'unsafe-inline' 'unsafe-eval'";

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "img-src 'self' data: blob: https:",
      "media-src 'self' blob:",
      "style-src 'self' 'unsafe-inline'",
      `script-src ${scriptSources}`,
      "font-src 'self' data:",
      "connect-src 'self' https: wss:",
    ].join("; "),
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  agentRules: false,
  allowedDevOrigins: ["192.168.1.4"],
  turbopack: {
    root: path.join(__dirname),
  },
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${BACKEND_ORIGIN}/api/:path*` },
      { source: "/uploads/:path*", destination: `${BACKEND_ORIGIN}/uploads/:path*` },
    ];
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
