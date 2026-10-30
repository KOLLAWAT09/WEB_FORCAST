const HORIZONS = [1, 3, 5, 7, 14, 21, 30];
const RANGES = [['1M', 22], ['3M', 66], ['6M', 130], ['1Y', 260], ['ALL', Infinity]];

// Nothing is preselected: results appear once the user picks an asset, models and a horizon.
const state = { asset: null, models: new Set(), h: null, range: '6M', type: 'candle' };
const cache = {};
let D = null;
const charts = {};

// ---------- state <-> URL hash
function readHash() {
  const p = new URLSearchParams(location.hash.slice(1));
  if (ASSET_ORDER.includes(p.get('asset'))) state.asset = p.get('asset');
  if (p.get('models')) state.models = new Set(p.get('models').split(',').filter((m) => MODELS.includes(m)));
  const h = Number(p.get('h'));
  if (HORIZONS.includes(h)) state.h = h;
}
function writeHash() {
  const p = new URLSearchParams();
  if (state.asset) p.set('asset', state.asset);
  if (state.models.size) p.set('models', MODELS.filter((m) => state.models.has(m)).join(','));
  if (state.h) p.set('h', state.h);
  history.replaceState(null, '', p.toString() ? `#${p}` : location.pathname + location.search);
}
const ready = () => Boolean(state.asset && D && state.models.size && state.h);

