import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Server Actions accept 1 MB by default. Product photos can be up to 4 MB
  // (lib/validations/product.schema.ts), plus a little form overhead.
  experimental: {
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },
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
