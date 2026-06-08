/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['pdf-parse', 'mammoth', 'adm-zip']
  },
  async rewrites() {
    return {
      // fallback: only applied when no App Router/Pages route matches the path.
      // This prevents the proxy from intercepting internal Next.js API routes
      // (e.g. /api/review-studio/*) and creating an infinite proxy loop through nginx.
      fallback: [
        {
          source: "/api/:path*",
          destination: `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/:path*`,
        },
      ],
    };
  },
};

export default nextConfig;
