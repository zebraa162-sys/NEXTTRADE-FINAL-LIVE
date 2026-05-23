const nextConfig = {
  output: 'standalone',
  images: {
    unoptimized: true,
  },
  experimental: {
    // Keep mongodb out of the webpack bundle — required for the native /
    // dynamic `require()` calls inside the driver to work at runtime.
    serverComponentsExternalPackages: ['mongodb'],

    // Next.js's automatic file tracer drops several runtime-required files
    // from `.next/standalone/node_modules/...` because they are loaded via
    // dynamic / conditional `require()` calls. When those files are missing
    // the deployed pod crashes at the FIRST request with errors like:
    //   "Cannot find module './mongocryptd_manager'"
    //   "Cannot find module './future/route-matcher-providers/app-route-...'"
    // and every Next.js route returns 500.
    //
    // We force-include:
    //   - The full `mongodb` driver tree + its peer deps (client-side
    //     encryption, bson, saslprep, sparse-bitfield, memory-pager).
    //   - The full `next/dist/server` and `next/dist/shared` trees so the
    //     route-matcher providers, render-server helpers, etc. are always
    //     present regardless of how the tracer prunes them.
    //
    // We apply the include list to BOTH the API catch-all and root pages so
    // server-rendered pages and API routes both pick up the extra files.
    outputFileTracingIncludes: {
      '/**/*': [
        './node_modules/next/dist/server/**/*',
        './node_modules/next/dist/shared/**/*',
        './node_modules/next/dist/compiled/**/*',
      ],
      '/api/**/*': [
        './node_modules/mongodb/**/*',
        './node_modules/bson/**/*',
        './node_modules/mongodb-connection-string-url/**/*',
        './node_modules/@mongodb-js/saslprep/**/*',
        './node_modules/sparse-bitfield/**/*',
        './node_modules/memory-pager/**/*',
        './node_modules/next/dist/server/**/*',
        './node_modules/next/dist/shared/**/*',
        './node_modules/next/dist/compiled/**/*',
      ],
    },
  },
  webpack(config, { dev }) {
    if (dev) {
      // Reduce CPU/memory from file watching
      config.watchOptions = {
        poll: 2000, // check every 2 seconds
        aggregateTimeout: 300, // wait before rebuilding
        ignored: ['**/node_modules'],
      };
    }
    return config;
  },
  onDemandEntries: {
    maxInactiveAge: 10000,
    pagesBufferLength: 2,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "ALLOWALL" },
          { key: "Content-Security-Policy", value: "frame-ancestors *;" },
          { key: "Access-Control-Allow-Origin", value: process.env.CORS_ORIGINS || "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, PUT, DELETE, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "*" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
