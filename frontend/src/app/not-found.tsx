import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
    title: 'Page Not Found',
    robots: { index: false, follow: false },
};

export default function NotFound() {
    return (
        <div className="flex flex-col items-center justify-center h-full gap-4">
            <h1 className="text-4xl font-bold text-white">404</h1>
            <p className="text-gray-400">The page you&apos;re looking for doesn&apos;t exist.</p>
            <Link href="/" className="text-emerald-500 hover:underline">Go Home</Link>
        </div>
    );
}