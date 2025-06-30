//  ⚠ The "images.domains" configuration is deprecated. 
//  Please use "images.remotePatterns" configuration instead.
// /** @type {import('next').NextConfig} */
// const nextConfig = {
//     images: {
//       domains: ["ipfs.io", "gateway.pinata.cloud"],
//     },
//   };
  
//   export default nextConfig;
  

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'ipfs.io',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'gateway.pinata.cloud',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;

