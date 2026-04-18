# MICRO-TASK E.3

## المهمة: تحديث `layout.tsx` — حقل `icons` في metadata + JSON-LD logo

## السياق
حذفنا `icon.svg` وأنشأنا `icon.tsx` و `apple-icon.tsx`. الآن نحتاج تحديث `layout.tsx` ليشير للأيقونات الجديدة. Next.js يخدم هذه الملفات عند `/icon` و `/apple-icon` (بدون `.png`).

## التعليمات

افتح `frontend/src/app/layout.tsx` واجعل التغييرات التالية:

### التغيير 1: حقل `icons` في metadata (حوالي السطر 45-47)

**من:**
```typescript
icons: {
    apple: '/apple-icon.svg',
},
```

**إلى:**
```typescript
icons: {
    icon: [
        { url: '/icon', sizes: '32x32', type: 'image/png' },
    ],
    apple: '/apple-icon',
},
```

### التغيير 2: JSON-LD Organization logo (حوالي السطر 98)

**من:**
```typescript
logo: `${SITE_URL}/icon.svg`,
```

**إلى:**
```typescript
logo: `${SITE_URL}/icon`,
```

## الملفات
- `frontend/src/app/layout.tsx` — **تعديل** (تغييران فقط)

## قواعد صارمة
- لا تغيّر أي شيء آخر في `layout.tsx`.
- لا تغيّر metadata base, title, description, keywords, robots, manifest, openGraph, twitter.
- لا تغيّر الـ `<head>` أو `<body>` أو `<Script>` أو أي JSON-LD آخر.
- لا تعدّل ملفات أخرى.

## التسليم
أكّد التغييرين. أوقف.
