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
- قواعد أمان Firestore: `firestore.rules`. لا شيء في المستودع ينشرها؛ تُنشر يدوياً من Firebase Console (المشروع ← Firestore Database ← قاعدة البيانات المسماة في `firebase-applet-config.json` ← Rules ← لصق الملف ← Publish) أو بالأمر `npx firebase-tools deploy --only firestore:rules` مع `firebase.json`. مجموعة `lab_requests` (طلبات التجارب) تحتاج ذلك مرة واحدة، و`GET /api/lab/status` يعرض هل نُشرت.
- البيانات الشخصية (قانون رقم 13 لسنة 2016): يُحفظ فقط ما يُدخله المرسل لنشر الإعلان (المتوفى وذووه ومواعيد الدفن والعزاء ومقراته). لا يُجمع شيء عن المرسل: لا جهاز ولا لغة ولا تعريف زيارة ولا IP (العنوان يُستعمل في ذاكرة الخادم دقائق لتحديد المعدل فقط)، ولا تحليلات، والخطوط مضمّنة في التطبيق (`@fontsource`) فلا يتصل المتصفح بطرف ثالث. أرقام الهواتف لا تُحفظ أبداً (لا حقل لها في العقد) وتُطمس بـ`maskPhones` في نص «طلب من نص» قبل إرساله إلى Gemini وقبل حفظه. `/api/client-log` يسجّل رسالة الخطأ ومكدسها مقصوصين مع حدّ للمعدل. الطرف الثالث الوحيد الذي يصله نص: Google Gemini (نص الإعلان بعد الطمس). إشعار الخصوصية للجمهور في `src/components/privacy-notice.tsx`. **مدة الاحتفاظ 48 ساعة** (`lib/db/src/retention.ts`، وتُغيَّر للاختبار بـ`RETENTION_HOURS`): كل طلب أُنشئ قبل أكثر من ذلك يُستبدل مستنده بإحصاء مجهَّل (`expiredAt` + `stat`: القناة، عدد التعديلات، أسماء الحقول التي تغيّرت بلا قيم، تحذيرات الذكاء الاصطناعي) فيختفي من القوائم والبحث والتعديل، ولا يبقى اسم ولا نص. التشغيل في `artifacts/api-server/src/lib/retention.ts`: قبل كل قراءة من المسارات (مرة في الدقيقة) وعند بدء الخدمة ثم كل ربع ساعة. يُعرض المجهَّل في `/admin/lab/behaviour` عبر `GET /api/obituary-requests/expired`. الحذف اليدوي حين تمنع القواعد الحذف النهائي يمسح المستند أيضاً (`deletedAt` بلا بيانات). تنظيف ما حُفظ قبل ذلك: `scripts/scrub-personal-data.py`. ما زال مفتوحاً: قواعد Firestore تسمح بالقراءة لمن يملك الإعدادات؛ الحل Admin SDK (أعلاه).
- سجل سلوك الطلب: كل طلب يحمل `audit` (القناة `form` / `from_text` / `admin_edit`، والنص الملصوق في «طلب من نص» وردّ الذكاء الاصطناعي الخام وتحذيراته بعد طمس الهواتف؛ لا شيء عن المرسل) و`history` (الإنشاء ثم كل تعديل بأسطر عربية «قبل ← بعد» من `artifacts/api-server/src/lib/request-audit.ts`، آخر ٥٠). الجمهور لا يستطيع ادعاء قناة أخرى، والجلب العام برقم الطلب لا يعيد السجل. تُعرض في `/admin/lab/behaviour`.
- التجارب: `/admin/lab` مركز (بالعنوان فقط) فيه تجربة الصورة `/admin/lab/poster`، ولوحة المسؤول كاملة على مجموعة `lab_requests` المستقلة في `/admin/lab/admin` (الصفحات نفسها تحت `RequestsScopeProvider scope="lab"` فتستدعي `/api/lab/obituary-requests`؛ `src/lib/requests-api.tsx`)، ونسخ الطلبات الحية إليها وتفريغها. مخزن التجارب صارم (`strict`): لا يسقط إلى الذاكرة، فإن لم تُنشر القواعد يظهر ذلك بدل حفظ وهمي.
- مخطط البيانات: `firebase-blueprint.json`

## Product

- نموذج عربي متجاوب بصفحة مراجعة قبل الإرسال.
- حقول ديناميكية للأقارب، صلاة الجنازة، وعزاء الرجال والنساء.
- رقم طلب بعد الإرسال ولوحة داخلية لعرض الطلبات وتعديل حالتها ونسخها.

## Architecture decisions

