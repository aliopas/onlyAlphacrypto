import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Sidebar } from '@/features/shared/components/Sidebar';
import { TickerBar } from '@/features/shared/components/TickerBar';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'OnlyAlpha — AI-Powered Crypto Intelligence',
  description: 'Real-time AI market analysis, airdrop tracking and on-chain intelligence for serious traders.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap" rel="stylesheet" />
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
