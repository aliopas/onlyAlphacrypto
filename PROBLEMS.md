# سجل المشكلات البرمجية (Code Issues Log)

هذا الملف مخصص لتوثيق المشكلات التي يتم تحديدها في الكود، مع شرح الحالة الراهنة وتأثيرها على بقية أجزاء التطبيق.

---

## مشكلة 1: البار العلوي والسايدبار (أدوات الأسعار المتحركة) تظهر كبيانات ثابتة (Mockups)
- **الملفات المتأثرة**: 
  - `frontend/src/features/shared/components/TickerBar.tsx`
  - `frontend/src/features/home/components/TopMovers.tsx`
  - `frontend/src/app/page.tsx`
  - `backend/src/services/binance.service.ts`
- **الحالة الراهنة**: 
  - البيانات يتم جلبها من الباك إند (Binance API) بشكل سليم تقنياً، لكنها تظهر للمستخدم كأنها Mockup أو معلومات ثابتة.
  - في الفروينت إند، المكونات (`TickerBar`, `TopMovers`) تقوم بجلب البيانات **مرة واحدة فقط** عند تحميل الصفحة (`useEffect` بدون تحديث دوري).
  - صفحة `HomePage` تستخدم خاصية `revalidate = 60` مما يجعل البيانات ثابتة لمدة دقيقة كاملة حتى مع تحديث الصفحة (Refresh).
  - لا يوجد نظام تحديث لحظي (WebSockets أو Polling) لجعل الأسعار "تتحرك" فعلياً أمام المستخدم.
- **التأثير**: 
  - يفقد التطبيق مصداقيته في تقديم بيانات "حية" (Live Data) ويشعر المستخدم أن المعلومات قديمة أو غير حقيقية (Mockup).
  - التيكر العلوي (TickerBar) يتحرك بصرياً (Animation) ولكن الأرقام داخله تظل ثابتة تماماً.

---

## مشكلة 2: عطل زرار "Load More Signals" وخطأ تقني في الكود
- **الملفات المتأثرة**: `frontend/src/features/home/components/RadarGrid.tsx`
- **الحالة الراهنة**: 
  - عند الضغط على الزر، يحدث "Crash" للتطبيق وتظهر رسالة خطأ `ReferenceError: apiClient is not defined`.
  - السبب هو محاولة إجراء طلب API باستخدام `apiClient` دون عمل `import` له في ملف المكون.
- **التأثير**: 
  - تعطل وظيفة جلب المزيد من الإشارات (Signals) تماماً، مما يمنع المستخدم من تصفح البيانات القديمة.

---

## مشكلة 3: تجربة المستخدم (UX) وتخطيط الصفحة (Layout)
- **الموقع المتأثر**: الصفحة الرئيسية (Dashboard)
- **الحالة الراهنة**: 
  - **السلوك البصري**: السايدبار الأيمن (Top Movers / Market Mood) يختفي عند النزول لأسفل لتصفح الـ Radar Signals، مما يترك مساحة فارغة كبيرة على اليمين ويجبر المستخدم على الصعود للأعلى لمشاهدة حالة السوق.
  - **موقع الزر**: زر "Load More" يقع في نهاية الشبكة (Grid) وهو مكان تقليدي، ولكن مع تزايد عدد المقالات، يصبح الوصول إليه متعباً (خاصة في الـ UX الحديث الذي يفضل الـ Infinite Scroll أو الأزرار الثابتة).
- **الحالة المطلوبة**: 
  - جعل السيكشن الأيمن (Sidebar) "ثابتاً" (`sticky`) بحيث يتحرك مع المستخدم أثناء النزول.
  - تحسين مكان زر الـ Load More أو طريقة عرضه ليكون أكثر تناسقاً مع الـ Sidebar الثابت.

---

## مشكلة 4: صفحة الترمينال على الموبايل - زر "Load More" في Terminal Wire غير قابل للاستخدام
- **الملفات المتأثرة**: 
  - `frontend/src/features/terminal/components/TerminalWire.tsx`
  - `frontend/src/features/terminal/components/TerminalPageClient.tsx`
- **الحالة الراهنة**: 
  - في ملف [`TerminalWire.tsx`](frontend/src/features/terminal/components/TerminalWire.tsx:115-125)، زر "Show More +" موجود داخل الـ `aside` الذي له `h-[300px]` على الموبايل (السطر 49: `h-[300px] xl:h-auto`).
  - هذا الارتفاع الثابت (300px) على الموبايل يجعل القائمة قصيرة جداً، والزر يكون في نهاية القائمة التي تحتاج للتمرير داخل حاوية صغيرة.
  - في [`TerminalPageClient.tsx`](frontend/src/features/terminal/components/TerminalPageClient.tsx:62)، التخطيط يستخدم `flex-1 flex flex-col xl:flex-row` مما يعني على الموبايل كل العناصر تكون عمودية (column) وتحتاج للتمرير.
  - زر "Load More" في TerminalWire يعمل بشكل صحيح تقنياً (يستخدم `apiClient` المستورد بشكل صحيح)، لكن تجربة المستخدم على الموبايل سيئة بسبب الارتفاع المحدود.
- **التأثير**: 
  - المستخدم على الموبايل يواجه صعوبة في الوصول لزر "Load More" بسبب الارتفاع المحدود (300px) والحاجة للتمرير داخل مساحة صغيرة.
  - هذا يقلل من إمكانية استكشاف الإشارات القديمة ويحد من تجربة المستخدم.

---

## مشكلة 5: صفحة الترمينال على الموبايل - لا يوجد مكان كافٍ لعرض المقالة (AlphaStream)
- **الملفات المتأثرة**: 
  - `frontend/src/features/terminal/components/TerminalPageClient.tsx`
  - `frontend/src/features/terminal/components/AlphaStream.tsx`
  - `frontend/src/features/terminal/components/TerminalWire.tsx`
  - `frontend/src/features/terminal/components/TerminalChat.tsx`
- **الحالة الراهنة**: 
  - في [`TerminalPageClient.tsx`](frontend/src/features/terminal/components/TerminalPageClient.tsx:62)، التخطيط على الموبايل (`xl:flex-row` لا يُطبق) يجعل كل العناصر (`TerminalWire`, `AlphaStream`, `TerminalChat`) تتراص عمودياً (`flex-col`).
  - `TerminalWire` له `h-[300px]` على الموبايل (السطر 49 في TerminalWire.tsx).
  - `TerminalChat` له `h-[600px]` على الموبايل (السطر 27 في TerminalChat.tsx).
  - `AlphaStream` (منطقة عرض المقالة) ليس له ارتفاع محدد، لكنه محصور بين عنصرين كبيرين (300px + 600px = 900px) مما يترك مساحة صغيرة جداً أو معدومة للمقالة نفسها على شاشات الموبايل.
  - الحاوية الرئيسية `flex-1 flex flex-col xl:flex-row overflow-y-auto xl:overflow-hidden` (السطر 62) تعني أن التمرير يكون عمودياً على الموبايل، لكن العناصر الثلاثة تتنافس على المساحة.
  - `AlphaStream` في [`AlphaStream.tsx`](frontend/src/features/terminal/components/AlphaStream.tsx:89) يستخدم `flex-1 flex flex-col p-8 xl:p-12 overflow-y-auto` لكن `flex-1` لا يعمل بشكل فعال عندما تكون العناصر الأخرى لها ارتفاعات ثابتة كبيرة.
