const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'emdad.db');
const db = new DatabaseSync(DB_PATH);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS centers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    branch TEXT DEFAULT '',
    manager_name TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    address TEXT DEFAULT '',
    is_active INTEGER DEFAULT 1,
    scan_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS supplies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sku TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT DEFAULT '',
    unit TEXT DEFAULT 'علبة',
    available_qty INTEGER DEFAULT 0,
    min_stock INTEGER DEFAULT 5,
    max_per_order INTEGER DEFAULT 50,
    icon TEXT DEFAULT '📦',
    image_url TEXT DEFAULT '',
    badge_tone TEXT DEFAULT 'sage',
    is_visible INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_code TEXT UNIQUE NOT NULL,
    center_id INTEGER NOT NULL,
    center_name TEXT NOT NULL,
    center_branch TEXT DEFAULT '',
    manager_name TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    priority TEXT DEFAULT 'normal',
    status TEXT DEFAULT 'pending',
    progress INTEGER DEFAULT 15,
    notes TEXT DEFAULT '',
    admin_note TEXT DEFAULT '',
    driver_name TEXT DEFAULT '',
    driver_phone TEXT DEFAULT '',
    eta_minutes INTEGER DEFAULT 0,
    stage_log TEXT DEFAULT '[]',
    total_items INTEGER DEFAULT 0,
    total_units INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (center_id) REFERENCES centers(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    supply_id INTEGER,
    supply_name TEXT NOT NULL,
    unit TEXT DEFAULT 'علبة',
    category TEXT DEFAULT '',
    quantity INTEGER NOT NULL,
    icon TEXT DEFAULT '📦',
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS qr_scans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    center_id INTEGER,
    scanned_at TEXT DEFAULT (datetime('now', 'localtime')),
    user_agent TEXT DEFAULT '',
    FOREIGN KEY (center_id) REFERENCES centers(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

function formatLocalOffset(daysAgo = 0, hoursAgo = 0, minutesAgo = 0) {
  const d = new Date(Date.now() - (((daysAgo * 24 + hoursAgo) * 60 + minutesAgo) * 60 * 1000));
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function seedIfEmpty() {
  const centerCount = db.prepare('SELECT COUNT(*) AS c FROM centers').get().c;
  if (centerCount > 0) return;

  const insertSetting = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  insertSetting.run('brand_name', 'إمداد QR');
  insertSetting.run('brand_subtitle', 'إدارة التوريدات الذكية للمراكز');
  insertSetting.run('public_base_url', '');
  insertSetting.run('sound_alerts', 'true');
  insertSetting.run('show_out_of_stock', 'true');

  const insertCenter = db.prepare(`
    INSERT INTO centers (code, name, branch, manager_name, phone, address, is_active, scan_count)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?)
  `);

  const centers = [
    ['sama-zaytoun', 'مركز سما سكان للأشعة', 'فرع حلمية الزيتون', 'د. محمود صابر', '01012345678', 'شارع سليم الأول، حلمية الزيتون، القاهرة', 46],
    ['noor-nasr', 'مركز النور للتحاليل والأشعة', 'فرع مدينة نصر', 'أ. أحمد الشريف', '01123456789', 'شارع عباس العقاد، مدينة نصر، القاهرة', 31],
    ['shifa-maadi', 'مركز الشفاء التخصصي', 'فرع المعادي', 'د. سارة المنشاوي', '01234567890', 'شارع 9، المعادي، القاهرة', 19],
    ['hayat-dokki', 'مركز الحياة للتشخيص الطبي', 'فرع الدقي', 'أ. كريم عبد الرحمن', '01098765432', 'ميدان المساحة، الدقي، الجيزة', 14]
  ];
  for (const c of centers) insertCenter.run(...c);

  const insertSupply = db.prepare(`
    INSERT INTO supplies (sku, name, category, description, unit, available_qty, min_stock, max_per_order, icon, badge_tone, is_visible, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
  `);

  const supplies = [
    ['SUP-101', 'أفلام أشعة ديجيتال 14×17 (فوجي)', 'أفلام أشعة', 'علبة أفلام حرارية عالية الدقة 100 فيلم متوافقة مع طابعات DryPix', 'علبة', 38, 10, 15, '🩻', 'periwinkle', 1],
    ['SUP-102', 'أفلام أشعة ديجيتال 10×12 (أجفا)', 'أفلام أشعة', 'علبة أفلام طبية مقاس متوسط للرنين والمقطعية — 100 فيلم', 'علبة', 24, 8, 12, '🎞️', 'periwinkle', 2],
    ['SUP-103', 'صبغة أشعة مقطعية Omnipaque 350', 'صبغات ومحاليل', 'زجاجة 100 مل صبغة وريدية غير أيونية معتمدة للأشعة المقطعية', 'زجاجة', 16, 6, 10, '🧪', 'honey', 3],
    ['SUP-104', 'جل سونار طبي أزرق (جالون 5 لتر)', 'صبغات ومحاليل', 'جل سونار عالي التوصيل خالي من الأملاح وآمن على البروب', 'جالون', 29, 8, 10, '🧴', 'sage', 4],
    ['SUP-105', 'قفازات فحص نيتريل بدون بودرة (M/L)', 'مستلزمات طبية', 'علبة 100 قفاز نيتريل طبي مقاوم للتمزق للاستخدام اليومي', 'علبة', 64, 15, 25, '🧤', 'sage', 5],
    ['SUP-106', 'سرنجات حقن أوتوماتيك 200 مل + لاين', 'مستلزمات طبية', 'طقم حقن صبغة كامل معقم متوافق مع أجهزة الحاقن الآلي', 'طقم', 7, 10, 8, '💉', 'peach', 6],
    ['SUP-107', 'شنط وأظرف أفلام أشعة مطبوعة باللوجو', 'مطبوعات وأكياس', 'باكيت 50 شنطة فاخرة مقوى مقاس كبير لتسليم تقارير وأفلام المرضى', 'باكيت', 42, 10, 20, '🛍️', 'honey', 7],
    ['SUP-108', 'ورق تقارير طبية فاخر A4 (مطبوع)', 'مطبوعات وأكياس', 'رزمة 500 ورقة 100 جرام ببيانات المركز وتصميم الهوية', 'رزمة', 18, 6, 10, '📄', 'periwinkle', 8],
    ['SUP-109', 'أسطوانات CD فارغة + جراب مطبوع', 'مطبوعات وأكياس', 'باكيت 50 أسطوانة عالية السرعة لنسخ ملفات DICOM للمرضى', 'باكيت', 4, 8, 6, '💿', 'peach', 9],
    ['SUP-110', 'كحول طبي إيثيلي 70% للتعقيم (لتر)', 'تعقيم ونظافة', 'عبوة تعقيم أسطح وأجهزة معتمدة سريعة التبخر بدون أثر', 'عبوة', 35, 10, 15, '🧼', 'sage', 10],
    ['SUP-111', 'رول ملاءات كشف طبية (كرتونة 12 رول)', 'تعقيم ونظافة', 'ملاءات طبية غير منسوجة عرض 60 سم لأسرة الأشعة والعيادات', 'كرتونة', 12, 5, 6, '🧻', 'honey', 11],
    ['SUP-112', 'حبر طابعة تقارير ليزر أصلي HP 85A', 'أجهزة وأحبار', 'خراطيش حبر أصلية عالية الكفاءة لطباعة التقارير الطبية', 'قطعة', 0, 4, 4, '🖨️', 'peach', 12]
  ];
  for (const s of supplies) insertSupply.run(...s);

  const insertOrder = db.prepare(`
    INSERT INTO orders (
      order_code, center_id, center_name, center_branch, manager_name, phone,
      priority, status, progress, notes, admin_note, driver_name, driver_phone, eta_minutes,
      stage_log, total_items, total_units, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertItem = db.prepare(`
    INSERT INTO order_items (order_id, supply_id, supply_name, unit, category, quantity, icon)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  // Sample Order 1: Dispatched (in transit!) for Center 1
  const log1 = JSON.stringify([
    { status: 'pending', label: 'تم استلام طلب التوريد', time: formatLocalOffset(0, 2, 10), note: 'تم تسجيل الطلب تلقائياً عبر بوابة QR' },
    { status: 'approved', label: 'تم اعتماد الطلب وحجز الكميات', time: formatLocalOffset(0, 1, 45), note: 'تمت مراجعة الأرصدة واعتماد الصرف' },
    { status: 'preparing', label: 'جاري تجهيز وتعبئة المهمة', time: formatLocalOffset(0, 1, 10), note: 'تم تغليف الطرود ومراجعة الباركود في المخزن الرئيسي' },
    { status: 'dispatched', label: 'المندوب في الطريق للمركز', time: formatLocalOffset(0, 0, 22), note: 'خرجت الشحنة مع المندوب طارق حسن — وقت الوصول المتوقع 18 دقيقة' }
  ]);
  const r1 = insertOrder.run(
    'EM-2601', 1, 'مركز سما سكان للأشعة', 'فرع حلمية الزيتون', 'د. محمود صابر', '01012345678',
    'urgent', 'dispatched', 80, 'يرجى التسليم لمسؤول المخزن بالدور الأول قبل الساعة 5 مساءً',
    'الشحنة جاهزة ومغلفة — المندوب قريب من حلمية الزيتون', 'طارق حسن', '01055667788', 18,
    log1, 3, 14, formatLocalOffset(0, 2, 10), formatLocalOffset(0, 0, 22)
  );
  insertItem.run(r1.lastInsertRowid, 1, 'أفلام أشعة ديجيتال 14×17 (فوجي)', 'علبة', 'أفلام أشعة', 5, '🩻');
  insertItem.run(r1.lastInsertRowid, 3, 'صبغة أشعة مقطعية Omnipaque 350', 'زجاجة', 'صبغات ومحاليل', 4, '🧪');
  insertItem.run(r1.lastInsertRowid, 7, 'شنط وأظرف أفلام أشعة مطبوعة باللوجو', 'باكيت', 'مطبوعات وأكياس', 5, '🛍️');

  // Sample Order 2: Preparing (warehouse animation!) for Center 2
  const log2 = JSON.stringify([
    { status: 'pending', label: 'تم استلام طلب التوريد', time: formatLocalOffset(0, 1, 5), note: 'طلب جديد من فرع مدينة نصر' },
    { status: 'approved', label: 'تم اعتماد الطلب وحجز الكميات', time: formatLocalOffset(0, 0, 48), note: 'تم الاعتماد وجاري التحويل للتجهيز' },
    { status: 'preparing', label: 'جاري تجهيز وتعبئة المهمة', time: formatLocalOffset(0, 0, 15), note: 'فريق المخزن يقوم بتجميع وفحص الأصناف الآن' }
  ]);
  const r2 = insertOrder.run(
    'EM-2602', 2, 'مركز النور للتحاليل والأشعة', 'فرع مدينة نصر', 'أ. أحمد الشريف', '01123456789',
    'normal', 'preparing', 58, 'طلب التوريد الأسبوعي للمعمل وقسم السونار',
    'جاري فحص تاريخ صلاحية الجل وتغليف القفازات', '', '', 0,
    log2, 3, 16, formatLocalOffset(0, 1, 5), formatLocalOffset(0, 0, 15)
  );
  insertItem.run(r2.lastInsertRowid, 4, 'جل سونار طبي أزرق (جالون 5 لتر)', 'جالون', 'صبغات ومحاليل', 4, '🧴');
  insertItem.run(r2.lastInsertRowid, 5, 'قفازات فحص نيتريل بدون بودرة (M/L)', 'علبة', 'مستلزمات طبية', 10, '🧤');
  insertItem.run(r2.lastInsertRowid, 11, 'رول ملاءات كشف طبية (كرتونة 12 رول)', 'كرتونة', 'تعقيم ونظافة', 2, '🧻');

  // Sample Order 3: Pending (awaiting admin action!) for Center 3
  const log3 = JSON.stringify([
    { status: 'pending', label: 'تم استلام طلب التوريد', time: formatLocalOffset(0, 0, 12), note: 'تم إرسال الطلب من جوال مدير المركز عبر كود QR' }
  ]);
  const r3 = insertOrder.run(
    'EM-2603', 3, 'مركز الشفاء التخصصي', 'فرع المعادي', 'د. سارة المنشاوي', '01234567890',
    'emergency', 'pending', 15, 'عاجل: نحتاج سرنجات الحاقن الآلي وأفلام 10×12 في أسرع وقت',
    '', '', '', 0,
    log3, 2, 7, formatLocalOffset(0, 0, 12), formatLocalOffset(0, 0, 12)
  );
  insertItem.run(r3.lastInsertRowid, 6, 'سرنجات حقن أوتوماتيك 200 مل + لاين', 'طقم', 'مستلزمات طبية', 3, '💉');
  insertItem.run(r3.lastInsertRowid, 2, 'أفلام أشعة ديجيتال 10×12 (أجفا)', 'علبة', 'أفلام أشعة', 4, '🎞️');

  // Sample Order 4: Delivered yesterday for Center 1
  const log4 = JSON.stringify([
    { status: 'pending', label: 'تم استلام طلب التوريد', time: formatLocalOffset(1, 5, 0), note: 'تم التسجيل' },
    { status: 'approved', label: 'تم اعتماد الطلب وحجز الكميات', time: formatLocalOffset(1, 4, 30), note: 'تم الاعتماد' },
    { status: 'preparing', label: 'جاري تجهيز وتعبئة المهمة', time: formatLocalOffset(1, 3, 50), note: 'تم التجهيز' },
    { status: 'dispatched', label: 'المندوب في الطريق للمركز', time: formatLocalOffset(1, 3, 0), note: 'مع المندوب كريم عادل' },
    { status: 'delivered', label: 'تم التسليم بنجاح', time: formatLocalOffset(1, 2, 15), note: 'تم الاستلام والتوقيع من مدير المركز' }
  ]);
  const r4 = insertOrder.run(
    'EM-2598', 1, 'مركز سما سكان للأشعة', 'فرع حلمية الزيتون', 'د. محمود صابر', '01012345678',
    'normal', 'delivered', 100, 'توريد أوراق تقارير ومواد تعقيم',
    'تم التسليم بالكامل بدون نواقص', 'كريم عادل', '01033445566', 0,
    log4, 2, 11, formatLocalOffset(1, 5, 0), formatLocalOffset(1, 2, 15)
  );
  insertItem.run(r4.lastInsertRowid, 8, 'ورق تقارير طبية فاخر A4 (مطبوع)', 'رزمة', 'مطبوعات وأكياس', 5, '📄');
  insertItem.run(r4.lastInsertRowid, 10, 'كحول طبي إيثيلي 70% للتعقيم (لتر)', 'عبوة', 'تعقيم ونظافة', 6, '🧼');

  // Seed QR scan logs over the past 14 days for realistic chart analytics
  const insertScan = db.prepare('INSERT INTO qr_scans (center_id, scanned_at, user_agent) VALUES (?, ?, ?)');
  const scanPattern = [9, 6, 11, 8, 14, 10, 7, 13, 9, 12, 6, 8, 5, 7];
  scanPattern.forEach((count, dayIdx) => {
    for (let i = 0; i < count; i++) {
      const cId = (i % 4) + 1;
      const hourOffset = Math.floor((i / Math.max(count, 1)) * 12) + 1;
      insertScan.run(cId, formatLocalOffset(dayIdx, hourOffset, (i * 17) % 59), 'Mobile Safari / QR Scanner');
    }
  });
}

seedIfEmpty();

module.exports = { db, formatLocalOffset };
