# MICRO-TASK E.5

## المهمة: إنشاء route handler لـ `/favicon.ico` — يعمل redirect إلى `/icon`

## السياق
المتصفحات Legacy تطلب `/favicon.ico` تلقائياً. ليس لدينا ملف بهذا الاسم. نحتاج route handler يعمل redirect إلى `/icon` (الذي يخدمه `icon.tsx` ديناميكياً).

## القاعدة الحاسمة (CRITICAL)
في Next.js App Router:
- API route handlers يجب أن تستخدم `route.ts` داخل مجلد يمثل الـ route segment.
- ملف اسمه `favicon.ico.tsx` في root `app/` **ليس** route handler صالح — ملفات `.tsx` هي React components فقط.

**الحل الصحيح:** إنشاء `frontend/src/app/favicon.ico/route.ts`

## التعليمات

أنشئ المجلد والمحل:
`frontend/src/app/favicon.ico/route.ts`

محتواه:

```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const url = new URL('/icon', request.url);
  return NextResponse.redirect(url);
}
```

## الملفات
- `frontend/src/app/favicon.ico/route.ts` — **جديد** (المجلد `favicon.ico` جديد أيضاً)

## قواعد صارمة
- اسم المجلد بالضبط `favicon.ico` (بدون تغيير).
- اسم الملف بالضبط `route.ts` (بدون تغيير).
- لا تنشئ `favicon.ico.tsx` في root `app/` — هذا خطأ.
- لا تستخدم `any` في أي نوع.
- لا تعدّل ملفات أخرى.

## التسليم
أكّد أن الملف والمجلد موجودان. أوقف.
