# MICRO-TASK F.2

## المهمة: إضافة JSON-LD structured data لصفحة `[coin]/page.tsx`

## السياق
صفحة Terminal لكل عملة لا تحتوي على structured data (JSON-LD). Google يحتاج هذا لفهم المحتوى كـ "مقال". سنضيف `<script type="application/ld+json">` بـ schema `Article` (أو `WebPage` كبديل إذا لم يوجد article).

## التعليمات

افتح `frontend/src/app/terminal/[coin]/page.tsx` واجعل التغييرات التالية:

### 1. أضف import للـ type `MasterArticle`

أضف في أعلى الملف (بعد الـ imports الموجودة):
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
            name: `${symbol} Terminal — OnlyAlpha`,
            url: `${SITE_URL}/terminal/${symbol.toLowerCase()}`,
        };
    }

    return {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: masterArticle.metaTitle || `${symbol} Terminal — Live Analysis`,
        description: masterArticle.metaDescription || `AI-powered analysis for ${symbol}`,
        author: { '@type': 'Organization', name: 'OnlyAlpha' },
        publisher: {
            '@type': 'Organization',
            name: 'OnlyAlpha',
            logo: { '@type': 'ImageObject', url: `${SITE_URL}/icon` },
        },
        url: `${SITE_URL}/terminal/${symbol.toLowerCase()}`,
        datePublished: masterArticle.createdAt,
        dateModified: masterArticle.updatedAt,
        mainEntityOfPage: `${SITE_URL}/terminal/${symbol.toLowerCase()}`,
    };
}
```

**ملاحظة:** نوع الـ return هو `Record<string, unknown>` — لا تستخدم `object` أو `any`.

### 3. عدّل الدالة `CoinTerminalPage` — أضف جلب masterArticle و JSON-LD injection

استبدل الدالة بالكامل:

```typescript
export default async function CoinTerminalPage({
    params,
    searchParams
}: {
    params: Promise<{ coin: string }>;
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    const news = await terminalApi.getLatestWire();
    const radarSignals = await homeApi.getRadarSignals();

    const resolvedParams = await params;
    const resolvedSearchParams = await searchParams;
    const coinSymbol = resolvedParams.coin.toUpperCase();

    const radarId = resolvedSearchParams.radarId ? Number(resolvedSearchParams.radarId) : undefined;
    const isAlphaFocus = resolvedSearchParams.alpha === 'true';

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
            <TerminalPageClient
                initialNews={news}
                coin={coinSymbol}
                radarSignals={radarSignals}
                initialRadarId={radarId}
                isAlphaFocus={isAlphaFocus}
            />
        </>
    );
}
```

## الملفات
- `frontend/src/app/terminal/[coin]/page.tsx` — **تعديل** (import جديد + helper function + تعديل page component)

## قواعد صارمة
- لا تغيّر `generateMetadata` — يجب أن يبقى كما هو (يعمل بشكل صحيح).
- لا تغيّر `generateStaticParams` أو `COINS` array.
- لا تغيّر `export const revalidate = 60;`.
- لا تستخدم `any` — استخدم `Record<string, unknown>` لـ JSON-LD.
- لا تستخدم `object` كنوع return — استخدم `Record<string, unknown>`.
- لا تعدّل `TerminalPageClient` أو أي props.
- لا تعدّل ملفات أخرى.
- الـ API call مزدوج (مرة في `generateMetadata` ومرة في page component) مقبول — SEO benefit يفوق الـ overhead.

## التسليم
أكّد التغييرات. أوقف.
