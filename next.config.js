/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@farcaster/frame-sdk"],
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    return config;
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "raw.githubusercontent.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "api.together.ai",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "ipfs.io",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "api.stability.ai",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "replicate.delivery",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "pbxt.replicate.delivery",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "tjzk.replicate.delivery",
        pathname: "/**",
      },
    ],

  },
  // Minimalize configurations to avoid conflicts
  async headers() {
    return [
      {
        source: '/.well-known/(.*)',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          }
        ],
      },
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'ALLOWALL',
          },
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors *",
          },
        ],
      },
    ];
  },
  // Re-add rewrites to ensure .well-known path works
  async rewrites() {
    return [
      {
        source: '/.well-known/farcaster.json',
        destination: '/api/farcaster.json',
      },
    ];
  },
};

export default nextConfig;