- **التأثير**: 
  - المستخدم على الموبايل لا يرى محتوى المقالة (AlphaStream) بشكل كافٍ، لأن المساحة المتاحة لها صغيرة جداً أو معدومة.
  - المقالة هي المحتوى الرئيسي للصفحة، وعدم القدرة على قراءتها على الموبايل يُفقد الصفحة قيمتها الأساسية.
  - التصميم الحالي مُهيأ للشاشات الكبيرة (Desktop/XL) بشكل أساسي، ويتجاهل تجربة الموبايل.

---

## مشكلة 6: صفحة Airdrop - سايدبار "Recent Activity" بيانات وهمية (Mockup)
- **الملفات المتأثرة**: 
  - `frontend/src/app/airdrops/page.tsx`
- **الحالة الراهنة**: 
  - في ملف [`page.tsx`](frontend/src/app/airdrops/page.tsx:105-117)، قسم "Recent Activity" يحتوي على بيانات hardcoded تماماً:
    ```tsx
    {[
        { dot: 'bg-blue-500', text: 'Swapped 0.2 ETH on ZkSync', time: '2 minutes ago' },
        { dot: 'bg-emerald-500', text: 'Completed "Linea Voyage" Task 4', time: '1 hour ago' },
        { dot: 'bg-yellow-500', text: 'BERA Faucet claim successful', time: '6 hours ago' },
    ].map((a, i) => (
    ```
  - لا يوجد أي اتصال بالباك إند لجلب النشاط الحقيقي للمستخدم.
  - قسم "My Farming Stats" أيضاً يحتوي على بيانات ثابتة (`$4,500+`, `08` wallets, `1,242` TXs) (السطور 85-96).
  - قسم "Upcoming Deadlines" أيضاً hardcoded (السطور 128-142).
- **التأثير**: 
  - المستخدم لا يرى نشاطه الحقيقي على الصفحة، مما يفقد الصفحة مصداقيتها.
  - النظام الأساسي يعتمد على ربط المحفظة ومراقبة الترانزكشنز، لكن الواجهة لا تعرض أي بيانات حقيقية.
  - **الحل المطلوب**: 
    1. عند ربط المستخدم لمحفظته (`userWallets`)، يتم فتح session مراقبة.
    2. يتم جلب الترانزكشنز الحقيقية من Moralis API وعرضها في Recent Activity.
    3. يتم حساب الإحصائيات الحقيقية (Total TXs, Wallets Active) من الباك إند.

---

## مشكلة 7: صفحة تفاصيل مشروع Airdrop - تفتقر معلومات أساسية (فريق، سيولة، تحليل AI)
- **الملفات المتأثرة**: 
  - `frontend/src/app/airdrops/[id]/page.tsx`
  - `frontend/src/features/airdrop/types.ts`
  - `backend/src/models/airdrop.model.ts`
- **الحالة الراهنة**: 
  - في ملف [`page.tsx`](frontend/src/app/airdrops/[id]/page.tsx:77-91)، صفحة المشروع تعرض فقط:
    - Est. Value
    - Snapshot Date
    - TGE Date
    - Progress Percentage
  - **معلومات مفقودة تماماً**:
    - **معلومات الفريق**: لا يوجد عرض لأعضاء الفريق أو خلفياتهم.
    - **السيولة المحتملة**: لا يوجد تحليل للسيولة أو Funding Round.
    - **تقرير AI الكامل**: حقل `aiReport` موجود في الداتابيز (`backend/src/models/airdrop.model.ts:14`) لكن لا يتم عرضه في الواجهة.
    - **المنصات المتوقعة**: لا يوجد قائمة بالمنصات التي سيتم الإدراج عليها.
    - **تحليل Hype/Scam**: الـ `riskVerdict` موجود لكن بدون تفاصيل عن سبب التصنيف.
  - في [`types.ts`](frontend/src/features/airdrop/types.ts:15-29)، الـ `AirdropProject` type لا يحتوي على حقول للفريق أو السيولة أو المنصات المتوقعة.
- **التأثير**: 
  - المستخدم لا يحصل على معلومات كافية لاتخاذ قرار حول المشروع.
  - القيمة الأساسية للمنصة (AI Intelligence) لا تظهر في صفحة التفاصيل.
  - **الحل المطلوب**:
    1. إضافة حقول جديدة للـ types (teamInfo, liquidityAnalysis, expectedPlatforms, scamAnalysis).
    2. عرض تقرير AI الكامل في صفحة المشروع.
    3. إضافة قسم لمعلومات الفريق والسيولة.

---

## مشكلة 8: نظام التحقق (Verification) - لا يوجد مراقبة لحظية للمحفظة
- **الملفات المتأثرة**: 
  - `backend/src/services/verification.service.ts`
  - `backend/src/services/moralis.service.ts`
  - `frontend/src/features/airdrop/components/TaskList.tsx`
- **الحالة الراهنة**: 
  - في ملف [`verification.service.ts`](backend/src/services/verification.service.ts:15-77)، التحقق يتم **فقط** عندما يضغط المستخدم على زر "Verify".
  - لا يوجد نظام مراقبة لحظية (Real-time Monitoring) للمحفظة.
  - في [`TaskList.tsx`](frontend/src/features/airdrop/components/TaskList.tsx:16-29)، المستخدم يجب أن يضغط يدوياً على كل مهمة للتحقق منها.
  - **مفقود**:
    - **مراقبة لحظية**: لا يوجد WebSocket أو Polling لمراقبة الترانزكشنز الجديدة.
    - **إشعارات تلقائية**: المستخدم لا يتم إشعاره عند إكمال مهمة تلقائياً.
    - **Session Monitoring**: لا يوجد نظام لفتح session مراقبة عند ربط المحفظة.
- **التأثير**: 
  - تجربة المستخدم سيئة (يجب الضغط يدوياً على كل مهمة).
  - التأخير في اكتشاف الترانزكشنز الجديدة.
  - **الحل المطلوب**:
    1. عند ربط المحفظة، يتم فتح session مراقبة.
    2. استخدام Moralis Streams (Webhooks) أو Polling لمراقبة الترانزكشنز.
    3. إشعار المستخدم عند إكمال مهمة تلقائياً.

---

## مشكلة 9: نظام Validation - لا يوجد تحليل معتمد على الأخبار والـ Hype
- **الملفات المتأثرة**: 
  - `backend/src/crons/airdropHunter.cron.ts`
  - `backend/src/services/openai.service.ts`
