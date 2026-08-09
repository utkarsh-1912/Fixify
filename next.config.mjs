import path from 'path';

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
};
  
export default nextConfig;
  