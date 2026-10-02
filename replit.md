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