- **الحالة الراهنة**: 
  - في ملف [`airdropHunter.cron.ts`](backend/src/crons/airdropHunter.cron.ts:11-25)، دالة `scrapePotentialAirdrops()` تستخدم **بيانات وهمية** (placeholder):
    ```tsx
    console.log('[AirdropHunter] Using placeholder daily scrape data...');
    return [
        { name: 'LayerZero', description: '...', network: 'Omnichain' },
        { name: 'ZkSync Era', description: '...', network: 'zkSync Era' }
    ];
    ```
  - لا يوجد جلب حقيقي للأخبار أو تحليل Hype من المنصات الاجتماعية.
  - في [`openai.service.ts`](backend/src/services/openai.service.ts)، دالة `validateAirdrop()` موجودة لكن المدخلات لها وهمية.
  - **مفقود**:
    - **جلب الأخبار**: لا يوجد تكامل مع CryptoPanic/Tavily لجلب الأخبار عن المشاريع.
    - **تحليل Hype**: لا يوجد تحليل لـ Twitter/Discord/Reddit لقياس الـ Hype.
    - **Scam Detection**: لا يوجد تحليل متقدم للكشف عن المشاريع المشبوهة.
    - **TGE Prediction**: لا يوجد توقع للمنصات المتوقعة للإدراج.
- **التأثير**: 
  - نظام الـ Airdrop Hunter لا يعمل بشكل حقيقي.
  - المستخدم لا يحصل على تحليلات AI حقيقية عن المشاريع.
  - **الحل المطلوب**:
    1. تكامل مع CryptoPanic/Tavily API لجلب الأخبار.
    2. تحليل Hype من Twitter/Discord/Reddit.
    3. استخدام AI لتحليل المشروع وتحديد:
       - هل هو Scam؟
       - متى متوقع TGE؟
       - ما هي المنصات المتوقعة؟
        - ما هي السيولة المحتملة؟

---

## مشكلة 10: نظام AI - DataAugmenter يجلب بيانات DexScreener بدون عنوان (empty address)
- **الملفات المتأثرة**: 
  - `backend/src/services/ai/data-augmenter.ts`
  - `backend/src/services/dexscreener.service.ts`
- **الحالة الراهنة**: 
  - في ملف [`data-augmenter.ts`](backend/src/services/ai/data-augmenter.ts:44)، دالة `getTokenData()` تُستدعى بعنوان فارغ (`""`):
    ```tsx
    const tokenData = await getTokenData("");
    ```
  - هذا يعني أن كل طلب لجلب بيانات السوق لأي عملة يرجع بيانات غير صحيحة أو فارغة.
  - في [`aiWorkflow.cron.ts`](backend/src/crons/aiWorkflow.cron.ts:61-62)، يتم استخدام `dexMap.get(coin.coinSymbol.toUpperCase())` لجلب العنوان، لكن هذا يعتمد على بيانات DexScreener التي قد لا تكون متاحة لكل العملات.
  - في [`dexscreener.service.ts`](backend/src/services/dexscreener.service.ts)، الدالة `getTokenData(address)` تتطلب عنوان صحيح للعمل، لكن العنوان الفارغ يسبب فشل الطلب.
- **التأثير**: 
  - تحليلات AI تعمل بدون بيانات سوق حقيقية (price, volume, liquidity, market cap).
  - تقارير `DeepIntelligenceReport` و `MarketVerdict` تكون غير دقيقة بسبب نقص البيانات.
  - **الحل المطلوب**:
    1. تمرير العنوان الصحيح للعملة عند جلب البيانات.
    2. استخدام CoinGecko أو Binance API كبديل للبيانات الأساسية.
    3. تحسين DexScreener search للعثور على العنوان الصحيح بناءً على اسم العملة.

---

## مشكلة 11: نظام AI - لا يوجد نظام إشعارات للمستخدمين
- **الملفات المتأثرة**: 
  - `backend/src/models/user.model.ts`
  - `frontend/src/features/settings/components/PreferencesPanel.tsx`
  - `backend/src/crons/` (جميع ملفات الـ Crons)
- **الحالة الراهنة**: 
  - في ملف [`user.model.ts`](backend/src/models/user.model.ts:50-58)، جدول `userPreferences` يحتوي على حقول للإشعارات:
    - `emailAlerts`
    - `breakingNewsAlerts`
    - `airdropDeadlineAlerts`
    - `alphaFocusAlerts`
  - في [`PreferencesPanel.tsx`](frontend/src/features/settings/components/PreferencesPanel.tsx:25-30)، الواجهة تعرض خيارات الإشعارات.
  - **لكن لا يوجد نظام إشعارات فعلي**:
    - لا يوجد كود لإرسال بريد إلكتروني (No Nodemailer/SendGrid/Resend).
    - لا يوجد نظام Push Notifications (No Web Push / Firebase).
    - لا يوجد نظام In-App Notifications (No notifications table in DB).
    - الـ Crons لا تتحقق من تفضيلات المستخدمين قبل التنفيذ.
- **التأثير**: 
  - المستخدم يفعّل الإشعارات لكن لا يتلقى أي شيء.
  - فقدان قيمة أساسية من المنصة (Real-time Alerts).
  - **الحل المطلوب**:
    1. إضافة جدول `notifications` في الداتابيز.
    2. تكامل مع خدمة بريد إلكتروني (Resend/SendGrid).
    3. إضافة Web Push Notifications.
    4. تعديل الـ Crons للتحقق من تفضيلات المستخدمين وإرسال الإشعارات.

---

## مشكلة 12: صفحة الإعدادات - تفتقر ميزات أساسية وتجربة مستخدم محسّنة
- **الملفات المتأثرة**: 
  - `frontend/src/features/settings/components/`
  - `frontend/src/app/settings/page.tsx`
  - `backend/src/controllers/user.controller.ts`
- **الحالة الراهنة**: 
  - **الميزات المفقودة**:
    - **لا يوجد إدارة للملف الشخصي**: لا يمكن تغيير الاسم أو الصورة الشخصية.
    - **لا يوجد تغيير كلمة المرور**: المستخدم لا يمكنه تحديث كلمة المرور.
    - **لا يوجد إدارة الجلسات**: لا يمكن عرض أو إنهاء الجلسات النشطة.
    - **لا يوجد تصدير البيانات**: لا يمكن تصدير سجل الترانزكشنز أو الإشارات.
    - **لا يوجد Dark/Light Mode Toggle**: التطبيق Dark فقط.
  - **مشاكل في الواجهة**:
    - في [`WalletManager.tsx`](frontend/src/features/settings/components/WalletManager.tsx:57-62)، حقل إدخال المحفظة `readOnly` مما يعني المستخدم لا يمكنه رؤية العنوان الكامل للتعديل أو النسخ بسهولة.
    - في [`ApiKeyManager.tsx`](frontend/src/features/settings/components/ApiKeyManager.tsx:88-92)، المفتاح الجديد يظهر مع `blur` effect مما يصعب نسخه.
    - في [`PricingCards.tsx`](frontend/src/features/settings/components/PricingCards.tsx)، لا يوجد تكامل حقيقي مع بوابة دفع (Stripe/Coinbase Commerce).
  - **في الباك إند**:
    - في [`user.controller.ts`](backend/src/controllers/user.controller.ts)، لا يوجد endpoint لتغيير كلمة المرور أو إدارة الجلسات.
