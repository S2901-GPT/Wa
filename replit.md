# نموذج بيانات إعلان وفاة

تطبيق عربي RTL لتعبئة ومراجعة بيانات إعلان وفاة في قطر وحفظها كطلبات منظمة للمسؤول.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- واجهة التطبيق: `artifacts/qatar-obituary-form`
- واجهة API: `artifacts/api-server/src/routes/obituary-requests.ts`
- عقد API: `lib/api-spec/openapi.yaml`
- مخطط قاعدة البيانات: `lib/db/src/schema/obituary-requests.ts`

## Architecture decisions

- نص الإعلان يُولَّد بقواعد ثابتة في `artifacts/qatar-obituary-form/src/lib/announcement.ts` (لا نموذج لغوي)، ويستخدمه نص «نسخ كنص للعرض» وصورة التعزية ومعاينة المراجعة معاً حتى لا تتباعد القواعد.
- الصيغ مأخوذة من أرشيف «وفيات قطر»: «توفي/توفيت»، «والدة كل من»، «أبناء /»، «الله يرحمه ويغفر له»، «شفيعاً لوالديه يارب».
- اسم المتوفاة اختياري؛ التعريف قد يكون بالكنية أو «حرم/أرملة فلان» أو «ابنة فلان» أو «والدة كل من». الزوج والأب كيانان مستقلان بحالة حياة.
- صلة القرابة تُخزَّن من منظور الأقارب (`relationKey`) ويحوّلها المولّد إلى منظور المتوفى. جنس الأقارب لا يُسجَّل لأن العرف لا يذكر الإناث في خانة الأقارب، فالترحّم عليهم بالمذكر (رحمه/رحمهما/رحمهم).

## Product

- نموذج عربي متجاوب بصفحة مراجعة قبل الإرسال.
- حقول ديناميكية للأقارب، صلاة الجنازة، وعزاء الرجال والنساء.
- رقم طلب بعد الإرسال ولوحة داخلية لعرض الطلبات ونسخها.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- `npm test` يشغّل اختبارات القبول المأخوذة من الأرشيف؛ شغّلها بعد أي تعديل على الصياغة.
- بعد تعديل `lib/api-spec/openapi.yaml` أعد توليد الأنواع: `npx orval --config ./orval.config.ts` داخل `lib/api-spec`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
