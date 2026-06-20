import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Output standalone for Docker/VPS deployment
  output: "standalone",

  // Force mysql2 to be included in standalone node_modules trace
  outputFileTracingIncludes: {
    "/**/*": ["./node_modules/mysql2/**/*"],
  },

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com", // Google profile pictures
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com", // Plugio Cloudinary assets
      },
    ],
  },

  // Security headers for admin panel
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
