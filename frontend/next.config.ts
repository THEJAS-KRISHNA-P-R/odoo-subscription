/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appRouter: true,
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': filePath(path.dirname(require.resolve(path.join(__dirname, 'package.json'), 'app'))),
    }
    return config
  },
}

module.exports = nextConfig