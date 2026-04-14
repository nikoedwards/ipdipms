// ============================================================
// IPMS 流程视图 — 第一页渲染逻辑
// ============================================================

(function () {
  const app = document.getElementById('app');

  // ── localStorage persistence ─────────────────────────────────
  const STORAGE_KEY = 'ipms-flow-collapsed';

  function loadCollapsed() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
    catch { return {}; }
  }

  function saveCollapsed(id, collapsed) {
    const state = loadCollapsed();
    state[id] = collapsed;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  // ── 顶部 IPD 管理层（4个维度标签）──────────────────────────
  function renderManagementRow() {
    const spans = [2, 1, 2, 2]; // 每个维度占的列数
    const labels = ['IPD & IPMS\n流程视图', '管理 Offering\n与组合', '管理 Idea', '管理研发', '管理产品数据'];
    // 实际上顶部管理层是 corner + 4段，对应 7 列
    // 我们用更简洁的方式：corner占1列，4个管理维度各占若干列
    // corner:1, 管理offering:2, 管理Idea:1, 管理研发:2, 管理产品数据:2 = 1+2+1+2+2 = 8? 不对
    // 总共 role(1) + 7 stage列 = 8列
    // 分配: role(1) + offering(2) + idea(1) + 研发(2) + 产品数据(2) = 8 ✓
    const row = document.createElement('div');
    row.className = 'ipd-mgmt-row';
    row.style.gridColumn = '1 / -1';
    row.style.display = 'grid';
    row.style.gridTemplateColumns = 'var(--col-role) repeat(2,var(--col-stage)) var(--col-stage) repeat(2,var(--col-stage)) repeat(2,var(--col-stage))';

    const defs = [
      { text: '', cols: 1 },
      { text: '管理 Offering 与组合', cols: 2 },
      { text: '管理 Idea', cols: 1 },
      { text: '管理研发', cols: 2 },
      { text: '管理产品数据', cols: 2 },
    ];
    defs.forEach(d => {
      const el = document.createElement('div');
      el.className = 'ipd-mgmt-label';
      if (d.cols > 1) el.style.gridColumn = `span ${d.cols}`;
      el.textContent = d.text;
      row.appendChild(el);
    });
    return row;
  }

  // ── IPD 阶段色带 ─────────────────────────────────────────────
  function renderIPDPhaseRow() {
    const row = document.createElement('div');
    row.className = 'ipd-phase-row';

    // corner
    const corner = document.createElement('div');
    corner.className = 'ipd-phase-corner';
    corner.innerHTML = '<span class="ipd-phase-corner-text">IPD 阶段</span>';
    row.appendChild(corner);

    // phases map to stage indices 0-6 (GR1-GR6)
    // 概念:gr1(0), 计划:gr2(1), 开发验证:gr3+gr4(2,3), 发布:gr5(4), 生命周期:gr5a+gr6(5,6)
    const phases = IPD_PHASES;
    phases.forEach(p => {
      const span = p.endIdx - p.startIdx + 1;
      const cell = document.createElement('div');
      cell.className = 'ipd-phase-cell';
      cell.style.background = p.color;
      cell.style.borderBottom = `3px solid ${p.accent}`;
      if (span > 1) cell.style.gridColumn = `span ${span}`;

      const dot = document.createElement('span');
      dot.className = 'ipd-phase-dot';
      dot.style.background = p.accent;

      const label = document.createElement('span');
      label.style.fontSize = '11px';
      label.style.fontWeight = '600';
      label.style.color = p.accent;
      label.textContent = p.name;

      cell.appendChild(dot);
      cell.appendChild(label);

      if (p.gate) {
        const gate = document.createElement('span');
        gate.className = 'ipd-phase-gate';
        gate.textContent = p.gate;
        cell.appendChild(gate);
      }

      row.appendChild(cell);
    });
    return row;
  }

  // ── GR 阶段列头 ──────────────────────────────────────────────
  function renderStageHeaderRow() {
    const row = document.createElement('div');
    row.className = 'stage-header-row';

    const corner = document.createElement('div');
    corner.className = 'stage-header-corner';
    corner.innerHTML = '<span class="stage-header-corner-text">角色 / 交付物</span>';
    row.appendChild(corner);

    STAGES.forEach(s => {
      const cell = document.createElement('div');
      cell.className = 'stage-header-cell';
      cell.innerHTML = `
        <span class="stage-code">${s.code}</span>
        <span class="stage-name">${s.name}</span>
        <span class="stage-gate">${s.ipdGate}</span>
      `;
      row.appendChild(cell);
    });
    return row;
  }

  // ── 团队区块标题 ─────────────────────────────────────────────
  function renderSectionHeader(type, label, desc) {
    const row = document.createElement('div');
    row.className = 'section-header-row';
    row.style.background = type === 'pdt' ? '#f0f9ff' : '#faf5ff';
    // Stick just below the three frozen header rows
    row.style.position = 'sticky';
    row.style.top = 'calc(var(--hdr-mgmt-h) + var(--hdr-phase-h) + var(--hdr-stage-h))';
    row.style.zIndex = '55';

    const badge = document.createElement('div');
    badge.className = `section-header-badge ${type}`;
    badge.innerHTML = `<span class="section-header-dot"></span>${label}`;

    const descEl = document.createElement('span');
    descEl.className = 'section-header-desc';
    descEl.textContent = desc;

    row.appendChild(badge);
    row.appendChild(descEl);
    return row;
  }

  // ── 角色行 ───────────────────────────────────────────────────
  function renderRoleRow(roleData, accentColor) {
    const fragment = document.createDocumentFragment();
    const stageCells = [];

    // Role cell (sticky left)
    const roleCell = document.createElement('div');
    roleCell.className = `role-cell${roleData.isHighlight ? ' highlight' : ''}`;

    const badge = document.createElement('span');
    badge.className = 'role-badge';
    badge.textContent = roleData.role;
    badge.style.background = roleData.color + '18';
    badge.style.color = roleData.color;

    const name = document.createElement('div');
    name.className = 'role-name';
    name.textContent = roleData.title;
    name.style.color = roleData.isHighlight ? 'var(--mo-accent)' : 'var(--text-primary)';

    const subtitle = document.createElement('div');
    subtitle.className = 'role-subtitle';
    subtitle.textContent = roleData.subtitle;

    // Toggle button — restore saved state immediately after cells are built
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'toggle-btn';
    toggleBtn.title = '折叠/展开';
    toggleBtn.textContent = '▼';

    function applyCollapsed(collapsed) {
      roleCell.classList.toggle('row-collapsed', collapsed);
      stageCells.forEach(c => c.classList.toggle('row-collapsed', collapsed));
      toggleBtn.textContent = collapsed ? '▶' : '▼';
      saveCollapsed(roleData.id, collapsed);
    }

    toggleBtn.addEventListener('click', () => {
      applyCollapsed(!roleCell.classList.contains('row-collapsed'));
    });

    // Will be called after stageCells are populated (see restoreState below)
    roleData._applyCollapsed = applyCollapsed;

    roleCell.appendChild(badge);
    roleCell.appendChild(name);
    roleCell.appendChild(subtitle);
    roleCell.appendChild(toggleBtn);
    fragment.appendChild(roleCell);

    // Stage cells
    STAGES.forEach(s => {
      const stageData = roleData.stages[s.id] || { deliverables: [], models: [] };
      const cell = document.createElement('div');
      cell.className = `stage-cell${roleData.isHighlight ? ' highlight' : ''}`;
      stageCells.push(cell);

      // Deliverables
      if (stageData.deliverables.length > 0) {
        const ul = document.createElement('ul');
        ul.className = 'deliverable-list';
        stageData.deliverables.forEach(d => {
          const li = document.createElement('li');
          li.className = 'deliverable-item';
          li.innerHTML = `<span class="deliverable-bullet" style="background:${roleData.color}"></span><span>${d}</span>`;
          ul.appendChild(li);
        });
        cell.appendChild(ul);
      }

      // Model tags
      if (stageData.models && stageData.models.length > 0) {
        const tagsWrap = document.createElement('div');
        tagsWrap.className = 'model-tags';
        stageData.models.forEach(m => {
          const tag = document.createElement('span');
          tag.className = 'model-tag';
          tag.textContent = m;
          tagsWrap.appendChild(tag);
        });
        cell.appendChild(tagsWrap);
      }

      fragment.appendChild(cell);
    });

    return fragment;
  }

  // ── 主渲染 ───────────────────────────────────────────────────
  function render() {
    const page = document.createElement('div');
    page.className = 'page';

    const title = document.createElement('div');
    title.className = 'page-title';
    title.textContent = 'IPD & IPMS 流程视图';
    const subtitle = document.createElement('div');
    subtitle.className = 'page-subtitle';
    subtitle.textContent = '产品开发团队 (PDT) 与产品商业化团队 (PCT) 在各阶段的职责与核心交付物';

    page.appendChild(title);
    page.appendChild(subtitle);

    const wrapper = document.createElement('div');
    wrapper.className = 'flow-wrapper';

    const grid = document.createElement('div');
    grid.className = 'flow-grid';

    // Top bands (span all columns)
    const mgmtRow = renderManagementRow();
    mgmtRow.style.gridColumn = '1 / -1';
    grid.appendChild(mgmtRow);

    const phaseRow = renderIPDPhaseRow();
    phaseRow.style.gridColumn = '1 / -1';
    grid.appendChild(phaseRow);

    const headerRow = renderStageHeaderRow();
    headerRow.style.gridColumn = '1 / -1';
    grid.appendChild(headerRow);

    // PDT section
    const pdtSection = renderSectionHeader('pdt', 'PDT — 产品开发团队', 'Product Development Team');
    pdtSection.style.gridColumn = '1 / -1';
    grid.appendChild(pdtSection);

    const allRoles = [];

    PDT_ROLES.forEach(role => {
      const frag = renderRoleRow(role, 'var(--pdt-accent)');
      grid.appendChild(frag);
      allRoles.push(role);
    });

    // PCT section
    const pctSection = renderSectionHeader('pct', 'PCT — 产品商业化团队', 'Product Commercial Team');
    pctSection.style.gridColumn = '1 / -1';
    grid.appendChild(pctSection);

    PCT_ROLES.forEach(role => {
      const frag = renderRoleRow(role, 'var(--pct-accent)');
      grid.appendChild(frag);
      allRoles.push(role);
    });

    wrapper.appendChild(grid);
    page.appendChild(wrapper);
    app.appendChild(page);

    // Restore collapsed state AFTER all cells are in the DOM
    const saved = loadCollapsed();
    allRoles.forEach(role => {
      if (saved[role.id] && role._applyCollapsed) {
        role._applyCollapsed(true);
      }
    });
  }

  render();
})();
