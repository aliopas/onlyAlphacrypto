import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const EXEMPT_PATHS = [
    '/admin',
    '/api',
    '/_next',
    '/favicon.ico',
    '/robots.txt',
    '/sitemap.xml',
    '/feed.xml',
];

function getPageKey(pathname: string): string {
    if (pathname === '/') return 'home';
    if (pathname.startsWith('/terminal')) return 'terminal';
    if (pathname.startsWith('/airdrops')) return 'airdrops';
    if (pathname.startsWith('/scorecard')) return 'scorecard';
    if (pathname.startsWith('/archive')) return 'archive';
    if (pathname.startsWith('/about')) return 'about';
    if (pathname.startsWith('/contact')) return 'contact';
    if (pathname.startsWith('/settings')) return 'settings';
    if (pathname.startsWith('/auth')) return 'auth';
    return 'other';
}

export async function middleware(request: NextRequest) {
    const pathname = request.nextUrl.pathname;

    if (EXEMPT_PATHS.some((p) => pathname.startsWith(p))) {
        return NextResponse.next();
    }

    try {
        const apiBase = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').replace('/api', '');
        const pageKey = getPageKey(pathname);
        const url = `${apiBase}/admin/maintenance/status?page=${encodeURIComponent(pageKey)}`;

        const res = await fetch(url, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(2000),
        });

        if (res.ok) {
            const data = (await res.json()) as { inMaintenance: boolean; retryAfter?: number };
            if (data.inMaintenance) {
                const retryAfter = data.retryAfter ?? 300;
                return new NextResponse('Service Unavailable', {
                    status: 503,
                    headers: {
                        'Retry-After': String(retryAfter),
                        'Content-Type': 'text/plain',
                    },
                });
            }
        }
    } catch {
        // Fail-open: allow access if backend check fails
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.).*)'],
};
