# تقرير الفحص المعماري المجهري للوحة الإدارة ومحرك توليد الصور (Deep Code Audit)

**تاريخ التقرير:** 2 أكتوبر 2026  
**الدور المعماري:** Staff Software Engineer  
**المشروع:** نظام إعلانات الوفاة والتعازي (قطر) — Qatar Obituary System  
**النطاق المفحوص:** المسار `/admin` وكافة المكونات الفرعية، مسارات الخادم، محرر القوالب البصري، محرك الكانفاس لتوليد الصور (1080×1350)، وتوافقيتها مع `src/lib/schema.ts` الجديد.

---

## 1. هيكلة المسارات والمكونات (Routing & UI Architecture)

### أ. خريطة المسارات والملفات المسؤولة (Frontend Routes)
تم فحص موجه التطبيق الرئيسي في `src/App.tsx` والمسارات المنبثقة منه:

| المسار (Route) | المكون (Component) | مسار الملف (File Path) | الوظيفة |
| :--- | :--- | :--- | :--- |
| `/admin` | `AdminPage` | `src/pages/admin/index.tsx` | لوحة التحكم وجدول عرض بطاقات الطلبات مع شارات الحالة. |
| `/admin/:requestNumber` | `AdminRequestDetailsPage` | `src/pages/admin/request-details.tsx` | شاشة تفاصيل الطلب الكاملة، نسخ النص، وتغيير الحالة. |
| `/admin/:requestNumber/edit` | `AdminEditRequestPage` | `src/pages/admin/edit-request.tsx` | واجهة تعديل بيانات الطلب عبر خطوات النموذج المتعددة. |
| `/admin/templates` | `AdminTemplatesPage` | `src/pages/admin/templates.tsx` | واجهة محرر القوالب البصري التفاعلي. |

---

### ب. آلية جلب قائمة الطلبات من Firestore وعرضها
تسير دورة البيانات عبر طبقات معمارية واضحة:

```
[UI Component: AdminPage]
       │
       ▼ (React Query: useListObituaryRequests)
[API Client: @workspace/api-client-react]
       │
       ▼ (HTTP GET /api/obituary-requests)
[Express Server: artifacts/api-server/src/routes/obituary-requests.ts]
       │
       ▼ (Database Abstraction: obituaryRequestsDb.list())
[Firestore Service: lib/db/src/index.ts]
       │
       ▼ (collection: "obituary_requests")
[Google Cloud Firestore Database]
```

1. **الواجهة الأمامية (`src/pages/admin/index.tsx`):**
   * يتم استدعاء الـ Hook المولد بواسطة Orval/React-Query: `useListObituaryRequests()`.
   * يقوم بتنفيذ استعلام `GET /api/obituary-requests` مع تفعيل الكاش وإعادة الجلب التلقائي.
2. **الواجهة الخلفية (`artifacts/api-server/src/routes/obituary-requests.ts`):**
   * يستقبل الراوتر الطلب ويستدعي طبقة قاعدة البيانات:
     ```typescript
     const rows = await obituaryRequestsDb.list();
     return res.json(rows.map(serialize));
     ```
3. **طبقة قاعدة البيانات (`lib/db/src/index.ts`):**
   * يتم الاتصال بقاعدة بيانات Cloud Firestore عبر الإعدادات المعتمدة في `firebase-applet-config.json`:
     ```typescript
     const colRef = collection(firestoreDb, "obituary_requests");
     const snapshot = await getDocs(query(colRef, orderBy("createdAt", "desc")));
     ```
   * يتم إرجاع الوثائق وتمريرها عبر دالة `serialize()` لتوحيد حقول البيانات وفق عقد OpenAPI.

---

## 2. إدارة حالة الطلبات (Order Status Management)

### أ. قراءة تفاصيل الطلب (`src/pages/admin/request-details.tsx`)
* يُلتقط معرف الطلب `requestNumber` من الـ URL عبر:
  ```typescript
  const [, params] = useRoute("/admin/:requestNumber");
  const requestNumber = params?.requestNumber;
  ```
* يُجلب الطلب بواسطة الـ Hook:
  ```typescript
  const { data: req, isLoading, error } = useGetObituaryRequest(requestNumber || "", {
    query: {
      enabled: !!requestNumber,
      queryKey: getGetObituaryRequestQueryKey(requestNumber || ""),
    }
  });
  ```
* تعرض الشاشة تفاصيل منظمة:
  * بيانات المتوفين وأعمارهم ومهنهم.
  * قائمة الأقارب وأسمائهم وصفاتهم.
  * تفاصيل الدفن ومكانه ورابط موقعه.
  * صلاة الجنازة والجامع وموعدها.
  * مقرات العزاء المحددة وتفاصيلها.
  * أرقام التواصل عبر الهاتف بصيغة LTR معزولة.
  * زر "نسخ كنص للعرض" (`copyToClipboard`) الذي يولد نصاً رسمياً مخصصاً للنشر الفوري.

