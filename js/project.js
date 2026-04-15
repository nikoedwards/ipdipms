// ============================================================
// 项目详情页（Supabase + 横向 Tab + IPD 时间线版）
// ============================================================

(async function () {
  const user = await Auth.requireAuth();
  if (!user) return;
  Auth.injectNavUser();

  const app = document.getElementById('app');
  const params = new URLSearchParams(window.location.search);
  const projectId = params.get('id');
  if (!projectId) { window.location.href = 'projects.html'; return; }

  // ── 常量 ─────────────────────────────────────────────────
  const STAGE_ORDER  = ['gr1','gr2','gr3','gr4','gr5','gr5a','gr6'];
  const STAGE_LABELS = {
    gr1:'GR1 规划与立项', gr2:'GR2 拓展准备', gr3:'GR3 市场拓展',
    gr4:'GR4 上市准备',  gr5:'GR5 上市销售', gr5a:'GR5A 稳定销售', gr6:'GR6 退市撤盘',
  };

  // 默认各阶段周数
  const DEFAULT_STAGE_WEEKS = { gr1:8, gr2:12, gr3:20, gr4:12, gr5:52, gr5a:26, gr6:8 };

  // ── 本地存储 helpers ──────────────────────────────────────
  const LS_WEEKS   = `ipms-stage-weeks-${projectId}`;
  const LS_ASSIGN  = `ipms-role-assign-${projectId}`;
  const LS_VIRTUAL = `ipms-virtual-${projectId}`;

  function getStageWeeks() {
    try { return { ...DEFAULT_STAGE_WEEKS, ...JSON.parse(localStorage.getItem(LS_WEEKS) || '{}') }; }
    catch { return { ...DEFAULT_STAGE_WEEKS }; }
  }
  function saveStageWeeks(w) { localStorage.setItem(LS_WEEKS, JSON.stringify(w)); }

  function getRoleAssignments() {
    try { return JSON.parse(localStorage.getItem(LS_ASSIGN) || '{}'); }
    catch { return {}; }
  }
  function saveRoleAssignment(roleId, member) {
    const a = getRoleAssignments();
    if (member) a[roleId] = member; else delete a[roleId];
    localStorage.setItem(LS_ASSIGN, JSON.stringify(a));
  }

  function getVirtualMembers() {
    try { return JSON.parse(localStorage.getItem(LS_VIRTUAL) || '[]'); }
    catch { return []; }
  }
  function saveVirtualMembers(arr) { localStorage.setItem(LS_VIRTUAL, JSON.stringify(arr)); }

  // ── 加载项目 ─────────────────────────────────────────────
  let project = await Store.getProject(projectId);
  if (!project) {
    app.innerHTML = `<div class="page"><p style="color:var(--text-muted);padding:40px">项目不存在。<a href="projects.html">返回列表</a></p></div>`;
    return;
  }
  const myRole = await Store.getUserRole(projectId, user.id);

  // ── 页面骨架 ─────────────────────────────────────────────
  const page = document.createElement('div');
  page.className = 'page';
  page.style.paddingBottom = '48px';

  const bc = document.createElement('div');
  bc.className = 'breadcrumb';
  bc.innerHTML = `<a href="projects.html">项目</a><span class="breadcrumb-sep">/</span><span>${project.name}</span>`;
  page.appendChild(bc);

  const statusLabels = { active:'进行中', hold:'已暂停', done:'已完成' };
  const header = document.createElement('div');
  header.className = 'proj-header';
  header.innerHTML = `
    <div class="proj-header-top">
      <div class="proj-header-name" id="proj-title">${project.name}</div>
      <div style="display:flex;gap:8px;align-items:center;margin-top:6px;flex-wrap:wrap">
        <span class="proj-code">${project.code}</span>
        <span class="status-badge ${project.status||'active'}">${statusLabels[project.status]||'进行中'}</span>
        ${project.pdt_lead ? `<span style="font-size:12px;color:var(--text-secondary)">PDT: ${project.pdt_lead}</span>` : ''}
        ${project.gtm_lead ? `<span style="font-size:12px;color:var(--text-secondary)">GTM: ${project.gtm_lead}</span>` : ''}
      </div>
    </div>
    ${project.description ? `<div class="proj-header-desc">${project.description}</div>` : ''}`;
  page.appendChild(header);

  // ── 横向 Tab Nav ─────────────────────────────────────────
  const TABS = [
    { id: 'timeline',     label: '时间线' },
    { id: 'deliverables', label: '交付件' },
    { id: 'meetings',     label: '会议'   },
    { id: 'kanban',       label: '看板'   },
    { id: 'wiki',         label: 'WIKI'   },
    { id: 'settings',     label: '设置'   },
  ];
  let activeTab = 'timeline';

  const subnav = document.createElement('div');
  subnav.className = 'proj-subnav';
  TABS.forEach(t => {
    const btn = document.createElement('button');
    btn.className = `proj-subnav-btn${t.id === activeTab ? ' active' : ''}`;
    btn.textContent = t.label;
    btn.dataset.tab = t.id;
    btn.addEventListener('click', () => switchTab(t.id));
    subnav.appendChild(btn);
  });
  page.appendChild(subnav);

  const tabContent = document.createElement('div');
  tabContent.className = 'proj-tab-content';
  page.appendChild(tabContent);

  app.appendChild(page);

  function switchTab(id) {
    activeTab = id;
    subnav.querySelectorAll('.proj-subnav-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === id);
    });
    renderTab(id);
  }

  function renderTab(id) {
    tabContent.innerHTML = '';
    switch (id) {
      case 'timeline':     renderTimeline();     break;
      case 'deliverables': renderDeliverables(); break;
      case 'meetings':     renderMeetings();     break;
      case 'kanban':       renderPlaceholder('看板', '可视化任务卡片（即将上线）'); break;
      case 'wiki':         renderPlaceholder('WIKI', '项目知识库（AI 接入后支持自动生成）'); break;
      case 'settings':     renderSettings();     break;
    }
  }

  // ============================================================
  // TAB 1 — 时间线（IPD/IPMS 流程图）
  // ============================================================
  async function renderTimeline() {
    const wrap = document.createElement('div');
    wrap.className = 'tab-timeline';

    // 小标题 + 提交记录按钮
    const hdr = document.createElement('div');
    hdr.className = 'tab-section-header';
    hdr.innerHTML = `<span class="tab-section-title">项目时间线</span><span style="font-size:12px;color:var(--text-muted)">点击角色行的 + 分配成员 · 点击周次可调整计划周期</span>`;
    const addBtn = document.createElement('button');
    addBtn.className = 'btn-primary';
    addBtn.textContent = '＋ 提交记录';
    hdr.appendChild(addBtn);
    wrap.appendChild(hdr);

    // ── 流程图容器 ──────────────────────────────────────────
    const outer = document.createElement('div');
    outer.className = 'proj-flow-outer';

    // gridWrap: position:relative，今日线在其内随内容一起滚动
    const gridWrap = document.createElement('div');
    gridWrap.className = 'flow-grid-wrap';

    // 今日纵线（相对 gridWrap 定位，随内容滚动）
    const todayLine = document.createElement('div');
    todayLine.className = 'today-line';
    gridWrap.appendChild(todayLine);

    const grid = document.createElement('div');
    grid.className = 'flow-grid';

    // 定位今日线的闭包（在 buildWeekRow 里复用）
    function updateTodayLine() { positionTodayLine(gridWrap, grid, todayLine); }

    // 1. 管理层标题行
    grid.appendChild(buildManagementRow());
    // 2. IPD 阶段色带
    grid.appendChild(buildPhaseRow());
    // 3. GR 阶段列头
    grid.appendChild(buildStageHeaderRow());
    // 4. WEEK 行（新增，传入 updateTodayLine 回调）
    grid.appendChild(buildWeekRow(updateTodayLine));
    // 5. PDT 区块
    grid.appendChild(buildSectionHeader('pdt', 'PDT — 产品开发团队', 'Product Development Team'));
    PDT_ROLES.forEach(role => grid.appendChild(buildProjectRoleRow(role, 'pdt')));
    // 6. PCT 区块
    grid.appendChild(buildSectionHeader('pct', 'PCT — 产品商业化团队', 'Product Commercial Team'));
    PCT_ROLES.forEach(role => grid.appendChild(buildProjectRoleRow(role, 'pct')));

    gridWrap.appendChild(grid);
    outer.appendChild(gridWrap);
    wrap.appendChild(outer);

    // ── 最近动态折叠区 ──────────────────────────────────────
    const actSection = document.createElement('div');
    actSection.className = 'proj-activity-section';
    const actToggle = document.createElement('div');
    actToggle.className = 'proj-activity-toggle';
    actToggle.innerHTML = `<span>▸</span><span>最近动态</span><span class="tab-count" id="act-count">…</span>`;
    const actBody = document.createElement('div');
    actBody.className = 'proj-activity-body';
    actBody.style.display = 'none';
    actSection.appendChild(actToggle);
    actSection.appendChild(actBody);
    wrap.appendChild(actSection);

    tabContent.appendChild(wrap);

    // 定位今日线（等 DOM 渲染后；因线在 gridWrap 内随内容滚动，无需 scroll 监听）
    requestAnimationFrame(updateTodayLine);

    // 提交记录按钮
    addBtn.addEventListener('click', () => {
      const modal = buildCommitModal(async () => {
        const updated = await Store.getCommits(projectId);
        renderCommitList(actBody, updated.slice(0, 10));
        document.getElementById('act-count').textContent = updated.length;
      });
      document.body.appendChild(modal);
      const sel = modal.querySelector('#s-stage');
      if (sel) sel.value = project.current_stage || 'gr1';
    });

    // 折叠展开动态
    let actOpen = false;
    actToggle.addEventListener('click', async () => {
      actOpen = !actOpen;
      actToggle.querySelector('span').textContent = actOpen ? '▾' : '▸';
      actBody.style.display = actOpen ? 'block' : 'none';
      if (actOpen && !actBody.children.length) {
        const commits = await Store.getCommits(projectId);
        document.getElementById('act-count').textContent = commits.length;
        renderCommitList(actBody, commits.slice(0, 10));
      }
    });

    // 初始化动态计数
    Store.getCommits(projectId).then(c => {
      document.getElementById('act-count').textContent = c.length;
    });
  }

  // ── 管理层标题行 ──────────────────────────────────────────
  function buildManagementRow() {
    const row = document.createElement('div');
    row.className = 'ipd-mgmt-row';
    row.style.gridColumn = '1 / -1';
    row.style.display = 'grid';
    row.style.gridTemplateColumns = 'var(--col-role) repeat(2,var(--col-stage)) var(--col-stage) repeat(2,var(--col-stage)) repeat(2,var(--col-stage))';
    [
      { text: '', cols: 1 },
      { text: '管理 Offering 与组合', cols: 2 },
      { text: '管理 Idea', cols: 1 },
      { text: '管理研发', cols: 2 },
      { text: '管理产品数据', cols: 2 },
    ].forEach(d => {
      const el = document.createElement('div');
      el.className = 'ipd-mgmt-label';
      if (d.cols > 1) el.style.gridColumn = `span ${d.cols}`;
      el.textContent = d.text;
      row.appendChild(el);
    });
    return row;
  }

  // ── IPD 阶段色带 ─────────────────────────────────────────
  function buildPhaseRow() {
    const row = document.createElement('div');
    row.className = 'ipd-phase-row';
    const corner = document.createElement('div');
    corner.className = 'ipd-phase-corner';
    corner.innerHTML = '<span class="ipd-phase-corner-text">IPD 阶段</span>';
    row.appendChild(corner);
    IPD_PHASES.forEach(p => {
      const span = p.endIdx - p.startIdx + 1;
      const cell = document.createElement('div');
      cell.className = 'ipd-phase-cell';
      cell.style.background = p.color;
      cell.style.borderBottom = `3px solid ${p.accent}`;
      if (span > 1) cell.style.gridColumn = `span ${span}`;
      cell.innerHTML = `<span class="ipd-phase-dot" style="background:${p.accent}"></span><span style="font-size:11px;font-weight:600;color:${p.accent}">${p.name}</span>`;
      if (p.gate) {
        const g = document.createElement('span');
        g.className = 'ipd-phase-gate';
        g.textContent = p.gate;
        cell.appendChild(g);
      }
      row.appendChild(cell);
    });
    return row;
  }

  // ── GR 阶段列头 ──────────────────────────────────────────
  function buildStageHeaderRow() {
    const currentStage = project.current_stage || 'gr1';
    const row = document.createElement('div');
    row.className = 'stage-header-row';
    const corner = document.createElement('div');
    corner.className = 'stage-header-corner';
    corner.innerHTML = '<span class="stage-header-corner-text">角色 / 交付物</span>';
    row.appendChild(corner);
    STAGES.forEach(s => {
      const cell = document.createElement('div');
      cell.className = 'stage-header-cell';
      const isCurrent = s.id === currentStage;
      if (isCurrent) {
        cell.style.background = '#eff6ff';
        cell.style.borderBottom = '2px solid #2563eb';
      }
      cell.innerHTML = `
        <span class="stage-code" style="${isCurrent ? 'color:#2563eb' : ''}">${s.code}</span>
        <span class="stage-name">${s.name}</span>
        <span class="stage-gate">${s.ipdGate}</span>`;
      if (isCurrent) {
        const dot = document.createElement('span');
        dot.style.cssText = 'position:absolute;top:4px;right:4px;width:6px;height:6px;border-radius:50%;background:#2563eb';
        cell.style.position = 'relative';
        cell.appendChild(dot);
      }
      row.appendChild(cell);
    });
    return row;
  }

  // ── WEEK 行 ───────────────────────────────────────────────
  function buildWeekRow(onUpdate) {
    const stageWeeks = getStageWeeks();
    const row = document.createElement('div');
    row.className = 'week-row';
    row.id = 'proj-week-row';

    const corner = document.createElement('div');
    corner.className = 'week-corner';
    corner.textContent = 'WEEK';
    row.appendChild(corner);

    let cumWeek = 1;
    STAGE_ORDER.forEach(stageId => {
      const w = stageWeeks[stageId] || DEFAULT_STAGE_WEEKS[stageId] || 8;
      const start = cumWeek;
      const end   = cumWeek + w - 1;
      cumWeek += w;

      const cell = document.createElement('div');
      cell.className = 'week-cell';
      cell.dataset.stage = stageId;

      const textEl = document.createElement('span');
      textEl.className = 'week-cell-text';
      textEl.textContent = `W${start} ~ W${end}`;
      cell.appendChild(textEl);

      const editIcon = document.createElement('span');
      editIcon.style.cssText = 'font-size:9px;opacity:.5;';
      editIcon.textContent = '✎';
      cell.appendChild(editIcon);

      cell.addEventListener('click', () => {
        // Inline edit
        cell.innerHTML = '';
        const editDiv = document.createElement('div');
        editDiv.className = 'week-cell-edit';
        editDiv.innerHTML = `<span class="week-edit-hint">W${start}~</span><input class="week-cell-input" type="number" min="1" max="104" value="${w}"><span class="week-edit-hint">周</span>`;
        cell.appendChild(editDiv);
        const inp = editDiv.querySelector('input');
        inp.focus(); inp.select();

        function commit() {
          const newW = Math.max(1, Math.min(104, parseInt(inp.value) || w));
          const weeks = getStageWeeks();
          weeks[stageId] = newW;
          saveStageWeeks(weeks);
          // Re-render week row
          const newRow = buildWeekRow(onUpdate);
          row.parentNode.replaceChild(newRow, row);
          requestAnimationFrame(onUpdate);
        }
        inp.addEventListener('keydown', e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { inp.value = w; commit(); } });
        inp.addEventListener('blur', commit);
      });

      row.appendChild(cell);
    });
    return row;
  }

  // ── 今日纵线定位 ─────────────────────────────────────────
  // wrapEl: flow-grid-wrap（position:relative，是线的定位祖先）
  // gridEl: flow-grid（用于查找 stage-header-cell 和高度）
  function positionTodayLine(wrapEl, gridEl, lineEl) {
    const stageWeeks  = getStageWeeks();
    const projectStart = new Date(project.created_at || project.createdAt || Date.now()).getTime();
    const now          = Date.now();
    const weeksElapsed = (now - projectStart) / (7 * 24 * 3600 * 1000);

    let cumWeeks = 0;
    let targetIdx = -1;
    let fraction  = 0;
    for (let i = 0; i < STAGE_ORDER.length; i++) {
      const w = stageWeeks[STAGE_ORDER[i]] || DEFAULT_STAGE_WEEKS[STAGE_ORDER[i]] || 8;
      if (weeksElapsed < cumWeeks + w) {
        targetIdx = i;
        fraction  = (weeksElapsed - cumWeeks) / w;
        break;
      }
      cumWeeks += w;
    }

    if (targetIdx < 0) { lineEl.style.display = 'none'; return; }

    const stageCells = gridEl.querySelectorAll('.stage-header-cell');
    if (stageCells.length <= targetIdx) return;
    const targetCell = stageCells[targetIdx];

    // 使用 viewport 坐标差值 → 得到相对于 wrapEl 内容原点的偏移量
    // 两者都随外层容器滚动同步移动，差值恒定，与滚动无关
    const wrapRect = wrapEl.getBoundingClientRect();
    const cellRect = targetCell.getBoundingClientRect();
    const xInWrap  = (cellRect.left - wrapRect.left) + fraction * cellRect.width;

    lineEl.style.left   = xInWrap + 'px';
    lineEl.style.height = wrapEl.offsetHeight + 'px';
    lineEl.style.display = 'block';
  }

  // ── 区块标题行 ────────────────────────────────────────────
  function buildSectionHeader(type, label, desc) {
    const row = document.createElement('div');
    row.className = 'section-header-row';
    row.style.gridColumn = '1 / -1';
    row.style.background = type === 'pdt' ? '#f0f9ff' : '#faf5ff';
    row.style.position = 'sticky';
    // top is set via CSS: .proj-flow-outer .section-header-row
    row.style.zIndex = '55';
    row.innerHTML = `
      <div class="section-header-badge ${type}"><span class="section-header-dot"></span>${label}</div>
      <span class="section-header-desc">${desc}</span>`;
    return row;
  }

  // ── 项目角色行（含"+"分配按钮）────────────────────────────
  function buildProjectRoleRow(roleData, team) {
    const fragment = document.createDocumentFragment();
    const assignments = getRoleAssignments();
    const assigned = assignments[roleData.id] || null;

    // ── 角色格（左固定列）─────────────────────────────────
    const roleCell = document.createElement('div');
    roleCell.className = `role-cell${roleData.isHighlight ? ' highlight' : ''}`;
    roleCell.style.position = 'relative';

    const badge = document.createElement('span');
    badge.className = 'role-badge';
    badge.textContent = roleData.role;
    badge.style.background = roleData.color + '18';
    badge.style.color = roleData.color;

    const name = document.createElement('div');
    name.className = 'role-name';
    name.textContent = roleData.title;

    const subtitle = document.createElement('div');
    subtitle.className = 'role-subtitle';
    subtitle.textContent = roleData.subtitle;

    // 折叠按钮
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'toggle-btn';
    toggleBtn.textContent = '▼';

    const stageCells = [];
    function applyCollapsed(c) {
      roleCell.classList.toggle('row-collapsed', c);
      stageCells.forEach(sc => sc.classList.toggle('row-collapsed', c));
      toggleBtn.textContent = c ? '▶' : '▼';
    }
    toggleBtn.addEventListener('click', () => applyCollapsed(!roleCell.classList.contains('row-collapsed')));

    // 成员分配区
    const assignArea = document.createElement('div');
    assignArea.className = 'role-assign-area';
    assignArea.dataset.roleId = roleData.id;

    function renderAssignArea() {
      assignArea.innerHTML = '';
      const cur = getRoleAssignments()[roleData.id];
      if (cur) {
        const chip = document.createElement('div');
        chip.className = 'role-assign-chip';
        chip.title = '点击更改';
        const av = document.createElement('div');
        av.className = 'role-assign-avatar';
        av.style.background = cur.color || '#2563eb';
        av.textContent = (cur.name || '?').charAt(0).toUpperCase();
        chip.appendChild(av);
        chip.appendChild(document.createTextNode(cur.name));
        chip.addEventListener('click', e => openAssignPopover(roleData.id, chip, renderAssignArea));
        assignArea.appendChild(chip);
      } else {
        const plusBtn = document.createElement('button');
        plusBtn.className = 'role-assign-btn';
        plusBtn.title = '分配成员';
        plusBtn.textContent = '+';
        plusBtn.addEventListener('click', e => openAssignPopover(roleData.id, plusBtn, renderAssignArea));
        assignArea.appendChild(plusBtn);
      }
    }
    renderAssignArea();

    roleCell.appendChild(badge);
    roleCell.appendChild(name);
    roleCell.appendChild(subtitle);
    roleCell.appendChild(assignArea);
    roleCell.appendChild(toggleBtn);
    fragment.appendChild(roleCell);

    // ── 阶段格 ─────────────────────────────────────────────
    const currentStage = project.current_stage || 'gr1';
    const currentIdx = STAGE_ORDER.indexOf(currentStage);

    STAGES.forEach((s, i) => {
      const stageData = roleData.stages[s.id] || { deliverables: [], models: [] };
      const cell = document.createElement('div');
      cell.className = `stage-cell${roleData.isHighlight ? ' highlight' : ''}`;
      stageCells.push(cell);

      // 阶段锁定样式
      const stageIdx = STAGE_ORDER.indexOf(s.id);
      if (stageIdx > currentIdx) {
        cell.style.opacity = '.45';
      } else if (stageIdx === currentIdx) {
        cell.style.background = '#f0f9ff';
        cell.style.outline = '1px solid #bfdbfe';
      }

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
      if (stageData.models && stageData.models.length > 0) {
        const tw = document.createElement('div');
        tw.className = 'model-tags';
        stageData.models.forEach(m => {
          const tag = document.createElement('span');
          tag.className = 'model-tag';
          tag.textContent = m;
          tw.appendChild(tag);
        });
        cell.appendChild(tw);
      }
      fragment.appendChild(cell);
    });

    return fragment;
  }

  // ── 成员分配弹窗 ─────────────────────────────────────────
  async function openAssignPopover(roleId, anchorEl, refreshFn) {
    // 关闭已有弹窗
    document.querySelectorAll('.assign-popover').forEach(p => p.remove());

    // 获取全部成员 = Supabase 真实成员 + 本地虚拟成员
    const [realMembers, virtualMembers] = await Promise.all([
      Store.getMembers(projectId),
      Promise.resolve(getVirtualMembers()),
    ]);

    const assignments = getRoleAssignments();
    const currentAssigned = assignments[roleId];

    const popover = document.createElement('div');
    popover.className = 'assign-popover';

    // 真实成员
    if (realMembers.length) {
      const hdr = document.createElement('div');
      hdr.className = 'assign-popover-header';
      hdr.textContent = '项目成员';
      popover.appendChild(hdr);
      realMembers.forEach(m => {
        const p = m.profiles || {};
        const name = p.name || p.email?.split('@')[0] || '未知';
        const colors = ['#2563eb','#7c3aed','#0891b2','#065f46','#b45309'];
        const color = colors[name.charCodeAt(0) % colors.length];
        const item = document.createElement('div');
        item.className = 'assign-popover-item' + (currentAssigned?.userId === m.user_id ? ' active' : '');
        item.innerHTML = `
          <div class="assign-pop-avatar" style="background:${color}">${name.charAt(0).toUpperCase()}</div>
          <span class="assign-pop-name">${name}</span>
          <span class="assign-pop-tag">${{owner:'所有者',admin:'管理员',member:'成员'}[m.ipms_role]||'成员'}</span>`;
        item.addEventListener('click', () => {
          saveRoleAssignment(roleId, { name, userId: m.user_id, color, isVirtual: false });
          popover.remove();
          refreshFn();
        });
        popover.appendChild(item);
      });
    }

    // 虚拟成员
    if (virtualMembers.length) {
      const div = document.createElement('div');
      div.className = 'assign-popover-divider';
      popover.appendChild(div);
      const hdr = document.createElement('div');
      hdr.className = 'assign-popover-header';
      hdr.textContent = '测试成员';
      popover.appendChild(hdr);
      virtualMembers.forEach(vm => {
        const item = document.createElement('div');
        item.className = 'assign-popover-item' + (currentAssigned?.userId === vm.id ? ' active' : '');
        item.innerHTML = `
          <div class="assign-pop-avatar" style="background:${vm.color||'#64748b'}">${vm.name.charAt(0).toUpperCase()}</div>
          <span class="assign-pop-name">${vm.name}</span>
          <span class="assign-pop-tag">测试</span>`;
        item.addEventListener('click', () => {
          saveRoleAssignment(roleId, { name: vm.name, userId: vm.id, color: vm.color||'#64748b', isVirtual: true });
          popover.remove();
          refreshFn();
        });
        popover.appendChild(item);
      });
    }

    if (!realMembers.length && !virtualMembers.length) {
      const empty = document.createElement('div');
      empty.style.cssText = 'padding:12px;font-size:12px;color:var(--text-muted);text-align:center';
      empty.textContent = '暂无成员，请先在设置中添加';
      popover.appendChild(empty);
    }

    // 清除选项（如已分配）
    if (currentAssigned) {
      const div = document.createElement('div');
      div.className = 'assign-popover-divider';
      popover.appendChild(div);
      const clearBtn = document.createElement('div');
      clearBtn.className = 'assign-clear-btn';
      clearBtn.textContent = '✕  清除分配';
      clearBtn.addEventListener('click', () => {
        saveRoleAssignment(roleId, null);
        popover.remove();
        refreshFn();
      });
      popover.appendChild(clearBtn);
    }

    // 定位弹窗
    document.body.appendChild(popover);
    const rect = anchorEl.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    if (spaceBelow < 220) {
      popover.style.bottom = (window.innerHeight - rect.top + 4) + 'px';
    } else {
      popover.style.top  = (rect.bottom + 4) + 'px';
    }
    const rightEdge = rect.left + 220;
    if (rightEdge > window.innerWidth - 8) {
      popover.style.right = '8px';
    } else {
      popover.style.left = rect.left + 'px';
    }

    // 点击外部关闭
    setTimeout(() => {
      document.addEventListener('click', function outsideClick(e) {
        if (!popover.contains(e.target)) { popover.remove(); document.removeEventListener('click', outsideClick); }
      });
    }, 10);
  }

  // ============================================================
  // TAB 2 — 交付件
  // ============================================================
  async function renderDeliverables() {
    const wrap = document.createElement('div');
    wrap.className = 'tab-deliverables';

    const hdr = document.createElement('div');
    hdr.className = 'tab-section-header';
    hdr.innerHTML = `<span class="tab-section-title">交付件</span><span style="font-size:12px;color:var(--text-muted)">基于 IPD/IPMS 流程自动生成，当前阶段可编辑</span>`;
    wrap.appendChild(hdr);

    const loading = document.createElement('div');
    loading.className = 'empty-state';
    loading.textContent = '加载中…';
    wrap.appendChild(loading);
    tabContent.appendChild(wrap);

    let dbRows = await Store.getDeliverables(projectId);
    if (dbRows.length === 0) dbRows = await seedDeliverables();
    loading.remove();

    const currentIdx = STAGE_ORDER.indexOf(project.current_stage || 'gr1');

    STAGE_ORDER.forEach((stageId, stageIdx) => {
      const stageDels = dbRows.filter(d => d.stage_id === stageId);
      if (!stageDels.length) return;

      const isLocked  = stageIdx > currentIdx;
      const isPast    = stageIdx < currentIdx;
      const isCurrent = stageIdx === currentIdx;

      const section = document.createElement('div');
      section.className = 'deliv-stage-section';

      const stageHdr = document.createElement('div');
      stageHdr.className = 'deliv-stage-header';
      stageHdr.innerHTML = `
        <span class="deliv-stage-label">${STAGE_LABELS[stageId]}</span>
        <span class="deliv-stage-status ${isCurrent ? 'current' : isPast ? 'past' : 'locked'}">
          ${isCurrent ? '当前阶段' : isPast ? '已完成' : '🔒 待解锁'}
        </span>
        <span style="font-size:12px;color:var(--text-muted);margin-left:auto">
          ${stageDels.filter(d => d.status === 'approved').length}/${stageDels.length} 已批准
        </span>`;
      section.appendChild(stageHdr);

      const grid2 = document.createElement('div');
      grid2.className = 'deliv-grid';
      const teams = [...new Set(stageDels.map(d => d.team))];
      teams.forEach(team => {
        const teamBlock = document.createElement('div');
        teamBlock.className = 'deliv-team-block';
        teamBlock.innerHTML = `<div class="deliv-team-label ${team.toLowerCase()}">${team}</div>`;
        stageDels.filter(d => d.team === team).forEach(d => teamBlock.appendChild(buildDelivCard(d, isLocked)));
        grid2.appendChild(teamBlock);
      });
      section.appendChild(grid2);
      wrap.appendChild(section);
    });
  }

  function buildDelivCard(d, isLocked) {
    const statusColors = { pending:'#94a3b8', in_progress:'#f59e0b', submitted:'#3b82f6', approved:'#22c55e' };
    const statusMap    = { pending:'待提交', in_progress:'进行中', submitted:'已提交', approved:'已批准' };
    const color = statusColors[d.status] || '#94a3b8';
    const card = document.createElement('div');
    card.className = `deliv-card ${isLocked ? 'locked' : ''}`;
    card.innerHTML = `
      <div class="deliv-card-top">
        <span class="deliv-role-badge" style="background:#2563eb18;color:#2563eb">${d.role_label}</span>
        <span class="deliv-status-dot" style="background:${color}" title="${statusMap[d.status]}"></span>
      </div>
      <div class="deliv-name">${d.name}</div>
      ${d.content ? `<div class="deliv-content">${d.content}</div>` : ''}
      <div class="deliv-status-label" style="color:${color}">${statusMap[d.status]}</div>`;
    if (!isLocked) {
      const btn = document.createElement('button');
      btn.className = 'deliv-action-btn';
      btn.textContent = (d.status === 'pending' || d.status === 'in_progress') ? '填写内容' : '查看 / 编辑';
      btn.addEventListener('click', () => showDelivModal(d));
      card.appendChild(btn);
    }
    return card;
  }

  function showDelivModal(d) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <span class="modal-title">${d.name}</span>
          <button class="modal-close">✕</button>
        </div>
        <div class="modal-body">
          <div style="font-size:12px;color:var(--text-muted);margin-bottom:12px">${d.role_label} · ${STAGE_LABELS[d.stage_id]}</div>
          <div class="form-group">
            <label class="form-label">状态</label>
            <select class="form-select" id="d-status">
              <option value="pending" ${d.status==='pending'?'selected':''}>待提交</option>
              <option value="in_progress" ${d.status==='in_progress'?'selected':''}>进行中</option>
              <option value="submitted" ${d.status==='submitted'?'selected':''}>已提交</option>
              <option value="approved" ${d.status==='approved'?'selected':''}>已批准</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">内容</label>
            <textarea class="form-textarea" id="d-content" rows="6" placeholder="填写交付件内容、链接或说明…">${d.content || ''}</textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-ghost" id="d-cancel">取消</button>
          <button class="btn-primary" id="d-save">保存</button>
        </div>
      </div>`;
    const close = () => overlay.remove();
    overlay.querySelector('.modal-close').addEventListener('click', close);
    overlay.querySelector('#d-cancel').addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    overlay.querySelector('#d-save').addEventListener('click', async () => {
      const btn = overlay.querySelector('#d-save');
      btn.disabled = true; btn.textContent = '保存中…';
      try {
        await Store.upsertDeliverable({ ...d, status: overlay.querySelector('#d-status').value, content: overlay.querySelector('#d-content').value.trim(), submitted_by: user.id, submitted_at: new Date().toISOString() });
        close();
        renderDeliverables();
      } catch (err) { btn.disabled = false; btn.textContent = '保存'; alert('保存失败：' + (err.message || '')); }
    });
    document.body.appendChild(overlay);
  }

  async function seedDeliverables() {
    const rows = [];
    let order = 0;
    const groups = [
      ...(typeof PDT_ROLES !== 'undefined' ? PDT_ROLES : []).map(r => ({ ...r, team: 'PDT' })),
      ...(typeof PCT_ROLES !== 'undefined' ? PCT_ROLES : []).map(r => ({ ...r, team: 'PCT' })),
    ];
    groups.forEach(role => {
      STAGE_ORDER.forEach(stageId => {
        const dels = role.stages?.[stageId]?.deliverables || [];
        dels.forEach(name => {
          rows.push({ id: `dlv_${projectId}_${role.id}_${stageId}_${order}`, project_id: projectId, stage_id: stageId, team: role.team, role_id: role.id, role_label: role.title || role.role || role.id, name, status: 'pending', content: '', sort_order: order++ });
        });
      });
    });
    if (rows.length > 0) {
      const { error } = await sb.from('deliverables').insert(rows);
      if (error) console.error('seedDeliverables:', error);
    }
    return rows;
  }

  // ============================================================
  // TAB 3 — 会议
  // ============================================================
  async function renderMeetings() {
    const meetings = await Store.getMeetings(projectId);
    const wrap = document.createElement('div');
    wrap.className = 'tab-meetings';
    const hdr = document.createElement('div');
    hdr.className = 'tab-section-header';
    hdr.innerHTML = `<span class="tab-section-title">会议记录 <span class="tab-count">${meetings.length}</span></span>`;
    const addBtn = document.createElement('button');
    addBtn.className = 'btn-primary';
    addBtn.textContent = '＋ 新增会议';
    hdr.appendChild(addBtn);
    wrap.appendChild(hdr);
    const list = document.createElement('div');
    list.className = 'meeting-list';
    renderMeetingList(list, meetings);
    wrap.appendChild(list);
    tabContent.appendChild(wrap);
    addBtn.addEventListener('click', () => {
      const modal = buildMeetingModal(async () => {
        const updated = await Store.getMeetings(projectId);
        renderMeetingList(list, updated);
        wrap.querySelector('.tab-count').textContent = updated.length;
      });
      document.body.appendChild(modal);
    });
  }

  function renderMeetingList(container, meetings) {
    container.innerHTML = '';
    if (!meetings.length) { container.innerHTML = `<div class="empty-state">暂无会议记录</div>`; return; }
    meetings.forEach(m => {
      const card = document.createElement('div');
      card.className = 'meeting-card';
      const actions = Array.isArray(m.action_items) ? m.action_items : [];
      card.innerHTML = `
        <div class="meeting-card-top">
          <span class="meeting-title">${m.title}</span>
          <span class="meeting-date">${m.meeting_date || formatDate(m.created_at)}</span>
        </div>
        ${m.stage_id ? `<div class="meeting-stage">${STAGE_LABELS[m.stage_id] || m.stage_id}</div>` : ''}
        ${m.agenda ? `<div class="meeting-field"><strong>议程：</strong>${m.agenda}</div>` : ''}
        ${m.minutes ? `<div class="meeting-field"><strong>纪要：</strong>${m.minutes.replace(/\n/g,'<br>')}</div>` : ''}
        ${actions.length ? `<div class="meeting-field"><strong>行动项：</strong><ul class="action-items-list">${actions.map(a=>`<li>${typeof a==='string'?a:(a.text||JSON.stringify(a))}</li>`).join('')}</ul></div>` : ''}
        <div class="meeting-card-footer"><span style="font-size:12px;color:var(--text-muted)">${formatRelativeTime(m.created_at)}</span></div>`;
      container.appendChild(card);
    });
  }

  function buildMeetingModal(onSaved) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal modal-lg">
        <div class="modal-header"><span class="modal-title">新增会议记录</span><button class="modal-close">✕</button></div>
        <div class="modal-body">
          <div class="form-row">
            <div class="form-group"><label class="form-label">会议标题 *</label><input class="form-input" id="m-title" placeholder="例：GR3 评审会议" /></div>
            <div class="form-group"><label class="form-label">会议日期</label><input class="form-input" id="m-date" type="date" /></div>
          </div>
          <div class="form-group"><label class="form-label">关联阶段</label>
            <select class="form-select" id="m-stage"><option value="">无</option>${STAGE_ORDER.map(id=>`<option value="${id}">${STAGE_LABELS[id]}</option>`).join('')}</select></div>
          <div class="form-group"><label class="form-label">议程</label><textarea class="form-textarea" id="m-agenda" rows="2" placeholder="主要议题…"></textarea></div>
          <div class="form-group"><label class="form-label">会议纪要</label><textarea class="form-textarea" id="m-minutes" rows="5" placeholder="会议要点、讨论结果、重要决策…"></textarea></div>
          <div class="form-group"><label class="form-label">行动项（每行一条）</label><textarea class="form-textarea" id="m-actions" rows="3" placeholder="- 张明 4/17 前提交降本方案"></textarea></div>
          <div id="m-err" style="display:none;color:#ef4444;font-size:12px;margin-top:4px"></div>
        </div>
        <div class="modal-footer"><button class="btn-ghost" id="m-cancel">取消</button><button class="btn-primary" id="m-save">保存</button></div>
      </div>`;
    const close = () => overlay.remove();
    overlay.querySelector('.modal-close').addEventListener('click', close);
    overlay.querySelector('#m-cancel').addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    overlay.querySelector('#m-date').value = new Date().toISOString().slice(0,10);
    if (project.current_stage) overlay.querySelector('#m-stage').value = project.current_stage;
    overlay.querySelector('#m-save').addEventListener('click', async () => {
      const title = overlay.querySelector('#m-title').value.trim();
      const errEl = overlay.querySelector('#m-err');
      if (!title) { errEl.textContent = '请填写会议标题'; errEl.style.display = 'block'; return; }
      const btn = overlay.querySelector('#m-save');
      btn.disabled = true; btn.textContent = '保存中…';
      const actionsRaw = overlay.querySelector('#m-actions').value.trim();
      try {
        await Store.addMeeting(projectId, { title, meetingDate: overlay.querySelector('#m-date').value, stageId: overlay.querySelector('#m-stage').value, agenda: overlay.querySelector('#m-agenda').value.trim(), minutes: overlay.querySelector('#m-minutes').value.trim(), actionItems: actionsRaw ? actionsRaw.split('\n').map(s=>s.replace(/^[-•]\s*/,'').trim()).filter(Boolean) : [] }, user.id);
        close(); await onSaved();
      } catch(err) { errEl.textContent = '保存失败：'+(err.message||''); errEl.style.display = 'block'; btn.disabled = false; btn.textContent = '保存'; }
    });
    return overlay;
  }

  // ============================================================
  // TAB 6 — 设置（含虚拟成员）
  // ============================================================
  async function renderSettings() {
    const members = await Store.getMembers(projectId);
    const virtualMembers = getVirtualMembers();

    const wrap = document.createElement('div');
    wrap.className = 'tab-settings';

    // ── 项目信息 ──────────────────────────────────────────
    const infoSection = document.createElement('div');
    infoSection.className = 'settings-section';
    infoSection.innerHTML = `
      <div class="settings-section-title">项目信息</div>
      <div class="form-group"><label class="form-label">项目名称</label><input class="form-input" id="cfg-name" value="${project.name || ''}" /></div>
      <div class="form-group"><label class="form-label">项目描述</label><textarea class="form-textarea" id="cfg-desc" rows="3">${project.description || ''}</textarea></div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">PDT Lead</label><input class="form-input" id="cfg-pdt" value="${project.pdt_lead || ''}" /></div>
        <div class="form-group"><label class="form-label">GTM Lead</label><input class="form-input" id="cfg-gtm" value="${project.gtm_lead || ''}" /></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">当前阶段</label>
          <select class="form-select" id="cfg-stage">${STAGE_ORDER.map(id=>`<option value="${id}" ${project.current_stage===id?'selected':''}>${STAGE_LABELS[id]}</option>`).join('')}</select>
        </div>
        <div class="form-group"><label class="form-label">项目状态</label>
          <select class="form-select" id="cfg-status">
            <option value="active" ${project.status==='active'?'selected':''}>进行中</option>
            <option value="hold"   ${project.status==='hold'?'selected':''}>已暂停</option>
            <option value="done"   ${project.status==='done'?'selected':''}>已完成</option>
          </select>
        </div>
      </div>
      <div style="margin-top:4px;display:flex;gap:8px;align-items:center">
        <button class="btn-primary" id="cfg-save">保存修改</button>
        <span id="cfg-msg" style="font-size:13px;color:var(--text-muted)"></span>
      </div>`;
    wrap.appendChild(infoSection);

    // ── 正式成员 ──────────────────────────────────────────
    const roleLabels = { owner:'所有者', admin:'管理员', member:'成员' };
    const memberSection = document.createElement('div');
    memberSection.className = 'settings-section';
    const memberRows = members.map(m => {
      const p = m.profiles || {};
      return `<div class="member-row">
        <div class="member-avatar">${(p.name || p.email || '?').charAt(0).toUpperCase()}</div>
        <div class="member-info"><div class="member-name">${p.name || '—'}</div><div class="member-email">${p.email || ''}</div></div>
        <span class="member-role-badge role-${m.ipms_role}">${roleLabels[m.ipms_role] || m.ipms_role}</span>
      </div>`;
    }).join('');
    memberSection.innerHTML = `
      <div class="settings-section-title">团队成员 <span class="tab-count">${members.length}</span></div>
      <div class="member-list">${memberRows || '<div class="empty-state" style="padding:12px 0">暂无成员</div>'}</div>
      <div class="member-add-row" style="margin-top:12px">
        <input class="form-input" id="add-email" placeholder="输入邮箱添加成员" style="flex:1" />
        <select class="form-select" id="add-role" style="width:120px"><option value="member">成员</option><option value="admin">管理员</option></select>
        <button class="btn-primary" id="add-member-btn">添加</button>
      </div>
      <div id="add-msg" style="font-size:12px;margin-top:6px;color:var(--text-muted)"></div>`;
    wrap.appendChild(memberSection);

    // ── 虚拟测试成员 ──────────────────────────────────────
    const VM_COLORS = ['#2563eb','#7c3aed','#0891b2','#065f46','#b45309','#9d174d','#c2410c','#0f766e'];
    const vmSection = document.createElement('div');
    vmSection.className = 'settings-section';

    function renderVmSection() {
      vmSection.innerHTML = `<div class="settings-section-title">测试成员 <span class="tab-count">${getVirtualMembers().length}</span></div>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:12px">仅供本地测试使用，无需注册账号。可在时间线角色行中分配这些成员。</div>`;

      const vmList = document.createElement('div');
      vmList.className = 'vm-list';
      const vms = getVirtualMembers();
      if (vms.length) {
        vms.forEach((vm, idx) => {
          const item = document.createElement('div');
          item.className = 'vm-item';
          item.innerHTML = `
            <div class="vm-avatar" style="background:${vm.color||'#64748b'}">${vm.name.charAt(0).toUpperCase()}</div>
            <div class="vm-info">
              <div class="vm-name">${vm.name}</div>
              ${vm.desc ? `<div class="vm-desc">${vm.desc}</div>` : ''}
            </div>
            <span class="vm-badge">虚拟</span>
            <button class="vm-del" data-idx="${idx}" title="删除">✕</button>`;
          vmList.appendChild(item);
        });
        vmList.querySelectorAll('.vm-del').forEach(btn => {
          btn.addEventListener('click', () => {
            const arr = getVirtualMembers();
            arr.splice(parseInt(btn.dataset.idx), 1);
            saveVirtualMembers(arr);
            renderVmSection();
          });
        });
      } else {
        vmList.innerHTML = '<div style="font-size:13px;color:var(--text-muted);padding:8px 0">暂无测试成员</div>';
      }
      vmSection.appendChild(vmList);

      const addRow = document.createElement('div');
      addRow.className = 'vm-add-row';
      addRow.innerHTML = `
        <input class="form-input" id="vm-name" placeholder="姓名（例：张明）" style="flex:1;min-width:120px" />
        <input class="form-input" id="vm-desc" placeholder="职位描述（选填）" style="flex:1;min-width:120px" />
        <button class="btn-primary" id="vm-add-btn">添加</button>`;
      vmSection.appendChild(addRow);
      const vmMsg = document.createElement('div');
      vmMsg.style.cssText = 'font-size:12px;margin-top:6px;color:var(--text-muted)';
      vmMsg.id = 'vm-msg';
      vmSection.appendChild(vmMsg);

      vmSection.querySelector('#vm-add-btn').addEventListener('click', () => {
        const name = vmSection.querySelector('#vm-name').value.trim();
        const desc = vmSection.querySelector('#vm-desc').value.trim();
        if (!name) { vmMsg.textContent = '请输入姓名'; return; }
        const arr = getVirtualMembers();
        const color = VM_COLORS[arr.length % VM_COLORS.length];
        arr.push({ id: 'vm_' + Date.now(), name, desc, color });
        saveVirtualMembers(arr);
        renderVmSection();
      });
    }
    renderVmSection();
    wrap.appendChild(vmSection);

    // ── 危险操作 ──────────────────────────────────────────
    const dangerSection = document.createElement('div');
    dangerSection.className = 'settings-section settings-danger';
    dangerSection.innerHTML = `
      <div class="settings-section-title" style="color:#ef4444">危险操作</div>
      <p style="font-size:13px;color:var(--text-secondary);margin-bottom:12px">删除项目将永久移除所有记录，无法恢复。</p>
      <button class="btn-danger" id="delete-proj-btn">删除此项目</button>`;
    wrap.appendChild(dangerSection);

    tabContent.appendChild(wrap);

    // 事件绑定
    document.getElementById('cfg-save').addEventListener('click', async () => {
      const btn = document.getElementById('cfg-save');
      const msg = document.getElementById('cfg-msg');
      btn.disabled = true; btn.textContent = '保存中…';
      try {
        project = await Store.updateProject(projectId, {
          name: document.getElementById('cfg-name').value.trim(),
          description: document.getElementById('cfg-desc').value.trim(),
          pdtLead: document.getElementById('cfg-pdt').value.trim(),
          gtmLead: document.getElementById('cfg-gtm').value.trim(),
          currentStage: document.getElementById('cfg-stage').value,
          status: document.getElementById('cfg-status').value,
        });
        document.getElementById('proj-title').textContent = project.name;
        msg.style.color = '#22c55e'; msg.textContent = '已保存';
        setTimeout(() => { msg.textContent = ''; }, 2000);
      } catch(err) { msg.style.color = '#ef4444'; msg.textContent = '保存失败：'+(err.message||''); }
      btn.disabled = false; btn.textContent = '保存修改';
    });

    document.getElementById('add-member-btn').addEventListener('click', async () => {
      const email = document.getElementById('add-email').value.trim();
      const role  = document.getElementById('add-role').value;
      const msgEl = document.getElementById('add-msg');
      if (!email) { msgEl.textContent = '请输入邮箱'; return; }
      msgEl.style.color = 'var(--text-muted)'; msgEl.textContent = '查询中…';
      const { data: profiles } = await sb.from('profiles').select('id, name, email').eq('email', email).limit(1);
      if (!profiles || !profiles.length) { msgEl.style.color = '#ef4444'; msgEl.textContent = '未找到该用户'; return; }
      try {
        await Store.addMember(projectId, profiles[0].id, role);
        msgEl.style.color = '#22c55e'; msgEl.textContent = `已添加 ${profiles[0].name || email}`;
        document.getElementById('add-email').value = '';
        setTimeout(() => renderSettings(), 800);
      } catch(err) { msgEl.style.color = '#ef4444'; msgEl.textContent = '添加失败：'+(err.message||''); }
    });

    document.getElementById('delete-proj-btn').addEventListener('click', async () => {
      if (!confirm(`确定要删除项目「${project.name}」吗？\n此操作不可恢复。`)) return;
      try { await Store.deleteProject(projectId); window.location.href = 'projects.html'; }
      catch(err) { alert('删除失败：'+(err.message||'')); }
    });
  }

  // ============================================================
  // 提交记录 Modal（时间线动态）
  // ============================================================
  function buildCommitModal(onSubmitted) {
    const pdtRoles = ALL_ROLES.filter(r => r.team === 'PDT');
    const pctRoles = ALL_ROLES.filter(r => r.team === 'PCT');
    const roleOpts = (grp, roles) => `<optgroup label="${grp}">${roles.map(r=>`<option value="${r.id}">${r.label}</option>`).join('')}</optgroup>`;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header"><span class="modal-title">提交记录</span><button class="modal-close">✕</button></div>
        <div class="modal-body">
          <div class="form-row">
            <div class="form-group"><label class="form-label">提交角色 *</label>
              <select class="form-select" id="s-role">${roleOpts('PDT — 产品开发团队', pdtRoles)}${roleOpts('PCT — 产品商业化团队', pctRoles)}</select></div>
            <div class="form-group"><label class="form-label">记录类型 *</label>
              <select class="form-select" id="s-type">${COMMIT_TYPES.map(t=>`<option value="${t.id}">${t.icon} ${t.label}</option>`).join('')}</select></div>
          </div>
          <div class="form-group"><label class="form-label">关联阶段</label>
            <select class="form-select" id="s-stage">${STAGE_ORDER.map(id=>`<option value="${id}">${STAGE_LABELS[id]}</option>`).join('')}</select></div>
          <div class="form-group"><label class="form-label">标题 *</label><input class="form-input" id="s-title" placeholder="简要描述这条记录的主题" /></div>
          <div class="form-group"><label class="form-label">详细内容</label><textarea class="form-textarea" id="s-content" rows="5" placeholder="记录完整内容…"></textarea></div>
          <div class="form-group"><label class="form-label">标签（逗号分隔）</label><input class="form-input" id="s-tags" placeholder="例：PDCP, 成本风险" /></div>
          <div id="s-err" style="display:none;color:#ef4444;font-size:12px;margin-top:4px"></div>
        </div>
        <div class="modal-footer"><button class="btn-ghost" id="s-cancel">取消</button><button class="btn-primary" id="s-confirm">提交</button></div>
      </div>`;

    const close = () => overlay.remove();
    overlay.querySelector('.modal-close').addEventListener('click', close);
    overlay.querySelector('#s-cancel').addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

    overlay.querySelector('#s-confirm').addEventListener('click', async () => {
      const title = overlay.querySelector('#s-title').value.trim();
      const roleId = overlay.querySelector('#s-role').value;
      const errEl = overlay.querySelector('#s-err');
      if (!title) { errEl.textContent = '请填写标题'; errEl.style.display = 'block'; return; }
      const btn = overlay.querySelector('#s-confirm');
      btn.disabled = true; btn.textContent = '提交中…';
      try {
        const roleInfo = getRoleInfo(roleId);
        const tagsRaw = overlay.querySelector('#s-tags').value.trim();
        const commit = await Store.addCommit(projectId, { type: overlay.querySelector('#s-type').value, roleId, roleLabel: roleInfo.label, stageId: overlay.querySelector('#s-stage').value, title, content: overlay.querySelector('#s-content').value.trim(), tags: tagsRaw ? tagsRaw.split(',').map(t=>t.trim()).filter(Boolean) : [], sourceTab: 'timeline' }, user.id);
        close();
        await onSubmitted(commit);
      } catch(err) { errEl.textContent = '提交失败：'+(err.message||''); errEl.style.display = 'block'; btn.disabled = false; btn.textContent = '提交'; }
    });
    return overlay;
  }

  // ── commit 卡片列表 ──────────────────────────────────────
  function renderCommitList(container, commits) {
    container.innerHTML = '';
    if (!commits.length) { container.innerHTML = `<div class="empty-state">暂无记录</div>`; return; }
    commits.forEach(c => {
      const type = getCommitType(c.type);
      const role = getRoleInfo(c.role_id);
      const stageCode = (STAGE_LABELS[c.stage_id] || '').split(' ')[0];
      const item = document.createElement('div');
      item.className = 'commit-item';
      item.innerHTML = `
        <div class="commit-icon" style="background:${type.color}18;border-color:${type.color}30">${type.icon}</div>
        <div class="commit-body">
          <div class="commit-top">
            <span class="commit-role-badge" style="background:${role.color}18;color:${role.color}">${c.role_label || role.label}</span>
            ${stageCode ? `<span class="commit-stage-chip">${stageCode}</span>` : ''}
            <span class="commit-time">${formatRelativeTime(c.created_at)}</span>
          </div>
          <div class="commit-title">${c.title}</div>
          ${c.summary ? `<div class="commit-summary">${c.summary}</div>` : ''}
          ${(c.tags||[]).length ? `<div class="commit-tags">${c.tags.map(t=>`<span class="commit-tag">${t}</span>`).join('')}</div>` : ''}
          ${c.content ? `<button class="commit-expand-btn" data-open="0">展开详情 ↓</button><div class="commit-full-content">${c.content.replace(/\n/g,'<br>')}</div>` : ''}
        </div>`;
      const eb = item.querySelector('.commit-expand-btn');
      if (eb) {
        eb.addEventListener('click', () => {
          const open = eb.dataset.open === '1';
          eb.dataset.open = open ? '0' : '1';
          eb.textContent = open ? '展开详情 ↓' : '收起 ↑';
          item.querySelector('.commit-full-content').classList.toggle('open', !open);
        });
      }
      container.appendChild(item);
    });
  }

  // ── 占位符 Tab ────────────────────────────────────────────
  function renderPlaceholder(title, desc) {
    tabContent.innerHTML = `
      <div class="empty-state" style="padding:60px 0">
        <div style="font-size:32px;margin-bottom:12px">🚧</div>
        <div style="font-size:16px;font-weight:600;color:var(--text-primary);margin-bottom:6px">${title}</div>
        <div style="font-size:13px;color:var(--text-muted)">${desc}</div>
      </div>`;
  }

  // ── 首次渲染 ─────────────────────────────────────────────
  renderTab('timeline');
})();
