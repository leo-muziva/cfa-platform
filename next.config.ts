import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "127.0.0.1",
        port: "15421",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "aihuehpfhypxtjkechgj.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
