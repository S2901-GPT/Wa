# نموذج بيانات إعلان وفاة

تطبيق عربي RTL لتعبئة ومراجعة بيانات إعلان وفاة في قطر وحفظها كطلبات منظمة للمسؤول.

## Run & Operate

- `npm run dev` — runs unified backend and frontend on port 3000
- `npm run typecheck` — full TypeScript build check across packages
- `npm run build` — builds frontend applet
- `npm start` — production: serves the API and the built frontend with `tsx server.ts` (`NODE_ENV=production`, `PORT`)
- Deploy (Cloud Run): AI Studio's Publish uploads its whole workspace (node_modules included, about 1 GB unpacked) and Cloud Run fails to import it. Deploy from Cloud Shell instead: `cd ~ && rm -rf Wa && git clone --depth 1 https://github.com/S2901-GPT/Wa.git && bash Wa/deploy-cloud-run.sh`. The script runs `npm ci` and `npm run build`, then `gcloud alpha run deploy --no-build`, which uploads only what `.gcloudignore` lets through (about 2.5 MB, no node_modules). `npm run build` builds the frontend (`artifacts/qatar-obituary-form/dist/public`) and bundles `server.ts` with everything it imports into `dist/server.mjs` (`build-server.mjs`, production-only). `npm start` runs that bundle with plain `node`; without it, it falls back to `tsx server.ts`. `package-lock.json` is the only lockfile; `bunfig.toml` keeps Bun (used by AI Studio) on the flat layout for fresh installs. Root scripts avoid `npm run --workspace`, which loops under `bun run`. Rollup is pinned to 4.63.6 (4.64.0 makes `vite build` take about 10 minutes). The root `Dockerfile` also works.
- Database: Cloud Firestore (connected via `firebase-applet-config.json`, no `DATABASE_URL` required)

## Stack

- npm workspaces, Node.js 22, TypeScript
- Frontend: Vite 7 + React 19 + Tailwind CSS + Lucide Icons
- API: Express 5
- DB: Google Cloud Firestore (Native integration via `@workspace/db`)
- Validation: Zod schemas (`@workspace/api-zod`)
- API Client: React Query hooks (`@workspace/api-client-react`)

## Where things live

- واجهة التطبيق: `artifacts/qatar-obituary-form`
- واجهة API: `artifacts/api-server/src/routes/obituary-requests.ts`
- طبقة قاعدة البيانات: `lib/db/src/index.ts`
- قواعد أمان Firestore: `firestore.rules`
- مخطط البيانات: `firebase-blueprint.json`

## Product

- نموذج عربي متجاوب بصفحة مراجعة قبل الإرسال.
- حقول ديناميكية للأقارب، صلاة الجنازة، وعزاء الرجال والنساء.
- رقم طلب بعد الإرسال ولوحة داخلية لعرض الطلبات وتعديل حالتها ونسخها.

## Architecture decisions

- نص الإعلان يُولَّد بقواعد ثابتة في `artifacts/qatar-obituary-form/src/lib/announcement.ts` (لا نموذج لغوي)، ويستخدمه نص «نسخ كنص للعرض» وبيانات القوالب البصرية (`presentation-normalizer.ts`) ومعاينة المراجعة معاً حتى لا تتباعد القواعد.
- صورة التعزية تُرسم بمحرك واحد: `naskh-poster-plan.ts` (مخطّط نقي يُختبر في Node) و`naskh-poster-engine.ts` (الرسم على Canvas)، وتدخل إليه الواجهات عبر `poster-render.ts`. ثمانية تخطيطات (`NASKH_LAYOUTS`: اليمين، المتوسّط، الجدول، العمودان، الصحيفة، العناوين، الترويسة، الهجين) تشترك في المحتوى والخط والضبط التلقائي؛ المستخدم يختار التخطيط داخل استوديو الصورة في صفحة الطلب ويُحفظ اختياره في المتصفح. لا يوجد محرر قوالب ولا قوالب مخصصة. ترتيب الأقسام ترتيب الأرشيف، ورمز الموقع بجانب كل عزاء، وتطول الصورة تلقائياً من 1350 حتى 1800 ولا يقل النص عن 32 بكسل. الخلفية ومخطوطة «إنا لله» في `src/assets/poster/`.
- النموذج يملك شكل بياناته الخاص (`deceasedList`…)، ويحوّله `mapper.ts` إلى عقد الـ API (`deceasedPeople`…) قبل الإرسال؛ الخادم لا يقبل إلا عقد الـ API.
- الصيغ مأخوذة من أرشيف «وفيات قطر»: «توفي/توفيت»، «والدة كل من»، «أبناء /»، «الله يرحمه ويغفر له»، «شفيعاً لوالديه يارب».
- اسم المتوفاة اختياري إذا عُرّفت بزوجها («أرملة / حرم فلان»، ولقب الزوج من قائمة). لا خانات للكنية أو الأب أو طريقة التعريف؛ المولّد ما زال يقرأها من الطلبات القديمة.
- جنس الأقارب لا يُسجَّل لأن العرف لا يذكر الإناث في خانة الأقارب، فالترحّم عليهم بالمذكر (رحمه/رحمهما/رحمهم).
- نموذج المستخدم يبقى بشكله الأصلي: الخانات المضافة (نوع الرسالة، السطر الإضافي للمتوفى، «حتى»، سبب العزاء، المواقع الإضافية، معاينة النص) مطوية تحت «خيارات إضافية» (`MoreOptions` في `form-steps-extras.tsx`). `EXTRA_OPTIONS_OPEN_BY_DEFAULT = true` يعيد الشكل الموسّع، وصفحة تعديل الطلب عند المسؤول تفتحها دائماً عبر `ExtrasOpenContext`.
- قائمة صلة القرابة هي القائمة الأصلية («أبناؤه، أخوانه…»)؛ يُحفظ معها `relationKey` في الخلفية حتى يكتب المولّد «والدة كل من».
- «رحمه الله» للأقارب بجانب كل اسم دائماً. الصفة الوظيفية: جهة العمل وحدها = على رأس عمله، وزر «متقاعد» يكتب «أحمد (جهة العمل) (متقاعد)».
- وحدة العمر من اللقب: الرضيع/الرضيعة بالأشهر، المولودة بالأيام، وغيرهما بالسنوات.
- الأمثلة والبيانات التجريبية بأسماء وهمية فقط، بلا أسماء عوائل.

