import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Empty turbopack config to silence the warning
  // Phaser works fine without custom webpack config in Turbopack mode
  turbopack: {},
};

export default nextConfig;
