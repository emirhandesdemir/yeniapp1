
// const withPWA = require("@ducanh2912/next-pwa")({
//   dest: "public",
//   register: true,
//   skipWaiting: true,
//   disable: process.env.NODE_ENV === "development",
//   runtimeCaching: [
//     {
//       urlPattern: /^https:\/\/firestore\.googleapis\.com\/.*/i,
//       handler: "StaleWhileRevalidate",
//       options: {
//         cacheName: "firestore-data",
//         expiration: {
//           maxEntries: 100,
//           maxAgeSeconds: 60 * 60 * 24 * 1, // 1 day
//         },
//         cacheableResponse: {
//           statuses: [0, 200],
//         },
//       },
//     },
//     {
//       urlPattern: /^https:\/\/firebasestorage\.googleapis\.com\/.*/i,
//       handler: "CacheFirst",
//       options: {
//         cacheName: "firebase-images",
//         expiration: {
//           maxEntries: 120,
//           maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
//         },
//         cacheableResponse: {
//           statuses: [0, 200],
//         },
//       },
//     },
//     {
//       urlPattern: /^https:\/\/placehold\.co\/.*/i,
//       handler: "CacheFirst",
//       options: {
//         cacheName: "placeholder-images",
//         expiration: {
//           maxEntries: 20,
//           maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
//         },
//         cacheableResponse: {
//           statuses: [0, 200],
//         },
//       },
//     },
//     {
//       urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
//       handler: "StaleWhileRevalidate",
//       options: {
//         cacheName: "google-fonts-stylesheets",
//       },
//     },
//     {
//       urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
//       handler: "CacheFirst",
//       options: {
//         cacheName: "google-fonts-webfonts",
//         expiration: {
//           maxEntries: 30,
//           maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
//         },
//         cacheableResponse: {
//           statuses: [0, 200],
//         },
//       },
//     },
//   ],
//   buildExcludes: [/middleware-manifest\.json$/],
//   fallbacks: {
//     document: "/offline",
//   },
//   swSrc: "src/worker/index.ts",
//   swDest: "public/sw.js",
// });

const securityHeaders = [
  { key: "X-DNS-Prefetch-Control", value: "on" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-XSS-Protection", value: "1; mode=block" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "origin-when-cross-origin" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "placehold.co",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

// module.exports = withPWA(nextConfig);
module.exports = nextConfig;
