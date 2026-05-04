import { NextResponse } from 'next/server';
import { apiClient } from '@/features/shared/api/client';
import { SITE_URL } from '@/lib/constants';

interface ArchiveArticle {
  id: number;
  coinSymbol: string;
  headline: string;
  hook: string | null;
  metaDescription: string | null;
  createdAt: string;
  updatedAt: string;
}

export const revalidate = 3600;

export async function GET() {
  try {
    const { data: articles } = await apiClient.get<ArchiveArticle[]>('/market/archive');

    const items = (articles as ArchiveArticle[]).map(article => {
      const pubDate = new Date(article.updatedAt || article.createdAt).toUTCString();
      const link = `${SITE_URL}/terminal/${article.coinSymbol.toLowerCase()}/alpha`;
      const description = article.metaDescription || article.hook || `AI-powered analysis for ${article.coinSymbol}`;

      return `    <item>
      <title><![CDATA[${article.headline}]]></title>
      <description><![CDATA[${description}]]></description>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${pubDate}</pubDate>
      <category>${article.coinSymbol}</category>
    </item>`;
    }).join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>OnlyAlpha — AI Crypto Intelligence</title>
    <description>Real-time AI market analysis, intelligence reports, and on-chain insights for crypto market participants.</description>
    <link>${SITE_URL}</link>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml" />
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <managingEditor>team@onlyalphacrypto.com (OnlyAlpha Team)</managingEditor>
    <webMaster>team@onlyalphacrypto.com (OnlyAlpha Team)</webMaster>
${items}
  </channel>
</rss>`;

    return new NextResponse(xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=1800',
      },
    });
  } catch (error) {
    console.error('[RSS] Failed to generate feed:', error);
    return new NextResponse('Failed to generate RSS feed', { status: 500 });
  }
}
