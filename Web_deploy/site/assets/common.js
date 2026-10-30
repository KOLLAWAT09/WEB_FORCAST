// Shared language, theme and formatting helpers for both pages.
const MODELS = ['ARIMA', 'SVR', 'XGBOOST', 'LSTM', 'TRANSFORMER'];
const ASSET_ORDER = ['BTC', 'SNP', 'USD', 'WTI', 'XAU'];
const MODEL_LABEL = { ARIMA: 'ARIMA', SVR: 'SVR', XGBOOST: 'XGBoost', LSTM: 'LSTM', TRANSFORMER: 'Transformer' };

const I18N = {
  th: {
    nav_guide: 'วิธีใช้งาน', nav_dash: 'แดชบอร์ด', lang: 'EN', theme: 'ธีม',
    hero_title: 'พยากรณ์ราคา 5 สินทรัพย์\nด้วย 5 โมเดล',
    hero_lead: 'ดูราคาตลาดล่าสุด ราคาที่โมเดลคำนวณล่วงหน้า 1–30 วัน และความแม่นยำที่วัดจากข้อมูลจริง เลือกสินทรัพย์ เลือกโมเดล และเปรียบเทียบได้ในหน้าเดียว',
    enter: 'เข้าสู่แดชบอร์ด', read_guide: 'อ่านวิธีใช้งาน',
    latest_prices: 'ราคาล่าสุด', updated: 'อัปเดต', data_through: 'ข้อมูลถึงวันที่',
    how_title: 'วิธีใช้งาน', how_sub: 'ใช้งานได้ใน 4 ขั้นตอน',
    s1_t: 'เลือกสินทรัพย์', s1_p: 'Bitcoin, S&P 500, USD/EUR, น้ำมัน WTI หรือทองคำ จากแถบด้านบนของแดชบอร์ด',
    s2_t: 'เลือกโมเดล', s2_p: 'กดเปิด/ปิดโมเดลได้หลายตัวพร้อมกัน เพื่อเปรียบเทียบบนกราฟและตารางเดียวกัน',
    s3_t: 'เลือกระยะพยากรณ์', s3_p: 'h = จำนวนวันทำการข้างหน้า (BTC นับวันปฏิทินเพราะซื้อขายทุกวัน) ตั้งแต่ 1 ถึง 30',
    s4_t: 'อ่านผล', s4_p: 'ดูราคาที่คาดการณ์ ช่วงความไม่แน่นอน 95% และค่าความคลาดเคลื่อนจากช่วงทดสอบ ก่อนตัดสินใจ',
    models_title: 'โมเดลที่ใช้', models_sub: 'ทุกโมเดล train บนข้อมูล 80% แรก แล้ววัดผลกับ 20% หลังที่โมเดลไม่เคยเห็น',
    m_ARIMA: 'โมเดลสถิติคลาสสิก เลือก (p,d,q) จาก AIC และตรวจ residual ด้วย Ljung–Box ให้ช่วงพยากรณ์ที่ตีความได้ง่าย',
    m_SVR: 'Support Vector Regression แบบ RBF แยกโมเดลต่อระยะพยากรณ์ ใช้ผลตอบแทนย้อนหลังเป็น input',
    m_XGBOOST: 'Gradient boosted trees แยกโมเดลต่อระยะพยากรณ์ จับความสัมพันธ์ไม่เชิงเส้นของผลตอบแทนย้อนหลัง',
    m_LSTM: 'Recurrent neural network 2 ชั้น (64→32) พยากรณ์ 30 วันพร้อมกัน เฉลี่ยจาก 5 seeds',
    m_TRANSFORMER: 'PatchTST แบ่งข้อมูลเป็น patch แล้วใช้ self-attention พยากรณ์ 30 วันพร้อมกัน เฉลี่ยจาก 5 seeds',
    gloss_title: 'อ่านค่าความแม่นยำอย่างไร',
    g_mape: 'MAPE', g_mape_p: 'ความคลาดเคลื่อนเฉลี่ยเป็น % ของราคาจริง ยิ่งต่ำยิ่งดี เช่น 1.5% หมายถึงพลาดเฉลี่ย 1.5%',
    g_rmse: 'RMSE', g_rmse_p: 'ความคลาดเคลื่อนในหน่วยราคา ให้น้ำหนักกับการพลาดมากๆ สูง ยิ่งต่ำยิ่งดี',
    g_da: 'ทายทิศทางถูก', g_da_p: 'สัดส่วนครั้งที่โมเดลบอกขึ้น/ลงตรงกับที่เกิดจริง 50% ≈ เดาสุ่ม',
    g_band: 'ช่วง 95%', g_band_p: 'ช่วงที่ราคาจริงตกอยู่ 95% ของครั้งในช่วงทดสอบ คำนวณจากความคลาดเคลื่อนจริงของโมเดลนั้น',
    data_title: 'ข้อมูลและการอัปเดต',
    data_p: 'ราคาปิดรายวันจาก Yahoo Finance ตั้งแต่ 1 ก.ค. 2021 ระบบดึงข้อมูลและพยากรณ์ใหม่ทุกวัน และ retrain ทุกโมเดลทุกสัปดาห์ ช่วงทดสอบจะยาวขึ้นทุกวันเพราะมีราคาจริงใหม่มาเทียบ',
    disclaimer: 'เว็บไซต์นี้จัดทำเพื่อการศึกษา ไม่ใช่คำแนะนำการลงทุน โมเดลไม่รู้ข่าว นโยบาย หรือเหตุการณ์ที่ไม่คาดคิด ผลในอดีตไม่รับประกันผลในอนาคต',
    disclaimer_t: 'ข้อควรทราบ',
    f_asset: 'สินทรัพย์', f_models: 'โมเดล (เลือกได้หลายตัว)', f_h: 'ระยะพยากรณ์',
    last_close: 'ราคาปิดล่าสุด', fc_for: 'พยากรณ์', ahead: 'ล่วงหน้า', steps_b: 'วันทำการ', steps_d: 'วัน',
    vs_last: 'จากราคาล่าสุด', mape_at: 'MAPE',
    market_chart: 'กราฟราคาตลาด', market_sub: 'ราคาจริงรายวัน',
    candle: 'แท่งเทียน', line: 'เส้น',
    pred_chart: 'กราฟพยากรณ์ของโมเดล', pred_sub: 'ช่วงทดสอบ: ราคาที่โมเดลพยากรณ์ไว้ h วันก่อน เทียบราคาจริง • เส้นประ: พยากรณ์อนาคต 30 วัน',
    actual: 'ราคาจริง', forecast: 'พยากรณ์', future: 'อนาคต', band95: 'ช่วง 95%', test_start: 'เริ่มช่วงทดสอบ', today: 'ล่าสุด',
    compare: 'เปรียบเทียบความแม่นยำ', compare_sub: 'วัดจากช่วงทดสอบที่ระยะ h ที่เลือก • ยิ่งต่ำยิ่งดี ยกเว้น “ทิศทางถูก”',
    model: 'โมเดล', n_tests: 'จำนวนครั้ง', direction: 'ทิศทางถูก', best: 'ดีสุด',
    err_chart: 'ความคลาดเคลื่อนตามระยะพยากรณ์', err_sub: 'MAPE (%) เมื่อพยากรณ์ไกลขึ้น',
    future_table: 'ตารางราคาพยากรณ์ 30 วันข้างหน้า', date: 'วันที่',
    model_info: 'รายละเอียดโมเดล', train_period: 'ช่วงข้อมูล train', trained_at: 'train ล่าสุด', spec: 'ค่าที่เลือก',
    lookback: 'ใช้ข้อมูลย้อนหลัง', obs: 'วัน',
    clear: 'ล้างการเลือก',
    gate_title: 'เลือกข้อมูลที่ต้องการดู', gate_sub: 'เลือกให้ครบ 3 ข้อด้านบน แล้วผลพยากรณ์จะแสดงที่นี่',
    need_asset: 'เลือกสินทรัพย์', need_models: 'เลือกโมเดลอย่างน้อย 1 ตัว', need_h: 'เลือกระยะพยากรณ์',
    pick_model: 'เลือกอย่างน้อย 1 โมเดลเพื่อดูผลพยากรณ์', loading: 'กำลังโหลดข้อมูล…',
    load_fail: 'โหลดข้อมูลไม่สำเร็จ ลองรีเฟรชหน้าเว็บ', no_band: 'ช่วง 95% แสดงเมื่อเลือกโมเดลเดียว',
    source: 'แหล่งข้อมูล: Yahoo Finance', range_all: 'ทั้งหมด', unit: 'หน่วย',
    show_table: 'ดูข้อมูลเป็นตาราง',
  },
  en: {
    nav_guide: 'Guide', nav_dash: 'Dashboard', lang: 'ไทย', theme: 'Theme',
    hero_title: '5 assets,\n5 forecasting models',
    hero_lead: 'See the latest market price, model forecasts 1–30 days ahead, and accuracy measured on real out-of-sample data. Pick an asset, pick models, and compare them on one page.',
    enter: 'Open dashboard', read_guide: 'Read the guide',
    latest_prices: 'Latest prices', updated: 'Updated', data_through: 'Data through',
    how_title: 'How to use it', how_sub: 'Four steps',
    s1_t: 'Pick an asset', s1_p: 'Bitcoin, S&P 500, USD/EUR, WTI crude or gold, from the bar at the top of the dashboard.',
    s2_t: 'Pick models', s2_p: 'Toggle one or several models to compare them on the same chart and table.',
    s3_t: 'Pick a horizon', s3_p: 'h = trading days ahead (calendar days for BTC, which trades every day), from 1 to 30.',
    s4_t: 'Read the result', s4_p: 'Check the forecast price, the 95% range and the test-period error before relying on it.',
    models_title: 'Models', models_sub: 'Every model is trained on the first 80% of history and scored on the last 20% it never saw.',
    m_ARIMA: 'Classical statistical model. (p,d,q) chosen by AIC with Ljung–Box residual checks.',
    m_SVR: 'RBF Support Vector Regression, one model per horizon, lagged returns as input.',
    m_XGBOOST: 'Gradient-boosted trees, one model per horizon, capturing non-linear lag effects.',
    m_LSTM: 'Two-layer recurrent network (64→32) forecasting 30 steps at once, averaged over 5 seeds.',
    m_TRANSFORMER: 'PatchTST: splits the series into patches and uses self-attention; 30 steps at once, 5 seeds.',
    gloss_title: 'Reading the accuracy numbers',
    g_mape: 'MAPE', g_mape_p: 'Average error as a % of the actual price. Lower is better; 1.5% means off by 1.5% on average.',
    g_rmse: 'RMSE', g_rmse_p: 'Error in price units, penalising large misses. Lower is better.',
    g_da: 'Direction hit rate', g_da_p: 'Share of times the predicted up/down move matched reality. 50% ≈ coin flip.',
    g_band: '95% range', g_band_p: 'Range that contained the actual price 95% of the time in the test period, from the model\'s own errors.',
    data_title: 'Data and updates',
    data_p: 'Daily closes from Yahoo Finance since 1 Jul 2021. Data and forecasts refresh every day; all models are retrained weekly. The test period grows daily as new actual prices arrive.',
    disclaimer: 'For education only, not investment advice. Models do not see news, policy or shocks. Past accuracy does not guarantee future results.',
    disclaimer_t: 'Please note',
    f_asset: 'Asset', f_models: 'Models (multi-select)', f_h: 'Horizon',
    last_close: 'Last close', fc_for: 'Forecast', ahead: 'ahead', steps_b: 'trading days', steps_d: 'days',
    vs_last: 'vs last close', mape_at: 'MAPE',
    market_chart: 'Market chart', market_sub: 'Actual daily prices',
    candle: 'Candles', line: 'Line',
    pred_chart: 'Model forecast chart', pred_sub: 'Test period: the price each model forecast h steps earlier vs actual • Dashed: next 30 steps',
    actual: 'Actual', forecast: 'Forecast', future: 'Future', band95: '95% range', test_start: 'Test starts', today: 'Latest',
    compare: 'Accuracy comparison', compare_sub: 'Test period at the selected horizon • lower is better, except direction',
    model: 'Model', n_tests: 'Tests', direction: 'Direction', best: 'Best',
    err_chart: 'Error by horizon', err_sub: 'MAPE (%) as the forecast reaches further',
    future_table: 'Forecast table, next 30 steps', date: 'Date',
    model_info: 'Model details', train_period: 'Training data', trained_at: 'Last trained', spec: 'Selected spec',
    lookback: 'Lookback', obs: 'steps',
    clear: 'Clear selection',
    gate_title: 'Choose what to view', gate_sub: 'Make all 3 selections above and the forecast will appear here',
    need_asset: 'Pick an asset', need_models: 'Pick at least one model', need_h: 'Pick a horizon',
    pick_model: 'Select at least one model to see forecasts', loading: 'Loading data…',
    load_fail: 'Could not load data. Try refreshing.', no_band: 'The 95% range shows when one model is selected',
    source: 'Source: Yahoo Finance', range_all: 'All', unit: 'Unit',
    show_table: 'Show as table',
  },
};