- **التأثير**: 
  - تجربة مستخدم غير مكتملة.
  - فقدان ميزات أمان أساسية (تغيير كلمة المرور، إدارة الجلسات).
  - **الحل المطلوب**:
    1. إضافة صفحة إدارة الملف الشخصي.
    2. إضافة تغيير كلمة المرور مع التحقق.
    3. إضافة إدارة الجلسات النشطة.
    4. تحسين تجربة نسخ المفاتيح والعناوين.

---

## مشكلة 13: نظام المصادقة (Auth) - غير مكتمل ويحتاج تحسينات
- **الملفات المتأثرة**: 
  - `frontend/src/app/auth/page.tsx`
  - `backend/src/middleware/auth.middleware.ts`
  - `backend/src/controllers/user.controller.ts`
  - `backend/src/models/user.model.ts`
- **الحالة الراهنة**: 
  - **الميزات المفقودة**:
    - **لا يوجد تسجيل دخول عبر Web3 Wallet**: المصادقة فقط عبر Email/Password.
    - **لا يوجد 2FA (Two-Factor Authentication)**: حماية الحساب ضعيفة.
    - **لا يوجد Forgot Password / Reset Password**: المستخدم الذي ينسى كلمة المرور لا يمكنه استعادتها.
    - **لا يوجد Email Verification**: الحسابات الجديدة لا تحتاج تأكيد البريد.
    - **لا يوجد Social Login**: لا يوجد Google/GitHub/Discord OAuth.
  - **مشاكل تقنية**:
    - في [`auth/page.tsx`](frontend/src/app/auth/page.tsx:26-28)، الـ token يُحفظ في `localStorage` مما يجعله عرضة لـ XSS attacks.
    - في [`auth.middleware.ts`](backend/src/middleware/auth.middleware.ts)، لا يوجد تحقق من صلاحية الـ token أو Blacklist للـ tokens المنتهية.
    - في [`user.model.ts`](backend/src/models/user.model.ts:39-47)، جدول `sessions` موجود لكن لا يُستخدم بشكل فعال (لا يوجد session rotation).
  - **في الواجهة**:
    - صفحة المصادقة بسيطة جداً بدون خيار "Remember Me" أو "Forgot Password".
    - لا يوجد مؤشر لقوة كلمة المرور عند التسجيل.
- **التأثير**: 
  - أمان الحسابات ضعيف.
  - تجربة مستخدم غير مكتملة.
  - فقدان ميزة Web3 Wallet Login التي هي أساسية لمنصة Crypto.
  - **الحل المطلوب**:
    1. إضافة Web3 Wallet Authentication (Sign Message).
    2. إضافة 2FA عبر TOTP.
    3. إضافة Forgot/Reset Password flow.
    4. إضافة Email Verification.
    5. استخدام HttpOnly Cookies بدلاً من localStorage للـ token.
    6. إضافة Session Management مع rotation.

---

## مشكلة 14: Mock Data في الإنتاج يخفي مشاكل حقيقية
- **الملفات المتأثرة**: 
  - `frontend/src/features/home/api.ts`
  - `frontend/src/features/terminal/api.ts`
  - `frontend/src/features/airdrop/api.ts`
  - `frontend/src/features/shared/api/mockData.ts`
- **الحالة الراهنة**: 
  - في كل ملفات الـ API الرئيسية، يوجد شرط `isMock` يعتمد على `process.env.NEXT_PUBLIC_API_MODE === 'mock'`:
    - [`home/api.ts`](frontend/src/features/home/api.ts:5-9): `if (isMock) return MOCK_MARKET_MOOD;`
    - [`terminal/api.ts`](frontend/src/features/terminal/api.ts:5-9): `if (isMock) return MOCK_COIN_NEWS;`
    - [`airdrop/api.ts`](frontend/src/features/airdrop/api.ts:5-9): `if (isMock) return MOCK_AIRDROPS;`
  - في [`mockData.ts`](frontend/src/features/shared/api/mockData.ts:7-96)، البيانات الوهمية محددة مسبقاً (LayerZero, ZkSync, Berachain, Blast).
  - **المشكلة**: 
    - إذا الـ env variable مش مضبوط صح أو الـ backend مش شغال، التطبيق هيشتغل على Mock Data بدون ما المستخدم يعرف.
    - المطورين ممكن يعتمدوا على البيانات الوهمية في التطوير وينسوا يختبروا مع الباك إند الحقيقي.
    - المستخدم ممكن يشوف بيانات قديمة أو غير حقيقية من غير ما يدري.
- **التأثير**: 
  - صعوبة اكتشاف مشاكل الاتصال بالباك إند.
  - بيانات غير حقيقية تظهر للمستخدم.
  - صعوبة التتبع (Debugging) لأن مش واضح البيانات منين جاية.
  - **الحل المطلوب**:
    1. إزالة Mock Data من كود الإنتاج نهائياً.
    2. استخدام Storybook أو MSW (Mock Service Worker) للاختبارات فقط.
    3. إضافة Loading States و Error Boundaries واضحة عند فشل الاتصال.

---

## مشكلة 15: Error Handling ضعيف في الـ Services
- **الملفات المتأثرة**: 
  - `backend/src/services/` (جميع الملفات)
  - `frontend/src/features/*/api.ts`
- **الحالة الراهنة**: 
  - في كتير من الـ services، الـ Error Handling بيكون بشكل ضعيف:
    - [`home/api.ts`](frontend/src/features/home/api.ts:13-15): `catch { return null; }` - بدون logging أو rethrow
    - [`terminal/api.ts`](frontend/src/features/terminal/api.ts:13-15): `catch { return []; }` - نفس المشكلة
    - [`airdrop/api.ts`](frontend/src/features/airdrop/api.ts:13-15): `catch { return []; }` - نفس المشكلة
    - [`binance.service.ts`](backend/src/services/binance.service.ts:51-61): لا يوجد try/catch حول طلبات API
    - [`moralis.service.ts`](backend/src/services/moralis.service.ts:68-70): `catch { // Skip failing chains silently }` - فشل صامت
  - **المشكلة**:
    - الأخطاء بتتم swallow بدون logging، مما يصعب تتبع المشاكل.
    - الـ frontend بيرجع `null` أو `[]` مما يخلي الواجهة تعرض "لا توجد بيانات" من غير ما تعرف المستخدم فيه خطأ.
    - لا يوجد نظام Centralized Error Handling.
    - لا يوجد Retry Logic للطلبات الفاشلة.
- **التأثير**: 
  - صعوبة تتبع الأخطاء في الإنتاج (No observability).
  - المستخدم بيشوف واجهة فاضية من غير ما يعرف السبب.
  - فقدان بيانات مهمة بسبب فشل صامت.
  - **الحل المطلوب**:
    1. إضافة Logging لكل الأخطاء (Winston/Pino).
    2. إضافة Retry Logic للطلبات المهمة.
    3. Centralized Error Handling في الـ frontend.
    4. Toast Notifications للمستخدم عند حدوث أخطاء.

---

## مشكلة 16: Cron Jobs متضاربة وبدون Coordination
- **الملفات المتأثرة**: 
  - `backend/src/server.ts`
  - `backend/src/crons/` (جميع الملفات)
