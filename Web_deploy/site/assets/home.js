let INDEX = null;

function sparkline(values, color) {
  const v = values.filter((x) => x != null);
  const min = Math.min(...v), max = Math.max(...v), w = 200, h = 40;
  const pts = v.map((y, i) => `${(i / (v.length - 1)) * w},${h - 3 - ((y - min) / (max - min || 1)) * (h - 6)}`);
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  path.setAttribute('points', pts.join(' '));
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', color);
  path.setAttribute('stroke-width', '2');
  path.setAttribute('vector-effect', 'non-scaling-stroke');
  svg.append(path);
  return svg;
}

function renderHome() {
  const cards = document.getElementById('assetCards');
  const models = document.getElementById('modelCards');
  models.replaceChildren(...MODELS.map((m, i) => el('div', { class: 'card mcard reveal-item', style: `--dot:var(--m-${m});--i:${i + 2}` },
    el('h3', {}, el('i'), MODEL_LABEL[m]), el('p', {}, t(`m_${m}`)))));
  if (!INDEX) return;
  document.getElementById('updated').textContent = `${t('data_through')} ${fmtDate(Object.values(INDEX.assets)[0]?.last_date)}`;
  cards.replaceChildren(...ASSET_ORDER.filter((k) => INDEX.assets[k]).map((k) => {
    const a = INDEX.assets[k];
    const ch = a.change_pct;
    return el('a', { class: 'card acard', href: `dashboard.html#asset=${k}` },
      el('div', { class: 't1' }, el('span', {}, a.pair), el('span', { class: `num ${ch >= 0 ? 'up' : 'down'}`, style: 'font-size:13px' }, `${ch >= 0 ? '▲' : '▼'} ${fmtPct(ch)}`)),
      el('div', { class: 'px num' }, fmtPrice(a.last_close, a.decimals)),
      el('div', { class: 'muted', style: 'font-size:12px' }, `${assetName(a)} · ${a.unit}`),
      sparkline(a.spark, cssVar('--ink-2')));
  }));
}

// Fade sections in as they scroll into view; content stays visible if the observer is unavailable.
function initReveal() {
  if (!('IntersectionObserver' in window)) return;
  document.documentElement.classList.add('js-reveal');
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
  document.querySelectorAll('.section').forEach((s) => io.observe(s));
}

initReveal();
initChrome(renderHome);
renderHome();
getJSON('data/index.json').then((d) => { INDEX = d; renderHome(); })
  .catch(() => { document.getElementById('assetCards').replaceChildren(el('div', { class: 'empty' }, t('load_fail'))); });
