import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["bcryptjs"],
  allowedDevOrigins: ["127.0.0.1"],
  turbopack: {
    root: "/Users/oyenai/.openclaw/workspace/bentop_erp/bentop-erp",
  },
};

export default nextConfig;
