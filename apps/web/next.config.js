/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@memsync/db", "@memsync/shared", "@memsync/ui"]
};

export default nextConfig;
