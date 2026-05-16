import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["bcryptjs"],
  ...(process.env.DOCKER_BUILD
    ? {}
    : {
        allowedDevOrigins: ["127.0.0.1"],
        turbopack: {
          root: process.cwd(),
        },
      }),
};

export default nextConfig;
