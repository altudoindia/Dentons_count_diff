/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'www.dentons.com',
      },
    ],
  },
  async redirects() {
    return [
      { source: '/insights', destination: '/', permanent: true },
      { source: '/news', destination: '/', permanent: true },
    ]
  },
}

module.exports = nextConfig
