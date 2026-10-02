# نموذج بيانات إعلان وفاة

تطبيق عربي RTL لتعبئة ومراجعة بيانات إعلان وفاة في قطر وحفظها كطلبات منظمة للمسؤول.

## Run & Operate

- `npm run dev` — runs unified backend and frontend on port 3000
- `npm run typecheck` — full TypeScript build check across packages
- `npm run build` — builds frontend applet
- `npm start` — production: serves the API and the built frontend with `tsx server.ts` (`NODE_ENV=production`, `PORT`)
- Deploy (Cloud Run): `Dockerfile` at the root (`npm ci` from `package-lock.json` → `npm run build` → `npm start`); buildpacks also work (`gcp-build`, `engines.node >= 22`). `artifacts/api-server` pins `esbuild ^0.25` so a fresh `npm install` resolves `esbuild-plugin-pino`'s peer range.
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
- قالب صورة التعزية الافتراضي «النسخ الرسمي» (`styleId: "naskh"`) يُرسم بمحرك مستقل: `naskh-poster-plan.ts` (تخطيط نقي يُختبر في Node) و`naskh-poster-engine.ts` (الرسم على Canvas)، وتدخل إليه الواجهات عبر `poster-render.ts`. ترتيبه ترتيب الأرشيف، ورمز الموقع بجانب كل عزاء، ويطول تلقائياً من 1350 حتى الحد الأقصى في إعدادات القالب ولا يقل النص عن 32 بكسل. الخلفية ومخطوطة «إنا لله» في `src/assets/poster/`، والشعار واسم الحساب والأيقونات تُضبط من صفحة القوالب وتُحفظ في مستند القالب نفسه (`branding`).
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
- بعد تعديل `lib/api-spec/openapi.yaml` أعد توليد الأنواع: `npx orval --config ./orval.config.ts` داخل `lib/api-spec`.