- **الحالة الراهنة**: 
  - في ملف [`server.ts`](backend/src/server.ts:59-65)، 7 cron jobs بيشتغلوا في نفس الوقت:
    ```tsx
    startAiWorkflowCron();
    startAirdropHunterCron();
    startDailyAlphaCron();
    startMarketMoodCron();
    startTerminalEngineCron();
    startTriageEngineCron();
    startBufferCleanupCron();
    ```
  - **المشكلة**:
    - **لا يوجد Coordination**: كل cron بيشتغل بشكل مستقل، مما ممكن يسبب:
      - Race Conditions على نفس البيانات (مثل `coinNews` table).
      - استهلاك عالي للـ CPU/Memory لما كل الـ crons تشتغل في نفس الوقت.
      - Deadlocks في الداتابيز.
    - **لا يوجد Health Check**: مفيش طريقة لمعرفة لو cron فشل أو وقف.
    - **لا يوجد Dependency Management**: بعض الـ crons محتاجة بيانات من crons تانية (مثل `dailyAlpha` محتاج `aiWorkflow`)، لكن مفيش ضمان للترتيب.
    - في [`aiWorkflow.cron.ts`](backend/src/crons/aiWorkflow.cron.ts:14-15)، فيه boolean lock (`isAiWorkflowRunning`) لكن ده مش كافي لـ 7 crons.
- **التأثير**: 
  - استهلاك عالي للموارد.
  - بيانات غير متسقة بسبب Race Conditions.
  - صعوبة تتبع أي cron فشل.
  - **الحل المطلوب**:
    1. استخدام Job Queue (BullMQ/Redis) بدلاً من node-cron.
    2. إضافة Dependency Graph بين الـ jobs.
    3. إضافة Health Check Endpoint للـ crons.
    4. إضافة Monitoring & Alerting للـ jobs الفاشلة.

---

## مشكلة 17: Cache Invalidation غير صحيح
- **الملفات المتأثرة**: 
  - `backend/src/services/ai/cache-manager.ts`
  - `backend/src/config/redis.ts`
  - `backend/src/controllers/market.controller.ts`
- **الحالة الراهنة**: 
  - في ملف [`cache-manager.ts`](backend/src/services/ai/cache-manager.ts:39-57)، الـ Cleanup بيحصل بس لما الـ cache يتعدى `maxSize`:
    ```tsx
    private _cleanup(): void {
        // Remove expired entries
        // If still over maxSize, remove oldest 20%
    }
    ```
  - في [`market.controller.ts`](backend/src/controllers/market.controller.ts:108-127)، الـ cache key بيتعمل بناءً على `limit` و `offset` و `timezone`:
    ```tsx
    const cacheKey = `radar:latest:${limit}:${offset}:${req.userTimezone || 'UTC'}`;
    ```
  - **المشكلة**:
    - **لا يوجد Cache Invalidation عند التحديث**: لما الـ cron يضيف بيانات جديدة، الـ cache القديم مش بيتحذف.
    - **TTL ثابت**: كل الـ entries عندها نفس الـ TTL (1 ساعة) من غير اعتبار لنوع البيانات.
    - **Memory Leak محتمل**: الـ Map في الـ CacheManager ممكن تكبر من غير حد أقصى فعال.
    - **Redis Cache مش مستخدم بشكل صحيح**: فيه `getCache` و `setCache` في الـ controllers لكن الـ CacheManager في الـ services منفصل.
- **التأثير**: 
  - بيانات قديمة تظهر للمستخدم من غير تحديث.
  - استهلاك Memory عالي.
  - صعوبة تتبع أي cache صالح وأي لا.
  - **الحل المطلوب**:
    1. توحيد نظام الـ Cache (Redis فقط أو In-Memory فقط).
    2. إضافة Cache Tags للـ invalidation الذكي.
    3. TTL مختلف لأنواع البيانات المختلفة.
    4. Event-driven cache invalidation عند إضافة بيانات جديدة.

---

## مشكلة 18: Type Safety - استخدام `any` في أماكن متعددة
- **الملفات المتأثرة**: 
  - `frontend/src/features/terminal/hooks/useBinanceChart.ts`
  - `backend/src/services/moralis.service.ts`
  - `backend/src/crons/aiWorkflow.cron.ts`
  - `backend/src/services/ai/ai-gateway.ts`
- **الحالة الراهنة**: 
  - في ملف [`useBinanceChart.ts`](frontend/src/features/terminal/hooks/useBinanceChart.ts:13): `let chart: any;` و `let candlestickSeries: any;`
  - في ملف [`moralis.service.ts`](backend/src/services/moralis.service.ts:55): `(data.result || []).map((tx: Record<string, unknown>) => ({`
  - في ملف [`aiWorkflow.cron.ts`](backend/src/crons/aiWorkflow.cron.ts:85): `tokenStats ? tokenStats as unknown as Record<string, number | string> : undefined`
  - في ملف [`ai-gateway.ts`](backend/src/services/ai/ai-gateway.ts:26): `Promise<T>` بدون قيود على `T`
  - **المشكلة**:
    - استخدام `any` بيخفي أخطاء Type في الـ compile time.
    - صعوبة الـ Refactoring لأن الـ types مش واضحة.
    - فقدان مزايا الـ IDE (Auto-complete, Go to Definition).
    - احتمال كبير لـ Runtime Errors.
- **التأثير**: 
  - أخطاء Runtime ممكنة (مثل `undefined is not a function`).
  - صعوبة صيانة الكود.
  - فقدان ثقة المطور في الـ types.
  - **الحل المطلوب**:
    1. استبدال `any` بـ `unknown` أو interfaces محددة.
    2. إضافة TypeScript strict mode في الـ tsconfig.
    3. استخدام ESLint rule `@typescript-eslint/no-explicit-any`.
    4. تعريف Types كاملة للـ lightweight-charts library.

---

## مشكلة 19: صفحة الترمينال - إشارة غلط بتظهر أو الصفحة بتكون فاضية عند الدخول من RadarGrid
- **الملفات المتأثرة**: 
  - `frontend/src/features/home/components/RadarGrid.tsx`
  - `frontend/src/features/terminal/components/TerminalPageClient.tsx`
  - `frontend/src/features/terminal/components/AlphaStream.tsx`
  - `frontend/src/features/terminal/components/TerminalWire.tsx`
  - `frontend/src/app/terminal/[coin]/page.tsx`

### الفلو الطبيعي المفروض يحصل:
1. المستخدم بيشوف قائمة إشارات (Signals) في RadarGrid على الصفحة الرئيسية
2. كل إشارة بتكون مرتبطة بعملة معينة (مثل SOL, BTC, ETH) ولها `radarId` فريد
3. لما يدوس على أي إشارة → يروح لصفحة الترمينال `/terminal/[coin]?radarId=[id]`
4. **نفس الإشارة اللي داس عليها بتظهرله في النص (AlphaStream)**
5. السايدبار (TerminalWire) بيعرض كل الأخبار والإشارات المتاحة
6. المستخدم يقدر يختار أي خبر أو إشارة تانية من السايدبار → المحتوى في النص بيتغير

