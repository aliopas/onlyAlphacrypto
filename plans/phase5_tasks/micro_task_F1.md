# MICRO-TASK F.1

## المهمة: إضافة `generateMetadata` ديناميكي لصفحة Alpha `[coin]/alpha/page.tsx`

## السياق
الصفحة `frontend/src/app/terminal/[coin]/alpha/page.tsx` حالياً تعرض metadata ثابت (hardcoded). كل صفحات الـ 30 عملة تعرض نفس النمط بدون أي بيانات فعلية من الـ API. نحتاج جعلها تجلب `metaTitle` و `metaDescription` من `masterArticle` مثلما يفعل `[coin]/page.tsx`.

## التعليمات

افتح `frontend/src/app/terminal/[coin]/alpha/page.tsx` واجعل التغييرات التالية:

### 1. أضف الـ import لـ `terminalApi`

أضف في أعلى الملف (بعد الـ imports الموجودة):
```typescript
import { terminalApi } from '@/features/terminal/api';
```

### 2. استبدل الدالة `generateMetadata` بالكامل

**من:**
```typescript
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
    const { coin } = await params;
    const symbol = coin.toUpperCase();

    return {
        title: `${symbol} Alpha Intelligence Report`,
        description: `Deep AI intelligence report and living article for ${symbol}. Comprehensive analysis with conviction scores, posture, and timeline.`,
        openGraph: {
            title: `${symbol} Alpha Report — OnlyAlpha`,
            description: `Deep AI intelligence report for ${symbol} with conviction scores and timeline.`,
            url: `${SITE_URL}/terminal/${coin}/alpha`,
            type: 'article',
        },
        twitter: {
            card: 'summary_large_image',
            title: `${symbol} Alpha Report — OnlyAlpha`,
            description: `Deep AI intelligence report for ${symbol}.`,
        },
        alternates: {
            canonical: `${SITE_URL}/terminal/${coin}/alpha`,
        },
    };
}
```

**إلى:**
```typescript
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
    const { coin } = await params;
    const symbol = coin.toUpperCase();

    let title = `${symbol} Alpha Intelligence Report`;
    let description = `Deep AI intelligence report and living article for ${symbol}. Comprehensive analysis with conviction scores, posture, and timeline.`;
    let keywords: string[] | undefined = undefined;

    try {
        const { masterArticle } = await terminalApi.getMasterArticle(symbol);
        if (masterArticle) {
            if (masterArticle.metaTitle) {
                title = masterArticle.metaTitle.replace(/\|\s*OnlyAlpha$/i, '') + ' — Alpha Report';
            }
            if (masterArticle.metaDescription) description = masterArticle.metaDescription;
            if (masterArticle.seoKeywords && Array.isArray(masterArticle.seoKeywords)) {
                keywords = masterArticle.seoKeywords;
            }
        }
    } catch (e) {
        console.error('[SEO] Error fetching master article for alpha metadata:', e);
    }

    return {
        title: { absolute: title },
        description,
        keywords,
        openGraph: {
            title,
            description,
            url: `${SITE_URL}/terminal/${coin}/alpha`,
            type: 'article',
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
        },
        alternates: {
            canonical: `${SITE_URL}/terminal/${coin}/alpha`,
        },
    };
}
```

## الملفات
- `frontend/src/app/terminal/[coin]/alpha/page.tsx` — **تعديل** (import جديد + استبدال generateMetadata)

## قواعد صارمة
- لا تغيّر `export const revalidate = 60;` — يجب أن يبقى.
- لا تغيّر `COINS` array أو `generateStaticParams`.
- لا تغيّر الدالة `AlphaSnapshotPage` أو الـ `LivingArticle` component — مهمة لاحقة ستضيف JSON-LD.
- لا تستخدم `any` في أي نوع.
- لا تعدّل ملفات أخرى.
- لا تضيف JSON-LD في هذه المهمة — مهمة F.3 ستتولاها.

## التسليم
أكّد التغييرات. أوقف.
