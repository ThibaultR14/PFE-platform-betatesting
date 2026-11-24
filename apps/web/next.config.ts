import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@microbeta/core", "@microbeta/i18n"],
};

export default nextConfig;
