import type { NextConfig } from "next";
import path from "node:path";

const BACKEND_ORIGIN = process.env.BACKEND_ORIGIN || "http://localhost:5000";

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
};

export default nextConfig;