### ب. تغيير وتحديث حالة الطلب
* تتضمن الواجهة قائمة اختيار منسدلة (`<Select>`) تضم أربع حالات معتمدة:
  1. `new` (جديد - شارة زرقاء)
  2. `reviewing` (قيد المراجعة - شارة صفراء/كهرمانية)
  3. `ready` (جاهز - شارة خضراء مفرغة)
  4. `completed` (مكتمل - شارة خضراء ممتلئة)
* **المسار البرمجي للتحديث:**
  1. عند اختيار حالة جديدة، تُستدعى الدالة `handleStatusChange`:
     ```typescript
     updateMutation.mutate({
       requestNumber,
       data: { ...req, status: newStatus }
     }, {
       onSuccess: () => {
         queryClient.invalidateQueries({ queryKey: getGetObituaryRequestQueryKey(requestNumber) });
         queryClient.invalidateQueries({ queryKey: getListObituaryRequestsQueryKey() });
         toast.success("تم تحديث الحالة بنجاح");
       }
     });
     ```
  2. يُرسل طلب `PUT /api/obituary-requests/:requestNumber` إلى الخادم.
  3. يقوم الخادم في `lib/db/src/index.ts` بتحديث وثيقة Firestore:
     ```typescript
     await setDoc(doc(firestoreDb, "obituary_requests", requestNumber), {
       ...existingData,
       status: newStatus,
       updatedAt: new Date().toISOString()
     }, { merge: true });
     ```
  4. يتم تحديث الواجهة تلقائياً دون إعادة تحميل الصفحة (Optimistic / Reactive Invalidation).

---

## 3. محرر القوالب البصري (Visual Template Editor - `/admin/templates`)

### أ. آلية العمل الداخلية
* المكون الحاكم هو `TemplateDesignerModal` في `src/components/template-designer/template-designer-modal.tsx`.
* يتكون المحرر من ثلاثة أجزاء رئيسية:
  1. **الكانفاس التفاعلي (`DesignerCanvas`):** يعرض القالب بمقاس (1080×1350) مع دعم التكبير والتصغير (`zoom`).
  2. **لوحة الطبقات (`LayersPanel`):** تتيح للمشرف التحكم بترتيب الطبقات (`zIndex`)، إخفاء/إظهار الكتل، وقفلها لمنع التعديل بالخطأ.
  3. **لوحة الخصائص (`PropertiesPanel`):** تتيح تخصيص الخطوط، أحجام النصوص، ألوان الخلفية، الحدود، الفراغات، واستدارة الحواف (`borderRadius`).
  4. **سجل التراجع والتقدم (`Undo / Redo Stack`):** يسجل كل تعديل في مصفوفة تاريخية تتيح العودة لأي خطوة سابقة.

### ب. المكتبة المستخدمة للرسم والتفاعل
* **الواقع البرمجي:** لا توجد أي مكتبات خارجية مثل Konva أو Fabric.js.
* المحرك مبني بالكامل على **واجهة الرسم الثنائية الأبعاد الأصلية (Native HTML5 Canvas 2D API)**:
  * يتم استخراج سياق الرسم عبر `canvas.getContext("2d")`.
  * السحب والإفلات وتغيير الحجم مبنيان يدوياً بمتابعة أحداث الفأرة (`handleMouseDown`, `handleMouseMove`, `handleMouseUp`).
  * يدعم 8 مقابض تفاعلية لكل كتلة (`nw`, `ne`, `se`, `sw`, `n`, `s`, `e`, `w`).
  * محاذاة مغناطيسية ذكية (`Snap Guides`) بهامش 10 بكسل نحو المنتصف وحواف الصفحة.

### ج. هيكل حفظ القالب في قاعدة البيانات
* المسؤول عن التخزين هو `src/lib/template-storage.ts`.
* تُحفظ القوالب في كولكشن مخصص في Firestore:
  ```typescript
  collection(firestoreDb, "condolence_templates")
  ```
  مع نسخة كاش احتياطية في المتصفح عبر `localStorage` (`qatar_condolence_templates_v2`).
* بنية كائن القالب (`CondolenceTemplate` من `src/lib/template-schema.ts`):
  * `id`, `name`, `isBuiltIn`, `isDefault`, `createdAt`, `updatedAt`.
  * `canvas`: أبعاد الكانفاس (1080×1350)، لون الخلفية، التدرجات (`backgroundGradient`)، والإطارات والزخارف.
  * `layout`: هوامش الصفحة `pageMarginX`، الفراغ بين البطاقات `cardGap`، وخيار التوزيع التلقائي `autoArrange`.
  * `blocks`: كائن يحتوي تكوين كل كتلة ذكية (`BlockConfig`):
    * الإحداثيات والأبعاد: `x`, `y`, `width`, `height`.
    * الطباعة: `fontFamily`, `fontSize`, `fontWeight`, `lineHeight`, `textAlign`, `textColor`.
    * المظهر: `backgroundColor`, `borderColor`, `borderWidth`, `borderRadius`, `accentColor`, `headerRibbonHeight`, `padding`, `opacity`.

