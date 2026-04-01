# OnlyAlpha — التاسكات + البرومبتات للـ Junior AI

> **كيفية الاستخدام**: انسخ البرومبت تحت التاسك المطلوب والصقه للـ السينور
> **المرجع**: `AUDIT-PLAN.md`
> **الترتيب**: تنفيذ بالترتيب المكتوب — كل تاسك لازم يخلص قبل اللي بعده

---

## المرحلة 1: إصلاحات حرجة (Critical Fixes)

---

### التاسك 1.1 — C-1: إصلاح `r.coin?.toUpperCase()` crash

**الملفات**: `frontend/src/features/home/types.ts`, `frontend/src/features/terminal/components/TerminalPageClient.tsx`

**البرومبت**:

```
المهمة: إصلاح runtime crash في صفحة الترمينال

الخطوة 1 — عدل الـ type:
في الملف `frontend/src/features/home/types.ts` السطر 33:
غير `coin: string;` إلى `coin: string | null;`

الخطوة 2 — أضف optional chaining:
في الملف `frontend/src/features/terminal/components/TerminalPageClient.tsx` السطر 21:
غير:
  const latestRadarForCoin = radarSignals.find(r => r.coin.toUpperCase() === coin?.toUpperCase())?.id;
إلى:
  const latestRadarForCoin = radarSignals.find(r => r.coin?.toUpperCase() === coin?.toUpperCase())?.id;

الخطوة 3 — أضف فلترة:
قبل السطر 20 (قبل const defaultTab)، أضف هذا السطر:
  const validSignals = radarSignals.filter(r => r.coin);

واستبدل كل استخدام لـ `radarSignals` في المكون بـ `validSignals` (ما عدا الفلترة نفسها).

قواعد صارمة:
- لا تضيف أي comments
- لا تغير أي شيء آخر في الملفات
- احتفظ بكل الـ exports والـ imports كما هي
```

---

### التاسك 1.2 — C-2: إصلاح `defaultRadarId` logic

**الملفات**: `frontend/src/features/terminal/components/TerminalPageClient.tsx`

**البرومبت**:

```
المهمة: إصلاح منطق اختيار الإشارة الافتراضية في صفحة الترمينال

في الملف `frontend/src/features/terminal/components/TerminalPageClient.tsx`:

الخطوة 1 — عدل السطر 20:
غير:
  const defaultTab = initialRadarId || isAlphaFocus ? 'RADAR' : 'WIRE';
إلى:
  const defaultTab = (initialRadarId ?? null) !== null || isAlphaFocus ? 'RADAR' : 'WIRE';

الخطوة 2 — عدل السطر 22:
غير:
  const defaultRadarId = initialRadarId || (isAlphaFocus ? latestRadarForCoin : null);
إلى:
  const defaultRadarId = initialRadarId ?? (isAlphaFocus ? latestRadarForCoin : null);

ملاحظة: الفرق إن `??` (nullish coalescing) بيتجاهل `null` و `undefined` بس، بينما `||` بيتجاهل كل falsy values بما فيها `0`. ده مهم لو `initialRadarId === 0` (أول signal).

قواعد صارمة:
- لا تضيف أي comments
- لا تغير أي شيء آخر في الملف
```

---

### التاسك 1.3 — C-3: إضافة Fallback + Loading States

**الملفات**: `frontend/src/features/terminal/components/TerminalPageClient.tsx`

**البرومبت**:

```
المهمة: إضافة fallback messages و loading states لصفحة الترمينال

في الملف `frontend/src/features/terminal/components/TerminalPageClient.tsx`:

الخطوة 1 — إضافة fallback لما radarSignals فاضية:
بعد الـ state declarations وقبل الـ JSX return، أضف:
  const hasSignals = validSignals.length > 0;

تمرير `hasSignals` كـ prop لـ `TerminalWire` المكون، والـ fallback message بالإنجليزي:
  "No signals available. Signals will appear automatically when available."
(تم التنفيذ في `TerminalWire.tsx:47-59`)

الخطوة 2 — إذا `defaultRadarId` هو null و `hasSignals` هو true:
اختر أول عنصر كـ default:
في تعريف `defaultRadarId`، بعد الـ line الحالي، أضف fallback:
  const finalDefaultRadarId = defaultRadarId ?? validSignals[0]?.id ?? null;

واستبدل `defaultRadarId` بـ `finalDefaultRadarId` في `useState` initialization.

الخطوة 3 — التأكد إن `selectedRadarId` يتـ update لو null:
أضف useEffect بعد الـ state declarations:
  useEffect(() => {
    if (selectedRadarId === null && hasSignals && !finalDefaultRadarId) {
      setSelectedRadarId(validSignals[0]?.id ?? null);
    }
  }, [selectedRadarId, hasSignals, finalDefaultRadarId, validSignals]);

التصميم:
- استخدم نفس الـ styling الموجود في باقي المكونات (font-mono, text-[#555])
- لا تستخدم أي library خارجية
- لا تضيف أي comments

قواعد صارمة:
- لا تغير أي ملف آخر
- احتفظ بكل الـ props والـ types كما هي
- `validSignals` موجود من التاسك 1.1 — لو مش موجود استخدم `radarSignals.filter(r => r.coin)`
```

---

### التاسك 1.4 — C-4: إضافة `import apiClient` في RadarGrid

**الملفات**: `frontend/src/features/home/components/RadarGrid.tsx`

