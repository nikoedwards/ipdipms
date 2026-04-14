// ============================================================
// IPMS 流程视图 — 第二页：方法论模型库
// ============================================================

(function () {
  const app = document.getElementById('app');

  const CAT_COLORS = {
    market:  'cat-market',
    user:    'cat-user',
    product: 'cat-product',
    gtm:     'cat-gtm',
    pm:      'cat-pm',
    finance: 'cat-finance',
    growth:  'cat-growth',
    quality: 'cat-quality',
  };

  const CAT_NAMES = {};
  CATEGORIES.forEach(c => { CAT_NAMES[c.id] = c.name; });

  let activeCategory = 'all';
  let searchQuery = '';

  function getFiltered() {
    return MODELS.filter(m => {
      const matchCat = activeCategory === 'all' || m.category === activeCategory;
      const q = searchQuery.toLowerCase();
      const matchSearch = !q ||
        m.name.toLowerCase().includes(q) ||
        (m.nameEn || '').toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q) ||
        (m.tags || []).some(t => t.toLowerCase().includes(q));
      return matchCat && matchSearch;
    });
  }

  function renderCard(model) {
    const catClass = CAT_COLORS[model.category] || '';
    const catName  = CAT_NAMES[model.category] || model.category;

    const stages = (model.stages || []).map(sid => {
      const s = STAGES.find(x => x.id === sid);
      return s ? `<span class="fw-stage-chip">${s.code}</span>` : '';
    }).join('');

    const tags = (model.tags || []).map(t =>
      `<span class="fw-tag">${t}</span>`
    ).join('');

    const card = document.createElement('div');
    card.className = 'fw-card';
    card.innerHTML = `
      <div class="fw-card-top">
        <div class="fw-card-names">
          <div class="fw-card-name">${model.name}</div>
          <div class="fw-card-name-en">${model.nameEn || ''}</div>
        </div>
        <span class="fw-cat-badge ${catClass}">${catName}</span>
      </div>
      <p class="fw-card-desc">${model.description}</p>
      ${model.howToUse ? `
        <div class="fw-card-section-title">如何使用</div>
        <div class="fw-card-how">${model.howToUse}</div>
      ` : ''}
      ${model.example ? `
        <div class="fw-card-section-title">示例</div>
        <div class="fw-card-example">${model.example}</div>
      ` : ''}
      <div class="fw-card-meta">
        ${stages ? `<div class="fw-card-stages">${stages}</div>` : ''}
        <div class="fw-card-tags">${tags}</div>
      </div>
    `;
    return card;
  }

  function renderGrid(container) {
    container.innerHTML = '';
    const filtered = getFiltered();
    if (filtered.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'fw-empty';
      empty.textContent = '没有找到匹配的模型，试试其他关键词。';
      container.appendChild(empty);
      return;
    }
    filtered.forEach(m => container.appendChild(renderCard(m)));
  }

  function render() {
    const page = document.createElement('div');
    page.className = 'page';

    // Header
    const header = document.createElement('div');
    header.className = 'fw-header';
    header.innerHTML = `
      <div class="page-title">方法论模型库</div>
      <div class="page-subtitle">覆盖 IPD & IPMS 全链路的核心工具与框架，按阶段和职能分类整理</div>
    `;
    page.appendChild(header);

    // Search + count row
    const searchWrap = document.createElement('div');
    searchWrap.className = 'fw-search-wrap';

    const searchInput = document.createElement('input');
    searchInput.className = 'fw-search';
    searchInput.type = 'text';
    searchInput.placeholder = '搜索模型名称、分类、标签…';

    const countEl = document.createElement('span');
    countEl.className = 'fw-count';
    countEl.textContent = `共 ${MODELS.length} 个模型`;

    searchWrap.appendChild(searchInput);
    searchWrap.appendChild(countEl);
    page.appendChild(searchWrap);

    // Filter bar
    const filterBar = document.createElement('div');
    filterBar.className = 'fw-filters';
    filterBar.style.marginBottom = '20px';

    CATEGORIES.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = `fw-filter-btn${cat.id === 'all' ? ' active' : ''}`;
      btn.textContent = cat.id === 'all' ? `${cat.name} (${MODELS.length})` : `${cat.name} (${MODELS.filter(m => m.category === cat.id).length})`;
      btn.dataset.cat = cat.id;
      btn.addEventListener('click', () => {
        activeCategory = cat.id;
        filterBar.querySelectorAll('.fw-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderGrid(grid);
        countEl.textContent = `共 ${getFiltered().length} 个模型`;
      });
      filterBar.appendChild(btn);
    });
    page.appendChild(filterBar);

    // Grid
    const grid = document.createElement('div');
    grid.className = 'fw-grid';
    renderGrid(grid);
    page.appendChild(grid);

    // Search event
    searchInput.addEventListener('input', () => {
      searchQuery = searchInput.value;
      renderGrid(grid);
      countEl.textContent = `共 ${getFiltered().length} 个模型`;
    });

    app.appendChild(page);
  }

  render();
})();