---

## 4. محرك توليد الصورة (Image Generation Flow & Canvas Engine)

### أ. تدفق البيانات التفصيلي (Data Flow)
```
[بيانات الطلب الأصلية req]
       │
       ▼
[createCondolenceImageDraft()] ──> إنشاء مسودة تعديل أولية
       │
       ▼
[normalizeObituaryPresentation()] ──> تنظيف، تطبيع، ودمج المواقع المتطابقة
       │
       ▼
[generateQrImages()] ──> توليد باركودات QR عالية التباين (360×360)
       │
       ▼
[compileAndRenderSinglePage()] ──> قياس الأطوال، تطبيق وضع الضغط، وتوزيع الكتل رأسياً
       │
       ▼
[Offscreen Canvas Context 2D Paint] ──> رسم الخلفية، الزخارف، الكروت، والنصوص
       │
       ▼
[Canvas Preview / Export] ──> نسخ للحافظة (واتساب) أو تنزيل PNG فائق الدقة
```

### ب. دمج بيانات الطلب مع القالب (1080×1350)
1. يفتح المشرف نافذة الاستوديو `CondolenceImageStudio` (`src/components/condolence-image-studio-v2.tsx`).
2. يقوم بتحديد القالب المطلوب (الرسمي المعتمد أو قالب مخصص).
3. يتم تطبيع البيانات عبر `normalizeObituaryPresentation()` في `src/lib/presentation-normalizer.ts`.
4. يستدعي المحرك دالة `compileAndRenderSinglePage()` في `src/lib/single-page-engine.ts`.
5. يتم رسم النتيجة على كانفاس بدقة (1080×1350) بكسل، مع تحميل الخطوط العربية المعتمدة (`Amiri`, `IBM Plex Sans Arabic`, `Cairo`).

### ج. المنطق البرمجي للقواعد الديناميكية والاستثناءات
1. **التعامل مع الحقول الاختيارية (Conditional Section Visibility):**
   * في `single-page-engine.ts` (الأسطر 275–296)، يتم تفعيل الكتل الممتلئة فقط (`activeBlockIds`). إذا كان الطلب لا يحتوي على أقارب أو هواتف أو ملاحظات، يتم استبعاد الكتل تماماً ولا يتم حجز أي مساحة رأسية لها.
2. **دمج الصلاة والدفن في كتلة موحدة (`prayerBurialCombined`):**
   * في `presentation-normalizer.ts` (الأسطر 335–360)، تقوم دالة `areLocationsEquivalent` بفحص مكان الصلاة ومكان الدفن؛ إذا كانا متطابقين، يتم دمجهما تلقائياً في كرت واحد يحمل عنوان "صلاة الجنازة والدفن" لمنع تكرار النصوص والباركودات وتوفير مساحة الكانفاس.
3. **محرك تقليص المسافات لضمان الصفحة الواحدة (Auto-Compact Engine):**
   * في `single-page-engine.ts` (الأسطر 433–478):
     * الحد الأقصى للمحتوى: `MAX_CANVAS_CONTENT_HEIGHT = 1310px`.
     * يتم قياس ارتفاع المحتوى بالوضع الطبيعي (مقياس خط 1.0 وفراغات 14px).
     * إذا تجاوز المحتوى 1310px، يُفعل النظام **وضع الضغط الذكي (Compact Mode)**:
       * تقليص فراغات البطاقات من 14px إلى 10px.
       * ضغط الخطوط بنسبة 92% (`fontScale = 0.92`).
       * تقليص الحشو الداخلي للبطاقات بنسبة 25%.
     * في حال استمرار التجاوز، يتم تفعيل ضغط أعمق (`fontScale = 0.86`, `cardGap = 8px`) لضمان عدم خروج أي نص خارج حدود الصفحة الواحدة نهائياً.
4. **استثناءات حجب باركود الـ QR (مقبرة مسيمير وجامع الإمام):**
   * في `presentation-normalizer.ts` عبر الدالة:
     ```typescript
     export function isKnownLocationSuppressed(locationText: string): boolean
     ```
   * تقوم بتجريد النص من التشكيل والحروف الزائدة ومقارنته؛ إذا تضمن مكان الصلاة أو الدفن "مسيمير" أو "جامع محمد بن عبدالوهاب / جامع الدولة"، يُحجب رابط الـ QR فوراً، ولا يُرسم مربع الباركود لأن هذه المعالم شهيرة ومعروفة لعامة أهل قطر.