## Gotchas

- `npm test` يشغّل اختبارات القبول المأخوذة من الأرشيف؛ شغّلها بعد أي تعديل على الصياغة.
- بعد تعديل `lib/api-spec/openapi.yaml` أعد توليد الأنواع: `npx orval@8 --config ./orval.config.ts` داخل `lib/api-spec` (لم يعد `lib/api-spec` ولا `artifacts/mockup-sandbox` ضمن مساحات العمل، فلا تُثبَّت أدواتهما مع التطبيق).
- رقم الطلب ستة أرقام: رقما السنة ثم أربعة أرقام عشوائية («261234»)، ويتحقق الخادم من عدم تكراره. التعديل على طلب سابق يتم من نموذج المستخدم: «نوع الرسالة: تعديل إعلان سابق» ثم رقم الطلب و«تحميل بيانات الطلب» فتُملأ الخطوات، ويُرسل طلب جديد مرتبط بالأصلي (`relatedRequestNumber`). صفحة النجاح فيها زر يرسل رقم الطلب إلى «وفيات قطر» على واتساب (`97470228822`).
- حماية لوحة الإدارة: كلمة مرور واحدة تُضبط في متغير بيئة الخادم `ADMIN_PASSWORD` (8 أحرف على الأقل، بلا قيمة افتراضية؛ إن غابت أو قصُرت تبقى اللوحة مقفلة). الدخول من `/admin` يضع جلسة موقّعة (HMAC) في ملف تعريف ارتباط `HttpOnly` و`SameSite=Strict` لسبعة أيام، وتغيير كلمة المرور يُبطل كل الجلسات. التحقق في الخادم (`artifacts/api-server/src/lib/admin-auth.ts`): قائمة الطلبات والتعديل والحذف تتطلب جلسة مسؤول، أما إرسال طلب جديد وجلب طلب برقمه (لتعديل طلب سابق) فمفتوحان للجميع، والجلب برقم الطلب محدود بثلاثين محاولة كل عشر دقائق لكل عنوان. عشر محاولات دخول خاطئة كل ربع ساعة تُقفل الدخول مؤقتاً. ضبط المتغير: Cloud Run ← الخدمة ← «Edit & deploy new revision» ← «Variables & secrets».
- حذف الطلبات (للمسؤول): `DELETE /api/obituary-requests/:requestNumber`. يُحذف المستند نهائياً، فإن منعت قواعد Firestore الحذف (`allow delete: if false` في `firestore.rules`) يُخفى بعلامة `deletedAt` فلا يظهر في أي قائمة أو بحث ولا يقبل التعديل. الحذف النهائي الفعلي وإغلاق القاعدة أمام الوصول المباشر يتطلبان نقل الخادم إلى Firebase Admin SDK مع صلاحية `roles/datastore.user` لحساب خدمة Cloud Run، ثم قواعد `allow read, write: if false`.
- إعدادات هوية الصورة (الشعار، اسم الحساب، الأيقونات، الطول الأقصى): صفحة `/admin/settings` (زر «الإعدادات» في لوحة الإدارة). الشعار يُصغَّر في المتصفح إلى 256 بكسل PNG ويُحفظ مع باقي الإعدادات في الخادم (`GET/PUT /api/admin/settings` للمسؤول فقط؛ الخادم لا يقبل إلا PNG/JPEG/WebP حتى 300KB ويرفض SVG). يُخزَّن المستند `poster-settings` في مجموعة `condolence_templates` لأن قواعد Firestore المنشورة تسمح بالكتابة فيها ولا تسمح بمجموعة جديدة؛ وإن لم يوجد يُقرأ الشعار القديم المحفوظ في مستند القالب `naskh` (`branding`). مسار الإعدادات وحده يقبل جسم طلب حتى 1MB (الافتراضي 100KB). الاستوديو يقرأ الإعدادات قبل الرسم.

