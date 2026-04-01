# OnlyAlpha — خطة العمل المعمارية (Architectural Plan)

> **التاريخ**: 1 أبريل 2026
> **المرجع**: `FULL-AUDIT-REVIEW.md`
> **الإجمالي**: 27 مشكلة صالحة | 6 مراحل | ~24 ساعة تقديرية
> **مؤجل**: Payment Gateway (#27)

---

## القرارات المعمارية

| القرار | الخيار المختار | السبب |
|--------|----------------|-------|
| Terminal Mobile | Bottom Navigation Tabs (Wire \| Stream \| Chat) | Best practice + متناسق مع dark theme الموقع |
| Mock Data | إزالة نهائية | كود أنظف + أمان أكبر |
| Logging | Winston + Console | لا يحتاج service خارجي + file rotation |
| ترتيب التنفيذ | 1→2→3→4→5→6 | Crashes أولاً → الأمان → UX → البيانات → Backend → تماميات |
| النطاق | كل المشاكل (Critical + High + Medium + Low) | بلان شامل |

---

## المرحلة 1: إصلاحات حرجة (Critical Fixes)

### الهدف
إيقاف الـ crashes اللي بتخلي الصفحة البيضاء تظهر وتأمين الصفحات الأساسية.

### المدة التقديرية
~1.5 ساعة

### المهام

#### C-1: Runtime Crash في صفحة الترمينال
- **المشكلة**: `r.coin.toUpperCase()` في `TerminalPageClient.tsx:21` بينما `r.coin` ممكن يكون `null/undefined` لأن المصدر `coinSymbol?: string` هو optional
- **الإصلاح المعماري**:
  1. إضافة optional chaining: `r.coin?.toUpperCase()`
  2. فلترة الإشارات اللي عندها `coin` فاضي: `radarSignals.filter(r => r.coin)`
  3. تعديل الـ type في `types.ts:33` ليكون `coin: string | null`
- **المخاطر**: منخفضة — تغيير بسيط ومحدود
- **الاعتماديات**: لا يوجد

#### C-2: إشارة خاطئة عند الدخول من RadarGrid
- **المشكلة**: `defaultRadarId` بيستخدم `latestRadarForCoin` (أول signal للعملة) بدل `initialRadarId` من الـ URL
- **الإصلاح المعماري**:
  1. استخدام `initialRadarId ?? null` بدل `||`
  2. الاعتماد على `initialRadarId` من الـ URL كـ primary source
  3. `latestRadarForCoin` يبقى fallback بس لو `initialRadarId` مش موجود
- **المخاطر**: متوسطة — لازم نتأكد إن الـ URL parameter بيتبعت صح من RadarGrid
- **الاعتماديات**: C-1 (نفس الملف)

#### C-3: صفحة الترمينال فاضية أحياناً
- **المشكلة**: مفيش loading states أو fallback messages لو البيانات فاضية
- **الإصلاح المعماري**:
  1. إضافة fallback message: "لا توجد إشارات حالياً" في RadarSignals
  2. إضافة Skeleton loader أثناء التحميل
  3. اختيار أول عنصر افتراضياً لما مفيش `radarId` في الـ URL
- **المخاطر**: منخفضة — تحسين UX بس
- **الاعتماديات**: C-1, C-2

#### C-4: `apiClient` مش مستورد في RadarGrid
- **المشكلة**: `RadarGrid.tsx:36` بيستخدم `apiClient.get()` بدون import
- **الإصلاح المعماري**: إضافة `import { apiClient } from '@/features/shared/api/client';`
- **المخاطر**: صفر — مجرد import
- **الاعتماديات**: لا يوجد

---

## المرحلة 2: الأمان + Error Handling

### الهدف
حماية النظام، تحسين Observability، ومنع الأخطاء الصامتة.

### المدة التقديرية
~3 ساعات

### المهام

#### H-2a: Winston Logger Setup
- **المشكلة**: مفيش logging system في الباك إند — أخطاء بتتم swallow
- **الإصلاح المعماري**:
  1. إنشاء `backend/src/utils/logger.ts` باستخدام Winston
  2. Configurations: Console transport + File transport مع rotation
  3. Log levels: error, warn, info, debug
  4. Format: timestamp + level + message + optional metadata
- **المخاطر**: منخفضة — إضافة جديدة تماماً
- **الاعتماديات**: تحتاج `winston` package (تحتاج install)

#### H-2b: Error Handling في Binance Service
- **المشكلة**: كل الدوال في `binance.service.ts` (5 دوال) بدون try/catch
- **الإصلاح المعماري**:
  1. لف كل دالة بـ try/catch
  2. Log كل error باستخدام Winston logger
  3. Return sensible fallback (empty array, null) على الـ error
  4. إضافة retry logic (1 retry) للطلبات الخارجية
- **المخاطر**: منخفضة — تغيير داخلي
- **الاعتماديات**: H-2a (Logger)

#### H-2c: Error Handling في Frontend APIs
- **المشكلة**: `catch { return null; }` بدون logging في 3 ملفات
- **الإصلاح المعماري**:
  1. إضافة `console.error` في كل catch block
  2. إضافة toast notification للمستخدم عند فشل الطلبات المهمة
  3. التأكد إن الـ error response من الباك إند بيترجع بشكل متسق
- **المخاطر**: منخفضة
- **الاعتماديات**: لا يوجد

#### H-2d: Error Handling في Middleware
- **المشكلة**: `guest-limit.middleware.ts:35-37` — `catch { next(); }` (fail-open)
- **الإصلاح المعماري**: نفس النمط — إضافة logging قبل `next()`
- **المخاطر**: منخفضة
- **الاعتماديات**: H-2a (Logger)

#### H-6a: Fail-Closed لـ Redis Middleware
- **المشكلة**: لو Redis وقف → مفيش حماية خالص (fail-open)
- **الإصلاح المعماري**:
  1. `guest-limit.middleware.ts:11-14`: بدل `next(); return;` → `next(new Error('Service unavailable')); return;`
  2. `rateLimit.middleware.ts:20,43`: نفس التعديل
  3. إضافة graceful handling: لو Redis مش موجود في development → `next()` مع warn
- **المخاطر**: عالية — لو Redis فعلاً وقف في production، كل الطلبات هتتوقف. لازم نضيف health check.
- **الاعتماديات**: لا يوجد

#### H-6b: إزالة `any` من rateLimit middleware
- **المشكلة**: `(req as any).plan` في `rateLimit.middleware.ts:45`
- **الإصلاح المعماري**:
  1. إنشاء/استخدام `AuthRequest` interface فيه `plan?: string`
  2. استبدال `(req as any).plan` بـ `(req as AuthRequest).plan`
- **المخاطر**: منخفضة
- **الاعتماديات**: لا يوجد

#### H-5: تحسين Auth Security (بداية)
- **المشكلة**: Token في localStorage (XSS risk)
- **الإصلاح المعماري (مرحلة أولى)**:
  1. هذا الموضوع كبير ومحتاج تغيير في الباك إند (HttpOnly cookies) + Frontend
  2. في المرحلة دي: هنعمل فقط Audit كامل ونوثق التغييرات المطلوبة
  3. التنفيذ الفعلي هيكون في مرحلة منفصلة
- **المخاطر**: عالية — تغيير جوهري في Auth flow
- **الاعتماديات**: لا يوجد

#### H-10: Disclaimer Check قبل Chat
- **المشكلة**: الممكن يستخدم Chat من غير موافقة على Disclaimer
- **الإصلاح المعماري**:
  1. في `useTerminalChat.ts`: إضافة check لـ disclaimer status قبل `send()`
  2. لو مش موافق → show disclaimer modal
  3. توحيد الـ routes في `chat.routes.ts`
- **المخاطر**: متوسطة — لازم نتأكد إن الـ disclaimer endpoint شغال
- **الاعتماديات**: لا يوجد

---

## المرحلة 3: تجربة المستخدم (UX)

### الهدف
تحسين تجربة الموبايل والبيانات الحية والتفاعل.

### المدة التقديرية
~4 ساعات

### المهام

#### M-4 + M-5: Terminal Mobile — Bottom Navigation Tabs
- **المشكلة**: Terminal على الموبايل بيستخدم stacking عمودي (`h-[300px]` + `h-[600px]` = 900px ثابت)
- **التصميم المعماري**:
  ```
  ┌─────────────────────────┐
  │                         │
  │    Content Area         │
  │    (Full Height)        │
  │                         │
  │                         │
  ├─────────────────────────┤
  │  Wire  │ Stream │ Chat  │  ← Bottom Nav (xl:hidden)
  └─────────────────────────┘
  ```
  1. إنشاء `TerminalMobileNav.tsx` — bottom navigation bar
  2. إضافة `useState` للـ active tab في `TerminalPageClient.tsx`
  3. على الموبايل (`xl:hidden`): عرض فقط الـ active tab
  4. على الديسكتوب (`xl:flex`): كل شيء جنب بعض زي الحالة الحالية
  5. Active tab بلون `#00ff88` مع icon + label
  6. Smooth transition بين التابات
- **المخاطر**: متوسطة — إعادة تصميم لمكون أساسي
- **الاعتماديات**: C-3 (Fallback states)

#### M-3: Dashboard Sidebar Sticky
- **المشكلة**: السايدبار الأيمن في `page.tsx:28-33` مش sticky
- **الإصلاح المعماري**: إضافة `sticky top-20` (20 = navbar height) للسايدبار div
- **المخاطر**: صفر
- **الاعتماديات**: لا يوجد

#### H-1: Polling لـ TickerBar
- **المشكلة**: `TickerBar.tsx` بيجيب البيانات مرة واحدة بس (`useEffect([], [])`)
- **الإصلاح المعماري**:
  1. إضافة `setInterval` كل 15 ثانية
  2. Cleanup interval في `useEffect` return
  3. إضافة error handling على الـ fetch
  4. Smooth update بدون flicker
- **المخاطر**: منخفضة
- **الاعتماديات**: H-2c (Error handling)

#### H-8: Sparkline حقيقي من Binance Klines
- **المشكلة**: SVG hardcoded في `AlphaFocusCard.tsx:51-56` — نفس الشكل دايماً
- **الإصلاح المعماري**:
  1. استخدام `getCoinKlines()` من `binance.service.ts` (موجودة فعلاً)
  2. إنشاء helper function لتحويل Klines إلى SVG path
  3. إضافة loading state لل sparkline
  4. Cache النتيجة لمدة 5 دقائق
- **المخاطر**: متوسطة — لازم نتأكد إن Binance Klines API شغال
- **الاعتماديات**: H-2b (Error handling في Binance)

---

## المرحلة 4: بيانات حقيقية + جودة الكود

### الهدف
إزالة Mock Data وربط كل البيانات بالباك إند وتحسين Type Safety.

### المدة التقديرية
~5 ساعات

### المهام

#### H-7: إزالة Mock Data نهائياً
- **المشكلة**: `isMock` logic في 3 ملفات + `mockData.ts` (155 سطر)
- **الإصلاح المعماري**:
  1. حذف `frontend/src/features/shared/api/mockData.ts`
  2. إزالة `isMock` condition من `home/api.ts`, `terminal/api.ts`, `airdrop/api.ts`
  3. كل function ترجع الداتا الحقيقية من API بس
  4. إزالة `NEXT_PUBLIC_API_MODE` من env
- **المخاطر**: متوسطة — لازم نتأكد إن كل API endpoints شغالين
- **الاعتماديات**: C-1 إلى C-4 (الـ crashes لازم تكون اتحلت)

#### H-3: ربط Airdrop Sidebar بالباك إند
- **المشكلة**: كل البيانات في `airdrops/page.tsx` hardcoded
- **الإصلاح المعماري**:
  1. إنشاء API endpoint جديد: `GET /airdrops/stats` (إحصائيات)
  2. إنشاء API endpoint جديد: `GET /airdrops/activity` (نشاط حديث)
  3. إنشاء API endpoint جديد: `GET /airdrops/deadlines` (مواعيد)
  4. ربط الصفحة بالـ endpoints الجديدة
  5. إضافة loading states
- **المخاطر**: عالية — محتاج backend endpoints جديدة
- **الاعتماديات**: H-7 (بعد إزالة Mock Data)

#### H-4: عرض AI Report في Airdrop Details
- **المشكلة**: `aiReport` موجود في الـ type لكن مش معروض
- **الإصلاح المعماري**:
  1. إضافة section جديد في `airdrops/[id]/page.tsx` لعرض `aiReport`
  2. Markdown rendering للـ AI report (استخدام `react-markdown` لو موجود أو pre-formatted)
  3. تصميم متوافق مع dark theme الموقع
- **المخاطر**: منخفضة
- **الاعتماديات**: لا يوجد

#### M-9: إزالة `any` Types
- **المشكلة**: `any` في `useBinanceChart.ts` (3 occurrences) + `rateLimit.middleware.ts` (1 occurrence)
- **الإصلاح المعماري**:
  1. `useBinanceChart.ts:13`: `let chart: any` → نوع مناسب من TradingView
  2. `useBinanceChart.ts:16`: `let candlestickSeries: any` → نوع مناسب
  3. `useBinanceChart.ts:40`: `data.map((d: any)` → interface محدد
  4. تم حل `rateLimit.middleware.ts:45` في H-6b
- **المخاطر**: منخفضة
- **الاعتماديات**: لا يوجد

#### L-1 + L-2: حذف Dead Code
- **المشكلة**: `Navbar.tsx` (91 سطر) و `HeroSection.tsx` (64 سطر) مش مستخدمين
- **الإصلاح المعماري**: حذف الملفين نهائياً
- **المخاطر**: صفر — تأكيد بالـ grep إن مفيش imports
- **الاعتماديات**: لا يوجد

---

## المرحلة 5: Backend Architecture

### الهدف
تحسين Cron Jobs و Cache و AI Pipeline.

### المدة التقديرية
~7 ساعات

### المهام

#### M-1: Cron Job Coordination
- **المشكلة**: 7 crons بتشتغل في نفس الوقت بدون staggering أو health checks
- **الإصلاح المعماري**:
  1. إضافة staggered start: كل cron يبدأ بـ delay مختلف
  2. إضافة health check endpoint: `GET /health/crons`
  3. إضافة graceful shutdown: stop all crons على SIGTERM
  4. Log كل cron execution مع timing
- **المخاطر**: متوسطة — تغيير في server startup flow
- **الاعتماديات**: H-2a (Logger)

#### M-2: Cache Invalidation
- **المشكلة**:
  1. Cache cleanup بس على `set()` — expired entries بتفضل لو مفيش writes
  2. Cache key بي_include timezone مش مستخدم في query
- **الإصلاح المعماري**:
  1. إضافة periodic cleanup interval (كل 5 دقائق) في `cache-manager.ts`
  2. إزالة `req.userTimezone` من cache key في `market.controller.ts:108`
  3. إضافة TTL-based expiration check
- **المخاطر**: متوسطة — لازم نتأكد إن إزالة timezone مش هتأثر على الداتا
- **الاعتماديات**: لا يوجد

#### M-6: Airdrop Hunter حقيقي
- **المشكلة**: `airdropHunter.cron.ts` بيرجع placeholder data hardcoded
- **الإصلاح المعماري**:
  1. تكامل مع CryptoPanic API (مجاني) لجلب أخبار Airdrop
  2. تحليل الـ headlines لتقييم Hype score
  3. حفظ النتائج في الداتابيز
- **المخاطر**: عالية — API integration جديد + NLP logic
- **الاعتماديات**: M-1 (Cron coordination)

#### M-7: إصلاح DataAugmenter
- **المشكلة**: `data-augmenter.ts:44` بيمرر `""` لـ `getTokenData()` بدل `coinSymbol`
- **الإصلاح المعماري**: تمرير `coinSymbol` الصحيح كم parameter
- **المخاطر**: منخفضة — fix بسيط
- **الاعتماديات**: لا يوجد

#### M-8: Real-time Wallet Verification
- **المشكلة**: Verification service يدعم auto-verification بس مفيش mechanism للـ real-time monitoring
- **الإصلاح المعماري**:
  1. إضافة polling mechanism في frontend (`TaskList.tsx`) يفحص حالة الـ task كل 30 ثانية
  2. إضافة endpoint: `GET /verification/check/:taskId`
  3. إضافة toast notification لما الـ task يتـ verify
- **المخاطر**: متوسطة
- **الاعتماديات**: لا يوجد

#### H-9: Tavily API Key Handling
- **المشكلة**: `TAVILY_API_KEY` optional و `tavily.service.ts` بيرجع empty string لو مفيش key
- **الإصلاح المعماري**:
  1. جعل الـ key required في `env.ts`
  2. لو مفيش key في development → warning واضح + fallback to dummy data
  3. في production → error و stop
- **المخاطر**: منخفضة
- **الاعتماديات**: لا يوجد

---

## المرحلة 6: التماميات (Low Priority)

### الهدف
إكمال الميزات المفقودة وتحسين الجودة العامة.

### المدة التقديرية
~3 ساعات

### المهام

#### L-3: Sessions حقيقية من الباك إند
- **المشكلة**: Sessions في `settings/page.tsx` hardcoded ("MacOS / Chrome")
- **الإصلاح المعماري**:
  1. إنشاء endpoint: `GET /auth/sessions` — يرجع sessions حقيقية
  2. إنشاء endpoint: `DELETE /auth/sessions` — terminate other sessions
  3. ربط الصفحة بالـ endpoints
  4. عرض: device, browser, IP, last active
- **المخاطر**: متوسطة — محتاج session tracking في الباك إند
- **الاعتماديات**: H-5 (Auth security)

#### L-4: Notification System
- **المشكلة**: Preferences موجودة في UI + DB لكن مفيش نظام فعلي يبعت إشعارات
- **الإصلاح المعماري**:
  1. إنشاء `backend/src/services/notification.service.ts`
  2. تكامل مع Resend (email API — مجاني للـ development)
  3. Cron job يفحص preferences ويبعت الإشعارات المناسبة
  4. إضافة in-app notification center (badge على icon في navbar)
- **المخاطر**: عالية — ميزة جديدة كاملة
- **الاعتماديات**: M-1 (Cron), L-3 (Sessions)

---

## مخاطر عامة

| المخاطرة | الاحتمال | التأثير | التخفيف |
|----------|----------|---------|---------|
| Redis failure في production | منخفض | عالي | Health checks + fail-closed مع graceful degradation |
| Binance API rate limiting | متوسط | متوسط | Retry logic + caching |
| Breaking changes في external APIs | منخفض | متوسط | Abstraction layers + error handling |
| Auth migration (localStorage → HttpOnly) | — | عالي | تنفيذ تدريجي مع backward compatibility |

---

## إحصائيات التنفيذ

| المرحلة | عدد المهام | المدة التقديرية | الأولوية |
|---------|------------|----------------|----------|
| 1 — Critical Fixes | 4 | 1.5 ساعة | فوري |
| 2 — Security + Error Handling | 7 | 3 ساعات | عالية |
| 3 — UX | 4 | 4 ساعات | عالية |
| 4 — Real Data + Code Quality | 5 | 5 ساعات | متوسطة |
| 5 — Backend Architecture | 6 | 7 ساعات | متوسطة |
| 6 — التماميات | 2 | 3 ساعات | منخفضة |
| **الإجمالي** | **28** | **~24 ساعة** | — |