**البرومبت**:

```
المهمة: إضافة import مفقود في RadarGrid

في الملف `frontend/src/features/home/components/RadarGrid.tsx`:

الخطوة 1 — أضف import في أعلى الملف (بعد الـ imports الموجودة):
  import { apiClient } from '@/features/shared/api/client';

الخطوة 2 — تحقق إن مفيش import مكرر لنفس الشيء.

قواعد صارمة:
- لا تضيف أي comments
- لا تغير أي شيء آخر في الملف
- هذا هو التغيير الوحيد المطلوب
```

---

## المرحلة 2: الأمان + Error Handling

---

### التاسك 2.1 — H-2a: إنشاء Winston Logger

**الملفات**: `backend/src/utils/logger.ts` (ملف جديد)

**البرومبت**:

```
المهمة: إنشاء Winston Logger utility

أنشئ ملف جديد `backend/src/utils/logger.ts` بالمحتوى التالي:

استخدم Winston لإنشاء logger بهذا التصميم:
1. Log levels: error, warn, info, http, debug
2. Format: timestamp + colorized level + message
3. Console transport دائماً
4. File transport لو NODE_ENV === 'production':
   - error.log للأخطاء فقط
   - combined.log لكل الـ levels
   - max size: 5MB
   - max files: 5
5. الـ default level حسب NODE_ENV:
   - production: 'info'
   - development: 'debug'
   - test: 'error'

المخرجات:
- export const logger (الـ Winston instance)
- export default logger

قواعد صارمة:
- لا تضيف أي comments
- لا تستخدم أي package غير winston
- استخدم winston.format.combine(), winston.format.timestamp(), winston.format.colorize(), winston.format.printf()
- الـ format: `${timestamp} [${level}]: ${message}`
```

---

### التاسك 2.2 — H-2b: Error Handling في Binance Service

**الملفات**: `backend/src/services/binance.service.ts`

**البرومبت**:

```
المهمة: إضافة try/catch + logging لكل دوال Binance Service

في الملف `backend/src/services/binance.service.ts`:

استورد الـ logger أولاً:
  import { logger } from '../utils/logger';

لكل دالة في الملف (getLivePrice, getLivePrices, getTopMovers, getCoinKlines, getFearAndGreed):

1. لف الـ body بتاع الدالة بـ try/catch
2. في catch block:
   - logger.error مع اسم الدالة والـ error message
   - return sensible fallback:
     * getLivePrice → return null
     * getLivePrices → return []
     * getTopMovers → return []
     * getCoinKlines → return []
     * getFearAndGreed → return { value: 0, classification: 'Unknown' }

مثال للنمط المطلوب:
  async function getLivePrice(symbol: string): Promise<number | null> {
    try {
      // الـ code الحالي كما هو
    } catch (error) {
      logger.error('[Binance] getLivePrice failed for %s: %s', symbol, error instanceof Error ? error.message : String(error));
      return null;
    }
  }

قواعد صارمة:
- لا تضيف أي comments
- لا تغير الـ logic الحالي داخل الـ try block
- لا تغير الـ function signatures
- لا تغير الـ exports
- احتفظ بكل الـ imports الموجودة وأضف logger import
```

---

### التاسك 2.3 — H-2c: Error Handling في Frontend APIs

**الملفات**: `frontend/src/features/home/api.ts`, `frontend/src/features/terminal/api.ts`, `frontend/src/features/airdrop/api.ts`

**البرومبت**:

```
المهمة: إضافة error logging في catch blocks في frontend API files

في كل ملف من الملفات التالية:
- frontend/src/features/home/api.ts
- frontend/src/features/terminal/api.ts
- frontend/src/features/airdrop/api.ts

لكل catch block في الملف:
غير:
  catch {
    return null;
  }
إلى:
  catch (error) {
    console.error('[API] FunctionName failed:', error);
    return null;
  }

استبدل FunctionName بالاسم الفعلي للدالة اللي فيها الـ catch.

مثال:
في home/api.ts لو عندك:
  catch {
    return [];
  }
غيره إلى:
  catch (error) {
    console.error('[API] getTopMovers failed:', error);
    return [];
  }

قواعد صارمة:
- لا تضيف أي comments
- لا تغير الـ logic الحالي
- لا تغير الـ function signatures
- لا تغير الـ exports أو الـ imports
- لا تضف toast notifications في هذا التاسك (تسكتس منفصل)
```

---

### التاسك 2.4 — H-2d: Error Handling في Middleware

**الملفات**: `backend/src/middleware/guest-limit.middleware.ts`

**البرومبت**:

```
المهمة: إضافة logging في middleware catch block

في الملف `backend/src/middleware/guest-limit.middleware.ts`:

الخطوة 1 — استورد الـ logger:
  import { logger } from '../utils/logger';

الخطوة 2 — غير الـ catch block في السطر 35-37:
غير:
  catch {
    next();
  }
إلى:
  catch (error) {
    logger.error('[GuestLimit] Redis error:', error instanceof Error ? error.message : String(error));
    next();
  }

قواعد صارمة:
- لا تضيف أي comments
- لا تغير أي شيء آخر
```

---

### التاسك 2.5 — H-6a: Fail-Closed لـ Redis Middleware

**الملفات**: `backend/src/middleware/guest-limit.middleware.ts`, `backend/src/middleware/rateLimit.middleware.ts`

**البرومبت**:

```
المهمة: تحويل fail-open إلى fail-closed في Redis middleware

الخطوة 1 — في `backend/src/middleware/guest-limit.middleware.ts`:

استورد env config:
  import { env } from '../config/env';

غير الـ block اللي بي check Redis availability:
من:
  if (!redis) {
    next();
    return;
  }
إلى:
  if (!redis) {
    if (env.NODE_ENV === 'development') {
      logger.warn('[GuestLimit] Redis unavailable — bypassing in development');
      next();
      return;
    }
    logger.error('[GuestLimit] Redis unavailable — rejecting request');
    res.status(503).json({ error: 'Service temporarily unavailable' });
    return;
  }

الخطوة 2 — في `backend/src/middleware/rateLimit.middleware.ts`:

نفذ نفس التعديل في كل مكان فيه `if (!redis)`:
- لو env.NODE_ENV === 'development' → warn + next()
- لو production → error + 503 response

قواعد صارمة:
- استخدم الـ logger اللي تم إنشاؤه في التاسك 2.1
- لا تضيف أي comments
- لا تغير أي logic آخر في الـ middleware
- احرص إن الـ env import موجود
```

---

### التاسك 2.6 — H-6b: إزالة `any` من rateLimit middleware

**الملفات**: `backend/src/middleware/rateLimit.middleware.ts`

**البرومبت**:

```
المهمة: إزالة any type من rateLimit middleware

في الملف `backend/src/middleware/rateLimit.middleware.ts`:

الخطوة 1 — ابحث عن كل استخدام لـ `(req as any)` وحدده.

الخطوة 2 — أنشئ أو استخدم interface مناسب:
لو مفيش AuthRequest interface في الملف أو في ملف مشترك:
أضف في أعلى الملف:
  interface RequestWithPlan extends Request {
    userId?: string;
    plan?: string;
  }

الخطوة 3 — استبدل:
  const plan = (req as any).plan || 'free';
بـ:
  const plan = (req as RequestWithPlan).plan || 'free';

الخطوة 4 — لو فيه أي `(req as any)` تاني في نفس الملف، نفذ نفس الشيء.

قواعد صارمة:
- لا تضيف أي comments
- لا تغير أي logic
- لو الـ AuthRequest interface موجود فعلاً في ملف آخر، استورده بدل إنشاء واحد جديد
- تحقق من `backend/src/middleware/auth.middleware.ts` ممكن يكون فيه الـ interface
```

---

### التاسك 2.7 — H-10: Disclaimer Check قبل Chat

**الملفات**: `frontend/src/features/terminal/hooks/useTerminalChat.ts`

**البرومبت**:

```
المهمة: إضافة disclaimer check قبل إرسال رسالة Chat

في الملف `frontend/src/features/terminal/hooks/useTerminalChat.ts`:

الخطوة 1 — أضف state جديد للتتبع:
  const [disclaimerAccepted, setDisclaimerAccepted] = useState<boolean | null>(null);

الخطوة 2 — أضف useEffect لفحص disclaimer status عند mount:
  useEffect(() => {
    async function checkDisclaimer() {
      try {
        const { data } = await apiClient.get('/chat/disclaimer-status');
        setDisclaimerAccepted(data.accepted ?? false);
      } catch {
        setDisclaimerAccepted(false);
      }
    }
    checkDisclaimer();
  }, []);

الخطوة 3 — في دالة `send` (أو الـ function اللي بتبعت الرسالة)، قبل ما تبعت:
أضف check:
  if (disclaimerAccepted === false) {
    return;
  }
  if (disclaimerAccepted === null) {
    return;
  }

الخطوة 4 — أضف دالة لقبول الـ disclaimer:
  const acceptDisclaimer = useCallback(async () => {
    try {
      await apiClient.post('/chat/accept-disclaimer');
      setDisclaimerAccepted(true);
    } catch (error) {
      console.error('[Chat] Failed to accept disclaimer:', error);
    }
  }, []);

الخطوة 5 — أضف الـ values الجديدة للـ return object:
  return {
    ...existing return values,
    disclaimerAccepted,
    acceptDisclaimer,
  };

الخطوة 6 — حدّث الـ return type لو فيه explicit type.

قواعد صارمة:
- لا تضيف أي comments
- لا تغير أي logic موجود
- احتفظ بكل الـ functionality الحالي
- لو `apiClient` مش مستورد، استورده من `@/features/shared/api/client`
```

---

## المرحلة 3: تجربة المستخدم (UX)

---

### التاسك 3.1 — M-4 + M-5: Terminal Mobile — Bottom Navigation Tabs

**الملفات**: `frontend/src/features/terminal/components/TerminalMobileNav.tsx` (جديد), `frontend/src/features/terminal/components/TerminalPageClient.tsx`

**البرومبت**:

```
المهمة: إنشاء Bottom Navigation Tabs لصفحة الترمينال على الموبايل

الخطوة 1 — إنشاء ملف جديد `frontend/src/features/terminal/components/TerminalMobileNav.tsx`:

أنشئ مكون bottom navigation bar بهذا التصميم:
- Props: { activeTab: 'wire' | 'stream' | 'chat'; onTabChange: (tab: 'wire' | 'stream' | 'chat') => void }
- 3 tabs: Wire, Stream, Chat
- الـ styling:
  * Container: fixed bottom-0 left-0 right-0 xl:hidden, bg-black, border-t border-[#222], flex, justify-around, items-center, h-14, z-50
  * كل tab: flex flex-col items-center gap-0.5, px-4 py-2, cursor-pointer, transition-colors
  * Active tab: text-[#00ff88]
  * Inactive tab: text-[#555]
  * Icon: SVG inline (simple —闪电 for Wire, 📊 for Stream, 💬 for Chat) — استخدم SVG paths مش emoji
  * Label: text-[10px] font-mono uppercase tracking-wider

استخدم 'use client' directive.

الخطوة 2 — عدل `frontend/src/features/terminal/components/TerminalPageClient.tsx`:

استورد المكون الجديد:
  import TerminalMobileNav from './TerminalMobileNav';

أضف state:
  const [activeMobileTab, setActiveMobileTab] = useState<'wire' | 'stream' | 'chat'>('wire');

في الـ JSX return:
1. أضف `pb-14 xl:pb-0` للـ main container
2. لف كل terminal section بـ conditional rendering للموبايل:
   - TerminalWire: `className={activeMobileTab === 'wire' ? 'flex' : 'hidden xl:flex'}`
   - AlphaStream: `className={activeMobileTab === 'stream' ? 'flex' : 'hidden xl:flex'}`
   - TerminalChat: `className={activeMobileTab === 'chat' ? 'flex' : 'hidden xl:flex'}`
3. أضف TerminalMobileNav في نهاية الـ JSX:
   <TerminalMobileNav activeTab={activeMobileTab} onTabChange={setActiveMobileTab} />

التصميم:
- الألوان: bg-black, text-white, accent #00ff88, border-[#222], inactive text-[#555]
- نفس الـ dark aesthetic الموجود في باقي الموقع
- Smooth: أضف `transition-all duration-200` للـ content switching

قواعد صارمة:
- لا تضيف أي comments
- لا تستخدم أي package خارجية (لا lucide-react، لا heroicons)
- SVG icons لازم تكون inline
- لا تغير سلوك الـ desktop layout
```

---

### التاسك 3.2 — M-3: Dashboard Sidebar Sticky

**الملفات**: `frontend/src/app/page.tsx`

**البرومبت**:

```
المهمة: جعل Dashboard Sidebar sticky

في الملف `frontend/src/app/page.tsx`:

الخطوة 1 — ابحث عن الـ right sidebar div (حوالي السطر 28-33).
يجب أن يكون شكله كده:
  <div className="w-full lg:w-[30%] flex flex-col gap-4">

الخطوة 2 — أضف sticky classes:
غير إلى:
  <div className="w-full lg:w-[30%] flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start">

الشرح:
- lg:sticky → يبقى sticky على desktop بس (lg breakpoint)
- lg:top-20 → 5rem من فوق (بعد الـ navbar)
- lg:self-start → لازم مع sticky لما يكون في flex container

قواعد صارمة:
- لا تضيف أي comments
- لا تغير أي شيء آخر
- تأكد إن الـ parent container (الـ flex wrapper) مفيش فيه `overflow-hidden`
```

---

### التاسك 3.3 — H-1: Polling لـ TickerBar

**الملفات**: `frontend/src/features/shared/components/TickerBar.tsx`

**البرومبت**:

```
المهمة: إضافة polling كل 15 ثانية لـ TickerBar

في الملف `frontend/src/features/shared/components/TickerBar.tsx`:

الخطوة 1 — ابحث عن الـ useEffect الحالي (حوالي السطر 49-51):
  useEffect(() => {
    homeApi.getTopMovers().then(setMovers);
  }, []);

الخطوة 2 — استبدله بـ polling version:
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;

    async function fetchMovers() {
      try {
        const data = await homeApi.getTopMovers();
        if (data) setMovers(data);
      } catch (error) {
        console.error('[TickerBar] Failed to fetch top movers:', error);
      }
    }

    fetchMovers();
    intervalId = setInterval(fetchMovers, 15000);

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

الشرح:
- يجلب الداتا فوراً عند mount
- يجدد كل 15 ثانية
- Cleanup interval على unmount
- Error handling في كل fetch

قواعد صارمة:
- لا تضيف أي comments
- لا تغير أي شيء آخر في الملف
- لا تضف أي loading state (الـ ticker bar يبقى يعرض آخر data متاحة)
```

---

### التاسك 3.4 — H-8: Sparkline حقيقي من Binance Klines

**الملفات**: `frontend/src/features/home/components/AlphaFocusCard.tsx`

**البرومبت**:

```
المهمة: استبدال الـ SVG sparkline الوهمي بـ sparkline حقيقي من Binance

في الملف `frontend/src/features/home/components/AlphaFocusCard.tsx`:

الخطوة 1 — أضف state و useEffect:
أضف في المكون:
  const [sparklinePath, setSparklinePath] = useState<string>('M0,50 L400,50');
  const [sparklineLoading, setSparklineLoading] = useState(true);

أضف useEffect:
  useEffect(() => {
    if (!coin) return;

    let cancelled = false;

    async function fetchSparkline() {
      try {
        const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=${coin.toUpperCase()}USDT&interval=1h&limit=24`);
        if (!response.ok) throw new Error('Binance API error');
        const data = await response.json();
        if (cancelled || !Array.isArray(data) || data.length === 0) return;

        const prices = data.map((d: unknown[]) => Number((d as unknown[])[4]));
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        const range = max - min || 1;
        const width = 400;
        const height = 100;

        const points = prices.map((price: number, i: number) => {
          const x = (i / (prices.length - 1)) * width;
          const y = height - ((price - min) / range) * (height - 10) - 5;
          return `${i === 0 ? 'M' : 'L'}${x},${y}`;
        });

        setSparklinePath(points.join(' '));
      } catch (error) {
        console.error('[AlphaFocusCard] Sparkline fetch failed:', error);
      } finally {
        if (!cancelled) setSparklineLoading(false);
      }
    }

    fetchSparkline();
    return () => { cancelled = true; };
  }, [coin]);

