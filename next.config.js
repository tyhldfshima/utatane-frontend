/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['cdn.utatane.jp'],
  },
  async redirects() {
    return [
      {
        source: '/lp',
        destination: '/',
        permanent: true,
      },
      {
        source: '/LP',
        destination: '/',
        permanent: true,
      },
      {
        source: '/Lp',
        destination: '/',
        permanent: true,
      },
    ]
  },
}
module.exports = nextConfig