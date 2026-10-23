import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      },
    ],
  },
  env: {
    NEXT_PUBLIC_MAINTAIN_MODE:
      process.env.MAINTAIN_MODE ?? process.env.NEXT_PUBLIC_MAINTAIN_MODE ?? '',
    NEXT_PUBLIC_STARTUP:
      process.env.STARTUP ?? process.env.NEXT_PUBLIC_STARTUP ?? '',
    NEXT_PUBLIC_SHUTDOWN:
      process.env.SHUTDOWN ?? process.env.NEXT_PUBLIC_SHUTDOWN ?? '',
  },
};

export default nextConfig;
