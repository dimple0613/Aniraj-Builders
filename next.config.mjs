/** @type {import('next').NextConfig} */
const nextConfig = {

    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'localhost', // Must match the external domain exactly
                port: '',
                pathname: '/**',
            },
        ],
        localPatterns: [
            {
                pathname: '/api/uploads/**',
            },
        ],
    },
    experimental: {
        serverActions: {
            bodySizeLimit: '10mb',
        },
    },
    poweredByHeader: false,
    compress: true,
    generateEtags: true,

    async headers() {
        return [
            {
                source: '/uploads/:path*',
                headers: [
                    {
                        key: 'Cache-Control',
                        value: 'public, max-age=0, must-revalidate, proxy-revalidate',
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
    typescript: {
        ignoreBuildErrors: true,
    },
};

export default nextConfig;
