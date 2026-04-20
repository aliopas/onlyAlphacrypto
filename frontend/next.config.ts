import type { NextConfig } from "next";
import { COINS } from "./src/lib/constants";

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