### المشكلة الحالية (السلوك الخاطئ):
- **المشكلة 1: إشارة غلط بتظهر**
  - المستخدم بيدوس على إشارة معينة في RadarGrid (مثل `radarId=5`)
  - بس لما بيروح لصفحة الترمينال → بيظهرله إشارة تانية (مثل `radarId=3`) لنفس العملة
  - السبب: الكود بيستخدم `latestRadarForCoin` بيختار أول signal للعملة مش الـ `radarId` اللي جاي من الـ URL

- **المشكلة 2: الصفحة بتفتح فاضية**
  - المستخدم بيدوس على إشارة → بيروح لصفحة الترمينال
  - الصفحة بتكون فاضية (AlphaStream Standby) من غير أي محتوى
  - السبب: `initialNews` أو `radarSignals` فاضيين، أو `defaultRadarId` مش محسوب صح

- **المشكلة 3: السايدبار فاضي**
  - TerminalWire مش بيعرض أي أخبار أو إشارات
  - السبب: الباك إند مش بيبعت بيانات كافية أو الـ API بيفشل

### التحليل التقني المفصل:

**1. من RadarGrid إلى TerminalPageClient:**
- في [`RadarGrid.tsx`](frontend/src/features/home/components/RadarGrid.tsx:77):
  ```tsx
  onClick={() => router.push(`/terminal/${s.coin}?radarId=${s.id}`)}
  ```
  - الكود بيستخدم `s.id` (الـ radarId الصحيح) في الـ URL

- في [`TerminalPageClient.tsx`](frontend/src/features/terminal/components/TerminalPageClient.tsx:21-22):
  ```tsx
  const latestRadarForCoin = radarSignals.find(r => r.coin.toUpperCase() === coin?.toUpperCase())?.id;
  const defaultRadarId = initialRadarId || (isAlphaFocus ? latestRadarForCoin : null);
  ```
  - **هنا المشكلة**: `latestRadarForCoin` بيختار أول signal في القائمة اللي نفس العملة، مش الـ `initialRadarId` اللي جاي من الـ URL
  - يعني لو الـ URL فيه `?radarId=5` لكن أول signal للعملة دي في القائمة هو `radarId=3` → هيظهر `radarId=3`

**2. ازاي AlphaStream بيحدد يعرض إيه:**
- في [`AlphaStream.tsx`](frontend/src/features/terminal/components/AlphaStream.tsx:17-42):
  ```tsx
  useEffect(() => {
      // لو فيه radar signal، مش محتاجين نجيب مقال
      if (radarSignal) {
          setArticle(null);
          return;
      }
      // لو مفيش newsId، مفيش مقال
      if (!newsId) {
          setArticle(null);
          return;
      }
      // لو فيه newsId، نجيب المقال من الـ API
      const data = await terminalApi.getNewsById(newsId!);
      setArticle(data);
  }, [newsId, radarSignal]);
  ```
  - لو `radarSignal` موجود → بيستخدم بيانات الـ radar مباشرة
  - لو `newsId` موجود → بيجيب المقال من الـ API
  - لو الاتنين مش موجودين → بيعرض "Alpha Stream Standby"

**3. ازاي الـ Tabs بتتحديد:**
- في [`TerminalPageClient.tsx`](frontend/src/features/terminal/components/TerminalPageClient.tsx:20):
  ```tsx
  const defaultTab = initialRadarId || isAlphaFocus ? 'RADAR' : 'WIRE';
  ```
  - لو `initialRadarId` مش موجود → الـ tab هيكون 'WIRE' مش 'RADAR'
  - ده معناه لو الـ `initialRadarId` مش بيتم تمريره صح → المحتوى مش هيظهر

**4. منين الـ `initialRadarId` بيجي:**
- في [`terminal/[coin]/page.tsx`](frontend/src/app/terminal/[coin]/page.tsx:24):
  ```tsx
  const radarId = resolvedSearchParams.radarId ? Number(resolvedSearchParams.radarId) : undefined;
  ```
  - الكود بيحاول يقرأ `radarId` من الـ URL query params
  - لو الـ query param مش موجود أو مش رقم → `radarId` هيكون `undefined`

### التأثير على المستخدم:
1. **تجربة مستخدم سيئة**: المستخدم بيدوس على إشارة معينة بيلاقي حاجة تانية
2. **فقدان الثقة**: المستخدم مش هيعرف يثق إن الإشارة اللي شايفها هي الصح
3. **صفحات فاضية**: المستخدم بيشوف شاشة فاضية من غير ما يعرف السبب
4. **صعوبة التنقل**: السايدبار الفاضي بيخلي المستخدم مش عارف يختار محتوى

### الحل المطلوب:
1. **استخدام `initialRadarId` من الـ URL مباشرة**:
   ```tsx
   const defaultRadarId = initialRadarId ?? null; // مش latestRadarForCoin
   ```

2. **إضافة fallback لما مفيش بيانات**:
   - لو `radarSignals` فاضية → عرض رسالة "لا توجد إشارات حالياً"
   - لو `initialNews` فاضي → عرض رسالة "لا توجد أخبار حالياً"

3. **تحسين الـ default state**:
   - اختيار أول إشارة أو مقال بشكل افتراضي لما مفيش `radarId` في الـ URL
   - إضافة رسالة توضيحية "اختار مقال من القائمة" لما مفيش حاجة مختارة

4. **تحسين الـ URL handling**:
   - التأكد إن `radarId` بيتقرأ صح من الـ URL
   - إضافة validation للـ `radarId` (رقم موجب)

5. **إضافة Loading State أفضل**:
   - عرض skeleton loader لما البيانات بتتحمل
   - عرض رسالة خطأ واضحة لما الـ API بيفشل

---

## مشكلة 20: خطأ Runtime TypeError عند الدخول لصفحة الترمينال - Cannot read properties of null (reading 'toUpperCase')
- **الملفات المتأثرة**: 
  - `frontend/src/features/terminal/components/TerminalPageClient.tsx`
  - `frontend/src/features/home/types.ts`
  - `backend/src/controllers/market.controller.ts`
- **رسالة الخطأ**: 
  ```
  Runtime TypeError
  Cannot read properties of null (reading 'toUpperCase')
  src\features\terminal\components\TerminalPageClient.tsx (21:62)
  ```
- **الحالة الراهنة**: 
  - في ملف [`TerminalPageClient.tsx`](frontend/src/features/terminal/components/TerminalPageClient.tsx:21):
    ```tsx
    const latestRadarForCoin = radarSignals.find(r => r.coin.toUpperCase() === coin?.toUpperCase())?.id;
    ```
  - **المشكلة**: 
    - الكود بيفترض إن `r.coin` دائماً موجود (string)، لكن في الواقع ممكن يكون `null` أو `undefined`
    - في [`RadarSignal`](frontend/src/features/home/types.ts:27-39) type، حقل `coin` معرف كـ `coin: string` لكن البيانات الجاية من الباك إند ممكن تبعت `coinSymbol` كـ `null` أو `undefined`
    - في [`market.controller.ts`](backend/src/controllers/market.controller.ts:119-124):
      ```tsx
      const mappedSignals = signals.map(s => ({
          ...s,
          coin: s.coinSymbol,  // لو s.coinSymbol null → coin هيكون null
          signal: s.signalText,
          formattedTime: req.formatTime(s.createdAt)
      }));
      ```
    - لما `s.coinSymbol` في الداتابيز يكون `null` → `coin` هيكون `null` → `r.coin.toUpperCase()` هيرمي خطأ
  - **متى بيحصل الخطأ**:
    - لما المستخدم بيدوس على أي مقال أو إشارة في الصفحة الرئيسية
    - الصفحة بتروح لـ `/terminal/[coin]`
    - `TerminalPageClient` بيحاول يعمل `find` على `radarSignals`
    - أول signal عنده `coin: null` → الخطأ بيحصل والصفحة بتـ crash
