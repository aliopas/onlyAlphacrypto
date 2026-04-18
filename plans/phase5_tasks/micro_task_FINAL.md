# MICRO-TASK FINAL — TypeScript Check + Verification

## المهمة: تشغيل TypeScript compiler للتأكد من صفر أخطاء

## السياق
بعد اكتمال جميع المهمات (E.1 → E.5, F.1 → F.3)، يجب التحقق أن الكود خالي من أخطاء TypeScript.

## التعليمات

### 1. شغّل TypeScript check في frontend:

```bash
npx tsc --noEmit
```

**من مجلد:** `frontend/`

### 2. تحقق من النتيجة

يجب أن تكون النتيجة: **صفر أخطاء** (zero errors).

إذا وُجدت أخطاء:
- أصلحها فوراً.
- الأخطاء المتوقعة محتملة فقط في:
  - `page.tsx` (الـ imports أو الـ types)
  - تأكد أن `MasterArticle` type مستورد بشكل صحيح

### 3. قائمة مراجعة نهائية (Verification Checklist)

تأكد أن:
- [ ] `frontend/src/app/icon.svg` محذوف
- [ ] `frontend/src/app/icon.tsx` موجود بحجم 32×32
- [ ] `frontend/src/app/apple-icon.tsx` موجود بحجم 180×180
- [ ] `frontend/src/app/favicon.ico/route.ts` موجود بـ redirect handler
- [ ] `frontend/src/app/layout.tsx` يشير لـ `/icon` و `/apple-icon` (بدون `.png`)
- [ ] `frontend/public/manifest.json` يشير لـ `/icon` و `/apple-icon`
- [ ] `[coin]/page.tsx` يحتوي JSON-LD script
- [ ] `[coin]/alpha/page.tsx` يحتوي dynamic generateMetadata + JSON-LD script
- [ ] صفر أخطاء TypeScript
- [ ] لا يوجد `any` في أي ملف جديد أو معدّل
- [ ] `revalidate = 60` موجود في كلا ملفات الصفحات

## قواعد صارمة
- لا تضيف code جديد.
- لا تُنظّف imports غير مستخدمة إلا إذا سبّبت خطأ TypeScript.
- لا تعدّل ملفات أخرى.

## التسليم
أرسل نتيجة `tsc --noEmit` + قائمة المراجعة مع التأكيدات.
