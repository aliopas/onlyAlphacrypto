# MICRO-TASK E.4

## المهمة: تحديث `manifest.json` — مراجع الأيقونات

## السياق
حذفنا `icon.svg` وأنشأنا `icon.tsx` و `apple-icon.tsx`. Next.js يخدمها عند `/icon` و `/apple-icon`. نحتاج تحديث `manifest.json` ليشير للمسارات الصحيحة.

## التعليمات

افتح `frontend/public/manifest.json` واستبدل كامل محتوى الملف بـ:

```json
{
  "name": "OnlyAlpha",
  "short_name": "OnlyAlpha",
  "description": "AI-Powered Crypto Intelligence — Real-time AI market analysis, airdrop tracking and on-chain intelligence for serious traders.",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0A0A0A",
  "theme_color": "#0A0A0A",
  "orientation": "portrait-primary",
  "icons": [
    {
      "src": "/icon",
      "sizes": "32x32",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/apple-icon",
      "sizes": "180x180",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

## الملفات
- `frontend/public/manifest.json` — **تعديل** (استبدال كامل — فقط الـ icons array يتغير)

## قواعد صارمة
- لا تغيّر أي حقل آخر في الـ manifest (name, short_name, description, start_url, display, background_color, theme_color, orientation).
- لا تعدّل ملفات أخرى.

## التسليم
أكّد التعديل. أوقف.
