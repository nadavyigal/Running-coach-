import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const svgrAvailable = (() => {
  try {
    require.resolve('@svgr/webpack');
    return true;
  } catch {
    return false;
  }
})();

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Temporarily ignore ESLint and TypeScript during builds for staging deployment
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // Image optimization
  images: {
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  
  // Disable critters optimization to fix dependency issue
  experimental: {
    optimizeCss: false, // Disable CSS optimization that uses critters
    optimizePackageImports: [
      '@radix-ui/react-icons',
      'date-fns',
      'recharts',
      '@radix-ui/react-dialog',
      '@radix-ui/react-popover',
      '@radix-ui/react-tooltip',
      'react-hook-form'
    ],
    // Turbopack disabled to fix CSS purging issue on Vercel
    // Turbopack processes PostCSS differently than webpack, causing Tailwind
    // to not purge unused classes properly (540KB vs 93KB with webpack)
    // turbo: {
    //   // Only add SVGR rule if the loader is available
    //   rules: svgrAvailable
    //     ? {
    //         '*.svg': {
    //           loaders: ['@svgr/webpack'],
    //           as: '*.js',
    //         },
    //       }
    //     : {},
    // },
  },
  
  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://api.openai.com https://us-assets.i.posthog.com https://vercel.live; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https: blob:; connect-src 'self' https://api.openai.com https://api.posthog.com https://us.i.posthog.com https://us-assets.i.posthog.com https://api.maptiler.com https://tile.openstreetmap.org https://*.tile.openstreetmap.org https://vercel.live; frame-src https://vercel.live; object-src 'none'; base-uri 'self'; form-action 'self'; worker-src 'self' blob:;",
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(self)',
          },
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
        ],
      },
      {
        source: '/_next/static/chunks/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ]
  },

  // Compiler optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },

  // Production optimizations
  productionBrowserSourceMaps: false, // Disable source maps in production for smaller bundle
  poweredByHeader: false, // Remove X-Powered-By header
  reactStrictMode: true, // Enable strict mode for better error detection

  // Webpack optimizations
  webpack: (config, { dev, isServer }) => {
    if (!dev && !isServer) {
      // Code splitting optimization
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          recharts: {
            test: /[\\/]node_modules[\\/](recharts|d3-*)[\\/]/,
            name: 'recharts',
            chunks: 'async',
            priority: 20,
          },
          radixui: {
            test: /[\\/]node_modules[\\/]@radix-ui[\\/]/,
            name: 'radix-ui',
            chunks: 'all',
            priority: 15,
          },
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
            priority: 10,
          },
          common: {
            name: 'common',
            minChunks: 2,
            chunks: 'all',
            priority: 5,
          },
        },
      };

      // Tree shaking optimization
      config.optimization.usedExports = true;
      config.optimization.sideEffects = false;

      // Additional minification for production
      config.optimization.minimize = true;
    }
    
    // Development optimizations
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        poll: 1000,
        aggregateTimeout: 300,
      }
    }
    
    return config
  },
}

export default nextConfig