// ---------- controls
function segButtons(container, items, current, onPick) {
  container.replaceChildren(...items.map(([value, label]) => el('button', {
    type: 'button', 'aria-pressed': String(value === current), onclick: () => onPick(value),
  }, label)));
}
function clearSelection() {
  state.asset = null;
  state.models.clear();
  state.h = null;
  D = null;
  const status = document.getElementById('status');
  status.hidden = true;
  renderAll();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderControls() {
  document.getElementById('clearBtn').disabled = !(state.asset || state.models.size || state.h);
  segButtons(document.getElementById('assetSeg'),
    ASSET_ORDER.map((k) => [k, cache[k]?.pair ?? { BTC: 'BTC/USD', SNP: 'S&P 500', USD: 'USD/EUR', WTI: 'WTI/USD', XAU: 'XAU/USD' }[k]]),
    state.asset, (v) => { state.asset = v; load(); });
  const chips = document.getElementById('modelChips');
  chips.replaceChildren(...MODELS.map((m) => el('button', {
    type: 'button', class: 'chip', style: `--dot:var(--m-${m})`, 'aria-pressed': String(state.models.has(m)),
    onclick: () => { state.models.has(m) ? state.models.delete(m) : state.models.add(m); renderAll(); },
  }, el('span', { class: 'dot' }), MODEL_LABEL[m])));
  segButtons(document.getElementById('hSeg'), HORIZONS.map((h) => [h, `h=${h}`]), state.h,
    (v) => { state.h = v; renderAll(); });
  segButtons(document.getElementById('rangeSeg'), RANGES.map(([k]) => [k, k === 'ALL' ? t('range_all') : k]), state.range,
    (v) => { state.range = v; renderControls(); renderMarket(); });
  segButtons(document.getElementById('typeSeg'), [['candle', t('candle')], ['line', t('line')]], state.type,
    (v) => { state.type = v; renderControls(); renderMarket(); });
}

// ---------- helpers
const selected = () => MODELS.filter((m) => state.models.has(m) && D?.models[m]);
const stepWord = () => (D.calendar === 'D' ? t('steps_d') : t('steps_b'));
const metricAt = (m, h) => D.models[m].metrics.find((x) => x.h === h);
const fmtP = (v) => fmtPrice(v, D.decimals);

function chartBase() {
  const ink2 = cssVar('--ink-2'), muted = cssVar('--muted'), grid = cssVar('--grid'), axis = cssVar('--axis');
  return {
    animation: false,
    textStyle: { fontFamily: cssVar('--font') || 'system-ui', color: ink2 },
    grid: { left: 64, right: 20, top: 16, bottom: 64 },
    tooltip: {
      trigger: 'axis', confine: true,
      axisPointer: { type: 'line', lineStyle: { color: muted, width: 1 } },
      backgroundColor: cssVar('--surface'), borderColor: cssVar('--border'), textStyle: { color: cssVar('--ink'), fontSize: 13 },
    },
    axisCommon: {
      axisLine: { lineStyle: { color: axis } }, axisTick: { show: false },
      axisLabel: { color: muted, fontSize: 12 }, splitLine: { lineStyle: { color: grid } },
    },
  };
}
function zoomStyle() {
  return {
    type: 'slider', height: 22, bottom: 14, borderColor: cssVar('--border'), backgroundColor: 'transparent',
    fillerColor: 'rgba(42,120,214,0.12)', dataBackground: { lineStyle: { color: cssVar('--axis') }, areaStyle: { color: 'transparent' } },
    handleStyle: { color: cssVar('--surface'), borderColor: cssVar('--muted') }, textStyle: { color: cssVar('--muted') },
    labelFormatter: '',
  };
}
const insideZoom = { type: 'inside', zoomOnMouseWheel: 'ctrl', moveOnMouseWheel: false, moveOnMouseMove: true };
function axisPrice(v) {
  const span = Math.abs(v);
  const d = span >= 1000 ? 0 : D.decimals;
  return Number(v).toLocaleString(LANG === 'th' ? 'th-TH' : 'en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}
function chart(id) {
  if (!charts[id]) charts[id] = echarts.init(document.getElementById(id), null, { renderer: 'canvas' });
  return charts[id];
}
function tooltipRows(params, fmt) {
  const seen = new Set();
  const rows = params.filter((p) => p.value != null && p.seriesName && !p.seriesName.startsWith('_') && !seen.has(p.seriesName) && seen.add(p.seriesName));
  if (!rows.length) return '';
  const head = rows[0].axisValueLabel ?? '';
  const date = /^\d{4}-\d{2}-\d{2}/.test(head) ? fmtDate(head.slice(0, 10)) : head;
  const ink = cssVar('--ink'), ink2 = cssVar('--ink-2');
  return `<div style="font-size:12px;color:${ink2};margin-bottom:4px">${date}</div>` + rows.map((p) => {
    const v = Array.isArray(p.value) ? p.value[p.value.length - 1] : p.value;
    return `<div style="display:flex;gap:10px;justify-content:space-between;align-items:center">
      <span style="color:${ink2}">${p.marker}${p.seriesName}</span><strong style="color:${ink};font-variant-numeric:tabular-nums">${fmt(v)}</strong></div>`;
  }).join('');
}

// ---------- tiles
function renderTiles() {
  const p = D.prices, n = p.close.length;
  const last = p.close[n - 1], prev = p.close[n - 2], ch = (last / prev - 1) * 100;
  const tiles = [el('div', { class: 'card tile' },
    el('div', { class: 'k' }, `${t('last_close')} · ${D.pair}`),
    el('div', { class: 'v num' }, fmtP(last)),
    el('div', { class: 's' }, el('span', { class: ch >= 0 ? 'up' : 'down' }, `${ch >= 0 ? '▲' : '▼'} ${fmtPct(ch)}`), ` · ${fmtDate(D.last_date)}`))];
  for (const m of selected()) {
    const r = D.models[m], fc = r.future.forecast[state.h - 1];
    const mt = metricAt(m, state.h), diff = (fc / last - 1) * 100;
    tiles.push(el('div', { class: 'card tile', style: `--dot:var(--m-${m})` },
      el('div', { class: 'k' }, el('span', { class: 'dot' }), `${MODEL_LABEL[m]} · ${fmtDate(D.future_dates[state.h - 1], { day: 'numeric', month: 'short' })}`),
      el('div', { class: 'v num' }, fmtP(fc)),
      el('div', { class: 's' }, el('span', { class: diff > 0.005 ? 'up' : diff < -0.005 ? 'down' : 'ink2' }, fmtPct(diff)), ` ${t('vs_last')} · MAPE ${fmtPct(mt?.mape, 2, false)}`)));
  }
  if (!selected().length) tiles.push(el('div', { class: 'card tile muted' }, t('pick_model')));
  document.getElementById('tiles').replaceChildren(...tiles);
}

// ---------- market chart
function renderMarket() {
  const p = D.prices, n = p.date.length, base = chartBase();
  const lookback = RANGES.find(([k]) => k === state.range)[1];
  const start = Math.max(0, n - Math.min(n, lookback));
  document.getElementById('marketSub').textContent = `${t('market_sub')} · ${t('unit')}: ${D.unit} · ${t('source')}`;
  const up = cssVar('--candle-up'), down = cssVar('--candle-down');
  const series = state.type === 'candle'
    ? [{ name: D.pair, type: 'candlestick', data: p.date.map((_, i) => [p.open[i], p.close[i], p.low[i], p.high[i]]),
        itemStyle: { color: up, color0: down, borderColor: up, borderColor0: down } }]
    : [{ name: t('actual'), type: 'line', data: p.close, showSymbol: false, lineStyle: { width: 2, color: cssVar('--ink') }, itemStyle: { color: cssVar('--ink') } }];
  chart('marketChart').setOption({
    ...base,
    tooltip: { ...base.tooltip, formatter: (ps) => {
      const i = ps[0].dataIndex;
      const rows = state.type === 'candle'
        ? [['O', p.open[i]], ['H', p.high[i]], ['L', p.low[i]], ['C', p.close[i]]]
        : [[t('actual'), p.close[i]]];
      return `<div style="font-size:12px;color:${cssVar('--ink-2')};margin-bottom:4px">${fmtDate(p.date[i])}</div>` +
        rows.map(([k, v]) => `<div style="display:flex;gap:16px;justify-content:space-between"><span>${k}</span><strong style="font-variant-numeric:tabular-nums">${fmtP(v)}</strong></div>`).join('');
    } },
    xAxis: { type: 'category', data: p.date, boundaryGap: true, ...base.axisCommon, splitLine: { show: false },
      axisLabel: { ...base.axisCommon.axisLabel, hideOverlap: true, formatter: (v) => fmtDate(v, state.range === 'ALL' || state.range === '1Y' ? { month: 'short', year: '2-digit' } : { day: 'numeric', month: 'short' }) } },
    yAxis: { type: 'value', scale: true, ...base.axisCommon, axisLabel: { ...base.axisCommon.axisLabel, formatter: axisPrice } },
    dataZoom: [{ ...insideZoom, startValue: start, endValue: n - 1 }, { ...zoomStyle(), startValue: start, endValue: n - 1 }],
    series,
  }, true);
}

// ---------- prediction chart
function renderPrediction() {
  const p = D.prices, n = p.date.length, h = state.h, base = chartBase(), ms = selected();
  const ink = cssVar('--ink');
  const firstTest = Math.min(...Object.values(D.models).map((r) => r.test[String(h)]?.first_origin ?? n));
  const from = Math.max(0, firstTest - 60);
  const series = [{
    name: t('actual'), type: 'line', showSymbol: false, z: 5,
    data: p.date.slice(from).map((d, i) => [d, p.close[from + i]]),
    lineStyle: { width: 2, color: ink }, itemStyle: { color: ink },
    markLine: { silent: true, symbol: 'none', label: { color: cssVar('--muted'), fontSize: 11, formatter: '{b}' },
      lineStyle: { color: cssVar('--axis'), type: 'dashed', width: 1 },
      data: [{ name: t('test_start'), xAxis: p.date[firstTest] }, { name: t('today'), xAxis: D.last_date }] },
  }];
  const legend = [el('span', { style: `--c:${ink}` }, el('i'), t('actual'))];
  for (const m of ms) {
    const r = D.models[m], c = cssVar(`--m-${m}`), test = r.test[String(h)];
    const name = MODEL_LABEL[m];
    if (test) series.push({ name, type: 'line', showSymbol: false, data: test.forecast.map((v, i) => [p.date[test.first_origin + i + h], v]),
      lineStyle: { width: 1.6, color: c }, itemStyle: { color: c } });
    series.push({ name: `${name} · ${t('future')}`, type: 'line', showSymbol: false,
      data: [[D.last_date, p.close[n - 1]], ...D.future_dates.map((d, i) => [d, r.future.forecast[i]])],
      lineStyle: { width: 2, type: [5, 4], color: c }, itemStyle: { color: c } });
    legend.push(el('span', { style: `--c:${c}` }, el('i'), name), el('span', { style: `--c:${c}` }, el('i', { class: 'dash' }), `${name} · ${t('future')}`));
  }
  if (ms.length === 1) {
    const r = D.models[ms[0]], c = cssVar(`--m-${ms[0]}`);
    const lo = r.future.lo95, hi = r.future.hi95;
    if (lo.every((v) => v != null)) {
      series.push({ name: '_lo', type: 'line', stack: 'band', symbol: 'none', lineStyle: { opacity: 0 }, tooltip: { show: false },
        data: D.future_dates.map((d, i) => [d, lo[i]]) });
      series.push({ name: '_band', type: 'line', stack: 'band', symbol: 'none', lineStyle: { opacity: 0 }, areaStyle: { color: c, opacity: 0.16 },
        data: D.future_dates.map((d, i) => [d, hi[i] - lo[i]]) });
      legend.push(el('span', { style: `--c:${c}` }, el('i', { class: 'band' }), t('band95')));
    }
  } else if (ms.length > 1) {
    legend.push(el('span', { class: 'muted' }, `· ${t('no_band')}`));
  }
  document.getElementById('predLegend').replaceChildren(...legend);
  const startIdx = Math.max(from, n - 150);
  chart('predChart').setOption({
    ...base,
    tooltip: { ...base.tooltip, formatter: (ps) => {
      let html = tooltipRows(ps, fmtP);
      if (ms.length === 1) {
        const r = D.models[ms[0]], d = ps[0]?.axisValueLabel?.slice(0, 10), j = D.future_dates.indexOf(d);
        if (j >= 0 && r.future.lo95[j] != null) html += `<div style="font-size:12px;color:${cssVar('--muted')};margin-top:4px">${t('band95')}: ${fmtP(r.future.lo95[j])} – ${fmtP(r.future.hi95[j])}</div>`;
      }
      return html;
    } },
    xAxis: { type: 'time', ...base.axisCommon, splitLine: { show: false },
      axisLabel: { ...base.axisCommon.axisLabel, hideOverlap: true, formatter: (v) => fmtDate(new Date(v).toISOString().slice(0, 10), { day: 'numeric', month: 'short' }) } },
    yAxis: { type: 'value', scale: true, ...base.axisCommon, axisLabel: { ...base.axisCommon.axisLabel, formatter: axisPrice } },
    dataZoom: [{ ...insideZoom, startValue: p.date[startIdx] }, { ...zoomStyle(), startValue: p.date[startIdx] }],
    series,
  }, true);
}

// ---------- error by horizon
function renderErrors() {
  const base = chartBase(), ms = selected();
  document.getElementById('errLegend').replaceChildren(...ms.map((m) => el('span', { style: `--c:var(--m-${m})` }, el('i'), MODEL_LABEL[m])));
  chart('errChart').setOption({
    ...base,
    grid: { left: 52, right: 20, top: 16, bottom: 36 },
    tooltip: { ...base.tooltip, formatter: (ps) => tooltipRows(ps.map((x) => ({ ...x, axisValueLabel: `h = ${x.axisValue}` })), (v) => fmtPct(v, 2, false)) },
    xAxis: { type: 'category', data: HORIZONS.map(String), ...base.axisCommon, splitLine: { show: false },
      name: 'h', nameLocation: 'end', nameTextStyle: { color: cssVar('--muted') } },
    yAxis: { type: 'value', ...base.axisCommon, axisLabel: { ...base.axisCommon.axisLabel, formatter: (v) => `${v}%` } },
    series: ms.map((m) => {
      const c = cssVar(`--m-${m}`);
      return { name: MODEL_LABEL[m], type: 'line', symbol: 'circle', symbolSize: 8,
        data: HORIZONS.map((h) => metricAt(m, h)?.mape ?? null), lineStyle: { width: 2, color: c },
        itemStyle: { color: c, borderColor: cssVar('--surface'), borderWidth: 2 } };
    }),
  }, true);
}

// ---------- tables
function renderMetricTable() {
  const ms = selected(), table = document.getElementById('metricTable');
  if (!ms.length) { table.replaceChildren(el('tbody', {}, el('tr', {}, el('td', { class: 'muted' }, t('pick_model'))))); return; }
  const rows = ms.map((m) => ({ m, x: metricAt(m, state.h) }));
  const best = (key, dir) => {
    const vals = rows.map((r) => r.x?.[key]).filter((v) => v != null);
    return vals.length > 1 ? (dir < 0 ? Math.min(...vals) : Math.max(...vals)) : null;
  };
  const b = { mape: best('mape', -1), rmse: best('rmse', -1), da: best('da', 1) };
  const cell = (v, key, fmt) => el('td', {}, fmt(v), v != null && v === b[key] ? el('span', { class: 'best' }, t('best')) : null);
  table.replaceChildren(
    el('thead', {}, el('tr', {}, ...[t('model'), 'MAPE', 'RMSE', t('direction'), t('n_tests')].map((h) => el('th', {}, h)))),
    el('tbody', {}, ...rows.map(({ m, x }) => el('tr', {},
      el('td', {}, el('span', { class: 'mname', style: `--dot:var(--m-${m})` }, el('i'), MODEL_LABEL[m])),
      cell(x?.mape, 'mape', (v) => fmtPct(v, 2, false)),
      cell(x?.rmse, 'rmse', fmtP),
      cell(x?.da, 'da', (v) => (v == null ? '—' : fmtPct(v, 1, false))),
      el('td', {}, x?.n ?? '—')))));
}
function renderFutureTable() {
  const ms = selected(), table = document.getElementById('futureTable');
  if (!ms.length) { table.replaceChildren(); return; }
  table.replaceChildren(
    el('thead', {}, el('tr', {}, el('th', {}, t('date')), el('th', {}, 'h'),
      ...ms.map((m) => el('th', {}, el('span', { class: 'mname', style: `--dot:var(--m-${m})` }, el('i'), MODEL_LABEL[m]))))),
    el('tbody', {}, ...D.future_dates.map((d, i) => el('tr', { style: i + 1 === state.h ? 'background:var(--surface-2);font-weight:600' : '' },
      el('td', {}, fmtDate(d, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })), el('td', {}, i + 1),
      ...ms.map((m) => {
        const r = D.models[m].future;
        return el('td', { title: r.lo95[i] != null ? `${t('band95')}: ${fmtP(r.lo95[i])} – ${fmtP(r.hi95[i])}` : '' }, fmtP(r.forecast[i]));
      })))));
}
function renderInfo() {
  const table = document.getElementById('infoTable');
  table.replaceChildren(
    el('thead', {}, el('tr', {}, ...[t('model'), t('spec'), t('train_period'), t('trained_at')].map((h) => el('th', {}, h)))),
    el('tbody', {}, ...MODELS.filter((m) => D.models[m]).map((m) => {
      const i = D.models[m].info;
      const spec = i.spec ?? (i.lookback ? `${t('lookback')} ${i.lookback} ${t('obs')}` : '—');
      return el('tr', {}, el('td', {}, el('span', { class: 'mname', style: `--dot:var(--m-${m})` }, el('i'), MODEL_LABEL[m])),
        el('td', {}, spec), el('td', {}, `${fmtDate(i.train_start)} – ${fmtDate(i.train_end)}`),
        el('td', {}, fmtDate(i.trained_at.slice(0, 10))));
    })));
  document.getElementById('statusbar').replaceChildren(
    el('span', {}, `${t('data_through')} ${fmtDate(D.last_date)}`),
    el('span', {}, `${t('updated')} ${new Date(D.generated_at).toLocaleString(LANG === 'th' ? 'th-TH' : 'en-GB')}`),
    el('span', {}, `${t('source')} (${D.ticker})`),
    el('span', {}, `h: ${stepWord()}`));
}

function renderGate() {
  const done = { needAsset: Boolean(state.asset), needModels: state.models.size > 0, needH: Boolean(state.h) };
  for (const [id, ok] of Object.entries(done)) {
    const li = document.getElementById(id);
    li.classList.toggle('done', ok);
    li.querySelector('.box').textContent = ok ? '✓' : String(Object.keys(done).indexOf(id) + 1);
  }
  const loading = !document.getElementById('status').hidden;
  document.getElementById('gate').hidden = ready() || loading;
  document.getElementById('content').hidden = !ready();
}

function renderAll() {
  writeHash();
  renderControls();
  renderGate();
  if (!ready()) return;
  renderTiles(); renderMarket(); renderPrediction(); renderErrors();
  renderMetricTable(); renderFutureTable(); renderInfo();
  Object.values(charts).forEach((c) => c.resize());
}

async function load() {
  const status = document.getElementById('status');
  D = state.asset ? cache[state.asset] ?? null : null;
  if (!state.asset || D) { renderAll(); return; }
  const asset = state.asset;
  status.hidden = false; status.textContent = t('loading');
  renderAll();
  try {
    cache[asset] = await getJSON(`data/${asset}.json`);
    status.hidden = true;
    if (state.asset === asset) { D = cache[asset]; renderAll(); }
  } catch (e) {
    console.error(e);
    status.textContent = t('load_fail');
    renderAll();
  }
}

readHash();
document.getElementById('clearBtn').addEventListener('click', clearSelection);
initChrome(renderAll);
window.addEventListener('resize', () => Object.values(charts).forEach((c) => c.resize()));
load();
