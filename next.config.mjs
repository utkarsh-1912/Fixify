import path from 'path';

const isDev = process.env.NODE_ENV !== 'production';

// Content-Security-Policy. 'unsafe-inline' is required by Next's bootstrap/hydration scripts and Tailwind
// style injection; everything else is locked to our own origin. jsdelivr is allowed only because
// @monaco-editor/react loads the Monaco editor from it. ws:/wss: are needed by the Live Feed monitor,
// which connects to a user-supplied FIX websocket.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${isDev ? "'unsafe-eval' " : ''}https://cdn.jsdelivr.net`,
  "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
  "img-src 'self' data: blob:",
  "font-src 'self' data: https://cdn.jsdelivr.net",
  "connect-src 'self' ws: wss: https://cdn.jsdelivr.net",
  "worker-src 'self' blob:",
  "media-src 'self' blob: data:",
  "object-src 'self' blob:",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '75mb',
    },
  },
  turbopack: {
    root: process.cwd(),
  },
  webpack: (config) => {
    config.resolve.modules = [
      path.resolve(process.cwd(), 'node_modules'),
      'node_modules',
    ];
    return config;
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' }
        ]
      }
    ];
  }
};
  
export default nextConfig;
  