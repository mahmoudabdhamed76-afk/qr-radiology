# QR Radiology — إمداد QR

متجر توريدات لكل مركز أشعة بكود QR، ولوحة تحكم للمورد يتابع منها الطلبات والمخزون والمراكز.

- **صفحة المركز** `/c/<كود-المركز>`: المدير بيمسح الكود من على باب المركز، فتفتحله صفحة متجر فيها الأصناف المتاحة بالكمية، وسلة، وأولوية للطلب. وبعد ما يبعت بيتابع الطلب لحظة بلحظة لحد التسليم: اتبعت ← اتعتمد ← بيتجهز ← في الطريق مع المندوب ← اتسلّم.
- **لوحة التحكم** `/` (بكلمة سر): الرئيسية، والطلبات (اعتماد وتجهيز وخروج مع مندوب وتأكيد التسليم)، والأصناف والمخزون، والمراكز وباركود لكل مركز للطباعة، والإعدادات.
- **الكود العام** `/center`: صفحة المدير يختار منها مركزه بالاسم. تقدر تقفلها من الإعدادات.

Node.js 22 أو أحدث، **من غير أي مكتبات** (`node:http` + `node:sqlite`). مفيش `npm install`.

## التشغيل

```bash
node server.js          # أو START.bat على ويندوز
```

افتح `http://localhost:3450`. كلمة السر لأول مرة بتطلع في الـ log وبتتحفظ في `data/ADMIN_PASSWORD.txt`. غيّرها من الإعدادات.

| متغير | معناه |
|---|---|
| `PORT` | المنفذ (افتراضي 3450) |
| `DATA_DIR` | مكان قاعدة البيانات (افتراضي `./data`) |
| `ADMIN_PASSWORD` | كلمة سر لوحة التحكم. لو اتحطت بتكسب دايمًا (مناسب لـ Railway) |
| `SEED_DEMO=0` | يبدأ فاضي من غير بيانات تجريبية |

## Railway

نفس الإعداد بالـ Dockerfile. لازم تربط **Volume** على `/app/data` عشان البيانات متتمسحش مع كل deploy، وتحط `ADMIN_PASSWORD` في الـ Variables.

## ترتيب المشروع

```
server.js               تشغيل بس
src/
  config.js             كل الإعدادات من الـ environment
  db.js                 الجداول (نفس جداول v1) + الإعدادات
  seed.js               البيانات التجريبية
  time.js               توقيت مصر حتى على سيرفر UTC
  http.js               router صغير + ملفات ثابتة (gzip/ETag)
  auth.js               دخول لوحة التحكم (scrypt + cookie + حد للمحاولات الغلط)
  sse.js                تحديث لحظي: قناة للوحة وقناة لكل مركز
  qr.js                 توليد QR (qrcode-generator، MIT، جوه src/vendor)
  services/orders.js    الطلبات: إنشاء وحجز المخزون والمراحل والإلغاء
  services/stats.js     أرقام الرئيسية والرسم
  routes/admin.js       API لوحة التحكم (/api/admin/*)
  routes/public.js      API صفحة المركز (/api/public/*)
public/
  shared/               base.css (الألوان والمكونات) · ui.js (الحركة والمكونات) · art.js (رسمة لكل صنف)
  store/                صفحة المركز (المتجر)
  panel/                لوحة التحكم
  vendor/gsap.min.js    GSAP للحركة
  fonts/                IBM Plex Sans Arabic محلي (بيشتغل من غير نت)
tests/api.test.js       node --test tests/api.test.js
```

## الحركة (Motion UI)

GSAP + CSS: Mask Wipe للعنوان، وعدسة مكبّرة على رف المخزن بتوري الكمية المتاحة من كل صنف، وخط سكان. وكمان Skeleton Shimmer، وScroll Reveal + Stagger، وHover Lift، وRipple، وSpring Scale. والصنف بيطير للسلة لما يتضاف، وفيه Icon Morphing (سلة↔صح، +↔صح، شمس↔قمر). على الموبايل فيه Bottom Sheet بيتقفل بالسحب، وعلى الكمبيوتر Slide-In. بعد إرسال الطلب الكرتونة بتتحول لعلامة صح (Morph)، والانتقال بين المتجر وطلباتي بـ Page Transitions. في لوحة التحكم فيه Segmented Control متحرك ومسار الطلب بيتحرك. الحركة كلها بتقف عند `prefers-reduced-motion`.
