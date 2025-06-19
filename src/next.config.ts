
import type {NextConfig} from 'next';
import withPWAInit from '@ducanh2912/next-pwa';

const customRuntimeCaching = [
  {
    urlPattern: /^https:\/\/firestore\.googleapis\.com\/.*/i,
    handler: 'StaleWhileRevalidate' as const,
    options: {
      cacheName: 'firestore-data',
      expiration: {
        maxEntries: 50,
        maxAgeSeconds: 60 * 60 * 24 * 1, // 1 gün
      },
      cacheableResponse: {
        statuses: [0, 200],
      },
    },
  },
  {
    urlPattern: /^https:\/\/firebasestorage\.googleapis\.com\/.*/i,
    handler: 'CacheFirst' as const,
    options: {
      cacheName: 'firebase-images',
      expiration: {
        maxEntries: 60,
        maxAgeSeconds: 60 * 60 * 24 * 30, // 30 gün
      },
      cacheableResponse: {
        statuses: [0, 200], // 0, Firebase SDK'sı opak yanıtları önbelleğe aldığında kullanılır
      },
    },
  },
  {
    urlPattern: /^https:\/\/placehold\.co\/.*/i,
    handler: 'CacheFirst' as const,
    options: {
      cacheName: 'placeholder-images',
      expiration: {
        maxEntries: 20,
        maxAgeSeconds: 60 * 60 * 24 * 30, // 30 gün
      },
      cacheableResponse: {
        statuses: [0, 200],
      },
    },
  },
  {
    urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
    handler: 'StaleWhileRevalidate' as const,
    options: {
      cacheName: 'google-fonts-stylesheets',
    },
  },
  {
    urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
    handler: 'CacheFirst' as const,
    options: {
      cacheName: 'google-fonts-webfonts',
      expiration: {
        maxEntries: 30,
        maxAgeSeconds: 60 * 60 * 24 * 365, // 1 yıl
      },
      cacheableResponse: {
        statuses: [0, 200],
      },
    },
  },
  {
    urlPattern: /^https:\/\/cdn\.onesignal\.com\/.*/i,
    handler: 'CacheFirst' as const,
    options: {
      cacheName: 'onesignal-sdk',
      expiration: {
        maxEntries: 10, // Genellikle az sayıda dosya olur
        maxAgeSeconds: 60 * 60 * 24 * 7, // 7 gün
      },
      cacheableResponse: {
        statuses: [0, 200],
      },
    },
  },
];


const pwaConfig = {
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  runtimeCaching: customRuntimeCaching,
  buildExcludes: [/middleware-manifest\.json$/], 
  fallbacks: { 
    document: '/offline', // Çevrimdışı yedek sayfası eklendi
  },
  swSrc: 'src/worker/index.ts', // Özel service worker dosyasının yolu
  swDest: 'public/sw.js', // Derlenmiş service worker'ın çıkış yolu
};

const withPWA = withPWAInit(pwaConfig);

const securityHeaders = [
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on'
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload'
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block'
  },
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN'
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    key: 'Referrer-Policy',
    value: 'origin-when-cross-origin'
  }
];

const currentNextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      { 
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
      },
    ],
  },
  async headers() {
    return [
      {
        // Tüm yollara uygula
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

const finalConfig = process.env.NODE_ENV === 'development'
  ? currentNextConfig
  : withPWA(currentNextConfig);

export default finalConfig;
