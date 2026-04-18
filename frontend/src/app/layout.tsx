import type { Metadata } from 'next';
import Script from 'next/script';
import { Inter } from 'next/font/google';
import './globals.css';
import { Sidebar } from '@/features/shared/components/Sidebar';
import { TickerBar } from '@/features/shared/components/TickerBar';

const GA_ID = 'G-VWQNMXJ2JK';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

const SITE_URL = 'https://onlyalphacrypto.com';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'OnlyAlpha — AI-Powered Crypto Intelligence',
    template: '%s | OnlyAlpha',
  },
  description: 'Real-time AI market analysis, airdrop tracking and on-chain intelligence for serious traders.',
  keywords: [
    'crypto intelligence',
    'AI trading',
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
    description: 'Real-time AI market analysis, airdrop tracking and on-chain intelligence for serious traders.',
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
    description: 'Real-time AI market analysis, airdrop tracking and on-chain intelligence for serious traders.',
    images: ['/opengraph-image.png'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_ID}');
          `}
        </Script>
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
              description: 'AI-Powered Crypto Intelligence — Real-time AI market analysis, airdrop tracking and on-chain intelligence for serious traders.',
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebSite',
              name: 'OnlyAlpha',
              url: SITE_URL,
              potentialAction: {
                '@type': 'SearchAction',
                target: `${SITE_URL}/search?q={search_term_string}`,
                'query-input': 'required name=search_term_string',
              },
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

          {/* Page content */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6">
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
