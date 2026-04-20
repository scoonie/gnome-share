/** @type {import('next').NextConfig} */
const pad = (n) => String(n).padStart(2, "0");
const today = new Date();
const defaultBuildDate = `${pad(today.getDate())}/${pad(today.getMonth() + 1)}/${today.getFullYear()}`;

const nextConfig = {
  output: "standalone", 
  env: {
    BUILD_DATE: process.env.BUILD_DATE || defaultBuildDate,
  },
  
  // Your clean, anti-cache headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
