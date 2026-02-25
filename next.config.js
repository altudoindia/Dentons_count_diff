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
}

module.exports = nextConfig
