# MICRO-TASK E.2

## المهمة: تعديل `icon.tsx` (32×32) + إنشاء `apple-icon.tsx` (180×180)

## السياق
في المهمة السابقة حذفنا `icon.svg`. الآن نحتاج تعديل `icon.tsx` لينتج أيقونة 32×32 بدل 144×144 (بحجم مناسب لتب المتصفح)، وإنشاء `apple-icon.tsx` للأجهزة Apple.

## القاعدة الحاسمة (CRITICAL)
Next.js App Router يعتمد على أسماء ملفات **محجوزة بالضبط**. الأسماء الصحيحة هي:
- `icon.tsx` — يتم خدمته تلقائياً عند `/icon`
- `apple-icon.tsx` — يتم خدمته تلقائياً عند `/apple-icon`

**لا تستخدم** `icon.png.tsx` أو `apple-icon.png.tsx` — هذا يكسر الـ convention. الـ `contentType = 'image/png'` export داخل الملف يكفي لضبط الـ headers.

## التعليمات

### 1. عدّل `frontend/src/app/icon.tsx` (الملف موجود — لا تغيّر اسمه)

استبدل محتواه بالكامل:

```typescript
import { ImageResponse } from 'next/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0A0A0A',
          borderRadius: 6,
          color: '#FFFFFF',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-end', fontFamily: 'monospace', fontWeight: 'bold' }}>
          <span style={{ fontSize: 16, lineHeight: 1, marginBottom: 1 }}>OA</span>
          <span style={{ fontSize: 8, color: '#00e5ff', lineHeight: 1, marginLeft: 0.5, fontWeight: 'normal' }}>c</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
```

**التغييرات عن النسخة الحالية:**
- `size`: من `{ width: 144, height: 144 }` إلى `{ width: 32, height: 32 }`
- `borderRadius`: من `34` إلى `6`
- `fontSize` لـ OA: من `60` إلى `16`
- `fontSize` لـ c: من `32` إلى `8`
- `marginBottom` لـ OA: من `6` إلى `1`
- `marginLeft` لـ c: من `2` إلى `0.5`
- اسم الدالة: `Icon` (بدل `Icon` — نفس الشيء، لكن تأكد)

### 2. أنشئ `frontend/src/app/apple-icon.tsx` (ملف جديد — اسمه بالضبط `apple-icon.tsx`)

```typescript
import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0A0A0A',
          borderRadius: 40,
          color: '#FFFFFF',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-end', fontFamily: 'monospace', fontWeight: 'bold' }}>
          <span style={{ fontSize: 72, lineHeight: 1, marginBottom: 6 }}>OA</span>
          <span style={{ fontSize: 36, color: '#00e5ff', lineHeight: 1, marginLeft: 2, fontWeight: 'normal' }}>c</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
```

## الملفات
- `frontend/src/app/icon.tsx` — **تعديل** (استبدال المحتوى بالكامل)
- `frontend/src/app/apple-icon.tsx` — **جديد**

## قواعد صارمة
- لا تغيّر اسم `icon.tsx` — يجب أن يبقى بالضبط `icon.tsx`.
- لا تنشئ `icon.png.tsx` أو `apple-icon.png.tsx`.
- لا تستخدم `any` في أي نوع.
- لا تعدّل `layout.tsx` أو `manifest.json` — مهمات لاحقة.
- لا تعدّل `opengraph-image.tsx`.

## التسليم
أكّد أن كلا الملفين موجودان بالمحتوى الصحيح. أوقف. لا تنتقل لمهمة أخرى.
