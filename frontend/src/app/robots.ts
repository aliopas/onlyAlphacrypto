import type { MetadataRoute } from 'next';

const SITE_URL = 'https://onlyalphacrypto.com';

export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: '*',
                allow: '/',
                disallow: ['/auth', '/settings', '/api'],
            },
            {
                userAgent: 'GPTBot',
                disallow: '/',
            },
            {
                userAgent: 'ChatGPT-User',
                disallow: '/',
            },
            {
                userAgent: 'CCBot',
                disallow: '/',
            },
        ],
        sitemap: `${SITE_URL}/sitemap.xml`,
    };
}