- **التأثير**: 
  - الصفحة بتـ crash تماماً (White Screen of Death)
  - المستخدم مش قادر يشوف أي محتوى
  - تجربة مستخدم كارثية
  - **الحل المطلوب**:
    1. إضافة null check قبل استدعاء `toUpperCase()`:
       ```tsx
       const latestRadarForCoin = radarSignals.find(r => r.coin?.toUpperCase() === coin?.toUpperCase())?.id;
       ```
    2. فلترة الإشارات اللي عندها `coin` فاضي قبل الـ find:
       ```tsx
       const latestRadarForCoin = radarSignals
           .filter(r => r.coin)
           .find(r => r.coin.toUpperCase() === coin?.toUpperCase())?.id;
       ```
    3. تحسين الـ type definition لـ `RadarSignal` ليعكس إن `coin` ممكن يكون `null`:
       ```tsx
       export type RadarSignal = {
           coin: string | null;  // مش string فقط
           // ...
       };
       ```
    4. التأكد إن الباك إند مش بيبعت `coinSymbol` كـ `null` (إضافة validation في الـ controller)

---

## مشكلة 21: Navbar component موجود لكن مش مستخدم في التطبيق
- **الملفات المتأثرة**: 
  - `frontend/src/features/shared/components/Navbar.tsx`
  - `frontend/src/app/layout.tsx`
- **الحالة الراهنة**: 
  - في ملف [`Navbar.tsx`](frontend/src/features/shared/components/Navbar.tsx:1-91)، فيه Navbar component كامل فيه:
    - Search bar
    - Bell notifications
    - Settings button
    - Login/Logout buttons
  - لكن في [`layout.tsx`](frontend/src/app/layout.tsx:1-40)، الـ Navbar مش مستخدم خالص:
    ```tsx
    <main className="flex-1 flex flex-col h-full min-w-0 bg-black pb-[72px] md:pb-0">
      <TickerBar />
      <div className="flex-1 overflow-y-auto">{children}</div>
    </main>
    ```
  - الـ layout بيستخدم `Sidebar` و `TickerBar` فقط
  - **المشكلة**:
    - كود ميت (Dead Code) بيزود حجم الـ bundle
    - صعوبة الصيانة (مينفعش نعرف لو الـ Navbar لسه محتاجينه ولا لأ)
    - inconsistency في التصميم
- **التأثير**: 
  - حجم bundle أكبر من اللازم
  - صعوبة صيانة الكود
  - **الحل المطلوب**:
    1. إما استخدام الـ Navbar في الـ layout
    2. أو حذفه لو مش محتاجينه

---

## مشكلة 22: HeroSection component موجود لكن مش مستخدم في الصفحة الرئيسية
- **الملفات المتأثرة**: 
  - `frontend/src/features/home/components/HeroSection.tsx`
  - `frontend/src/app/page.tsx`
- **الحالة الراهنة**: 
  - في ملف [`HeroSection.tsx`](frontend/src/features/home/components/HeroSection.tsx:1-64)، فيه HeroSection component كامل فيه:
    - Market Mood score
    - External/Internal scores
    - Trending icon
    - Gradient background
  - لكن في [`page.tsx`](frontend/src/app/page.tsx:1-36)، الـ HeroSection مش مستخدم خالص:
    ```tsx
    return (
      <div className="flex-1 overflow-y-auto p-4 flex flex-col lg:flex-row gap-4 h-full">
        <div className="w-full lg:w-[70%] flex flex-col gap-4">
          <AlphaFocusCard data={alpha} />
          <RadarGrid signals={signals} />
        </div>
        ...
      </div>
    );
    ```
  - الصفحة بتستخدم `AlphaFocusCard` مباشرة من غير HeroSection
  - **المشكلة**: نفس مشكلة الـ Navbar - كود ميت
- **التأثير**: 
  - حجم bundle أكبر من اللازم
  - صعوبة صيانة الكود
  - **الحل المطلوب**:
    1. إما استخدام الـ HeroSection فوق AlphaFocusCard
    2. أو حذفه لو مش محتاجينه

---

## مشكلة 23: Static sparkline في AlphaFocusCard (SVG hardcoded)
- **الملفات المتأثرة**: 
  - `frontend/src/features/home/components/AlphaFocusCard.tsx`
- **الحالة الراهنة**: 
  - في ملف [`AlphaFocusCard.tsx`](frontend/src/features/home/components/AlphaFocusCard.tsx:50-60)، الـ sparkline عبارة عن SVG hardcoded:
    ```tsx
    <svg className="w-full h-full" viewBox="0 0 400 100">
      <path d="M0,85 L20,88 L40,82 L60,85 L80,70 L100,75 L120,78 L140,65 L160,50 L180,55 L200,45 L220,38 L240,30 L260,32 L280,25 L300,28 L320,15 L340,18 L360,10 L380,8 L400,5" fill="none" stroke="currentColor" strokeWidth="2.5" />
    </svg>
    ```
  - **المشكلة**:
    - الـ sparkline مش حقيقي - دايماً نفس الشكل
    - مش بيعكس حركة السعر الحقيقية للعملة
    - misleading للمستخدم (بيفكر إن ده chart حقيقي)
  - **التأثير**: 
    - المستخدم بيشوف chart وهمي
    - فقدان المصداقية
    - **الحل المطلوب**:
    1. استخدام بيانات حقيقية من Binance API لرسم الـ sparkline
    2. أو استخدام lightweight-charts library
    3. أو إزالة الـ sparkline تماماً لو مش حقيقي

---

## مشكلة 24: Guest limit bypass عبر localStorage
- **الملفات المتأثرة**: 
  - `frontend/src/features/terminal/hooks/useTerminalChat.ts`
  - `backend/src/middleware/guest-limit.middleware.ts`
- **الحالة الراهنة**: 
  - في ملف [`useTerminalChat.ts`](frontend/src/features/terminal/hooks/useTerminalChat.ts:31-41):
    ```tsx
    const storedCount = localStorage.getItem('guest_chat_count');
    if (storedCount) {
        setGuestCount(parseInt(storedCount, 10));
    }
    ```
  - **المشكلة**:
    - المستخدم يقدر يمسح `localStorage` أو يعدّله ويتجاوز الـ limit
    - الـ backend فيه `guestLimit` middleware بيستخدم Redis IP-based، لكن الـ frontend بيعتمد على localStorage
    - inconsistency بين الـ frontend والـ backend
    - المستخدم يقدر يفتح incognito window ويتجاوز الـ limit
  - **التأثير**: 
    - نظام الـ guest limit مش آمن
    - إمكانية abuse للنظام
    - **الحل المطلوب**:
    1. الاعتماد على الـ backend فقط للـ limit (IP-based أو session-based)
    2. إزالة localStorage count
    3. استخدام cookies أو session tokens

