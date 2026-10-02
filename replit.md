# نموذج بيانات إعلان وفاة

تطبيق عربي RTL لتعبئة ومراجعة بيانات إعلان وفاة في قطر وحفظها كطلبات منظمة للمسؤول.

## Run & Operate

- `npm run dev` — runs unified backend and frontend on port 3000
- `npm run typecheck` — full TypeScript build check across packages
- `npm run build` — builds frontend applet
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
- النموذج يملك شكل بياناته الخاص (`deceasedList`…)، ويحوّله `mapper.ts` إلى عقد الـ API (`deceasedPeople`…) قبل الإرسال؛ الخادم لا يقبل إلا عقد الـ API.
- الصيغ مأخوذة من أرشيف «وفيات قطر»: «توفي/توفيت»، «والدة كل من»، «أبناء /»، «الله يرحمه ويغفر له»، «شفيعاً لوالديه يارب».
- اسم المتوفاة اختياري؛ التعريف قد يكون بالكنية أو «حرم/أرملة فلان» أو «ابنة فلان» أو «والدة كل من». الزوج والأب كيانان مستقلان بحالة حياة.
- جنس الأقارب لا يُسجَّل لأن العرف لا يذكر الإناث في خانة الأقارب، فالترحّم عليهم بالمذكر (رحمه/رحمهما/رحمهم).
- نموذج المستخدم يبقى بشكله الأصلي: الخانات المضافة من الأرشيف مطوية تحت «خيارات إضافية» (`MoreOptions` في `form-steps-extras.tsx`). `EXTRA_OPTIONS_OPEN_BY_DEFAULT = true` يعيد الشكل الموسّع، وصفحة تعديل الطلب عند المسؤول تفتحها دائماً عبر `ExtrasOpenContext`.
- قائمة صلة القرابة هي القائمة الأصلية («أبناؤه، أخوانه…»)؛ يُحفظ معها `relationKey` في الخلفية حتى يكتب المولّد «والدة كل من».

## Gotchas

- `npm test` يشغّل اختبارات القبول المأخوذة من الأرشيف؛ شغّلها بعد أي تعديل على الصياغة.
- بعد تعديل `lib/api-spec/openapi.yaml` أعد توليد الأنواع: `npx orval --config ./orval.config.ts` داخل `lib/api-spec`.
