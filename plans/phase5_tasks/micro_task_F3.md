# MICRO-TASK F.3

## المهمة: إضافة JSON-LD structured data لصفحة `[coin]/alpha/page.tsx`

## السياق
بعد مهمة F.1 (التي أضافت dynamic generateMetadata) و F.2 (التي أضافت JSON-LD لصفحة Terminal)، الآن نضيف JSON-LD لصفحة Alpha بنفس النمط.

## التعليمات

افتح `frontend/src/app/terminal/[coin]/alpha/page.tsx` واجعل التغييرات التالية:

### 1. أضف import للـ type `MasterArticle`

أضف في أعلى الملف:
```typescript
import { MasterArticle } from '@/features/terminal/types';
```

### 2. أضف helper function `buildArticleJsonLd`

أضف هذه الدالة بعد `const SITE_URL = ...` وقبل `generateMetadata`:

```typescript
function buildArticleJsonLd(symbol: string, masterArticle: MasterArticle | null): Record<string, unknown> {
    if (!masterArticle) {
        return {
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: `${symbol} Alpha Intelligence Report — OnlyAlpha`,
            url: `${SITE_URL}/terminal/${symbol.toLowerCase()}/alpha`,
        };
    }

    return {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: masterArticle.metaTitle || `${symbol} Alpha Intelligence Report`,
        description: masterArticle.metaDescription || `Deep AI intelligence report for ${symbol}`,
        author: { '@type': 'Organization', name: 'OnlyAlpha' },
        publisher: {
            '@type': 'Organization',
            name: 'OnlyAlpha',
            logo: { '@type': 'ImageObject', url: `${SITE_URL}/icon` },
        },
        url: `${SITE_URL}/terminal/${symbol.toLowerCase()}/alpha`,
        datePublished: masterArticle.createdAt,
        dateModified: masterArticle.updatedAt,
        mainEntityOfPage: `${SITE_URL}/terminal/${symbol.toLowerCase()}/alpha`,
    };
}
```

### 3. عدّل الدالة `AlphaSnapshotPage` — أضف جلب masterArticle و JSON-LD injection

استبدل الدالة بالكامل:

```typescript
export default async function AlphaSnapshotPage({
    params,
}: {
    params: Promise<{ coin: string }>;
}) {
    const resolvedParams = await params;
    const coinSymbol = resolvedParams.coin.toUpperCase();

    let masterArticle: MasterArticle | null = null;
    try {
        const resp = await terminalApi.getMasterArticle(coinSymbol);
        masterArticle = resp.masterArticle;
    } catch {
        // silently fail — JSON-LD fallback handles null
    }

    const jsonLd = buildArticleJsonLd(coinSymbol, masterArticle);

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            <LivingArticle symbol={coinSymbol} />
        </>
    );
}
```

## الملفات
- `frontend/src/app/terminal/[coin]/alpha/page.tsx` — **تعديل** (import + helper + page component)

## قواعد صارمة
- لا تغيّر `generateMetadata` — مهمة F.1 عدّلته وهو صحيح.
- لا تغيّر `generateStaticParams` أو `COINS` array.
- لا تغيّر `export const revalidate = 60;`.
- لا تستخدم `any` — استخدم `Record<string, unknown>` لـ JSON-LD.
- لا تغيّر `LivingArticle` component أو أي props.
- لا تعدّل ملفات أخرى.

## التسليم
أكّد التغييرات. أوقف.
