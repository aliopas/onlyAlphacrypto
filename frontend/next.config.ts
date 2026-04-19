import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    async headers() {
        return [
            {
                source: '/(.*)',
                headers: [
                    { key: 'X-Content-Type-Options', value: 'nosniff' },
                    { key: 'X-Frame-Options', value: 'DENY' },
                    { key: 'X-XSS-Protection', value: '1; mode=block' },
                    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
                    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
                ],
            },
        ];
    },
    async redirects() {
        const COINS = [
            'BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE', 'AVAX',
            'DOT', 'MATIC', 'LINK', 'UNI', 'ATOM', 'NEAR', 'APT', 'ARB',
            'OP', 'SUI', 'SEI', 'TIA', 'JUP', 'WIF', 'PEPE', 'FLOKI',
            'INJ', 'FTM', 'RENDER', 'AAVE', 'MKR', 'SNX',
        ];

        return COINS.map((coin) => ({
            source: `/${coin.toLowerCase()}`,
            destination: `/terminal/${coin.toLowerCase()}`,
            permanent: true, // 301
        }));
    },
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'coin-images.coingecko.com',
            },
        ],
    },
};

export default nextConfig;
