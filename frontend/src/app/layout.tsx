import type { Metadata } from 'next';
import Script from 'next/script';
import { Inter } from 'next/font/google';
import './globals.css';
import { Sidebar } from '@/features/shared/components/Sidebar';
import { TickerBar } from '@/features/shared/components/TickerBar';
import { CookieBanner } from '@/features/shared/components/CookieBanner';
import { SITE_URL, GA_MEASUREMENT_ID } from '@/lib/constants';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'OnlyAlpha — AI-Powered Crypto Intelligence',
    template: '%s | OnlyAlpha',
  },
  description: 'Real-time AI market analysis, airdrop tracking and on-chain intelligence for crypto market participants.',
  keywords: [
    'crypto intelligence',
    'AI market analysis',
    'airdrop tracking',
    'on-chain analysis',
    'cryptocurrency',
    'DeFi',
    'market analysis',
    'OnlyAlpha',
  ],
  authors: [{ name: 'OnlyAlpha' }],
  creator: 'OnlyAlpha',
  publisher: 'OnlyAlpha',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      { url: '/icon', sizes: '32x32', type: 'image/png' },
    ],
    apple: '/apple-icon',
  },
  manifest: '/manifest.json',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: SITE_URL,
    siteName: 'OnlyAlpha',
    title: 'OnlyAlpha — AI-Powered Crypto Intelligence',
    description: 'Real-time AI market analysis, airdrop tracking and on-chain intelligence for crypto market participants.',
    images: [
      {
        url: '/opengraph-image.png',
        width: 1200,
        height: 630,
        alt: 'OnlyAlpha — AI-Powered Crypto Intelligence',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'OnlyAlpha — AI-Powered Crypto Intelligence',
    description: 'Real-time AI market analysis, airdrop tracking and on-chain intelligence for crypto market participants.',
    images: ['/opengraph-image.png'],
    site: '@OnlyAlphaCrypto',
    creator: '@OnlyAlphaCrypto',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`} strategy="afterInteractive" />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}');
          `}
        </Script>
        {process.env.NEXT_PUBLIC_ADSENSE_ID && (
          <Script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${process.env.NEXT_PUBLIC_ADSENSE_ID}`}
            crossOrigin="anonymous"
            strategy="afterInteractive"
          />
        )}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap" rel="stylesheet" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: 'OnlyAlpha',
              url: SITE_URL,
              logo: `${SITE_URL}/icon`,
              description: 'AI-Powered Crypto Intelligence — Real-time AI market analysis, airdrop tracking and on-chain intelligence for crypto market participants.',
            }),
          }}
        />
      </head>
      <body className={`${inter.variable} font-sans bg-black text-white h-screen flex flex-col md:flex-row overflow-hidden`}>
        {/* Left sidebar nav (Desktop) / Bottom nav (Mobile) */}
        <Sidebar />

        {/* Main content area */}
        <main className="flex-1 flex flex-col h-full min-w-0 bg-black pb-[72px] md:pb-0">
          {/* Top ticker bar */}
          <TickerBar />

          {/* Page content — rendered by route group layouts */}
          {children}
        </main>
        <CookieBanner />
      </body>
    </html>
  );
}