---

## مشكلة 25: IP-based rate limiting مش كافي
- **الملفات المتأثرة**: 
  - `backend/src/middleware/rateLimit.middleware.ts`
  - `backend/src/middleware/guest-limit.middleware.ts`
- **الحالة الراهنة**: 
  - في ملف [`rateLimit.middleware.ts`](backend/src/middleware/rateLimit.middleware.ts:22-23):
    ```tsx
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `rl:${req.path}:${ip}`;
    ```
  - **المشكلة**:
    - IP-based rate limiting مش كافي في 2024:
      - NAT/shared IPs (مستخدمين كتير من نفس الـ IP)
      - VPNs/Proxies (مستخدم واحد يقدر يغير IP)
      - Dynamic IPs
    - الـ `guestLimit` middleware بيرجع لـ `next()` لو Redis مش موجود (fail-open)
    - في [`guest-limit.middleware.ts`](backend/src/middleware/guest-limit.middleware.ts:11-14):
      ```tsx
      if (!redis) { next(); return; }
      ```
  - **التأثير**: 
    - إمكانية abuse للنظام
    - حماية غير كافية
    - **الحل المطلوب**:
    1. إضافة fingerprint-based limiting (device fingerprint)
    2. استخدام combination من IP + session + fingerprint
    3. fail-closed لو Redis مش موجود

---

## مشكلة 26: MarketMoodGauge CSS classes مش معرّفة
- **الملفات المتأثرة**: 
  - `frontend/src/features/home/components/MarketMoodGauge.tsx`
  - `frontend/src/app/globals.css`
- **الحالة الراهنة**: 
  - في ملف [`MarketMoodGauge.tsx`](frontend/src/features/home/components/MarketMoodGauge.tsx:22-24):
    ```tsx
    <div className="gauge-container mb-4">
      <div className="gauge-bg" />
      <div className="gauge-fill" style={{ transform: `rotate(${rotation}deg)` }} />
    ```
  - **المشكلة**:
    - الـ CSS classes `gauge-container`, `gauge-bg`, `gauge-fill` مش واضحة لو معرّفة في `globals.css`
    - لو مش معرّفة → الـ gauge مش هيظهر صح
    - الـ gauge بيعتمد على CSS مش موجود
  - **التأثير**: 
    - الـ Market Mood مش هيظهر صح
    - تجربة مستخدم سيئة
    - **الحل المطلوب**:
    1. التأكد إن الـ CSS classes معرّفة في `globals.css`
    2. أو استخدام inline styles
    3. أو استخدام Tailwind classes بدلاً من custom CSS

---

## مشكلة 27: لا يوجد payment integration (Pricing Coming Soon)
- **الملفات المتأثرة**: 
  - `frontend/src/features/settings/components/PricingCards.tsx`
  - `backend/src/controllers/user.controller.ts`
- **الحالة الراهنة**: 
  - في ملف [`PricingCards.tsx`](frontend/src/features/settings/components/PricingCards.tsx:40-71):
    - كل الـ pricing cards فيها `disabled` على الـ buttons
    - PRO و INSTITUTIONAL عليهم "COMING SOON"
    - مفيش payment integration خالص
  - في [`user.controller.ts`](backend/src/controllers/user.controller.ts):
    - مفيش endpoints للـ subscription management
    - مفيش Stripe/Coinbase Commerce integration
  - **المشكلة**:
    - مفيش طريقة للمستخدم يترقى من Free لـ Pro
    - مفيش revenue model implemented
    - الـ features بتاعة Pro مش مقفلة فعلياً (مفيش feature gating)
  - **التأثير**: 
    - مفيش طريقة للكسب من التطبيق
    - مفيش حماية للـ Pro features
    - **الحل المطلوب**:
    1. إضافة Stripe integration
    2. إضافة feature gating للـ Pro features
    3. إضافة subscription management endpoints

---

## مشكلة 28: Tavily API key مش في env validation
- **الملفات المتأثرة**: 
  - `backend/src/config/env.ts`
  - `backend/src/services/tavily.service.ts`
- **الحالة الراهنة**: 
  - في ملف [`env.ts`](backend/src/config/env.ts:41):
    ```tsx
    TAVILY_API_KEY: z.string().optional(),
    ```
  - في [`tavily.service.ts`](backend/src/services/tavily.service.ts:7-11):
    ```tsx
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
        console.warn('[Tavily] No TAVILY_API_KEY found in .env, skipping search.');
        return '';
    }
    ```
  - **المشكلة**:
    - الـ Tavily API key اختياري (optional)
    - لو مش موجود → الـ service بيرجع empty string
    - الـ scam check مش هيشتغل من غير Tavily
    - مفيش fallback أو بديل
  - **التأثير**: 
    - الـ AI workflow مش هيشتغل كامل
    - الـ scam check مش هيحصل
    - **الحل المطلوب**:
    1. إضافة fallback service (مثل Google Search API)
    2. أو جعل Tavily API key required
    3. إضافة monitoring لو الـ service فشل

---

## مشكلة 29: Chat routes inconsistency
- **الملفات المتأثرة**: 
  - `backend/src/routes/chat.routes.ts`
  - `backend/src/controllers/chat.controller.ts`
  - `frontend/src/features/terminal/hooks/useTerminalChat.ts`
- **الحالة الراهنة**: 
  - في ملف [`chat.routes.ts`](backend/src/routes/chat.routes.ts:9-13):
    ```tsx
    router.post('/stream', optionalAuth, guestLimit, chatLimiter, chatStream);
    router.post('/stream/context', authMiddleware, chatLimiter, chatStream);
    router.post('/disclaimer-accept', authMiddleware, acceptDisclaimer);
    router.get('/disclaimer-status', optionalAuth, checkDisclaimer);
    router.get('/context/:articleId/:articleType', optionalAuth, getContext);
    ```
  - في ملف [`useTerminalChat.ts`](frontend/src/features/terminal/hooks/useTerminalChat.ts:55):
    ```tsx
    const resp = await fetch(`${...}/chat/stream`, {
        method: 'POST',
        body: JSON.stringify({ messages, coin, mode, articleId, articleType }),
    });
    ```
  - **المشكلة**:
    - الـ frontend بيبعت لـ `/chat/stream` لكن مفيش handling للـ disclaimer
    - الـ `/stream/context` route محتاج auth بس الـ frontend مش بيستخدمه
    - inconsistency في الـ middleware chain
    - الـ disclaimer مش بيظهر قبل أول استخدام
  - **التأثير**: 
    - إمكانية استخدام الـ chat من غير موافقة على disclaimer
    - inconsistency في الـ auth flow
    - **الحل المطلوب**:
    1. إضافة disclaimer check قبل الـ chat
    2. توحيد الـ routes بين الـ frontend والـ backend
    3. إضافة error handling للـ disclaimer