const store = {
  get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } },
};

let LANG = store.get('lang', 'th') === 'en' ? 'en' : 'th';
const t = (key) => (I18N[LANG][key] ?? I18N.th[key] ?? key);

function applyI18n(root = document) {
  document.documentElement.lang = LANG;
  root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
}

function assetName(a) { return LANG === 'th' ? a.name_th : a.name; }

function initChrome(onChange) {
  const theme = store.get('theme', '');
  if (theme) document.documentElement.dataset.theme = theme;
  document.getElementById('langBtn')?.addEventListener('click', () => {
    LANG = LANG === 'th' ? 'en' : 'th';
    store.set('lang', LANG);
    applyI18n();
    onChange?.();
  });
  document.getElementById('themeBtn')?.addEventListener('click', () => {
    const dark = isDark();
    document.documentElement.dataset.theme = dark ? 'light' : 'dark';
    store.set('theme', document.documentElement.dataset.theme);
    onChange?.();
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => onChange?.());
  applyI18n();
}

function isDark() {
  const th = document.documentElement.dataset.theme;
  if (th) return th === 'dark';
  return matchMedia('(prefers-color-scheme: dark)').matches;
}

function cssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

function fmtPrice(v, decimals) {
  if (v == null || !isFinite(v)) return '—';
  return Number(v).toLocaleString(LANG === 'th' ? 'th-TH' : 'en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
function fmtPct(v, d = 2, sign = true) {
  if (v == null || !isFinite(v)) return '—';
  return `${sign && v > 0 ? '+' : ''}${v.toFixed(d)}%`;
}
function fmtDate(s, opts = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!s) return '—';
  const d = new Date(s.length <= 10 ? `${s}T00:00:00` : s);
  return d.toLocaleDateString(LANG === 'th' ? 'th-TH' : 'en-GB', opts);
}
function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v;
    else if (k === 'style') n.style.cssText = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v);
  }
  for (const kid of kids.flat()) if (kid != null) n.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  return n;
}
async function getJSON(url) {
  const r = await fetch(url, { cache: 'no-cache' });
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json();
}
