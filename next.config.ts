import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compiler: {
    // Ye sirf production build se saare logs hata dega
    removeConsole: process.env.NODE_ENV === "production",
  },
};

export default nextConfig;
