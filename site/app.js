import { createCatalog, filterCatalog, getFilterOptions } from './catalog.js';

const PAGE_SIZE = 24;
const state = {
  catalog: null,
  query: '',
  rarity: '',
  series: '',
  view: 'physical',
  visible: PAGE_SIZE,
};

const elements = {
  filters: document.querySelector('#filters'),
  grid: document.querySelector('#catalog-grid'),
  loadMore: document.querySelector('#load-more'),
  rarity: document.querySelector('#rarity'),
  resultCount: document.querySelector('#result-count'),
  search: document.querySelector('#search'),
  series: document.querySelector('#series'),
  status: document.querySelector('#catalog-status'),
  viewButtons: [...document.querySelectorAll('[data-view]')],
};

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
  })[character]);
}

function safeSourceLink(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

function safeImagePath(value) {
  return value.startsWith('assets/images/virtual-garage/') ? value : '';
}

function rarityClass(rarity) {
  return `rarity-${rarity.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}

function metadata(label, value) {
  if (!value) return '';
  return `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`;
}

function renderPhysicalCard(item) {
  const loose = safeImagePath(item.images.loose);
  const carded = safeImagePath(item.images.carded);
  const primary = loose || carded;
  const source = safeSourceLink(item.sourceUrl);
  const title = source
    ? `<a href="${escapeHtml(source)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.castingName)} <span aria-hidden="true">↗</span></a>`
    : escapeHtml(item.castingName);
  const switches = [
    loose && { label: '散装', path: loose },
    carded && { label: item.type === 'completion' ? '盒装' : '卡装', path: carded },
  ].filter(Boolean);

  return `
    <article class="car-card">
      <div class="car-media${primary ? '' : ' no-image'}">
        ${primary ? `<img src="${escapeHtml(primary)}" alt="${escapeHtml(item.castingName)}" loading="lazy" decoding="async">` : ''}
        ${switches.length > 1 ? `<div class="image-switch" role="group" aria-label="${escapeHtml(item.castingName)} 图片">
          ${switches.map((entry, index) => `<button type="button" data-image-path="${escapeHtml(entry.path)}" aria-pressed="${index === 0}">${entry.label}</button>`).join('')}
        </div>` : ''}
      </div>
      <div class="car-body">
        <div class="card-topline">
          <span class="series-label">${escapeHtml(item.series)} · ${escapeHtml(item.cardId)}</span>
          <span class="rarity ${rarityClass(item.rarity)}">${escapeHtml(item.rarity)}</span>
        </div>
        <h3>${title}</h3>
        <dl class="metadata">
          ${metadata('Toy #', item.toyNumber)}
          ${metadata('数量', item.quantity)}
          ${metadata('颜色', item.color)}
          ${metadata('轮毂', item.wheelType)}
        </dl>
      </div>
    </article>`;
}

function renderCollectibleCard(item) {
  return `
    <article class="collectible-card">
      <span class="collectible-id">${escapeHtml(item.cardId)}</span>
      <div>
        <span class="series-label">${escapeHtml(item.series)}</span>
        <h3>${escapeHtml(item.castingName)}</h3>
        <p>${escapeHtml(item.segment || '未标注分组')}</p>
      </div>
      <span class="rarity ${rarityClass(item.rarity)}">${escapeHtml(item.rarity)}</span>
    </article>`;
}

function activeItems() {
  return state.catalog[state.view];
}

function updateOptions() {
  const options = getFilterOptions(activeItems());
  const fill = (select, values, placeholder) => {
    select.innerHTML = `<option value="">${placeholder}</option>${values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('')}`;
  };
  fill(elements.series, options.series, '全部系列');
  fill(elements.rarity, options.rarities, '全部稀有度');
}

function render() {
  const filtered = filterCatalog(activeItems(), state);
  const visibleItems = filtered.slice(0, state.visible);
  elements.grid.dataset.view = state.view;
  elements.grid.innerHTML = visibleItems.length
    ? visibleItems.map(state.view === 'physical' ? renderPhysicalCard : renderCollectibleCard).join('')
    : '<div class="empty-state"><strong>车库里没有匹配项</strong><p>换个关键词或重置筛选后再试。</p></div>';
  elements.grid.setAttribute('aria-busy', 'false');
  elements.resultCount.textContent = `找到 ${filtered.length.toLocaleString('zh-CN')} 条 · 已显示 ${visibleItems.length.toLocaleString('zh-CN')} 条`;
  elements.loadMore.hidden = visibleItems.length >= filtered.length;
}

function resetFilters() {
  state.query = '';
  state.rarity = '';
  state.series = '';
  state.visible = PAGE_SIZE;
  elements.search.value = '';
  elements.series.value = '';
  elements.rarity.value = '';
}

function switchView(view) {
  state.view = view;
  resetFilters();
  for (const button of elements.viewButtons) {
    const active = button.dataset.view === view;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  }
  updateOptions();
  render();
}

function bindEvents() {
  elements.filters.addEventListener('input', () => {
    state.query = elements.search.value;
    state.series = elements.series.value;
    state.rarity = elements.rarity.value;
    state.visible = PAGE_SIZE;
    render();
  });
  elements.filters.addEventListener('reset', () => {
    setTimeout(() => {
      resetFilters();
      render();
    });
  });
  elements.loadMore.addEventListener('click', () => {
    state.visible += PAGE_SIZE;
    render();
  });
  for (const button of elements.viewButtons) {
    button.addEventListener('click', () => switchView(button.dataset.view));
  }
  elements.grid.addEventListener('click', (event) => {
    const button = event.target.closest('[data-image-path]');
    if (!button) return;
    const media = button.closest('.car-media');
    media.querySelector('img').src = button.dataset.imagePath;
    for (const sibling of media.querySelectorAll('[data-image-path]')) {
      sibling.setAttribute('aria-pressed', String(sibling === button));
    }
  });
  elements.grid.addEventListener('error', (event) => {
    if (event.target.tagName !== 'IMG') return;
    event.target.closest('.car-media').classList.add('no-image');
    event.target.remove();
  }, true);
}

async function start() {
  try {
    const response = await fetch('./data/virtual-garage.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.catalog = createCatalog(await response.json());
    document.querySelector('[data-scraped-at]').textContent = new Intl.DateTimeFormat('zh-CN', {
      dateStyle: 'medium', timeZone: 'Asia/Shanghai',
    }).format(new Date(state.catalog.scrapedAt));
    for (const [key, value] of Object.entries(state.catalog.stats)) {
      const target = document.querySelector(`[data-stat="${key}"]`);
      if (target) target.textContent = value.toLocaleString('zh-CN');
    }
    const source = safeSourceLink(state.catalog.sourceUrl);
    if (source) document.querySelector('[data-source-link]').href = source;
    elements.status.hidden = true;
    updateOptions();
    bindEvents();
    render();
  } catch (error) {
    elements.grid.setAttribute('aria-busy', 'false');
    elements.status.innerHTML = `<strong>档案读取失败。</strong>&nbsp;${escapeHtml(error.message)}`;
    elements.resultCount.textContent = '无法显示目录';
  }
}

start();