- نص الإعلان يُولَّد بقواعد ثابتة في `artifacts/qatar-obituary-form/src/lib/announcement.ts` (لا نموذج لغوي)، ويستخدمه نص «نسخ كنص للعرض» وبيانات القوالب البصرية (`presentation-normalizer.ts`) ومعاينة المراجعة معاً حتى لا تتباعد القواعد.
- صورة التعزية تُرسم بمحرك واحد: `naskh-poster-plan.ts` (مخطّط نقي يُختبر في Node) و`naskh-poster-engine.ts` (الرسم على Canvas)، وتدخل إليه الواجهات عبر `poster-render.ts`. ثمانية تخطيطات (`NASKH_LAYOUTS`: اليمين، المتوسّط، الجدول، العمودان، الصحيفة، العناوين، الترويسة، الهجين) تشترك في المحتوى والخط والضبط التلقائي؛ المستخدم يختار التخطيط داخل استوديو الصورة في صفحة الطلب ويُحفظ اختياره في المتصفح. لا يوجد محرر قوالب ولا قوالب مخصصة. ترتيب الأقسام ترتيب الأرشيف، ورمز الموقع بجانب كل عزاء، والمقاس أحد مقاسي المنصات فقط (`NASKH_POSTER_SIZES`: منشور إنستقرام 1080 × 1350، أو ستوري سناب وإنستغرام 1080 × 1920؛ الافتراضي المنشور، والتصدير JPEG بجودة 95 من `poster-export.ts`)، ولا يقل النص عن 32 بكسل. الخلفية ومخطوطة «إنا لله» في `src/assets/poster/`.
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
- «طلب من نص» (`/admin/from-text`): يلصق المسؤول نص إعلان وصله دون تعبئة النموذج، فيحوّله Gemini إلى بيانات طلب (`POST /api/admin/parse-text`، للمسؤول فقط، ثلاثون صياغة كل عشر دقائق). الخادم يستدعي واجهة Gemini مباشرة بلا مكتبة (`artifacts/api-server/src/lib/ai-extract.ts`) بمخطط JSON ثابت، ثم يصحّح الناتج ويتحقق منه بعقد الطلب نفسه، ولا يحفظ شيئاً: يراجع المسؤول نص الإعلان والملاحظات ثم يضغط «حفظ كطلب جديد». المفتاح من `GEMINI_API_KEY` (يضبطه AI Studio عند النشر؛ قدرة `MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API` في `metadata.json`)، والنموذج `gemini-flash-latest` ثم `gemini-2.5-flash` إن لم يتوفر، ويمكن تغييره بـ `GEMINI_MODEL`.
- حذف الطلبات (للمسؤول): `DELETE /api/obituary-requests/:requestNumber`. يُحذف المستند نهائياً، فإن منعت قواعد Firestore الحذف (`allow delete: if false` في `firestore.rules`) يُخفى بعلامة `deletedAt` فلا يظهر في أي قائمة أو بحث ولا يقبل التعديل. الحذف النهائي الفعلي وإغلاق القاعدة أمام الوصول المباشر يتطلبان نقل الخادم إلى Firebase Admin SDK مع صلاحية `roles/datastore.user` لحساب خدمة Cloud Run، ثم قواعد `allow read, write: if false`.
- إعدادات هوية الصورة (الشعار، اسم الحساب، الأيقونات، الطول الأقصى): صفحة `/admin/settings` (زر «الإعدادات» في لوحة الإدارة). الشعار يُصغَّر في المتصفح إلى 256 بكسل PNG ويُحفظ مع باقي الإعدادات في الخادم (`GET/PUT /api/admin/settings` للمسؤول فقط؛ الخادم لا يقبل إلا PNG/JPEG/WebP حتى 300KB ويرفض SVG). يُخزَّن المستند `poster-settings` في مجموعة `condolence_templates` لأن قواعد Firestore المنشورة تسمح بالكتابة فيها ولا تسمح بمجموعة جديدة؛ وإن لم يوجد يُقرأ الشعار القديم المحفوظ في مستند القالب `naskh` (`branding`). مسار الإعدادات وحده يقبل جسم طلب حتى 1MB (الافتراضي 100KB). الاستوديو يقرأ الإعدادات قبل الرسم.
- رموز الموقع (QR) في الصورة: لكل موقع عزاء رمزه بجانب نصه. حين يتعدد موقع الجمهور الواحد (مثلاً موقعان للنساء) يصبح كل موقع قسماً مستقلاً بعنوانه («عزاء النساء الأول/الثاني») ورمزه، بمفاتيح `women` و`women-2`…؛ والمطبِّع يعطي `sites` لكل جمهور، و`posterQrUrls` تجمع روابط كل الرموز. تخطيط «العمودان» لا يُستعمل إلا حين يكون لكل من الرجال والنساء موقع واحد، وإلا تُرتَّب المواقع صفوفاً.

