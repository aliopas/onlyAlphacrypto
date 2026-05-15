import type { Metadata } from 'next';
import { archiveApi } from '@/features/archive/api';
import { ArchivePageClient } from '@/features/archive/components/ArchivePageClient';
import { SITE_URL } from '@/lib/constants';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Article Archive',
  description: 'Browse all AI-powered crypto intelligence articles, analysis reports, and market insights. Filter by coin, date, and sentiment.',
  openGraph: {
    title: 'Article Archive — OnlyAlpha',
    description: 'Browse all AI-powered crypto intelligence articles, analysis reports, and market insights.',
    url: `${SITE_URL}/archive`,
    siteName: 'OnlyAlpha',
    type: 'website',
    images: [{ url: `${SITE_URL}/opengraph-image.png`, width: 1200, height: 630, alt: 'Article Archive — OnlyAlpha' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Article Archive — OnlyAlpha',
    description: 'Browse all AI-powered crypto intelligence articles, analysis reports, and market insights.',
  },
  alternates: {
    canonical: `${SITE_URL}/archive`,
  },
};

export default async function ArchivePage() {
  const articles = await archiveApi.getArchiveArticles();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'OnlyAlpha Article Archive',
    description: 'Browse all AI-powered crypto intelligence articles and market analysis reports.',
    url: `${SITE_URL}/archive`,
    publisher: {
      '@type': 'Organization',
      name: 'OnlyAlpha',
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/icon` },
    },
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: 'Archive', item: `${SITE_URL}/archive` },
      ],
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ArchivePageClient articles={articles} />
    </>
  );
}