الخطوة 2 — استبدل الـ SVG hardcoded (حوالي السطر 51-56):
القديم:
  <svg className="..." preserveAspectRatio="none" viewBox="0 0 400 100">
    <path d="M0,85 L20,88 ..." fill="none" stroke="currentColor" strokeWidth="2.5" />
  </svg>

الجديد:
  <svg className="..." preserveAspectRatio="none" viewBox="0 0 400 100">
    {sparklineLoading ? (
      <line x1="0" y1="50" x2="400" y2="50" stroke="currentColor" strokeWidth="1" opacity="0.3" />
    ) : (
      <path d={sparklinePath} fill="none" stroke="currentColor" strokeWidth="2.5" />
    )}
  </svg>

احتفظ بكل الـ classes اللي على الـ svg كما هي.

قواعد صارمة:
- لا تضف أي comments
- لا تغير أي شيء آخر في الملف
- لا تستخدم أي API من الباك إند — استخدم Binance API مباشرة من frontend
- لا تستخدم `any` type — استخدم `unknown[]` مع casting
```

---

## المرحلة 4: بيانات حقيقية + جودة الكود

---

### التاسك 4.1 — H-7: إزالة Mock Data نهائياً

**الملفات**: `frontend/src/features/shared/api/mockData.ts` (حذف), `frontend/src/features/home/api.ts`, `frontend/src/features/terminal/api.ts`, `frontend/src/features/airdrop/api.ts`

**البرومبت**:

```
المهمة: إزالة Mock Data من كود الإنتاج نهائياً

الخطوة 1 — في `frontend/src/features/home/api.ts`:
1. احذف السطر: const isMock = process.env.NEXT_PUBLIC_API_MODE === 'mock';
2. احذف الـ import لـ mockData (لو موجود)
3. في كل function، احذف الـ isMock conditional وأبقى على الـ apiClient call بس:
   من:
     if (isMock) return mockData.xxx;
     const { data } = await apiClient.get(...);
     return data;
   إلى:
     const { data } = await apiClient.get('/endpoint');
     return data;

الخطوة 2 — في `frontend/src/features/terminal/api.ts`:
نفذ نفس الشيء بالضبط.

الخطوة 3 — في `frontend/src/features/airdrop/api.ts`:
نفذ نفس الشيء بالضبط.

الخطوة 4 — احذف الملف:
احذف `frontend/src/features/shared/api/mockData.ts` بالكامل.

قواعد صارمة:
- لا تضيف أي comments
- لا تغير الـ API endpoints
- لا تغير الـ function signatures
- لا تغير الـ exports
- تأكد إن مفيش import لمockData في أي ملف بعد التعديل
```

---

### التاسك 4.2 — H-4: عرض AI Report في Airdrop Details

**الملفات**: `frontend/src/app/airdrops/[id]/page.tsx`

**البرومبت**:

```
المهمة: عرض AI Report في صفحة تفاصيل Airdrop

في الملف `frontend/src/app/airdrops/[id]/page.tsx`:

الخطوة 1 — بعد الـ StatBox grid (بعد السطر 91 تقريباً)، أضف section جديد لعرض الـ aiReport:

  {project.aiReport && (
    <div className="mt-8 border border-[#222] bg-black p-6">
      <h3 className="text-xs font-mono font-bold text-[#00ff88] uppercase tracking-wider mb-4">
        AI Intelligence Report
      </h3>
      <div className="text-sm font-mono text-[#ccc] leading-relaxed whitespace-pre-wrap">
        {project.aiReport}
      </div>
    </div>
  )}