---

## 5. نقاط التصادم مع الـ Schema الجديد (Crucial Compatibility Check)

أظهر الفحص الهندسي تعارضاً جذرياً بين التحديثات الأخيرة في `src/lib/schema.ts` ومكونات لوحة الإدارة ومحرك الصور:

| # | الملف المتضرر | طبيعة التصادم (Breaking Collision) | الأثر الحتمي (Impact) |
| :- | :--- | :--- | :--- |
| **1** | `src/pages/admin/request-details.tsx` | يقرأ حقل العزاء كمصفوفة: `req.condolences.map(c => ...)` بينما في الـ Schema الجديد أصبح كائناً: `condolences: { type, men, women, phones }`. | **Crash فوري:** ظهور خطأ أبيض `TypeError: req.condolences.map is not a function` عند فتح أي طلب جديد! |
| **2** | `src/pages/admin/request-details.tsx` | يقرأ الدفن والصلاة بالحقول القديمة: `req.burial.cemetery`, `req.burial.day`, `req.prayer.place` بينما أصبحت في الـ Schema الجديد: `locationName`, `dateDescription`, `timeDescription`. | **فقدان عرض البيانات:** تظهر خانات الدفن والصلاة بيضاء وفارغة رغم قيام المستخدم بتعبئتها. |
| **3** | `src/pages/admin/request-details.tsx` | يقرأ المتوفين من `req.deceasedPeople` بينما أصبحت في الـ Schema: `deceasedList`، ولا يعرف صيغ علاقات النساء المعقدة (`femaleRelations: أرملة / حرم`). | اختفاء أسماء المتوفين من الترويسة وسقوط صلات القرابة للإناث. |
| **4** | `src/lib/condolence-copy.ts` | دالة `createCondolenceImageDraft` تعتمد على كون العزاء مصفوفة: `request.condolences?.find(c => c.audience === "men")`. | فشل قراءة مقرات العزاء، ويفتح محرر الصور ببيانات عزاء فارغة تماماً. |
| **5** | `src/lib/presentation-normalizer.ts` | يبحث عن كروت العزاء عبر فلترة المصفوفة القديمة `request.condolences?.find(...)`، ولا يتعرف على كائن `schedule` الجديد (التبويبات، الفترات الصباحية والمسائية، ويوم الجمعة). | **تشويه البوستر النهائي:** بوستر العزاء سيتجاهل مواعيد العزاء الجديدة ويسقط الفترات الزمنية كلياً. |
| **6** | `artifacts/api-server/src/routes/obituary-requests.ts` | دالة `normalizePayload` في مسار الخادم تقوم بتجريد أي حقول لا تطابق مخطط OpenAPI القديم، وتجبر `condolences` على التحول لمصفوفة كروت مسطحة. | **تلف وتجريد البيانات:** أي تعديل يُحفظ من لوحة الإدارة يمسح بيانات التبويبات وأوقات العزاء والصلات النسائية من Firestore! |
| **7** | `src/pages/admin/edit-request.tsx` | عند محاولة تعديل طلب، يمرر البيانات لدالة `mapPayloadToForm`؛ وبسبب اختلاف أسماء الحقول ومصفوفة المتوفين، تفشل الـ Form Resolver في مطابقة القيم مع `ObituaryFormSchema`. | عجز المشرف عن تعديل الطلبات المحفوظة وظهور أخطاء تحقق حمراء تحجب زر الحفظ. |

---

## 6. خطة العمل الموصى بها للإصلاح الهندسي (Refactoring Roadmap)

1. **المرحلة الأولى: تحديث الـ Data Adapter & Normalizer:**
   * تحديث دالة `normalizePayload` في `artifacts/api-server/src/routes/obituary-requests.ts` لدعم كائن `condolences` المباشر (`men`, `women`, `schedule`) ومصفوفة `deceasedList` وعلاقات `femaleRelations`.
2. **المرحلة الثانية: تحديث شاشات الإدارة:**
   * تحديث `request-details.tsx` لقراءة `req.condolences.men` و `req.condolences.women` بدلاً من استدعاء `.map()`، وعرض التبويبات الزمنية وعلاقات النساء.
   * ضبط `edit-request.tsx` لتغذية النموذج بالهيكلة المحدثة فوراً.
3. **المرحلة الثالثة: تحديث محرك الصور والبوسترات:**
   * تحديث `presentation-normalizer.ts` و `condolence-copy.ts` لاستخراج نصوص العزاء من `schedule.morningFrom / morningTo` و `schedule.eveningFrom / eveningTo` و `schedule.fridayNote` وعكسها بدقة في تصميم الـ (1080×1350).
