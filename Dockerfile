# صورة تشغيل التطبيق على Cloud Run: تثبيت الاعتماديات، بناء الواجهة، ثم تشغيل الخادم الموحّد (API + الواجهة المبنية).
FROM node:22-slim

WORKDIR /app

# ملفات التعريف أولاً لتُحفظ طبقة التثبيت في الذاكرة المؤقتة عند تغيّر الكود فقط
COPY package.json package-lock.json ./
COPY artifacts/api-server/package.json artifacts/api-server/
COPY artifacts/qatar-obituary-form/package.json artifacts/qatar-obituary-form/
COPY artifacts/mockup-sandbox/package.json artifacts/mockup-sandbox/
COPY lib/api-client-react/package.json lib/api-client-react/
COPY lib/api-spec/package.json lib/api-spec/
COPY lib/api-zod/package.json lib/api-zod/
COPY lib/db/package.json lib/db/
COPY scripts/package.json scripts/
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build && npm prune --omit=dev --no-audit --no-fund

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["npm", "start"]
