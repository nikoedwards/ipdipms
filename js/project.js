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

  // 各阶段结束节点对应的里程碑 key
  const STAGE_END_MILESTONE = {
    gr1:'cdcp', gr2:'pdcp', gr3:'devval', gr4:'adcp', gr5:'launch', gr5a:'gr5a_end', gr6:'gr6_end',
  };
  // 里程碑定义（顺序即为评审节点顺序）
  const MILESTONE_DEFS = [
    { key:'kickoff',  label:'Kick-off',  desc:'项目启动' },
    { key:'cdcp',     label:'CDCP',      desc:'GR1 → GR2' },
    { key:'pdcp',     label:'PDCP',      desc:'GR2 → GR3' },
    { key:'devval',   label:'开发验证',   desc:'GR3 → GR4' },
    { key:'adcp',     label:'ADCP',      desc:'GR4 → GR5' },
    { key:'launch',   label:'发布',       desc:'GR5 → GR5A' },
    { key:'gr5a_end', label:'稳定期结束', desc:'GR5A → GR6' },
    { key:'gr6_end',  label:'退市完成',   desc:'GR6 结束' },
  ];

  // 默认各阶段周数
  const DEFAULT_STAGE_WEEKS = { gr1:8, gr2:12, gr3:20, gr4:12, gr5:52, gr5a:26, gr6:8 };

  // ── 本地存储 helpers ──────────────────────────────────────
  const LS_WEEKS     = `ipms-stage-weeks-${projectId}`;
  const LS_ASSIGN    = `ipms-role-assign-${projectId}`;
  const LS_VIRTUAL   = `ipms-virtual-${projectId}`;
  const LS_ENABLED   = `ipms-role-enabled-${projectId}`;
  const LS_CUSTOM    = `ipms-custom-stage-${projectId}`;
  const LS_HISTORY     = `ipms-history-${projectId}`;
  const LS_TAB_ORDER   = `ipms-tab-order-${projectId}`;
  const LS_SHOW_MODELS = `ipms-show-models-${projectId}`;
  const LS_MILESTONES  = `ipms-milestones-${projectId}`;
  const LS_TODOS       = `ipms-todos-${projectId}`;
  const LS_WIKI        = `ipms-wiki-${projectId}`;

  function getShowModels() {
    try { const v = localStorage.getItem(LS_SHOW_MODELS); return v === null ? true : JSON.parse(v); }
    catch { return true; }
  }
  function setShowModels(v) { localStorage.setItem(LS_SHOW_MODELS, JSON.stringify(v)); }

  // ── 操作历史 ──────────────────────────────────────────────
  function getHistory() {
    try { return JSON.parse(localStorage.getItem(LS_HISTORY) || '[]'); }
    catch { return []; }
  }
  function logHistory(category, action, detail) {
    const history = getHistory();
    const userName = user.user_metadata?.name || user.user_metadata?.full_name || user.email?.split('@')[0] || '未知';
    history.unshift({
      id: Date.now(), ts: new Date().toISOString(),
      category, action, detail: detail || '',
      userName, userEmail: user.email || '',
    });
    if (history.length > 300) history.splice(300);
    localStorage.setItem(LS_HISTORY, JSON.stringify(history));
  }

  // ── Tab 顺序 ──────────────────────────────────────────────
  function getTabOrder() {
    try {
      const saved = JSON.parse(localStorage.getItem(LS_TAB_ORDER) || '[]');
      if (saved.length) return saved;
    } catch {}
    return null;
  }
  function saveTabOrder(ids) { localStorage.setItem(LS_TAB_ORDER, JSON.stringify(ids)); }

  function getStageWeeks() {
    const m = getMilestones();
    if (m) {
      const calc = calcWeeksFromMilestones(m);
      const base = { ...DEFAULT_STAGE_WEEKS };
      Object.entries(calc).forEach(([k, v]) => { if (v !== null) base[k] = v; });
      return base;
    }
    try { return { ...DEFAULT_STAGE_WEEKS, ...JSON.parse(localStorage.getItem(LS_WEEKS) || '{}') }; }
    catch { return { ...DEFAULT_STAGE_WEEKS }; }
  }
  function saveStageWeeks(w) { localStorage.setItem(LS_WEEKS, JSON.stringify(w)); }

  // ── 里程碑 helpers ────────────────────────────────────────
  function getMilestones() {
    try { const v = localStorage.getItem(LS_MILESTONES); return v ? JSON.parse(v) : null; }
    catch { return null; }
  }
  function saveMilestones(m) { localStorage.setItem(LS_MILESTONES, JSON.stringify(m)); }
  function calcWeeksFromMilestones(m) {
    const toMs = s => s ? new Date(s).getTime() : null;
    const wk = (a, b) => {
      const ta = toMs(a), tb = toMs(b);
      return (ta && tb && tb > ta) ? Math.max(1, Math.round((tb - ta) / 604800000)) : null;
    };
    // MILESTONE_DEFS のkeys順: kickoff,cdcp,pdcp,devval,adcp,launch,gr5a_end,gr6_end
    return {
      gr1:  wk(m.kickoff,  m.cdcp),
      gr2:  wk(m.cdcp,     m.pdcp),
      gr3:  wk(m.pdcp,     m.devval),
      gr4:  wk(m.devval,   m.adcp),
      gr5:  wk(m.adcp,     m.launch),
      gr5a: wk(m.launch,   m.gr5a_end),
      gr6:  wk(m.gr5a_end, m.gr6_end),
    };
  }
  function fmtMilestoneDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}`;
  }

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

  // ── 职能启用状态 ──────────────────────────────────────────
  function getEnabledRoles() {
    try { return JSON.parse(localStorage.getItem(LS_ENABLED) || '{}'); }
    catch { return {}; }
  }
  function isRoleEnabled(roleId) {
    const e = getEnabledRoles();
    return e[roleId] !== false; // default: all enabled
  }
  function setRoleEnabled(roleId, enabled) {
    const e = getEnabledRoles();
    e[roleId] = enabled;
    localStorage.setItem(LS_ENABLED, JSON.stringify(e));
  }

  // ── 自定义交付件 ───────────────────────────────────────────
  function getAllCustom() {
    try { return JSON.parse(localStorage.getItem(LS_CUSTOM) || '{}'); }
    catch { return {}; }
  }
  function getCustomStageData(roleId, stageId) {
    return getAllCustom()[`${roleId}_${stageId}`] ?? null;
  }
  function saveCustomStageData(roleId, stageId, data) {
    const all = getAllCustom();
    if (data === null) delete all[`${roleId}_${stageId}`];
    else all[`${roleId}_${stageId}`] = data;
    localStorage.setItem(LS_CUSTOM, JSON.stringify(all));
  }
  function getEffectiveStageData(roleData, stageId) {
    const custom = getCustomStageData(roleData.id, stageId);
    if (custom) return custom;
    return roleData.stages[stageId] || { deliverables: [], models: [] };
  }

  // ── 加载项目 ─────────────────────────────────────────────
  let project = await Store.getProject(projectId);
  if (!project) {
    app.innerHTML = `<div class="page"><p style="color:var(--text-muted);padding:40px">项目不存在。<a href="projects.html">返回列表</a></p></div>`;
    return;
  }
  const myRole = await Store.getUserRole(projectId, user.id);

  // ── 交付件行缓存（时间线和交付件视图共用）────────────────
  let cachedDbRows = null;
  async function getOrLoadDbRows() {
    if (cachedDbRows && cachedDbRows.length > 0) return cachedDbRows;
    cachedDbRows = await Store.getDeliverables(projectId);
    if (!cachedDbRows.length) cachedDbRows = await seedDeliverables();
    return cachedDbRows;
  }

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
    { id: 'todo',         label: 'To-do'  },
    { id: 'wiki',         label: 'Wiki'   },
    { id: 'settings',     label: '设置'   },
  ];
  let activeTab = 'timeline';

  const subnav = document.createElement('div');
  subnav.className = 'proj-subnav';

  function getOrderedTabs() {
    const order = getTabOrder();
    if (!order) return [...TABS];
    const result = order.map(id => TABS.find(t => t.id === id)).filter(Boolean);
    // append any tabs not in saved order (e.g. newly added tabs)
    TABS.forEach(t => { if (!result.find(x => x.id === t.id)) result.push(t); });
    return result;
  }

  let dragSrcId = null;
  function renderSubnav() {
    subnav.innerHTML = '';
    getOrderedTabs().forEach(t => {
      const btn = document.createElement('button');
      btn.className = `proj-subnav-btn${t.id === activeTab ? ' active' : ''}`;
      btn.textContent = t.label;
      btn.dataset.tab = t.id;
      btn.draggable = true;
      btn.addEventListener('click', () => switchTab(t.id));
      btn.addEventListener('dragstart', e => {
        dragSrcId = t.id;
        btn.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });
      btn.addEventListener('dragend', () => btn.classList.remove('dragging'));
      btn.addEventListener('dragover', e => { e.preventDefault(); btn.classList.add('drag-over'); });
      btn.addEventListener('dragleave', () => btn.classList.remove('drag-over'));
      btn.addEventListener('drop', e => {
        e.preventDefault();
        btn.classList.remove('drag-over');
        if (!dragSrcId || dragSrcId === t.id) return;
        const ordered = getOrderedTabs();
        const fromIdx = ordered.findIndex(x => x.id === dragSrcId);
        const toIdx   = ordered.findIndex(x => x.id === t.id);
        ordered.splice(toIdx, 0, ordered.splice(fromIdx, 1)[0]);
        saveTabOrder(ordered.map(x => x.id));
        renderSubnav();
      });
      subnav.appendChild(btn);
    });
  }
  renderSubnav();
  page.appendChild(subnav);

  const tabContent = document.createElement('div');
  tabContent.className = 'proj-tab-content';
  page.appendChild(tabContent);

  app.appendChild(page);

  function switchTab(id) {
    activeTab = id;
    renderSubnav();
    renderTab(id);
  }

  function renderTab(id) {
    tabContent.innerHTML = '';
    switch (id) {
      case 'timeline':     renderTimeline();     break;
      case 'deliverables': renderDeliverables(); break;
      case 'meetings':     renderMeetings();     break;
      case 'kanban':       renderKanban();       break;
      case 'todo':         renderTodo();         break;
      case 'wiki':         renderWiki();         break;
      case 'settings':     renderSettings();     break;
    }
  }

  // ============================================================
  // TAB 1 — 时间线（IPD/IPMS 流程图）
  // ============================================================
  async function renderTimeline() {
    const wrap = document.createElement('div');
    wrap.className = 'tab-timeline';

    // 预加载交付件行，使时间线状态点即时显示
    getOrLoadDbRows();

    // 小标题 + 提交记录按钮
    const hdr = document.createElement('div');
    hdr.className = 'tab-section-header';
    hdr.innerHTML = `<span class="tab-section-title">项目时间线</span><span style="font-size:12px;color:var(--text-muted)">点击周次可调整计划周期</span>`;
    const cfgBtn = document.createElement('button');
    cfgBtn.className = 'btn-cfg';
    cfgBtn.textContent = '⚙ 配置';
    cfgBtn.style.marginLeft = 'auto';
    cfgBtn.addEventListener('click', openConfigPanel);
    hdr.appendChild(cfgBtn);
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
    const activePDT = PDT_ROLES.filter(r => isRoleEnabled(r.id));
    if (activePDT.length > 0) {
      grid.appendChild(buildSectionHeader('pdt', 'PDT — 产品开发团队', 'Product Development Team'));
      activePDT.forEach(role => grid.appendChild(buildProjectRoleRow(role, 'pdt')));
    }
    // 6. PCT 区块
    const activePCT = PCT_ROLES.filter(r => isRoleEnabled(r.id));
    if (activePCT.length > 0) {
      grid.appendChild(buildSectionHeader('pct', 'PCT — 产品商业化团队', 'Product Commercial Team'));
      activePCT.forEach(role => grid.appendChild(buildProjectRoleRow(role, 'pct')));
    }

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
    const stageWeeks  = getStageWeeks();
    const milestones  = getMilestones();
    const useMilestone = !!(milestones && Object.values(milestones).some(Boolean));

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

      if (useMilestone) {
        // 显示阶段结束里程碑日期，不可编辑
        const mKey = STAGE_END_MILESTONE[stageId];
        const mDate = milestones[mKey];
        if (mDate) {
          const dateEl = document.createElement('span');
          dateEl.className = 'week-cell-milestone';
          const mDef = MILESTONE_DEFS.find(d => d.key === mKey);
          dateEl.textContent = `${mDef ? mDef.label : ''} ${fmtMilestoneDate(mDate)}`;
          cell.appendChild(dateEl);
        }
        cell.style.cursor = 'default';
      } else {
        // 手动编辑模式
        const editIcon = document.createElement('span');
        editIcon.style.cssText = 'font-size:9px;opacity:.5;';
        editIcon.textContent = '✎';
        cell.appendChild(editIcon);

        cell.addEventListener('click', () => {
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
            if (newW !== w) logHistory('timeline', '调整周期', `${STAGE_LABELS[stageId]} → ${newW} 周`);
            const newRow = buildWeekRow(onUpdate);
            row.parentNode.replaceChild(newRow, row);
            requestAnimationFrame(onUpdate);
          }
          inp.addEventListener('keydown', e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { inp.value = w; commit(); } });
          inp.addEventListener('blur', commit);
        });
      }

      row.appendChild(cell);
    });
    return row;
  }

  // ── 今日纵线定位 ─────────────────────────────────────────
  // ── 今日位置计算（milestone-aware）────────────────────────
  function calcTodayStageInfo() {
    const todayMs    = Date.now();
    const milestones = getMilestones();

    if (milestones && milestones.kickoff) {
      // milestone 模式：找今天落在哪个阶段区间
      const stageDates = {
        gr1:  [milestones.kickoff,  milestones.cdcp],
        gr2:  [milestones.cdcp,     milestones.pdcp],
        gr3:  [milestones.pdcp,     milestones.devval],
        gr4:  [milestones.devval,   milestones.adcp],
        gr5:  [milestones.adcp,     milestones.launch],
        gr5a: [milestones.launch,   milestones.gr5a_end],
        gr6:  [milestones.gr5a_end, milestones.gr6_end],
      };
      for (let i = 0; i < STAGE_ORDER.length; i++) {
        const sid = STAGE_ORDER[i];
        const [startStr, endStr] = stageDates[sid] || [];
        if (!startStr) continue;
        const startMs = new Date(startStr).getTime();
        const endMs   = endStr ? new Date(endStr).getTime() : Infinity;
        if (todayMs < startMs) return { stageIdx: i, fraction: 0 }; // 今天在此阶段之前
        if (todayMs < endMs)   return { stageIdx: i, fraction: (todayMs - startMs) / (endMs - startMs) };
      }
      return { stageIdx: -1, fraction: 0 }; // 今天已超出所有阶段
    }

    // 周数模式（fallback）
    const stageWeeks  = getStageWeeks();
    const projectStart = new Date(project.created_at || Date.now()).getTime();
    const weeksElapsed = (todayMs - projectStart) / (7 * 24 * 3600 * 1000);
    let cumWeeks = 0;
    for (let i = 0; i < STAGE_ORDER.length; i++) {
      const w = stageWeeks[STAGE_ORDER[i]] || DEFAULT_STAGE_WEEKS[STAGE_ORDER[i]] || 8;
      if (weeksElapsed < cumWeeks + w) return { stageIdx: i, fraction: (weeksElapsed - cumWeeks) / w };
      cumWeeks += w;
    }
    return { stageIdx: -1, fraction: 0 };
  }

  // 阶段是否可编辑（今日之前或当前阶段）
  function isStageAccessible(stageId) {
    const { stageIdx: todayIdx } = calcTodayStageInfo();
    if (todayIdx < 0) return false;
    return STAGE_ORDER.indexOf(stageId) <= todayIdx;
  }

  // wrapEl: flow-grid-wrap；gridEl: flow-grid
  function positionTodayLine(wrapEl, gridEl, lineEl) {
    const { stageIdx: targetIdx, fraction } = calcTodayStageInfo();
    if (targetIdx < 0) { lineEl.style.display = 'none'; return; }

    const stageCells = gridEl.querySelectorAll('.stage-header-cell');
    if (stageCells.length <= targetIdx) return;
    const targetCell = stageCells[targetIdx];

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
    const currentIdx   = STAGE_ORDER.indexOf(currentStage);

    STAGES.forEach((s, i) => {
      const cell = document.createElement('div');
      cell.className = `stage-cell${roleData.isHighlight ? ' highlight' : ''}`;
      stageCells.push(cell);

      // 阶段锁定：基于"今日"位置而非 current_stage
      const stageIdx   = STAGE_ORDER.indexOf(s.id);
      const accessible = isStageAccessible(s.id);
      if (!accessible) {
        cell.classList.add('stage-locked');
      } else if (stageIdx === currentIdx) {
        cell.style.background = '#f0f9ff';
        cell.style.outline = '1px solid #bfdbfe';
      }

      // 渲染单元格内容（可被刷新调用）
      function renderCellContent() {
        Array.from(cell.children).forEach(c => c.remove());

        const stageData    = getEffectiveStageData(roleData, s.id);
        const disabledSet  = new Set(stageData.disabled || []);
        const visibleDelivs = (stageData.deliverables || []).filter(d => !disabledSet.has(d));

        if (visibleDelivs.length > 0) {
          const ul = document.createElement('ul');
          ul.className = 'deliverable-list';
          visibleDelivs.forEach(delivName => {
            const li = document.createElement('li');
            li.className = 'deliverable-item';

            // 状态点（从缓存中查 db row）
            const dbRow = cachedDbRows && cachedDbRows.find(
              r => r.role_id === roleData.id && r.stage_id === s.id && r.name === delivName);
            const STATUS_COLORS = { pending:'#94a3b8', in_progress:'#f59e0b', submitted:'#3b82f6', approved:'#22c55e' };
            const sc = dbRow ? (STATUS_COLORS[dbRow.status] || '#94a3b8') : roleData.color;
            li.innerHTML = `<span class="deliverable-bullet" style="background:${sc}"></span><span>${delivName}</span>`;

            if (accessible) {
              li.classList.add('deliverable-clickable');
              li.addEventListener('click', async e => {
                e.stopPropagation();
                const rows = await getOrLoadDbRows();
                const row  = rows.find(r => r.role_id === roleData.id && r.stage_id === s.id && r.name === delivName);
                if (!row) return;
                showDelivDetailModal(row, rows, () => renderCellContent());
              });
            }
            ul.appendChild(li);
          });
          cell.appendChild(ul);
        }
        if (stageData.models && stageData.models.length > 0 && getShowModels()) {
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
      }
      renderCellContent();

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
          const rl = [...PDT_ROLES, ...PCT_ROLES].find(r => r.id === roleId);
          logHistory('timeline', '分配成员', `${rl ? rl.title : roleId} → ${name}`);
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
          const rl = [...PDT_ROLES, ...PCT_ROLES].find(r => r.id === roleId);
          logHistory('timeline', '分配成员', `${rl ? rl.title : roleId} → ${vm.name}`);
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
  // TAB 2 — 交付件（左右分栏）
  // ============================================================
  async function renderDeliverables() {
    const wrap = document.createElement('div');
    wrap.className = 'tab-deliverables tab-deliverables-split';
    tabContent.appendChild(wrap);

    const loading = document.createElement('div');
    loading.className = 'empty-state';
    loading.textContent = '加载中…';
    wrap.appendChild(loading);

    const dbRows = await getOrLoadDbRows();
    loading.remove();

    let stageFilter = null;
    let teamFilter  = null;
    let selectedId  = null;

    const STATUS_COLORS = { pending:'#94a3b8', in_progress:'#f59e0b', submitted:'#3b82f6', approved:'#22c55e' };
    const STATUS_MAP    = { pending:'待提交', in_progress:'进行中', submitted:'已提交', approved:'已批准' };

    function getVisibleRows() {
      return dbRows.filter(d => {
        if (!isRoleEnabled(d.role_id)) return false;
        const custom = getCustomStageData(d.role_id, d.stage_id);
        if (custom?.disabled?.includes(d.name)) return false;
        if (stageFilter && d.stage_id !== stageFilter) return false;
        if (teamFilter  && d.team     !== teamFilter)  return false;
        return true;
      });
    }

    // ── 布局 ──────────────────────────────────────────────────
    const split = document.createElement('div');
    split.className = 'deliv-split';
    wrap.appendChild(split);

    const sidebar = document.createElement('div');
    sidebar.className = 'deliv-sidebar';
    split.appendChild(sidebar);

    const detailPanel = document.createElement('div');
    detailPanel.className = 'deliv-detail';
    split.appendChild(detailPanel);

    function showEmptyDetail() {
      detailPanel.innerHTML = `
        <div class="deliv-detail-empty">
          <div style="font-size:40px;margin-bottom:12px;opacity:.4">📄</div>
          <div style="font-size:14px;color:var(--text-muted)">从左侧选择一个交付件</div>
        </div>`;
    }

    function renderSidebar() {
      sidebar.innerHTML = '';

      // ── 过滤栏 ────────────────────────────────────────────
      const filterBar = document.createElement('div');
      filterBar.className = 'deliv-filter-bar';

      function makeFilterRow(label, options, current, setter) {
        const row = document.createElement('div');
        row.className = 'deliv-filter-row';
        const lbl = document.createElement('span');
        lbl.className = 'deliv-filter-label';
        lbl.textContent = label;
        row.appendChild(lbl);
        options.forEach(({ value, text }) => {
          const btn = document.createElement('button');
          btn.className = 'deliv-filter-chip' + (current === value ? ' active' : '');
          btn.textContent = text;
          btn.addEventListener('click', () => {
            setter(value);
            selectedId = null;
            renderSidebar();
            showEmptyDetail();
          });
          row.appendChild(btn);
        });
        return row;
      }

      filterBar.appendChild(makeFilterRow(
        '阶段',
        [{ value: null, text: '全部' }, ...STAGE_ORDER.map(s => ({ value: s, text: s.toUpperCase() }))],
        stageFilter,
        v => { stageFilter = v; }
      ));
      filterBar.appendChild(makeFilterRow(
        '团队',
        [{ value: null, text: '全部' }, { value: 'PDT', text: 'PDT' }, { value: 'PCT', text: 'PCT' }],
        teamFilter,
        v => { teamFilter = v; }
      ));
      sidebar.appendChild(filterBar);

      // ── 树形列表 ──────────────────────────────────────────
      const tree = document.createElement('div');
      tree.className = 'deliv-tree';
      const visibleRows = getVisibleRows();
      const stageIds = stageFilter ? [stageFilter] : STAGE_ORDER;
      let hasAny = false;

      stageIds.forEach(stageId => {
        const stageRows = visibleRows.filter(d => d.stage_id === stageId);
        if (!stageRows.length) return;
        hasAny = true;

        const stageDone  = stageRows.filter(d => d.status === 'approved').length;
        const { stageIdx: todayIdx } = calcTodayStageInfo();
        const stageIdx   = STAGE_ORDER.indexOf(stageId);
        const stageState = !isStageAccessible(stageId) ? 'locked'
          : stageIdx === todayIdx ? 'current' : 'past';

        const stageNode = document.createElement('div');
        stageNode.className = 'deliv-tree-stage';

        const stageHdr = document.createElement('div');
        stageHdr.className = 'deliv-tree-stage-hdr';
        stageHdr.innerHTML = `
          <span class="deliv-tree-stage-code">${stageId.toUpperCase()}</span>
          <span class="deliv-tree-stage-name">${(STAGE_LABELS[stageId] || '').replace(/^GR\w+\s/, '')}</span>
          <span class="deliv-stage-status ${stageState}" style="font-size:10px;padding:1px 6px">
            ${stageState === 'current' ? '当前' : stageState === 'past' ? '完成' : '🔒'}
          </span>
          <span class="deliv-tree-badge">${stageDone}/${stageRows.length}</span>`;
        stageNode.appendChild(stageHdr);

        const teams = teamFilter ? [teamFilter] : ['PDT', 'PCT'];
        teams.forEach(team => {
          const teamRows = stageRows.filter(d => d.team === team);
          if (!teamRows.length) return;

          const teamNode = document.createElement('div');
          teamNode.className = 'deliv-tree-team';
          const teamLbl = document.createElement('div');
          teamLbl.className = `deliv-tree-team-label ${team.toLowerCase()}`;
          teamLbl.textContent = team;
          teamNode.appendChild(teamLbl);

          const roleIds = [...new Set(teamRows.map(d => d.role_id))];
          roleIds.forEach(roleId => {
            const roleRows = teamRows.filter(d => d.role_id === roleId);
            const roleDone = roleRows.filter(d => d.status === 'approved').length;
            const roleInfo = ALL_ROLES.find(r => r.id === roleId) || { color: '#64748b' };

            const roleNode = document.createElement('div');
            roleNode.className = 'deliv-tree-role';
            const roleHdr = document.createElement('div');
            roleHdr.className = 'deliv-tree-role-hdr';
            roleHdr.innerHTML = `
              <span class="deliv-tree-role-dot" style="background:${roleInfo.color}"></span>
              <span class="deliv-tree-role-name">${roleRows[0].role_label}</span>
              <span class="deliv-tree-badge">${roleDone}/${roleRows.length}</span>`;
            roleNode.appendChild(roleHdr);

            roleRows.forEach(d => {
              const item = document.createElement('div');
              item.className = 'deliv-tree-item' + (d.id === selectedId ? ' selected' : '');
              const sc = STATUS_COLORS[d.status] || '#94a3b8';
              const hasContent = d.content && d.content !== '{}' && d.content !== '{"text":"","links":[]}';
              item.innerHTML = `
                <span class="deliv-tree-item-dot" style="background:${sc}"></span>
                <span class="deliv-tree-item-name">${d.name}</span>
                ${hasContent ? '<span class="deliv-tree-item-flag">📎</span>' : ''}`;
              item.addEventListener('click', () => {
                selectedId = d.id;
                renderSidebar();
                showDelivDetail(d, detailPanel, dbRows, renderSidebar);
              });
              roleNode.appendChild(item);
            });

            teamNode.appendChild(roleNode);
          });
          stageNode.appendChild(teamNode);
        });
        tree.appendChild(stageNode);
      });

      if (!hasAny) {
        tree.innerHTML = `<div style="padding:32px 16px;text-align:center;font-size:13px;color:var(--text-muted)">暂无可见交付件</div>`;
      }
      sidebar.appendChild(tree);
    }

    renderSidebar();
    showEmptyDetail();
  }

  // ── 解析/序列化交付件内容 ────────────────────────────────────
  function parseDelivContent(raw) {
    if (!raw) return { text: '', links: [] };
    try {
      const p = JSON.parse(raw);
      if (p && typeof p === 'object' && ('text' in p || 'links' in p)) {
        return { text: p.text || '', links: Array.isArray(p.links) ? p.links : [] };
      }
    } catch {}
    return { text: raw, links: [] };
  }

  // ── 交付件详情面板 ──────────────────────────────────────────
  function showDelivDetail(d, detailPanel, dbRows, onSaved) {
    const { text: initText, links: initLinks } = parseDelivContent(d.content);
    const STATUS_COLORS = { pending:'#94a3b8', in_progress:'#f59e0b', submitted:'#3b82f6', approved:'#22c55e' };
    const STATUS_MAP    = { pending:'待提交', in_progress:'进行中', submitted:'已提交', approved:'已批准' };
    const roleInfo = ALL_ROLES.find(r => r.id === d.role_id) || { color: '#64748b' };
    const isLocked = !isStageAccessible(d.stage_id);
    let links = [...initLinks];

    detailPanel.innerHTML = '';
    const panel = document.createElement('div');
    panel.className = 'deliv-detail-inner';

    // 标题
    const titleBar = document.createElement('div');
    titleBar.className = 'deliv-detail-title-bar';
    titleBar.innerHTML = `
      <div class="deliv-detail-name">${d.name}</div>
      <div class="deliv-detail-meta">
        <span class="deliv-role-badge" style="background:${roleInfo.color}18;color:${roleInfo.color}">${d.role_label}</span>
        <span class="deliv-detail-sep">·</span>
        <span>${STAGE_LABELS[d.stage_id] || d.stage_id}</span>
        <span class="deliv-detail-sep">·</span>
        <span>${d.team}</span>
      </div>`;
    panel.appendChild(titleBar);

    if (isLocked) {
      const lock = document.createElement('div');
      lock.style.cssText = 'padding:16px;background:#f8fafc;border-radius:8px;color:#64748b;font-size:13px;margin-top:16px';
      lock.textContent = '🔒 该阶段尚未解锁，暂无法编辑';
      panel.appendChild(lock);
      detailPanel.appendChild(panel);
      return;
    }

    // 状态
    const statusGroup = document.createElement('div');
    statusGroup.className = 'deliv-detail-group';
    statusGroup.innerHTML = `<label class="form-label">状态</label>
      <select class="form-select" id="dd-status">
        ${Object.entries(STATUS_MAP).map(([v, l]) =>
          `<option value="${v}" ${d.status === v ? 'selected' : ''}>${l}</option>`).join('')}
      </select>`;
    panel.appendChild(statusGroup);

    // 说明
    const textGroup = document.createElement('div');
    textGroup.className = 'deliv-detail-group';
    textGroup.innerHTML = `<label class="form-label">说明 / 备注</label>
      <textarea class="form-textarea" id="dd-text" rows="4"
        placeholder="填写交付说明、备注或摘要…">${initText}</textarea>`;
    panel.appendChild(textGroup);

    // 附件
    const attachGroup = document.createElement('div');
    attachGroup.className = 'deliv-detail-group';
    const attachLbl = document.createElement('label');
    attachLbl.className = 'form-label';
    attachLbl.textContent = '附件 / 在线文档';
    attachGroup.appendChild(attachLbl);

    const linkList = document.createElement('div');
    linkList.className = 'deliv-link-list';
    attachGroup.appendChild(linkList);

    function renderLinks() {
      linkList.innerHTML = '';
      if (!links.length) {
        linkList.innerHTML = `<div style="font-size:12px;color:var(--text-muted);padding:4px 0">暂无附件</div>`;
        return;
      }
      links.forEach((lk, idx) => {
        const row = document.createElement('div');
        row.className = 'deliv-link-row';
        row.innerHTML = `
          <span class="deliv-link-icon">${lk.type === 'file' ? '📎' : '🔗'}</span>
          <a href="${lk.url}" target="_blank" class="deliv-link-name" title="${lk.label}">${lk.label}</a>
          <button class="deliv-link-del" data-idx="${idx}" title="移除">✕</button>`;
        linkList.appendChild(row);
      });
      linkList.querySelectorAll('.deliv-link-del').forEach(btn => {
        btn.addEventListener('click', () => { links.splice(parseInt(btn.dataset.idx), 1); renderLinks(); });
      });
    }
    renderLinks();

    // 添加链接行
    const addLinkRow = document.createElement('div');
    addLinkRow.className = 'deliv-add-row';
    addLinkRow.innerHTML = `
      <input class="form-input" id="dd-link-url"
        placeholder="粘贴链接（飞书 / Confluence / Google Docs…）" type="url" />
      <button class="btn-ghost" id="dd-link-add">+ 链接</button>`;
    attachGroup.appendChild(addLinkRow);
    addLinkRow.querySelector('#dd-link-add').addEventListener('click', () => {
      const url = addLinkRow.querySelector('#dd-link-url').value.trim();
      if (!url) return;
      let label = url;
      try { const u = new URL(url); label = u.hostname + (u.pathname !== '/' ? u.pathname.slice(0, 30) + '…' : ''); } catch {}
      links.push({ label, url, type: 'url' });
      addLinkRow.querySelector('#dd-link-url').value = '';
      renderLinks();
    });
    addLinkRow.querySelector('#dd-link-url').addEventListener('keydown', e => {
      if (e.key === 'Enter') addLinkRow.querySelector('#dd-link-add').click();
    });

    // 上传文件
    const uploadRow = document.createElement('div');
    uploadRow.className = 'deliv-upload-row';
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.doc,.docx,.xls,.xlsx,.pdf,.ppt,.pptx';
    fileInput.style.display = 'none';
    const uploadBtn = document.createElement('button');
    uploadBtn.className = 'btn-ghost';
    uploadBtn.textContent = '📤 上传文件';
    const uploadHint = document.createElement('span');
    uploadHint.style.cssText = 'font-size:11px;color:var(--text-muted)';
    uploadHint.textContent = 'Word / Excel / PDF / PPT（≤ 5 MB）';
    uploadRow.appendChild(fileInput);
    uploadRow.appendChild(uploadBtn);
    uploadRow.appendChild(uploadHint);
    attachGroup.appendChild(uploadRow);

    uploadBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        alert('文件超过 5 MB，建议上传至云端后粘贴链接');
        e.target.value = '';
        return;
      }
      uploadBtn.textContent = '读取中…';
      uploadBtn.disabled = true;
      const reader = new FileReader();
      reader.onload = ev => {
        links.push({ label: file.name, url: ev.target.result, type: 'file' });
        renderLinks();
        uploadBtn.textContent = '📤 上传文件';
        uploadBtn.disabled = false;
        e.target.value = '';
      };
      reader.readAsDataURL(file);
    });

    panel.appendChild(attachGroup);

    // 底部保存
    const footer = document.createElement('div');
    footer.className = 'deliv-detail-footer';
    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn-primary';
    saveBtn.textContent = '保存';
    saveBtn.addEventListener('click', async () => {
      saveBtn.disabled = true; saveBtn.textContent = '保存中…';
      try {
        const newStatus = panel.querySelector('#dd-status').value;
        const newText   = panel.querySelector('#dd-text').value.trim();
        const content   = JSON.stringify({ text: newText, links });
        const saved = await Store.upsertDeliverable({
          ...d, status: newStatus, content,
          submitted_by: user.id, submitted_at: new Date().toISOString(),
        });
        // patch in-memory row
        const idx = dbRows.findIndex(r => r.id === d.id);
        if (idx >= 0) dbRows[idx] = { ...dbRows[idx], status: newStatus, content };
        logHistory('deliverable', '更新交付件',
          `${d.name} · ${STAGE_LABELS[d.stage_id]} → ${STATUS_MAP[newStatus] || newStatus}`);
        saveBtn.style.background = '#22c55e';
        saveBtn.textContent = '已保存 ✓';
        setTimeout(() => {
          saveBtn.disabled = false;
          saveBtn.textContent = '保存';
          saveBtn.style.background = '';
        }, 1800);
        onSaved();
      } catch (err) {
        saveBtn.disabled = false; saveBtn.textContent = '保存';
        alert('保存失败：' + (err.message || ''));
      }
    });
    footer.appendChild(saveBtn);
    panel.appendChild(footer);
    detailPanel.appendChild(panel);
  }

  // ── 交付件详情 Modal（时间线点击用）──────────────────────────
  function showDelivDetailModal(d, dbRows, onSaved) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const modal = document.createElement('div');
    modal.className = 'modal modal-wide';
    modal.style.cssText = 'max-width:640px;width:90vw;max-height:85vh;overflow-y:auto;';

    const mhdr = document.createElement('div');
    mhdr.className = 'modal-header';
    mhdr.innerHTML = `<span class="modal-title">${d.name}</span><button class="modal-close">✕</button>`;
    modal.appendChild(mhdr);

    const mBody = document.createElement('div');
    mBody.style.cssText = 'padding:0';
    modal.appendChild(mBody);

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    mhdr.querySelector('.modal-close').addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

    showDelivDetail(d, mBody, dbRows, () => {
      if (onSaved) onSaved();
    });
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
        logHistory('meeting', '新增会议', title);
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
            const removed = arr[parseInt(btn.dataset.idx)];
            arr.splice(parseInt(btn.dataset.idx), 1);
            saveVirtualMembers(arr);
            logHistory('settings', '删除测试成员', removed ? removed.name : '');
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
        logHistory('settings', '添加测试成员', name);
        renderVmSection();
      });
    }
    renderVmSection();
    wrap.appendChild(vmSection);

    // ── 阶段评审时间 ──────────────────────────────────────
    const msSection = document.createElement('div');
    msSection.className = 'settings-section';
    const msCurrent = getMilestones() || {};
    msSection.innerHTML = `
      <div class="settings-section-title">阶段评审时间</div>
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:16px">
        设置各评审节点日期后，WEEK 行将自动按日期差计算周数，无需手动填写。
      </div>
      <div class="ms-grid" id="ms-grid"></div>
      <div style="margin-top:14px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <button class="btn-primary" id="ms-save">保存时间</button>
        <button class="btn-ghost" id="ms-clear">清除（恢复手动模式）</button>
        <span id="ms-msg" style="font-size:12px;color:var(--text-muted)"></span>
      </div>`;

    const msGrid = msSection.querySelector('#ms-grid');
    MILESTONE_DEFS.forEach(def => {
      const row = document.createElement('div');
      row.className = 'ms-row';
      row.innerHTML = `
        <div class="ms-label">
          <span class="ms-label-name">${def.label}</span>
          <span class="ms-label-desc">${def.desc}</span>
        </div>
        <input class="form-input ms-date-input" type="date" id="ms-${def.key}" value="${msCurrent[def.key] || ''}" />`;
      msGrid.appendChild(row);
    });
    wrap.appendChild(msSection);

    msSection.querySelector('#ms-save').addEventListener('click', () => {
      const m = {};
      MILESTONE_DEFS.forEach(def => {
        const v = msSection.querySelector(`#ms-${def.key}`).value;
        if (v) m[def.key] = v;
      });
      saveMilestones(Object.keys(m).length ? m : null);
      logHistory('settings', '更新评审时间', Object.entries(m).map(([k,v]) => `${k}:${v}`).join(' '));
      const msg = msSection.querySelector('#ms-msg');
      msg.style.color = '#22c55e'; msg.textContent = '已保存，时间线自动更新';
      setTimeout(() => { msg.textContent = ''; }, 2500);
      if (activeTab === 'timeline') renderTab('timeline');
    });
    msSection.querySelector('#ms-clear').addEventListener('click', () => {
      if (!confirm('确定清除评审时间，恢复手动调整周数模式？')) return;
      saveMilestones(null);
      MILESTONE_DEFS.forEach(def => { msSection.querySelector(`#ms-${def.key}`).value = ''; });
      const msg = msSection.querySelector('#ms-msg');
      msg.style.color = 'var(--text-muted)'; msg.textContent = '已清除';
      setTimeout(() => { msg.textContent = ''; }, 2000);
      if (activeTab === 'timeline') renderTab('timeline');
    });

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
        logHistory('settings', '更新项目信息', project.name);
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
        logHistory('settings', '添加成员', profiles[0].name || email);
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
  // 全局配置面板（右侧抽屉）
  // ============================================================
  function openConfigPanel() {
    document.querySelectorAll('.cfg-overlay').forEach(e => e.remove());

    const overlay = document.createElement('div');
    overlay.className = 'cfg-overlay';

    const panel = document.createElement('div');
    panel.className = 'cfg-panel';

    // ── 面板标题栏 ─────────────────────────────────────────
    const panelHdr = document.createElement('div');
    panelHdr.className = 'cfg-panel-hdr';
    panelHdr.innerHTML = `<span class="cfg-panel-title">⚙ 时间线配置</span>`;
    const closeBtn = document.createElement('button');
    closeBtn.className = 'cfg-panel-close';
    closeBtn.textContent = '✕';
    panelHdr.appendChild(closeBtn);
    panel.appendChild(panelHdr);

    // ── 面板主体 ───────────────────────────────────────────
    const body = document.createElement('div');
    body.className = 'cfg-panel-body';

    function buildTeamSection(roles, teamType, teamLabel) {
      const section = document.createElement('div');

      const teamHdr = document.createElement('div');
      teamHdr.className = 'cfg-team-hdr';
      teamHdr.innerHTML = `<span class="cfg-team-badge ${teamType}">${teamType.toUpperCase()}</span>${teamLabel}`;
      section.appendChild(teamHdr);

      roles.forEach(role => {
        const roleEl = document.createElement('div');
        roleEl.className = 'cfg-role';

        // 角色标题行
        const roleHdr = document.createElement('div');
        roleHdr.className = 'cfg-role-hdr';
        if (!isRoleEnabled(role.id)) roleHdr.style.opacity = '.5';

        // 职能开关
        const toggleLabel = document.createElement('label');
        toggleLabel.className = 'toggle-switch';
        const toggleInp = document.createElement('input');
        toggleInp.type = 'checkbox';
        toggleInp.checked = isRoleEnabled(role.id);
        const toggleSlider = document.createElement('span');
        toggleSlider.className = 'toggle-slider';
        toggleLabel.appendChild(toggleInp);
        toggleLabel.appendChild(toggleSlider);
        toggleInp.addEventListener('change', () => {
          setRoleEnabled(role.id, toggleInp.checked);
          roleHdr.style.opacity = toggleInp.checked ? '' : '.5';
          logHistory('timeline', toggleInp.checked ? '启用职能' : '禁用职能', role.title);
        });

        // 职能信息
        const roleInfo = document.createElement('div');
        roleInfo.className = 'cfg-role-info';
        roleInfo.innerHTML = `<div class="cfg-role-name">${role.title}</div><div class="cfg-role-sub">${role.subtitle}</div>`;

        // 成员分配（内联）
        const assignWrap = document.createElement('div');
        function renderInlineAssign() {
          assignWrap.innerHTML = '';
          const cur = getRoleAssignments()[role.id];
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
            chip.addEventListener('click', e => { e.stopPropagation(); openAssignPopover(role.id, chip, renderInlineAssign); });
            assignWrap.appendChild(chip);
          } else {
            const plusBtn = document.createElement('button');
            plusBtn.className = 'role-assign-btn';
            plusBtn.title = '分配成员';
            plusBtn.textContent = '+';
            plusBtn.addEventListener('click', e => { e.stopPropagation(); openAssignPopover(role.id, plusBtn, renderInlineAssign); });
            assignWrap.appendChild(plusBtn);
          }
        }
        renderInlineAssign();

        // 展开按钮
        const expandBtn = document.createElement('button');
        expandBtn.className = 'cfg-role-expand';
        expandBtn.textContent = '▶';

        roleHdr.appendChild(toggleLabel);
        roleHdr.appendChild(roleInfo);
        roleHdr.appendChild(assignWrap);
        roleHdr.appendChild(expandBtn);

        // 角色展开体（交付件开关）
        const roleBody = document.createElement('div');
        roleBody.className = 'cfg-role-body';

        function buildRoleBody() {
          roleBody.innerHTML = '';
          STAGES.forEach(stage => {
            const stageData = getEffectiveStageData(role, stage.id);
            const allDelivs = stageData.deliverables || [];
            if (!allDelivs.length) return;

            const stageRow = document.createElement('div');
            stageRow.className = 'cfg-stage-row';

            const stageLabel = document.createElement('div');
            stageLabel.className = 'cfg-stage-label';
            stageLabel.innerHTML = `<span class="cfg-stage-code">${stage.code}</span>${stage.name}`;
            stageRow.appendChild(stageLabel);

            const disabledSet = new Set(stageData.disabled || []);

            allDelivs.forEach(d => {
              const delivRow = document.createElement('div');
              delivRow.className = 'cfg-deliv-row';

              const tog = document.createElement('label');
              tog.className = 'toggle-switch';
              const togInp = document.createElement('input');
              togInp.type = 'checkbox';
              togInp.checked = !disabledSet.has(d);
              const togSlider = document.createElement('span');
              togSlider.className = 'toggle-slider';
              tog.appendChild(togInp);
              tog.appendChild(togSlider);

              const text = document.createElement('span');
              text.className = 'cfg-deliv-text' + (disabledSet.has(d) ? ' off' : '');
              text.textContent = d;

              togInp.addEventListener('change', () => {
                if (togInp.checked) { disabledSet.delete(d); text.className = 'cfg-deliv-text'; }
                else { disabledSet.add(d); text.className = 'cfg-deliv-text off'; }
                const effective = getEffectiveStageData(role, stage.id);
                saveCustomStageData(role.id, stage.id, {
                  deliverables: effective.deliverables || [],
                  disabled: Array.from(disabledSet),
                  models: effective.models || [],
                });
                logHistory('timeline', togInp.checked ? '启用交付件' : '禁用交付件', `${role.title} · ${stage.code} · ${d}`);
              });

              delivRow.appendChild(tog);
              delivRow.appendChild(text);
              stageRow.appendChild(delivRow);
            });

            roleBody.appendChild(stageRow);
          });
        }

        let expanded = false;
        expandBtn.addEventListener('click', () => {
          expanded = !expanded;
          expandBtn.textContent = expanded ? '▼' : '▶';
          roleBody.classList.toggle('open', expanded);
          if (expanded && !roleBody.children.length) buildRoleBody();
        });

        roleEl.appendChild(roleHdr);
        roleEl.appendChild(roleBody);
        section.appendChild(roleEl);
      });

      return section;
    }

    // ── 显示设置 ───────────────────────────────────────────
    const displaySection = document.createElement('div');
    const displayHdr = document.createElement('div');
    displayHdr.className = 'cfg-team-hdr';
    displayHdr.textContent = '显示设置';
    displaySection.appendChild(displayHdr);

    const modelRow = document.createElement('div');
    modelRow.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px 12px;background:#f8fafc;border:1px solid var(--border);border-radius:8px;';
    const modelInfo = document.createElement('div');
    modelInfo.style.cssText = 'flex:1;min-width:0;';
    modelInfo.innerHTML = `<div style="font-size:13px;font-weight:600;color:var(--text-primary)">方法论模型标签</div><div style="font-size:11px;color:var(--text-muted);margin-top:2px">绿色方法论工具标签（如 PEST分析、Kano模型）</div>`;
    const modelToggle = document.createElement('label');
    modelToggle.className = 'toggle-switch';
    const modelInp = document.createElement('input');
    modelInp.type = 'checkbox';
    modelInp.checked = getShowModels();
    const modelSlider = document.createElement('span');
    modelSlider.className = 'toggle-slider';
    modelToggle.appendChild(modelInp);
    modelToggle.appendChild(modelSlider);
    modelInp.addEventListener('change', () => {
      setShowModels(modelInp.checked);
      logHistory('timeline', modelInp.checked ? '显示方法论标签' : '隐藏方法论标签', '');
    });
    modelRow.appendChild(modelInfo);
    modelRow.appendChild(modelToggle);
    displaySection.appendChild(modelRow);
    body.appendChild(displaySection);

    body.appendChild(buildTeamSection(PDT_ROLES, 'pdt', 'PDT — 产品开发团队'));
    body.appendChild(buildTeamSection(PCT_ROLES, 'pct', 'PCT — 产品商业化团队'));
    panel.appendChild(body);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    requestAnimationFrame(() => panel.classList.add('open'));

    function closePanel() {
      panel.classList.remove('open');
      setTimeout(() => { overlay.remove(); renderTab('timeline'); }, 260);
    }

    closeBtn.addEventListener('click', closePanel);
    overlay.addEventListener('click', e => { if (e.target === overlay) closePanel(); });
  }

  // ============================================================
  // 阶段交付件配置 Modal
  // ============================================================
  function openStageCellEdit(roleData, stage, onSaved) {
    document.querySelectorAll('.stage-edit-overlay').forEach(e => e.remove());

    const customData  = getCustomStageData(roleData.id, stage.id);
    const defaultData = roleData.stages[stage.id] || { deliverables: [], models: [] };

    // allDelivs = 完整列表（含已关闭）；disabledSet = 当前关闭的条目文本集合
    let allDelivs   = customData ? [...(customData.deliverables || [])] : [...(defaultData.deliverables || [])];
    let disabledSet = new Set(customData ? (customData.disabled || []) : []);

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay stage-edit-overlay';

    function render() {
      overlay.innerHTML = '';
      const modal = document.createElement('div');
      modal.className = 'modal';

      const rowsHtml = allDelivs.map((d, i) => {
        const on = !disabledSet.has(d);
        return `<div class="deliv-edit-item" data-idx="${i}">
          <label class="toggle-switch" style="flex-shrink:0">
            <input type="checkbox" class="deliv-toggle" data-idx="${i}" ${on ? 'checked' : ''}/>
            <span class="toggle-slider"></span>
          </label>
          <input class="form-input deliv-edit-input" value="${d.replace(/"/g,'&quot;')}" data-idx="${i}"
            style="${on ? '' : 'opacity:.4;text-decoration:line-through;'}" />
        </div>`;
      }).join('') || '<div style="font-size:12px;color:var(--text-muted);padding:6px 0">暂无交付件</div>';

      modal.innerHTML = `
        <div class="modal-header">
          <span class="modal-title">${roleData.title} · ${stage.code} 交付件配置</span>
          <button class="modal-close">✕</button>
        </div>
        <div class="modal-body">
          <div style="font-size:12px;color:var(--text-muted);margin-bottom:12px">
            关闭开关将在时间线中隐藏该交付件，数据保留可随时恢复。
          </div>
          <div class="form-group">
            <label class="form-label">交付件列表</label>
            <div id="del-list">${rowsHtml}</div>
            <div class="deliv-add-row" style="margin-top:10px">
              <input class="form-input" id="new-del-inp" placeholder="添加新交付件…" />
              <button class="btn-ghost" id="add-del-btn">＋ 添加</button>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-ghost" id="se-cancel">取消</button>
          <button class="btn-ghost" id="se-reset" style="color:#f59e0b">恢复默认</button>
          <button class="btn-primary" id="se-save">保存</button>
        </div>`;
      overlay.appendChild(modal);

      modal.querySelector('.modal-close').addEventListener('click', () => overlay.remove());
      overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
      modal.querySelector('#se-cancel').addEventListener('click', () => overlay.remove());

      // 开关切换：实时更新 disabled 集合 + 输入框样式
      modal.querySelectorAll('.deliv-toggle').forEach(chk => {
        chk.addEventListener('change', () => {
          const idx = parseInt(chk.dataset.idx);
          const inp = modal.querySelector(`.deliv-edit-input[data-idx="${idx}"]`);
          if (chk.checked) {
            disabledSet.delete(allDelivs[idx]);
            if (inp) { inp.style.opacity = ''; inp.style.textDecoration = ''; }
          } else {
            disabledSet.add(allDelivs[idx]);
            if (inp) { inp.style.opacity = '.4'; inp.style.textDecoration = 'line-through'; }
          }
        });
      });

      const newInp = modal.querySelector('#new-del-inp');
      modal.querySelector('#add-del-btn').addEventListener('click', () => {
        const v = newInp.value.trim();
        if (!v) return;
        allDelivs.push(v); // 新增默认开启
        newInp.value = '';
        render();
      });
      newInp.addEventListener('keydown', e => { if (e.key === 'Enter') modal.querySelector('#add-del-btn').click(); });

      modal.querySelector('#se-reset').addEventListener('click', () => {
        if (!confirm('确定恢复为默认交付件吗？')) return;
        saveCustomStageData(roleData.id, stage.id, null);
        overlay.remove();
        onSaved();
      });

      modal.querySelector('#se-save').addEventListener('click', () => {
        const inputs = modal.querySelectorAll('.deliv-edit-input');
        const savedDelivs = allDelivs.map((_, i) => inputs[i]?.value.trim() || allDelivs[i]);
        const newDisabled = [];
        modal.querySelectorAll('.deliv-toggle').forEach(chk => {
          if (!chk.checked) newDisabled.push(savedDelivs[parseInt(chk.dataset.idx)]);
        });
        const effective = getEffectiveStageData(roleData, stage.id);
        saveCustomStageData(roleData.id, stage.id, {
          deliverables: savedDelivs,
          disabled: newDisabled,
          models: effective.models || [],
        });
        logHistory('timeline', '配置交付件', `${roleData.title} · ${stage.code}`);
        overlay.remove();
        onSaved();
      });
    }

    render();
    document.body.appendChild(overlay);
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

  // ============================================================
  // TAB 4 — 看板（项目概览 + 操作历史）
  // ============================================================
  async function renderKanban() {
    const wrap = document.createElement('div');
    wrap.className = 'tab-kanban';
    tabContent.appendChild(wrap);

    // ── 加载数据 ──────────────────────────────────────────────
    const allRows  = await getOrLoadDbRows();
    const milestones = getMilestones();
    const { stageIdx: todayIdx, fraction: todayFrac } = calcTodayStageInfo();

    // 过滤掉被禁用的交付件（与交付件视图逻辑一致）
    const visRows = allRows.filter(d => {
      if (!isRoleEnabled(d.role_id)) return false;
      const custom = getCustomStageData(d.role_id, d.stage_id);
      return !custom?.disabled?.includes(d.name);
    });

    const SC = { pending:'#94a3b8', in_progress:'#f59e0b', submitted:'#3b82f6', approved:'#22c55e' };
    const SM = { pending:'待提交', in_progress:'进行中', submitted:'已提交', approved:'已批准' };

    // ── 概览卡片区 ────────────────────────────────────────────
    const overviewHdr = document.createElement('div');
    overviewHdr.className = 'kanban-section-hdr';
    overviewHdr.textContent = '项目概览';
    wrap.appendChild(overviewHdr);

    const cards = document.createElement('div');
    cards.className = 'kanban-cards';
    wrap.appendChild(cards);

    // 卡片 1 — 交付件总览
    const total    = visRows.length;
    const approved = visRows.filter(d => d.status === 'approved').length;
    const submitted = visRows.filter(d => d.status === 'submitted').length;
    const inProg   = visRows.filter(d => d.status === 'in_progress').length;
    const pending  = visRows.filter(d => d.status === 'pending').length;
    const pct      = total ? Math.round(approved / total * 100) : 0;

    const c1 = document.createElement('div');
    c1.className = 'kanban-card';
    c1.innerHTML = `
      <div class="kc-label">交付件完成</div>
      <div class="kc-main">${approved}<span class="kc-denom"> / ${total}</span></div>
      <div class="kc-bar-wrap"><div class="kc-bar" style="width:${pct}%;background:#22c55e"></div></div>
      <div class="kc-sub">${pct}% 已批准</div>
      <div class="kc-status-row">
        <span style="color:${SC.pending}">待提交 ${pending}</span>
        <span style="color:${SC.in_progress}">进行中 ${inProg}</span>
        <span style="color:${SC.submitted}">已提交 ${submitted}</span>
      </div>`;
    cards.appendChild(c1);

    // 卡片 2 — 时间进度
    const c2 = document.createElement('div');
    c2.className = 'kanban-card';
    let timeContent = '';
    if (milestones && milestones.kickoff) {
      const kickMs  = new Date(milestones.kickoff).getTime();
      const endKey  = milestones.gr6_end || milestones.gr5a_end || milestones.launch;
      const endMs   = endKey ? new Date(endKey).getTime() : null;
      const nowMs   = Date.now();
      const elapsed = nowMs - kickMs;
      const timePct = endMs ? Math.max(0, Math.min(100, Math.round(elapsed / (endMs - kickMs) * 100))) : null;
      const elapsedWeeks = Math.max(0, Math.round(elapsed / 604800000));

      // 下一个里程碑
      const mDefs = [
        { key:'cdcp', label:'CDCP' }, { key:'pdcp', label:'PDCP' },
        { key:'devval', label:'开发验证' }, { key:'adcp', label:'ADCP' },
        { key:'launch', label:'发布' }, { key:'gr5a_end', label:'稳定期结束' }, { key:'gr6_end', label:'退市完成' },
      ];
      const upcoming = mDefs.find(m => milestones[m.key] && new Date(milestones[m.key]).getTime() > nowMs);
      let upcomingStr = '';
      if (upcoming) {
        const daysLeft = Math.ceil((new Date(milestones[upcoming.key]).getTime() - nowMs) / 86400000);
        const urgentCls = daysLeft <= 14 ? 'kc-upcoming-urgent' : 'kc-upcoming';
        upcomingStr = `<div class="${urgentCls}">▶ ${upcoming.label} 还剩 ${daysLeft} 天</div>`;
      }
      timeContent = `
        <div class="kc-label">时间进度</div>
        <div class="kc-main">${timePct !== null ? timePct + '%' : '—'}</div>
        ${timePct !== null ? `<div class="kc-bar-wrap"><div class="kc-bar" style="width:${timePct}%;background:#2563eb"></div></div>` : ''}
        <div class="kc-sub">Kick-off 后第 ${elapsedWeeks} 周</div>
        ${upcomingStr}`;
    } else {
      timeContent = `
        <div class="kc-label">时间进度</div>
        <div class="kc-main" style="font-size:14px;margin-top:8px">未设置里程碑</div>
        <div class="kc-sub" style="margin-top:8px">在"设置"中配置各节点时间后<br>此处将显示时间进度</div>`;
    }
    c2.innerHTML = timeContent;
    cards.appendChild(c2);

    // 卡片 3 — 当前阶段完成情况
    const c3 = document.createElement('div');
    c3.className = 'kanban-card';
    if (todayIdx >= 0) {
      const curStageId  = STAGE_ORDER[todayIdx];
      const stageRows   = visRows.filter(d => d.stage_id === curStageId);
      const stageApproved = stageRows.filter(d => d.status === 'approved').length;
      const stagePct    = stageRows.length ? Math.round(stageApproved / stageRows.length * 100) : 0;
      const stageLabel  = (STAGE_LABELS[curStageId] || curStageId).replace(/^GR\w+\s/, '');
      const stageProg   = Math.round(todayFrac * 100);
      c3.innerHTML = `
        <div class="kc-label">当前阶段</div>
        <div class="kc-stage-code">${curStageId.toUpperCase()}</div>
        <div class="kc-stage-name">${stageLabel}</div>
        <div class="kc-bar-wrap" title="交付件完成率">
          <div class="kc-bar" style="width:${stagePct}%;background:#7c3aed"></div>
        </div>
        <div class="kc-sub">交付件 ${stageApproved}/${stageRows.length} 已批准 · 阶段进度 ${stageProg}%</div>`;
    } else {
      c3.innerHTML = `<div class="kc-label">当前阶段</div>
        <div class="kc-sub" style="margin-top:12px">项目已完成或尚未开始</div>`;
    }
    cards.appendChild(c3);

    // 卡片 4 — 健康状态
    const c4 = document.createElement('div');
    c4.className = 'kanban-card';
    // 计算风险项
    const riskItems = visRows.filter(d =>
      isStageAccessible(d.stage_id) && (d.status === 'pending' || d.status === 'in_progress'));
    const blockers  = visRows.filter(d =>
      isStageAccessible(d.stage_id) && d.status === 'pending' && STAGE_ORDER.indexOf(d.stage_id) < todayIdx);
    const healthLevel = blockers.length > 0 ? 'danger' : riskItems.length > 3 ? 'warn' : 'ok';
    const healthLabels = { ok: ['🟢', '健康', '#166534', '#dcfce7'], warn: ['🟡', '需关注', '#92400e', '#fef3c7'], danger: ['🔴', '存在风险', '#991b1b', '#fee2e2'] };
    const [hIcon, hText, hColor, hBg] = healthLabels[healthLevel];
    c4.innerHTML = `
      <div class="kc-label">整体健康</div>
      <div class="kc-health" style="color:${hColor};background:${hBg}">${hIcon} ${hText}</div>
      <div class="kc-sub" style="margin-top:10px">
        ${blockers.length ? `<div style="color:#dc2626">⚠ ${blockers.length} 项已逾期</div>` : ''}
        ${riskItems.length - blockers.length > 0 ? `<div style="color:#d97706">⏳ ${riskItems.length - blockers.length} 项进行中</div>` : ''}
        ${!riskItems.length ? '<div style="color:#166534">✓ 无待处理风险项</div>' : ''}
      </div>`;
    cards.appendChild(c4);

    // ── 各阶段进度条 ──────────────────────────────────────────
    const stageHdr = document.createElement('div');
    stageHdr.className = 'kanban-section-hdr';
    stageHdr.textContent = '各阶段进度';
    wrap.appendChild(stageHdr);

    const stageGrid = document.createElement('div');
    stageGrid.className = 'kanban-stage-grid';
    wrap.appendChild(stageGrid);

    STAGE_ORDER.forEach((sid, idx) => {
      const rows   = visRows.filter(d => d.stage_id === sid);
      const appr   = rows.filter(d => d.status === 'approved').length;
      const subm   = rows.filter(d => d.status === 'submitted').length;
      const inp    = rows.filter(d => d.status === 'in_progress').length;
      const pend   = rows.filter(d => d.status === 'pending').length;
      const pct    = rows.length ? Math.round(appr / rows.length * 100) : 0;
      const accessible = isStageAccessible(sid);
      const isCurrent  = idx === todayIdx;

      let statusIcon, statusText, statusColor;
      if (!accessible && idx > todayIdx) {
        statusIcon = '🔒'; statusText = '未解锁'; statusColor = '#94a3b8';
      } else if (pct === 100) {
        statusIcon = '✅'; statusText = '全部完成'; statusColor = '#166534';
      } else if (pend > 0 && accessible && idx < todayIdx) {
        statusIcon = '🔴'; statusText = `${pend} 项逾期`; statusColor = '#dc2626';
      } else if (inp > 0 || (pend > 0 && isCurrent)) {
        statusIcon = '🟡'; statusText = '进行中'; statusColor = '#d97706';
      } else {
        statusIcon = '⬜'; statusText = '待开始'; statusColor = '#94a3b8';
      }

      const row = document.createElement('div');
      row.className = `kanban-stage-row${isCurrent ? ' current' : ''}${!accessible && idx > todayIdx ? ' locked' : ''}`;
      row.innerHTML = `
        <div class="ksr-code">${sid.toUpperCase()}</div>
        <div class="ksr-name">${(STAGE_LABELS[sid] || '').replace(/^GR\w+\s/, '')}</div>
        <div class="ksr-bar-area">
          <div class="ksr-bar-bg">
            <div class="ksr-bar-fill appr" style="width:${rows.length ? appr/rows.length*100 : 0}%"></div>
            <div class="ksr-bar-fill subm" style="width:${rows.length ? subm/rows.length*100 : 0}%;left:${rows.length ? appr/rows.length*100 : 0}%"></div>
            <div class="ksr-bar-fill inp"  style="width:${rows.length ? inp/rows.length*100 : 0}%;left:${rows.length ? (appr+subm)/rows.length*100 : 0}%"></div>
          </div>
          <span class="ksr-pct">${pct}%</span>
        </div>
        <div class="ksr-count">${appr}/${rows.length}</div>
        <div class="ksr-status" style="color:${statusColor}">${statusIcon} ${statusText}</div>`;
      stageGrid.appendChild(row);
    });

    // ── 风险清单 ──────────────────────────────────────────────
    if (riskItems.length > 0) {
      const riskHdr = document.createElement('div');
      riskHdr.className = 'kanban-section-hdr';
      riskHdr.innerHTML = `风险 / 待处理 <span class="kanban-badge">${riskItems.length}</span>`;
      wrap.appendChild(riskHdr);

      const riskList = document.createElement('div');
      riskList.className = 'kanban-risk-list';
      wrap.appendChild(riskList);

      // Sort: overdue (past stage + pending) first, then current stage, then in_progress
      const sorted = [...riskItems].sort((a, b) => {
        const aOverdue = a.status === 'pending' && STAGE_ORDER.indexOf(a.stage_id) < todayIdx;
        const bOverdue = b.status === 'pending' && STAGE_ORDER.indexOf(b.stage_id) < todayIdx;
        if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
        return STAGE_ORDER.indexOf(a.stage_id) - STAGE_ORDER.indexOf(b.stage_id);
      });

      sorted.forEach(d => {
        const stageIdx = STAGE_ORDER.indexOf(d.stage_id);
        const isOverdue = d.status === 'pending' && stageIdx < todayIdx;
        const roleInfo  = ALL_ROLES.find(r => r.id === d.role_id) || { color: '#64748b' };

        const item = document.createElement('div');
        item.className = `kanban-risk-item ${isOverdue ? 'overdue' : 'warn'}`;
        item.innerHTML = `
          <span class="krisk-icon">${isOverdue ? '🔴' : '🟡'}</span>
          <div class="krisk-body">
            <div class="krisk-name">${d.name}</div>
            <div class="krisk-meta">
              <span class="deliv-role-badge" style="background:${roleInfo.color}18;color:${roleInfo.color}">${d.role_label}</span>
              <span style="font-size:11px;color:var(--text-muted)">${STAGE_LABELS[d.stage_id] || d.stage_id}</span>
            </div>
          </div>
          <span class="krisk-status" style="color:${SC[d.status]}">${SM[d.status]}</span>
          <button class="krisk-edit-btn" title="打开编辑">编辑</button>`;
        item.querySelector('.krisk-edit-btn').addEventListener('click', () => {
          showDelivDetailModal(d, allRows, async () => {
            // Refresh kanban after save
            tabContent.innerHTML = '';
            renderKanban();
          });
        });
        riskList.appendChild(item);
      });
    }

    // ── 操作历史 ──────────────────────────────────────────────
    const histSep = document.createElement('div');
    histSep.className = 'kanban-section-hdr';
    histSep.style.marginTop = '8px';
    const clearBtn = document.createElement('button');
    clearBtn.className = 'btn-ghost';
    clearBtn.style.cssText = 'margin-left:auto;font-size:12px';
    clearBtn.textContent = '清空记录';
    clearBtn.addEventListener('click', () => {
      if (!confirm('确定清空所有操作记录？')) return;
      localStorage.removeItem(LS_HISTORY);
      renderHistory();
    });
    histSep.textContent = '操作历史';
    histSep.appendChild(clearBtn);
    wrap.appendChild(histSep);

    const CAT_CONFIG = [
      { id: 'all',         label: '全部',  color: '#475569' },
      { id: 'timeline',    label: '时间线', color: '#2563eb' },
      { id: 'deliverable', label: '交付件', color: '#7c3aed' },
      { id: 'meeting',     label: '会议',  color: '#0891b2' },
      { id: 'settings',    label: '设置',  color: '#64748b' },
    ];

    let activeFilter = 'all';

    const filterBar = document.createElement('div');
    filterBar.className = 'hist-filter-bar';
    const filterBtns = {};
    CAT_CONFIG.forEach(c => {
      const btn = document.createElement('button');
      btn.className = `hist-filter-btn${c.id === activeFilter ? ' active' : ''}`;
      btn.textContent = c.label;
      btn.style.setProperty('--cat-color', c.color);
      btn.addEventListener('click', () => {
        activeFilter = c.id;
        Object.values(filterBtns).forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderHistory();
      });
      filterBtns[c.id] = btn;
      filterBar.appendChild(btn);
    });
    wrap.appendChild(filterBar);

    const histList = document.createElement('div');
    histList.className = 'hist-list';
    wrap.appendChild(histList);

    function renderHistory() {
      histList.innerHTML = '';
      const all = getHistory();
      const filtered = activeFilter === 'all' ? all : all.filter(h => h.category === activeFilter);
      const catMap = Object.fromEntries(CAT_CONFIG.map(c => [c.id, c]));

      if (!filtered.length) {
        histList.innerHTML = `<div class="empty-state" style="padding:32px 0">暂无操作记录</div>`;
        return;
      }

      const groups = {};
      filtered.forEach(h => {
        const day = h.ts ? h.ts.slice(0, 10) : '未知日期';
        if (!groups[day]) groups[day] = [];
        groups[day].push(h);
      });

      Object.entries(groups).forEach(([day, items]) => {
        const dayHdr = document.createElement('div');
        dayHdr.className = 'hist-day-hdr';
        const today = new Date().toISOString().slice(0, 10);
        const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        dayHdr.textContent = day === today ? '今天' : day === yesterday ? '昨天' : day;
        histList.appendChild(dayHdr);

        items.forEach(h => {
          const cat = catMap[h.category] || { label: h.category, color: '#64748b' };
          const item = document.createElement('div');
          item.className = 'hist-item';
          const avatarLetter = (h.userName || '?').charAt(0).toUpperCase();
          item.innerHTML = `
            <div class="hist-avatar">${avatarLetter}</div>
            <div class="hist-body">
              <div class="hist-top">
                <span class="hist-cat-badge" style="background:${cat.color}18;color:${cat.color}">${cat.label}</span>
                <span class="hist-action">${h.action}</span>
                <span class="hist-time">${formatRelativeTime(h.ts)}</span>
              </div>
              ${h.detail ? `<div class="hist-detail">${h.detail}</div>` : ''}
              <div class="hist-who">
                <span class="hist-username">${h.userName || '未知'}</span>
                ${h.userEmail ? `<span class="hist-email">${h.userEmail}</span>` : ''}
              </div>
            </div>`;
          histList.appendChild(item);
        });
      });
    }

    renderHistory();
  }

  // ── TAB 5 — To-do ────────────────────────────────────────
  // ============================================================
  function renderTodo() {
    function getTodos() {
      try { return JSON.parse(localStorage.getItem(LS_TODOS) || '[]'); }
      catch { return []; }
    }
    function saveTodos(t) { localStorage.setItem(LS_TODOS, JSON.stringify(t)); }

    const wrap = document.createElement('div');
    wrap.className = 'tab-todo';
    tabContent.appendChild(wrap);

    // Header
    const hdr = document.createElement('div');
    hdr.className = 'tab-section-header';
    hdr.innerHTML = `<span class="tab-section-title">待办</span>`;
    const addBtn = document.createElement('button');
    addBtn.className = 'btn-primary';
    addBtn.textContent = '+ 新建待办';
    addBtn.style.marginLeft = 'auto';
    addBtn.addEventListener('click', () => showTodoModal(null));
    hdr.appendChild(addBtn);
    wrap.appendChild(hdr);

    // LLM banner
    const banner = document.createElement('div');
    banner.className = 'llm-banner';
    banner.innerHTML = `
      <div class="llm-banner-icon">🤖</div>
      <div class="llm-banner-body">
        <div class="llm-banner-title">AI 待办生成 <span class="llm-badge">即将接入</span></div>
        <div class="llm-banner-desc">接入 LLM 后，上传会议记录或文档，AI 将自动识别待办事项、设定截止时间并指派责任人；会议决策也将自动同步至此。</div>
      </div>`;
    wrap.appendChild(banner);

    let statusFilter = 'all';
    const filterBar = document.createElement('div');
    filterBar.className = 'todo-filter-bar';
    wrap.appendChild(filterBar);

    const todoList = document.createElement('div');
    todoList.className = 'todo-list';
    wrap.appendChild(todoList);

    function renderList() {
      const todos = getTodos();
      const open   = todos.filter(t => t.status !== 'done');
      const done   = todos.filter(t => t.status === 'done');
      const inProg = todos.filter(t => t.status === 'in_progress');

      filterBar.innerHTML = '';
      [
        { id: 'all',         label: `全部 ${todos.length}` },
        { id: 'open',        label: `待处理 ${open.filter(t => t.status === 'open').length}` },
        { id: 'in_progress', label: `进行中 ${inProg.length}` },
        { id: 'done',        label: `已完成 ${done.length}` },
      ].forEach(f => {
        const btn = document.createElement('button');
        btn.className = 'todo-filter-btn' + (statusFilter === f.id ? ' active' : '');
        btn.textContent = f.label;
        btn.addEventListener('click', () => { statusFilter = f.id; renderList(); });
        filterBar.appendChild(btn);
      });

      todoList.innerHTML = '';
      const filtered = statusFilter === 'all'  ? todos
        : statusFilter === 'open' ? todos.filter(t => t.status === 'open')
        : todos.filter(t => t.status === statusFilter);

      if (!filtered.length) {
        todoList.innerHTML = `<div class="empty-state" style="padding:48px 0">暂无待办事项</div>`;
        return;
      }

      // Sort: overdue pending first, then by dueDate, done last
      const sorted = [...filtered].sort((a, b) => {
        if (a.status === 'done' && b.status !== 'done') return 1;
        if (a.status !== 'done' && b.status === 'done') return -1;
        const ao = a.status !== 'done' && a.dueDate && new Date(a.dueDate) < new Date();
        const bo = b.status !== 'done' && b.dueDate && new Date(b.dueDate) < new Date();
        if (ao !== bo) return ao ? -1 : 1;
        if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
        return a.dueDate ? -1 : b.dueDate ? 1 : 0;
      });
      sorted.forEach(t => todoList.appendChild(buildTodoItem(t)));
    }

    const PRIORITY_CFG = {
      high:   { color: '#dc2626', bg: '#fee2e2', label: '高' },
      medium: { color: '#d97706', bg: '#fef3c7', label: '中' },
      low:    { color: '#2563eb', bg: '#dbeafe', label: '低' },
    };
    const SOURCE_LABELS  = { manual: '手动创建', meeting: '会议决策', llm: 'AI 生成' };
    const STATUS_LABELS  = { open: '待处理', in_progress: '进行中', done: '已完成' };
    const STATUS_COLORS  = { open: '#94a3b8', in_progress: '#f59e0b', done: '#22c55e' };

    function buildTodoItem(todo) {
      const pc       = PRIORITY_CFG[todo.priority] || PRIORITY_CFG.medium;
      const isDone   = todo.status === 'done';
      const isOverdue = !isDone && todo.dueDate && new Date(todo.dueDate) < new Date();

      const item = document.createElement('div');
      item.className = `todo-item${isDone ? ' done' : ''}${isOverdue ? ' overdue' : ''}`;

      const check = document.createElement('button');
      check.className = `todo-check${isDone ? ' checked' : ''}`;
      check.innerHTML = isDone ? '✓' : '';
      check.title = isDone ? '标记为待处理' : '标记为已完成';
      check.addEventListener('click', e => {
        e.stopPropagation();
        const todos = getTodos();
        const t = todos.find(x => x.id === todo.id);
        if (t) { t.status = isDone ? 'open' : 'done'; t.updatedAt = new Date().toISOString(); }
        saveTodos(todos);
        renderList();
      });

      const body = document.createElement('div');
      body.className = 'todo-body';
      body.style.cursor = 'pointer';
      body.addEventListener('click', () => showTodoModal(todo));

      const title = document.createElement('div');
      title.className = 'todo-title';
      title.textContent = todo.title;
      body.appendChild(title);

      const meta = document.createElement('div');
      meta.className = 'todo-meta';
      const parts = [];
      if (todo.assignee) parts.push(`<span class="todo-assignee">@${todo.assignee}</span>`);
      if (todo.dueDate) {
        const ds = new Date(todo.dueDate).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
        parts.push(`<span class="todo-due${isOverdue ? ' overdue-text' : ''}">${isOverdue ? '⚠ ' : ''}${ds}</span>`);
      }
      if (todo.stageId) parts.push(`<span class="todo-stage-tag">${todo.stageId.toUpperCase()}</span>`);
      if (todo.description) parts.push(`<span class="todo-desc-snippet">${todo.description.slice(0, 50)}${todo.description.length > 50 ? '…' : ''}</span>`);
      meta.innerHTML = parts.join('');
      body.appendChild(meta);

      const right = document.createElement('div');
      right.className = 'todo-right';
      right.innerHTML = `
        <span class="todo-priority-badge" style="background:${pc.bg};color:${pc.color}">${pc.label}</span>
        <span class="todo-source-tag">${SOURCE_LABELS[todo.source] || todo.source}</span>`;

      item.appendChild(check);
      item.appendChild(body);
      item.appendChild(right);
      return item;
    }

    function showTodoModal(todo) {
      const isNew = !todo;
      const assignments = getRoleAssignments();
      const vMembers    = getVirtualMembers();
      const memberOpts  = [
        ...Object.entries(assignments).map(([, m]) => `<option value="${m.name}">${m.name}</option>`),
        ...vMembers.map(m => `<option value="${m.name}">${m.name}</option>`),
      ].join('');

      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.innerHTML = `
        <div class="modal">
          <div class="modal-header">
            <span class="modal-title">${isNew ? '新建待办' : '编辑待办'}</span>
            <button class="modal-close">✕</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">标题 *</label>
              <input class="form-input" id="t-title" value="${todo?.title || ''}" placeholder="待办事项标题…" />
            </div>
            <div class="form-group">
              <label class="form-label">说明</label>
              <textarea class="form-textarea" id="t-desc" rows="3" placeholder="补充说明…">${todo?.description || ''}</textarea>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
              <div class="form-group">
                <label class="form-label">责任人</label>
                <input class="form-input" id="t-assignee" value="${todo?.assignee || ''}"
                  list="t-member-list" placeholder="姓名或角色…" />
                <datalist id="t-member-list">${memberOpts}</datalist>
              </div>
              <div class="form-group">
                <label class="form-label">截止日期</label>
                <input class="form-input" type="date" id="t-due" value="${todo?.dueDate || ''}" />
              </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
              <div class="form-group">
                <label class="form-label">优先级</label>
                <select class="form-select" id="t-priority">
                  <option value="high"   ${todo?.priority==='high'   ?'selected':''}>🔴 高</option>
                  <option value="medium" ${(!todo?.priority||todo?.priority==='medium')?'selected':''}>🟡 中</option>
                  <option value="low"    ${todo?.priority==='low'    ?'selected':''}>🔵 低</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">状态</label>
                <select class="form-select" id="t-status">
                  <option value="open"        ${(!todo?.status||todo?.status==='open')?'selected':''}>待处理</option>
                  <option value="in_progress"  ${todo?.status==='in_progress'?'selected':''}>进行中</option>
                  <option value="done"         ${todo?.status==='done'?'selected':''}>已完成</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">关联阶段</label>
                <select class="form-select" id="t-stage">
                  <option value="">不关联</option>
                  ${STAGE_ORDER.map(s => `<option value="${s}" ${todo?.stageId===s?'selected':''}>${s.toUpperCase()}</option>`).join('')}
                </select>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            ${!isNew ? '<button class="btn-ghost" id="t-delete" style="color:#dc2626;margin-right:auto">删除</button>' : ''}
            <button class="btn-ghost" id="t-cancel">取消</button>
            <button class="btn-primary" id="t-save">保存</button>
          </div>
        </div>`;

      const close = () => overlay.remove();
      overlay.querySelector('.modal-close').addEventListener('click', close);
      overlay.querySelector('#t-cancel').addEventListener('click', close);
      overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
      if (!isNew) {
        overlay.querySelector('#t-delete').addEventListener('click', () => {
          if (!confirm('确定删除？')) return;
          saveTodos(getTodos().filter(t => t.id !== todo.id));
          close(); renderList();
        });
      }
      overlay.querySelector('#t-save').addEventListener('click', () => {
        const title = overlay.querySelector('#t-title').value.trim();
        if (!title) { overlay.querySelector('#t-title').focus(); return; }
        const todos = getTodos();
        const now = new Date().toISOString();
        if (isNew) {
          todos.unshift({
            id: 'todo_' + Date.now(),
            title,
            description: overlay.querySelector('#t-desc').value.trim(),
            assignee:    overlay.querySelector('#t-assignee').value.trim() || null,
            dueDate:     overlay.querySelector('#t-due').value || null,
            priority:    overlay.querySelector('#t-priority').value,
            status:      overlay.querySelector('#t-status').value,
            stageId:     overlay.querySelector('#t-stage').value || null,
            source: 'manual', createdAt: now,
          });
        } else {
          const t = todos.find(t => t.id === todo.id);
          if (t) Object.assign(t, {
            title,
            description: overlay.querySelector('#t-desc').value.trim(),
            assignee:    overlay.querySelector('#t-assignee').value.trim() || null,
            dueDate:     overlay.querySelector('#t-due').value || null,
            priority:    overlay.querySelector('#t-priority').value,
            status:      overlay.querySelector('#t-status').value,
            stageId:     overlay.querySelector('#t-stage').value || null,
            updatedAt:   now,
          });
        }
        saveTodos(todos);
        close(); renderList();
      });
      document.body.appendChild(overlay);
      overlay.querySelector('#t-title').focus();
    }

    renderList();
  }

  // ── TAB 6 — Wiki ─────────────────────────────────────────
  // ============================================================
  function renderWiki() {
    function getEntries() {
      try { return JSON.parse(localStorage.getItem(LS_WIKI) || '[]'); }
      catch { return []; }
    }
    function saveEntries(e) { localStorage.setItem(LS_WIKI, JSON.stringify(e)); }

    const CATS = [
      { id: 'overview',  label: '项目概述', icon: '📋' },
      { id: 'product',   label: '产品规格', icon: '📦' },
      { id: 'market',    label: '市场策略', icon: '📊' },
      { id: 'decision',  label: '决策记录', icon: '⚡' },
      { id: 'tech',      label: '技术方案', icon: '🔧' },
      { id: 'process',   label: '流程规范', icon: '🗂️' },
      { id: 'other',     label: '其他',     icon: '📝' },
    ];
    const CATS_MAP = Object.fromEntries(CATS.map(c => [c.id, c]));

    const wrap = document.createElement('div');
    wrap.className = 'tab-wiki';
    tabContent.appendChild(wrap);

    // Header
    const hdr = document.createElement('div');
    hdr.className = 'tab-section-header';
    hdr.innerHTML = `<span class="tab-section-title">Wiki</span>
      <span style="font-size:12px;color:var(--text-muted)">项目知识库 · 最准确的信息来源</span>`;
    const addBtn = document.createElement('button');
    addBtn.className = 'btn-primary';
    addBtn.textContent = '+ 新建条目';
    addBtn.style.marginLeft = 'auto';
    addBtn.addEventListener('click', () => openEditor(null));
    hdr.appendChild(addBtn);
    wrap.appendChild(hdr);

    // LLM banner
    const banner = document.createElement('div');
    banner.className = 'llm-banner';
    banner.innerHTML = `
      <div class="llm-banner-icon">🤖</div>
      <div class="llm-banner-body">
        <div class="llm-banner-title">AI 自动同步 <span class="llm-badge">即将接入</span></div>
        <div class="llm-banner-desc">接入 LLM 后，Wiki 将自动从会议记录和交付件中提炼内容，去重整合，始终保持项目最新、最准确的知识状态。</div>
      </div>`;
    wrap.appendChild(banner);

    // Split layout
    const split = document.createElement('div');
    split.className = 'wiki-split';
    wrap.appendChild(split);

    const sidebar = document.createElement('div');
    sidebar.className = 'wiki-sidebar';
    split.appendChild(sidebar);

    const mainPanel = document.createElement('div');
    mainPanel.className = 'wiki-main';
    split.appendChild(mainPanel);

    let selectedId = null;

    function renderSidebar() {
      sidebar.innerHTML = '';
      const entries = getEntries();

      // New entry button at top
      const newBtn = document.createElement('button');
      newBtn.className = 'wiki-new-btn';
      newBtn.textContent = '+ 新建条目';
      newBtn.addEventListener('click', () => openEditor(null));
      sidebar.appendChild(newBtn);

      if (!entries.length) {
        const empty = document.createElement('div');
        empty.style.cssText = 'padding:16px 12px;font-size:12px;color:var(--text-muted)';
        empty.textContent = '暂无条目';
        sidebar.appendChild(empty);
        return;
      }

      const grouped = {};
      CATS.forEach(c => { grouped[c.id] = []; });
      entries.forEach(e => { (grouped[e.category] || grouped.other).push(e); });

      CATS.forEach(cat => {
        const items = grouped[cat.id];
        if (!items.length) return;

        const catHdr = document.createElement('div');
        catHdr.className = 'wiki-cat-hdr';
        catHdr.textContent = `${cat.icon} ${cat.label}`;
        sidebar.appendChild(catHdr);

        items.forEach(entry => {
          const item = document.createElement('div');
          item.className = 'wiki-nav-item' + (entry.id === selectedId ? ' selected' : '');
          item.textContent = entry.title;
          item.title = entry.title;
          item.addEventListener('click', () => { selectedId = entry.id; renderSidebar(); openReadView(entry); });
          sidebar.appendChild(item);
        });
      });
    }

    function showEmptyMain() {
      mainPanel.innerHTML = `
        <div class="wiki-empty">
          <div style="font-size:40px;opacity:.35;margin-bottom:12px">📖</div>
          <div style="font-size:14px;color:var(--text-muted)">从左侧选择或新建条目</div>
        </div>`;
    }

    function openReadView(entry) {
      const cat = CATS_MAP[entry.category] || CATS_MAP.other;
      const updStr = entry.updatedAt
        ? new Date(entry.updatedAt).toLocaleDateString('zh-CN')
        : new Date(entry.createdAt).toLocaleDateString('zh-CN');

      mainPanel.innerHTML = '';
      const view = document.createElement('div');
      view.className = 'wiki-view';

      const viewHdr = document.createElement('div');
      viewHdr.className = 'wiki-view-hdr';
      viewHdr.innerHTML = `
        <div>
          <div class="wiki-view-title">${entry.title}</div>
          <div class="wiki-view-meta">
            <span class="wiki-cat-badge">${cat.icon} ${cat.label}</span>
            <span style="color:var(--text-muted);font-size:11px">更新于 ${updStr}</span>
            ${entry.sources?.length ? `<span style="color:var(--text-muted);font-size:11px">· ${entry.sources.length} 个来源</span>` : ''}
          </div>
        </div>
        <div style="display:flex;gap:8px;flex-shrink:0">
          <button class="btn-ghost wiki-edit-btn">✎ 编辑</button>
          <button class="btn-ghost wiki-del-btn" style="color:#dc2626">删除</button>
        </div>`;

      const content = document.createElement('div');
      content.className = 'wiki-content';
      content.innerHTML = entry.content
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');

      view.appendChild(viewHdr);
      view.appendChild(content);
      mainPanel.appendChild(view);

      viewHdr.querySelector('.wiki-edit-btn').addEventListener('click', () => openEditor(entry));
      viewHdr.querySelector('.wiki-del-btn').addEventListener('click', () => {
        if (!confirm('确定删除此 Wiki 条目？')) return;
        saveEntries(getEntries().filter(e => e.id !== entry.id));
        selectedId = null;
        renderSidebar();
        showEmptyMain();
      });
    }

    function openEditor(entry) {
      const isNew = !entry;
      mainPanel.innerHTML = '';
      const form = document.createElement('div');
      form.className = 'wiki-form';

      form.innerHTML = `
        <div class="wiki-form-hdr">
          <span>${isNew ? '新建条目' : '编辑：' + entry.title}</span>
          ${!isNew ? '<button class="btn-ghost" id="wiki-cancel">取消</button>' : ''}
        </div>
        <div class="form-group">
          <label class="form-label">标题 *</label>
          <input class="form-input" id="wiki-title" value="${entry?.title || ''}" placeholder="条目标题…" />
        </div>
        <div class="form-group">
          <label class="form-label">分类</label>
          <select class="form-select" id="wiki-cat" style="max-width:200px">
            ${CATS.map(c => `<option value="${c.id}" ${(entry?.category||'other')===c.id?'selected':''}>${c.icon} ${c.label}</option>`).join('')}
          </select>
        </div>
        <div class="form-group wiki-content-group">
          <label class="form-label">内容</label>
          <textarea class="form-textarea wiki-textarea" id="wiki-content"
            placeholder="在此记录项目最新信息…&#10;&#10;提示：接入 LLM 后，内容将从会议记录和交付件自动提炼整合。">${entry?.content || ''}</textarea>
        </div>
        <div class="wiki-form-footer">
          <button class="btn-primary" id="wiki-save">保存</button>
          ${isNew && '<button class="btn-ghost" id="wiki-cancel2">取消</button>'}
        </div>`;

      if (!isNew) form.querySelector('#wiki-cancel').addEventListener('click', () => openReadView(entry));
      const c2 = form.querySelector('#wiki-cancel2');
      if (c2) c2.addEventListener('click', () => { if (!getEntries().length) showEmptyMain(); else openReadView(getEntries()[0]); });

      form.querySelector('#wiki-save').addEventListener('click', () => {
        const title = form.querySelector('#wiki-title').value.trim();
        if (!title) { form.querySelector('#wiki-title').focus(); return; }
        const entries = getEntries();
        const now = new Date().toISOString();
        let saved;
        if (isNew) {
          saved = {
            id: 'wiki_' + Date.now(),
            title,
            content:   form.querySelector('#wiki-content').value,
            category:  form.querySelector('#wiki-cat').value,
            sources:   [],
            createdAt: now, updatedAt: now,
          };
          entries.unshift(saved);
        } else {
          const e = entries.find(e => e.id === entry.id);
          if (e) {
            e.title    = title;
            e.content  = form.querySelector('#wiki-content').value;
            e.category = form.querySelector('#wiki-cat').value;
            e.updatedAt = now;
            saved = e;
          }
        }
        saveEntries(entries);
        selectedId = saved.id;
        renderSidebar();
        openReadView(saved);
      });

      mainPanel.appendChild(form);
      form.querySelector('#wiki-title').focus();
    }

    renderSidebar();
    showEmptyMain();
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
