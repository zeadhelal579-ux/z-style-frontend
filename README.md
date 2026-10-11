# Z-Style — Frontend (جاهز للرفع على Vercel)

متجر ملابس بـ HTML / CSS / JavaScript خام — **من غير build ولا npm**. الفولدر ده شغال لوحده بالكامل:
الكتالوج (80 منتج) جوه الكود، والحسابات والسلة والمفضلة والطلبات والشكاوى بتتخزن في متصفح الزائر (localStorage).
مفيش سيرفر مطلوب.

## الرفع على Vercel

**من GitHub (الأسهل):**
1. ارفع محتوى الفولدر ده على repo. لو الـ repo فيه `frontend/` و`backend/` مع بعض، هتختار `frontend` كـ Root Directory في الخطوة 3.
2. vercel.com ← **Add New → Project** ← اختار الـ repo.
3. **Framework Preset: Other** — سيب Build Command و Output Directory فاضيين.
4. **Deploy**.

**من الـ CLI:**
```bash
npm i -g vercel
cd z-style-frontend
vercel --prod
```

## تجربة محلية
لازم سيرفر محلي (الـ ES modules مش بتشتغل لو فتحت الملف مباشرة):
```bash
cd z-style-frontend
npx serve .          # أو: python3 -m http.server 8080
```

## التعديلات الشائعة
| عايز تعمل إيه | روح فين |
|---|---|
| تغيّر منتجات / أسعار / أقسام | `js/demo/catalog.js` (جدول `CATEGORY_DEFS`) |
| تحط صور منتجات حقيقية | حط الصور في `assets/products/` وعدّل الدالة `imagesFor()` في `js/demo/catalog.js` |
| تغيّر صور البانر الرئيسية | `assets/hero/` (3 ملفات) أو المسارات في `index.html` |
| تغيّر سرعة تحرك الأوردر بين مراحل التتبع | `DEMO_ORDER_STAGE_SECONDS` في `js/config.js` (`0` = يفضل "Placed") |
| تغيّر الألوان | `css/variables.css` |

## التوصيل بالباك إند الحقيقي لاحقًا
1. انشر الـ ASP.NET API على HTTPS (Vercel بتشتغل HTTPS، فالباك لازم HTTPS كمان).
2. في `js/config.js`: خلّي `USE_DEMO_API = false` وحط عنوان الـ API في `API_BASE_URL` و`ASSET_BASE_URL`.
3. في الباك إند ضيف رابط موقعك على Vercel في `Cors:AllowedOrigins` (ملف `appsettings.json`).

كل الصفحات بتتعامل مع `js/api.js` بس، فمفيش أي صفحة بتتغير.

## ملاحظات
- **وضع الـ demo:** كل زائر بيشوف حسابه وسلته وطلباته على جهازه هو بس، ومفيش دفع حقيقي ولا شحن (مكتوب للزائر في صفحتي الدخول والدفع). الرسايل دي بتختفي تلقائيًا لما `USE_DEMO_API = false`.
- كل نصوص الواجهة إنجليزي، ما عدا الشات بوت (عربي).

## الهيكل
```
index.html        الصفحة الوحيدة (SPA) — بتحمّل js/main.js
vercel.json       headers أمان بسيطة
css/              ملفات الستايل (variables.css = الألوان)
js/
  main.js         نقطة الدخول + تسجيل الصفحات
  router.js       التنقل بالـ hash (#/product/12)
  state.js        السلة / المفضلة / الجلسة
  api.js          الطبقة الوحيدة اللي بتكلّم "السيرفر" (حقيقي أو demo)
  config.js       الإعدادات
  views/          كل صفحة في ملف
  components/     أجزاء مشتركة (كارت المنتج، التوست، النافبار...)
  demo/           الباك إند اللي جوه المتصفح: catalog.js + demoApi.js + productArt.js
assets/           favicon + بانرات الهوم
```
