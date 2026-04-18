# Phase 5 — Senior Developer Task Collection

**Architect:** THE ARCHITECT (GLM-5-Turbo)
**Date:** April 18, 2026
**Reference Plan:** `plans/architect_plan_phase5.md` (APPROVED by Supreme Reviewer v2)

---

## كيفية الاستخدام

قم بنسخ كل مهمة (Micro-Task) كاملة — من عنوان المهمة إلى نهاية تعليمات التسليم — والصقها في جلسة المطور الـ Senior.

---

# MICRO-TASK E.1

## المهمة: حذف `icon.svg` من `frontend/src/app/`

## السياق
الملف `icon.tsx` (ديناميكي عبر `ImageResponse`) والم文件 `icon.svg` (ستاتيك) يتعارضان في نفس المجلد. Next.js يعطي الأولوية لـ `icon.tsx`. وجود كلاهما يسبب غموض. سنحذف الـ SVG ونحدث المراجع لاحقاً.

## التعليمات
1. احذف الملف `frontend/src/app/icon.svg` نهائياً.
2. لا تعدّل أي ملف آخر في هذه المهمة.

## الملفات
- `frontend/src/app/icon.svg` — **حذف**

## قاعدة صارمة
- لا تعدّل `icon.tsx` — المهمة التالية ستتعامل معه.
- لا تعدّل `layout.tsx` أو `manifest.json` — مهمات لاحقة ستتولاها.

## التسليم
أكّد الحذف وأوقف. لا تنتقل لمهمة أخرى.
