import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  agentRules: false,
  devIndicators: false,
  images: {
    remotePatterns: [
      "photo-1513104890138-7c749659a591",
      "photo-1558857563-b371033873b8",
      "photo-1495474472287-4d71bcdd2085",
      "photo-1509440159596-0249088772ff",
      "photo-1504674900247-0877df9cc836",
    ].map((photo) => ({
      protocol: "https" as const,
      hostname: "images.unsplash.com",
      pathname: `/${photo}`,
      search: "?auto=format&fit=crop&w=800&q=85",
    })),
  },
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../.."),
};

export default nextConfig;
