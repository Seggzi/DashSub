import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  reactStrictMode: false,
  experimental: {
    turbopackUseSystemTlsCerts: true,
  },
};

export default nextConfig;