/** @type {import('next').NextConfig} */
const { version } = require('./package.json');

const nextConfig = {
  output: "standalone", 
  env: {
    VERSION: process.env.BUILD_DATE || version,
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
