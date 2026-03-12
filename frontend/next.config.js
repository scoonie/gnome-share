/** @type {import('next').NextConfig} */
const { version } = require('./package.json');

const withPWA = require("next-pwa")({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  runtimeCaching: [
    {
      urlPattern: /^https?.*/,
      handler: 'NetworkOnly',
    },
  ],
  reloadOnOnline: false,
});

module.exports = withPWA({
  output: "standalone", 
  env: {
    VERSION: version,
  },
  
  // --- ADDED ANTI-CACHING HEADERS HERE ---
  async headers() {
    return [
      {
        // Applies to all routes
        source: '/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
          {
            key: 'Expires',
            value: '0',
          },
        ],
      },
    ];
  },
});