الشرح:
- يظهر بس لو `project.aiReport` مش empty/null/undefined
- الـ styling يتبع نفس الـ dark theme الموجود في الصفحة
- border-[#222], bg-black, text-[#ccc] زي باقي الـ cards في الصفحة
- العنوان باللون الأخضر #00ff88 (اللون الأساسي للموقع)
- whitespace-pre-wrap عشان يحافظ على الـ formatting اللي في الـ report

قواعد صارمة:
- لا تضيف أي comments
- لا تغير أي شيء آخر في الملف
- لا تستخدم react-markdown أو أي library — استخدم pre-formatted text
```

---

### التاسك 4.3 — M-9: إزالة `any` Types في useBinanceChart

**الملفات**: `frontend/src/features/terminal/hooks/useBinanceChart.ts`

**البرومبت**:

```
المهمة: إزالة all `any` types من useBinanceChart hook

في الملف `frontend/src/features/terminal/hooks/useBinanceChart.ts`:

الخطوة 1 — استبدل `let chart: any` (السطر 13 تقريباً):
غير إلى:
  let chart: { applyOptions: (options: Record<string, unknown>) => void; remove: () => void } | null = null;

الخطوة 2 — استبدل `let candlestickSeries: any` (السطر 16 تقريباً):
غير إلى:
  let candlestickSeries: { setData: (data: Array<{ time: number; open: number; high: number; low: number; close: number }>) => void } | null = null;

الخطوة 3 — استبدل `data.map((d: any)` (السطر 40 تقريباً):
أنشئ interface قبل الـ hook:
  interface BinanceKline {
    0: number;
    1: string;
    2: string;
    3: string;
    4: string;
    5: string;
  }

واستبدل:
  data.map((d: any) => ({ ... }))
بـ:
  (data as BinanceKline[]).map((d) => ({ ... }))

واعمل destructure بدل الـ index:
  time: d[0] / 1000,
  open: parseFloat(d[1]),
  high: parseFloat(d[2]),
  low: parseFloat(d[3]),
  close: parseFloat(d[4],

قواعد صارمة:
- لا تضيف أي comments
- لا تغير أي logic
- لا تستخدم `any` في أي مكان
- لو الـ types مش دقيقة 100%، استخدم `unknown` أو generic interfaces
```

---

### التاسك 4.4 — L-1 + L-2: حذف Dead Code

**الملفات**: `frontend/src/features/shared/components/Navbar.tsx` (حذف), `frontend/src/features/home/components/HeroSection.tsx` (حذف)

**البرومبت**:

```
المهمة: حذف Dead Code — مكونات غير مستخدمة

الخطوة 1 — احذف الملف:
frontend/src/features/shared/components/Navbar.tsx

الخطوة 2 — احذف الملف:
frontend/src/features/home/components/HeroSection.tsx

الخطوة 3 — تأكد:
- تأكد إن مفيش import لأي من الملفين في أي ملف آخر
- لو فيه index file في المجلد (مثل `components/index.ts`) وكان بيexport أي منهم، احذف الـ export
- لو فيه barrel export، احذف الإشارة لهم

قواعد صارمة:
- احذف الملفات بالكامل
- لا تضيف أي comments
- لا تغير أي ملف آخر
```

---

## المرحلة 5: Backend Architecture

---

### التاسك 5.1 — M-1: Cron Job Staggered Start + Graceful Shutdown

**الملفات**: `backend/src/server.ts`

**البرومبت**:

```
المهمة: إضافة staggered start و graceful shutdown للـ Cron Jobs

في الملف `backend/src/server.ts`:

الخطوة 1 — استورد الـ logger:
  import { logger } from './utils/logger';

الخطوة 2 — استبدل الـ cron starts block (السطور 59-65):
من:
  startAiWorkflowCron();
  startAirdropHunterCron();
  startDailyAlphaCron();
  startMarketMoodCron();
  startTerminalEngineCron();
  startTriageEngineCron();
  startBufferCleanupCron();

إلى:
  const cronStartDelay = 5000;
  const crons = [
    { name: 'AiWorkflow', fn: startAiWorkflowCron },
    { name: 'AirdropHunter', fn: startAirdropHunterCron },
    { name: 'DailyAlpha', fn: startDailyAlphaCron },
    { name: 'MarketMood', fn: startMarketMoodCron },
    { name: 'TerminalEngine', fn: startTerminalEngineCron },
    { name: 'TriageEngine', fn: startTriageEngineCron },
    { name: 'BufferCleanup', fn: startBufferCleanupCron },
  ];

  crons.forEach((cron, index) => {
    setTimeout(() => {
      try {
        cron.fn();
        logger.info('[Server] Cron started: %s', cron.name);
      } catch (error) {
        logger.error('[Server] Failed to start cron %s: %s', cron.name, error instanceof Error ? error.message : String(error));
      }
    }, index * cronStartDelay);
  });

الخطوة 3 — أضف graceful shutdown handler بعد الـ app.listen:
  process.on('SIGTERM', () => {
    logger.info('[Server] SIGTERM received — shutting down gracefully');
    process.exit(0);
  });

  process.on('SIGINT', () => {
    logger.info('[Server] SIGINT received — shutting down gracefully');
    process.exit(0);
  });

قواعد صارمة:
- لا تضيف أي comments
- لا تغير أي logic آخر
- احتفظ بكل الـ imports الموجودة
```

---

### التاسك 5.2 — M-2: Cache Invalidation Fix

**الملفات**: `backend/src/services/ai/cache-manager.ts`, `backend/src/controllers/market.controller.ts`

**البرومبت**:

```
المهمة: إصلاح Cache Invalidation — إزالة timezone من key + periodic cleanup

الخطوة 1 — في `backend/src/services/ai/cache-manager.ts`:

أضف periodic cleanup. ابحث عن مكان مناسب (بعد الـ class definition أو في constructor):
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

في الـ constructor أو init method، أضف:
  this.cleanupInterval = setInterval(() => {
    this.cleanup();
  }, 5 * 60 * 1000);

و أضف method:
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

الخطوة 2 — في `backend/src/controllers/market.controller.ts`:

ابحث عن السطر اللي فيه cache key (حوالي السطر 108):
  const cacheKey = `radar:latest:${limit}:${offset}:${req.userTimezone || 'UTC'}`;

غيره إلى:
  const cacheKey = `radar:latest:${limit}:${offset}`;

سبب التغيير: timezone مش مستخدم في الـ query الفعلي، فلا داعي يكون في الـ cache key.

قواعد صارمة:
- لا تضيف أي comments
- لا تغير أي logic آخر
- احرص إن الـ CacheManager class methods تبقى كما هي
- لو الـ cleanup method موجود فعلاً، عدله بس ما تنشئ واحد جديد
```

---

### التاسك 5.3 — M-7: إصلاح DataAugmenter — تمرير coinSymbol

**الملفات**: `backend/src/services/ai/data-augmenter.ts`

**البرومبت**:

```
المهمة: إصلاح خطأ في DataAugmenter — تمرير coinSymbol الصحيح

في الملف `backend/src/services/ai/data-augmenter.ts`:

الخطوة 1 — ابحث عن السطر اللي فيه:
  const tokenData = await getTokenData("");

الخطوة 2 — استبدل بـ:
  const tokenData = await getTokenData(coinSymbol);

ملاحظة: `coinSymbol` لازم يكون متوفر كـ parameter في الدالة أو من الـ context.
تحقق إن الـ variable name صحيح — ممكن يكون `symbol` أو `coin` أو `coinSymbol`.
شوف الـ context حول السطر 44 وعرف الـ variable name الصح.

لو الـ function signature فيه `coinSymbol` كـ parameter، استخدمه.
لو مش موجود، شوف الـ context وحدد الـ variable الصح.

قواعد صارمة:
- لا تضيف أي comments
- لا تغير أي شيء آخر
- تأكد من اسم الـ variable قبل التعديل
```

---

### التاسك 5.4 — M-8: Real-time Wallet Verification Polling

**الملفات**: `frontend/src/features/airdrop/components/TaskList.tsx`

**البرومبت**:

```
المهمة: إضافة polling mechanism لفحص حالة الـ verification

في الملف `frontend/src/features/airdrop/components/TaskList.tsx`:

الخطوة 1 — أضف useEffect للـ polling:
  useEffect(() => {
    const pendingTasks = tasks.filter(t => t.status === 'pending');
    if (pendingTasks.length === 0) return;

    const intervalId = setInterval(async () => {
      try {
        const promises = pendingTasks.map(async (task) => {
          const { data } = await apiClient.get(`/verification/check/${task.id}`);
          return data;
        });
        const results = await Promise.allSettled(promises);
        results.forEach((result, index) => {
          if (result.status === 'fulfilled' && result.value.verified) {
            onTaskUpdate(pendingTasks[index].id, 'completed');
          }
        });
      } catch (error) {
        console.error('[TaskList] Verification poll failed:', error);
      }
    }, 30000);

    return () => clearInterval(intervalId);
  }, [tasks, onTaskUpdate]);

ملاحظات:
- `apiClient` لازم يكون مستورد — استورده لو مش موجود: `import { apiClient } from '@/features/shared/api/client'`
- `onTaskUpdate` هو callback لازم يكون موجود في الـ props أو state. لو مش موجود، أضفه كـ prop.
- الـ polling interval: 30 ثانية
- بيستخدم `Promise.allSettled` عشان لو request واحد فشل الباقي يكمل

قواعد صارمة:
- لا تضيف أي comments
- لا تغير أي شيء آخر في الملف
- لو `onTaskUpdate` مش موجود كـ prop، أضفه في الـ type definition
```

---

### التاسك 5.5 — H-9: Tavily API Key Handling

**الملفات**: `backend/src/config/env.ts`, `backend/src/services/tavily.service.ts`

**البرومبت**:

```
المهمة: تحسين Tavily API Key handling

الخطوة 1 — في `backend/src/config/env.ts`:

ابحث عن:
  TAVILY_API_KEY: z.string().optional(),

استبدل بـ:
  TAVILY_API_KEY: z.string().min(1).optional(),

الخطوة 2 — في `backend/src/services/tavily.service.ts`:

استورد الـ logger:
  import { logger } from '../utils/logger';

ابحث عن:
  if (!apiKey) {
    console.warn('[Tavily] No TAVILY_API_KEY found in .env, skipping search.');
    return '';
  }

استبدل بـ:
  if (!apiKey) {
    logger.warn('[Tavily] No TAVILY_API_KEY configured — search functionality disabled');
    return '';
  }

قواعد صارمة:
- لا تضيف أي comments
- لا تغير أي logic آخر
```

---

## المرحلة 6: التماميات (Low Priority)

---

### التاسك 6.1 — L-3: Sessions حقيقية من الباك إند

**الملفات**: `backend/src/controllers/auth.controller.ts` (تعديل), `backend/src/routes/auth.routes.ts` (تعديل), `frontend/src/app/settings/page.tsx` (تعديل)

**البرومبت**:

```
المهمة: ربط Sessions بالباك إند بدل الـ hardcoded data

الخطوة 1 — Backend — أضف endpoint في `backend/src/controllers/auth.controller.ts`:

أضف دالة:
  async getSessions(req: Request, res: Response) {
    try {
      const userId = (req as AuthRequest).userId;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const sessions = await db.query.userSessions.findMany({
        where: eq(userSessions.userId, userId),
        orderBy: desc(userSessions.lastActive),
        limit: 10,
      });
      res.json(sessions);
    } catch (error) {
      logger.error('[Auth] getSessions failed:', error);
      res.status(500).json({ error: 'Failed to fetch sessions' });
    }
  }

  async terminateSessions(req: Request, res: Response) {
    try {
      const userId = (req as AuthRequest).userId;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      await db.delete(userSessions).where(and(
        eq(userSessions.userId, userId),
        ne(userSessions.isCurrent, true)
      ));
      res.json({ message: 'Other sessions terminated' });
    } catch (error) {
      logger.error('[Auth] terminateSessions failed:', error);
      res.status(500).json({ error: 'Failed to terminate sessions' });
    }
  }

الخطوة 2 — أضف routes في `backend/src/routes/auth.routes.ts`:
  router.get('/sessions', authMiddleware, authController.getSessions);
  router.delete('/sessions', authMiddleware, authController.terminateSessions);

الخطوة 3 — Frontend — في `frontend/src/app/settings/page.tsx`:

استبدل الـ hardcoded sessions section بـ dynamic data:
- أضف state: const [sessions, setSessions] = useState<Array<{ id: string; device: string; browser: string; ip: string; lastActive: string; isCurrent: boolean }>>([]);
- أضف useEffect يفحص `/auth/sessions`
- عرض الـ sessions dynamically
- ربط زر "Terminate All Other Sessions" بـ DELETE `/auth/sessions`

التصميم:
- نفس الـ styling الموجود (border-[#333], bg-black, font-mono)
- كل session: device / browser / last active
- Current session مع badge "ACTIVE" باللون الأخضر

قواعد صارمة:
- لا تضف أي comments
- استخدم الـ database schema الموجود فعلاً في user.model.ts
- استورد eq, desc, ne, and من drizzle-orm
- استورد الـ logger من utils/logger
```

---

### التاسك 6.2 — H-3: ربط Airdrop Sidebar بالباك إند

**الملفات**: `backend/src/controllers/airdrop.controller.ts` (تعديل), `backend/src/routes/airdrop.routes.ts` (تعديل), `frontend/src/app/airdrops/page.tsx` (تعديل), `frontend/src/features/airdrop/api.ts` (تعديل)

**البرومبت**:

```
المهمة: ربط Airdrop page sidebar بالباك إند — إحصائيات + نشاط + مواعيد

الخطوة 1 — Backend — أضف endpoints في `backend/src/controllers/airdrop.controller.ts`:

أضف 3 دوال:

  async getStats(req: Request, res: Response) {
    try {
      const userId = (req as AuthRequest).userId;
      const totalValue = await calculateTotalAirdropValue(userId);
      const walletCount = await getUserWalletCount(userId);
      const txCount = await getUserTxCount(userId);
      res.json({ totalValue, walletCount, txCount });
    } catch (error) {
      logger.error('[Airdrop] getStats failed:', error);
      res.status(500).json({ error: 'Failed to fetch stats' });
    }
  }

  async getActivity(req: Request, res: Response) {
    try {
      const userId = (req as AuthRequest).userId;
      const activity = await getRecentActivity(userId, 10);
      res.json(activity);
    } catch (error) {
      logger.error('[Airdrop] getActivity failed:', error);
      res.status(500).json({ error: 'Failed to fetch activity' });
    }
  }

  async getDeadlines(req: Request, res: Response) {
    try {
      const deadlines = await getUpcomingDeadlines(5);
      res.json(deadlines);
    } catch (error) {
      logger.error('[Airdrop] getDeadlines failed:', error);
      res.status(500).json({ error: 'Failed to fetch deadlines' });
    }
  }

الخطوة 2 — أضف routes في `backend/src/routes/airdrop.routes.ts`:
  router.get('/stats', optionalAuth, airdropController.getStats);
  router.get('/activity', optionalAuth, airdropController.getActivity);
  router.get('/deadlines', airdropController.getDeadlines);

الخطوة 3 — Frontend API — في `frontend/src/features/airdrop/api.ts`:

أضف 3 functions:
  async function getAirdropStats(): Promise<AirdropStats | null> { ... }
  async function getAirdropActivity(): Promise<AirdropActivity[] | null> { ... }
  async function getAirdropDeadlines(): Promise<AirdropDeadline[] | null> { ... }

مع types:
  interface AirdropStats { totalValue: number; walletCount: number; txCount: number; }
  interface AirdropActivity { id: string; description: string; timestamp: string; type: string; }
  interface AirdropDeadline { id: string; name: string; deadline: string; daysLeft: number; }

الخطوة 4 — Frontend Page — في `frontend/src/app/airdrops/page.tsx`:

استبدل كل hardcoded data:
- $4,500+ → stats.totalValue
- 08 wallets → stats.walletCount
- 1,242 TXs → stats.txCount
- "Recent Activity" items → activity data
- "Upcoming Deadlines" items → deadlines data

أضف:
- useState لكل data type
- useEffect يجلب الداتا عند mount
- Loading state (font-mono text-[#555] "Loading...")
- Error state (font-mono text-red-500 "Failed to load")

قواعد صارمة:
- لا تضف أي comments
- استخدم نفس الـ styling الموجود في الصفحة
- الـ helper functions (calculateTotalAirdropValue, etc.) ممكن تكون placeholder implementations ترجع mock data من الداتابيز — المهم إن الـ API infrastructure يكون صح
```

---

## ملخص سريع

| المرحلة | عدد التاسكات | التاسكات |
|---------|-------------|----------|
| 1 — Critical | 4 | 1.1, 1.2, 1.3, 1.4 |
| 2 — Security | 7 | 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7 |
| 3 — UX | 4 | 3.1, 3.2, 3.3, 3.4 |
| 4 — Data + Quality | 4 | 4.1, 4.2, 4.3, 4.4 |
| 5 — Backend | 5 | 5.1, 5.2, 5.3, 5.4, 5.5 |
| 6 — التماميات | 2 | 6.1, 6.2 |
| **الإجمالي** | **26** | — |
