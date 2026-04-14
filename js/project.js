// ============================================================
// 项目详情页（Supabase + 横向 Tab 导航版）
// ============================================================

(async function () {
  // 1. 要求登录
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

  // ── 加载项目 ─────────────────────────────────────────────
  let project = await Store.getProject(projectId);
  if (!project) {
    app.innerHTML = `<div class="page"><p style="color:var(--text-muted);padding:40px">项目不存在。<a href="projects.html">返回列表</a></p></div>`;
    return;
  }

  // 当前用户在此项目的角色
  const myRole = await Store.getUserRole(projectId, user.id);

  // ── 页面骨架 ─────────────────────────────────────────────
  const page = document.createElement('div');
  page.className = 'page';
  page.style.paddingBottom = '48px';

  // Breadcrumb
  const bc = document.createElement('div');
  bc.className = 'breadcrumb';
  bc.innerHTML = `<a href="projects.html">项目</a><span class="breadcrumb-sep">/</span><span>${project.name}</span>`;
  page.appendChild(bc);

  // Project header
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

  // ── 横向 Sub-Nav ─────────────────────────────────────────
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

  // Tab content container
  const tabContent = document.createElement('div');
  tabContent.className = 'proj-tab-content';
  page.appendChild(tabContent);

  app.appendChild(page);

  // ── Tab 切换 ─────────────────────────────────────────────
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
  // TAB 1 — 时间线
  // ============================================================
  async function renderTimeline() {
    const commits = await Store.getCommits(projectId);

    const wrap = document.createElement('div');
    wrap.className = 'tab-timeline';

    // Header
    const hdr = document.createElement('div');
    hdr.className = 'tab-section-header';
    hdr.innerHTML = `<span class="tab-section-title">动态记录 <span class="tab-count">${commits.length}</span></span>`;
    const addBtn = document.createElement('button');
    addBtn.className = 'btn-primary';
    addBtn.textContent = '＋ 提交记录';
    hdr.appendChild(addBtn);
    wrap.appendChild(hdr);

    const list = document.createElement('div');
    list.className = 'commit-list';
    renderCommitList(list, commits);
    wrap.appendChild(list);

    tabContent.appendChild(wrap);

    addBtn.addEventListener('click', () => {
      const modal = buildCommitModal(async commit => {
        const updated = await Store.getCommits(projectId);
        renderCommitList(list, updated);
        list.closest('.tab-timeline').querySelector('.tab-count').textContent = updated.length;
      });
      document.body.appendChild(modal);
      const sel = modal.querySelector('#s-stage');
      if (sel) sel.value = project.current_stage || 'gr1';
    });
  }

  function renderCommitList(container, commits) {
    container.innerHTML = '';
    if (!commits.length) {
      container.innerHTML = `<div class="empty-state">暂无记录，点击「提交记录」开始</div>`;
      return;
    }
    commits.forEach(c => container.appendChild(buildCommitCard(c)));
  }

  function buildCommitCard(c) {
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

    const expandBtn = item.querySelector('.commit-expand-btn');
    if (expandBtn) {
      expandBtn.addEventListener('click', () => {
        const open = expandBtn.dataset.open === '1';
        expandBtn.dataset.open = open ? '0' : '1';
        expandBtn.textContent = open ? '展开详情 ↓' : '收起 ↑';
        item.querySelector('.commit-full-content').classList.toggle('open', !open);
      });
    }
    return item;
  }

  // ── 提交记录 Modal ────────────────────────────────────────
  function buildCommitModal(onSubmitted) {
    const pdtRoles = ALL_ROLES.filter(r => r.team === 'PDT');
    const pctRoles = ALL_ROLES.filter(r => r.team === 'PCT');
    const roleOpts = (grp, roles) =>
      `<optgroup label="${grp}">${roles.map(r=>`<option value="${r.id}">${r.label}</option>`).join('')}</optgroup>`;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <span class="modal-title">提交记录</span>
          <button class="modal-close">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">提交角色 *</label>
              <select class="form-select" id="s-role">
                ${roleOpts('PDT — 产品开发团队', pdtRoles)}
                ${roleOpts('PCT — 产品商业化团队', pctRoles)}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">记录类型 *</label>
              <select class="form-select" id="s-type">
                ${COMMIT_TYPES.map(t=>`<option value="${t.id}">${t.icon} ${t.label}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">关联阶段</label>
            <select class="form-select" id="s-stage">
              ${STAGE_ORDER.map(id=>`<option value="${id}">${STAGE_LABELS[id]}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">标题 *</label>
            <input class="form-input" id="s-title" placeholder="简要描述这条记录的主题" />
          </div>
          <div class="form-group">
            <label class="form-label">详细内容</label>
            <textarea class="form-textarea" id="s-content" rows="5" placeholder="记录完整内容…"></textarea>
          </div>
          <div class="form-group">
            <label class="form-label">标签（逗号分隔）</label>
            <input class="form-input" id="s-tags" placeholder="例：PDCP, 成本风险" />
          </div>
          <div id="s-err" style="display:none;color:#ef4444;font-size:12px;margin-top:4px"></div>
        </div>
        <div class="modal-footer">
          <button class="btn-ghost" id="s-cancel">取消</button>
          <button class="btn-primary" id="s-confirm">提交</button>
        </div>
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
        const commit = await Store.addCommit(projectId, {
          type:      overlay.querySelector('#s-type').value,
          roleId,
          roleLabel: roleInfo.label,
          stageId:   overlay.querySelector('#s-stage').value,
          title,
          content:   overlay.querySelector('#s-content').value.trim(),
          tags:      tagsRaw ? tagsRaw.split(',').map(t=>t.trim()).filter(Boolean) : [],
          sourceTab: 'timeline',
        }, user.id);
        close();
        await onSubmitted(commit);
      } catch (err) {
        errEl.textContent = '提交失败：' + (err.message || '请稍后重试');
        errEl.style.display = 'block';
        btn.disabled = false; btn.textContent = '提交';
      }
    });

    return overlay;
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

    // Loading
    const loading = document.createElement('div');
    loading.className = 'empty-state';
    loading.textContent = '加载中…';
    wrap.appendChild(loading);
    tabContent.appendChild(wrap);

    // Load deliverables from DB
    let dbRows = await Store.getDeliverables(projectId);

    // Auto-seed if empty
    if (dbRows.length === 0) {
      dbRows = await seedDeliverables();
    }

    loading.remove();

    const currentIdx = STAGE_ORDER.indexOf(project.current_stage || 'gr1');

    // Group by stage
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

      const grid = document.createElement('div');
      grid.className = 'deliv-grid';

      // Group by team within stage
      const teams = [...new Set(stageDels.map(d => d.team))];
      teams.forEach(team => {
        const teamDels = stageDels.filter(d => d.team === team);

        const teamBlock = document.createElement('div');
        teamBlock.className = 'deliv-team-block';
        teamBlock.innerHTML = `<div class="deliv-team-label ${team.toLowerCase()}">${team}</div>`;

        teamDels.forEach(d => {
          const card = buildDelivCard(d, isLocked, isPast);
          teamBlock.appendChild(card);
        });

        grid.appendChild(teamBlock);
      });

      section.appendChild(grid);
      wrap.appendChild(section);
    });
  }

  function buildDelivCard(d, isLocked, isPast) {
    const statusMap = { pending:'待提交', in_progress:'进行中', submitted:'已提交', approved:'已批准' };
    const statusColors = { pending:'#94a3b8', in_progress:'#f59e0b', submitted:'#3b82f6', approved:'#22c55e' };
    const color = statusColors[d.status] || '#94a3b8';

    const card = document.createElement('div');
    card.className = `deliv-card ${isLocked ? 'locked' : ''}`;
    card.innerHTML = `
      <div class="deliv-card-top">
        <span class="deliv-role-badge" style="background:${d.role_id ? '#2563eb18' : '#f1f5f9'};color:#2563eb">${d.role_label}</span>
        <span class="deliv-status-dot" style="background:${color}" title="${statusMap[d.status]}"></span>
      </div>
      <div class="deliv-name">${d.name}</div>
      ${d.content ? `<div class="deliv-content">${d.content}</div>` : ''}
      <div class="deliv-status-label" style="color:${color}">${statusMap[d.status]}</div>`;

    if (!isLocked) {
      const btn = document.createElement('button');
      btn.className = 'deliv-action-btn';
      if (d.status === 'pending' || d.status === 'in_progress') {
        btn.textContent = '填写内容';
        btn.addEventListener('click', () => showDelivModal(d, card));
      } else if (d.status === 'submitted' || d.status === 'approved') {
        btn.textContent = '查看 / 编辑';
        btn.addEventListener('click', () => showDelivModal(d, card));
      }
      card.appendChild(btn);
    }
    return card;
  }

  function showDelivModal(d, card) {
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
        const updated = await Store.upsertDeliverable({
          ...d,
          status:       overlay.querySelector('#d-status').value,
          content:      overlay.querySelector('#d-content').value.trim(),
          submitted_by: user.id,
          submitted_at: new Date().toISOString(),
        });
        close();
        // Refresh tab
        renderDeliverables();
      } catch (err) {
        btn.disabled = false; btn.textContent = '保存';
        alert('保存失败：' + (err.message || ''));
      }
    });

    document.body.appendChild(overlay);
  }

  async function seedDeliverables() {
    const rows = [];
    let order = 0;
    const allRoleGroups = [
      ...(typeof PDT_ROLES !== 'undefined' ? PDT_ROLES : []).map(r => ({ ...r, team: 'PDT' })),
      ...(typeof PCT_ROLES !== 'undefined' ? PCT_ROLES : []).map(r => ({ ...r, team: 'PCT' })),
    ];

    allRoleGroups.forEach(role => {
      STAGE_ORDER.forEach(stageId => {
        const dels = role.deliverables?.[stageId];
        if (!dels || !dels.length) return;
        dels.forEach(name => {
          rows.push({
            id:         `dlv_${projectId}_${role.id}_${stageId}_${order}`,
            project_id: projectId,
            stage_id:   stageId,
            team:       role.team,
            role_id:    role.id,
            role_label: role.title || role.label || role.id,
            name,
            status:     'pending',
            content:    '',
            sort_order: order++,
          });
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
    if (!meetings.length) {
      container.innerHTML = `<div class="empty-state">暂无会议记录</div>`;
      return;
    }
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
        ${actions.length ? `
          <div class="meeting-field"><strong>行动项：</strong>
            <ul class="action-items-list">${actions.map(a=>`<li>${typeof a==='string'?a:(a.text||JSON.stringify(a))}</li>`).join('')}</ul>
          </div>` : ''}
        <div class="meeting-card-footer">
          <span style="font-size:12px;color:var(--text-muted)">${formatRelativeTime(m.created_at)}</span>
        </div>`;
      container.appendChild(card);
    });
  }

  function buildMeetingModal(onSaved) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal modal-lg">
        <div class="modal-header">
          <span class="modal-title">新增会议记录</span>
          <button class="modal-close">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">会议标题 *</label>
              <input class="form-input" id="m-title" placeholder="例：GR3 评审会议" />
            </div>
            <div class="form-group">
              <label class="form-label">会议日期</label>
              <input class="form-input" id="m-date" type="date" />
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">关联阶段</label>
            <select class="form-select" id="m-stage">
              <option value="">无</option>
              ${STAGE_ORDER.map(id=>`<option value="${id}">${STAGE_LABELS[id]}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">议程</label>
            <textarea class="form-textarea" id="m-agenda" rows="2" placeholder="主要议题…"></textarea>
          </div>
          <div class="form-group">
            <label class="form-label">会议纪要</label>
            <textarea class="form-textarea" id="m-minutes" rows="5" placeholder="会议要点、讨论结果、重要决策…"></textarea>
          </div>
          <div class="form-group">
            <label class="form-label">行动项（每行一条）</label>
            <textarea class="form-textarea" id="m-actions" rows="3" placeholder="- 张明 4/17 前提交降本方案&#10;- PMO 更新项目计划"></textarea>
          </div>
          <div id="m-err" style="display:none;color:#ef4444;font-size:12px;margin-top:4px"></div>
        </div>
        <div class="modal-footer">
          <button class="btn-ghost" id="m-cancel">取消</button>
          <button class="btn-primary" id="m-save">保存</button>
        </div>
      </div>`;

    const close = () => overlay.remove();
    overlay.querySelector('.modal-close').addEventListener('click', close);
    overlay.querySelector('#m-cancel').addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

    // Set today's date
    overlay.querySelector('#m-date').value = new Date().toISOString().slice(0, 10);
    const sel = overlay.querySelector('#m-stage');
    if (project.current_stage) sel.value = project.current_stage;

    overlay.querySelector('#m-save').addEventListener('click', async () => {
      const title = overlay.querySelector('#m-title').value.trim();
      const errEl = overlay.querySelector('#m-err');
      if (!title) { errEl.textContent = '请填写会议标题'; errEl.style.display = 'block'; return; }
      const btn = overlay.querySelector('#m-save');
      btn.disabled = true; btn.textContent = '保存中…';

      const actionsRaw = overlay.querySelector('#m-actions').value.trim();
      const actionItems = actionsRaw
        ? actionsRaw.split('\n').map(s => s.replace(/^[-•]\s*/, '').trim()).filter(Boolean)
        : [];

      try {
        await Store.addMeeting(projectId, {
          title,
          meetingDate: overlay.querySelector('#m-date').value,
          stageId:     overlay.querySelector('#m-stage').value,
          agenda:      overlay.querySelector('#m-agenda').value.trim(),
          minutes:     overlay.querySelector('#m-minutes').value.trim(),
          actionItems,
        }, user.id);
        close();
        await onSaved();
      } catch (err) {
        errEl.textContent = '保存失败：' + (err.message || '');
        errEl.style.display = 'block';
        btn.disabled = false; btn.textContent = '保存';
      }
    });

    return overlay;
  }

  // ============================================================
  // TAB 6 — 设置
  // ============================================================
  async function renderSettings() {
    const members = await Store.getMembers(projectId);

    const wrap = document.createElement('div');
    wrap.className = 'tab-settings';

    // Project info section
    const infoSection = document.createElement('div');
    infoSection.className = 'settings-section';
    infoSection.innerHTML = `
      <div class="settings-section-title">项目信息</div>
      <div class="form-group">
        <label class="form-label">项目名称</label>
        <input class="form-input" id="cfg-name" value="${project.name || ''}" />
      </div>
      <div class="form-group">
        <label class="form-label">项目描述</label>
        <textarea class="form-textarea" id="cfg-desc" rows="3">${project.description || ''}</textarea>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">PDT Lead</label>
          <input class="form-input" id="cfg-pdt" value="${project.pdt_lead || ''}" />
        </div>
        <div class="form-group">
          <label class="form-label">GTM Lead</label>
          <input class="form-input" id="cfg-gtm" value="${project.gtm_lead || ''}" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">当前阶段</label>
          <select class="form-select" id="cfg-stage">
            ${STAGE_ORDER.map(id=>`<option value="${id}" ${project.current_stage===id?'selected':''}>${STAGE_LABELS[id]}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">项目状态</label>
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

    // Members section
    const memberSection = document.createElement('div');
    memberSection.className = 'settings-section';
    const roleLabels = { owner:'所有者', admin:'管理员', member:'成员' };
    const memberRows = members.map(m => {
      const p = m.profiles || {};
      return `
        <div class="member-row">
          <div class="member-avatar">${(p.name || p.email || '?').charAt(0).toUpperCase()}</div>
          <div class="member-info">
            <div class="member-name">${p.name || '—'}</div>
            <div class="member-email">${p.email || ''}</div>
          </div>
          <span class="member-role-badge role-${m.ipms_role}">${roleLabels[m.ipms_role] || m.ipms_role}</span>
        </div>`;
    }).join('');

    memberSection.innerHTML = `
      <div class="settings-section-title">团队成员 <span class="tab-count">${members.length}</span></div>
      <div class="member-list">${memberRows || '<div class="empty-state" style="padding:16px 0">暂无成员</div>'}</div>
      <div class="member-add-row" style="margin-top:12px">
        <input class="form-input" id="add-email" placeholder="输入邮箱添加成员" style="flex:1" />
        <select class="form-select" id="add-role" style="width:120px">
          <option value="member">成员</option>
          <option value="admin">管理员</option>
        </select>
        <button class="btn-primary" id="add-member-btn">添加</button>
      </div>
      <div id="add-msg" style="font-size:12px;margin-top:6px;color:var(--text-muted)"></div>`;

    wrap.appendChild(memberSection);

    // Danger zone
    const dangerSection = document.createElement('div');
    dangerSection.className = 'settings-section settings-danger';
    dangerSection.innerHTML = `
      <div class="settings-section-title" style="color:#ef4444">危险操作</div>
      <p style="font-size:13px;color:var(--text-secondary);margin-bottom:12px">删除项目将永久移除所有记录，无法恢复。</p>
      <button class="btn-danger" id="delete-proj-btn">删除此项目</button>`;
    wrap.appendChild(dangerSection);

    tabContent.appendChild(wrap);

    // Save project info
    document.getElementById('cfg-save').addEventListener('click', async () => {
      const btn = document.getElementById('cfg-save');
      const msg = document.getElementById('cfg-msg');
      btn.disabled = true; btn.textContent = '保存中…';
      try {
        project = await Store.updateProject(projectId, {
          name:         document.getElementById('cfg-name').value.trim(),
          description:  document.getElementById('cfg-desc').value.trim(),
          pdtLead:      document.getElementById('cfg-pdt').value.trim(),
          gtmLead:      document.getElementById('cfg-gtm').value.trim(),
          currentStage: document.getElementById('cfg-stage').value,
          status:       document.getElementById('cfg-status').value,
        });
        document.getElementById('proj-title').textContent = project.name;
        msg.style.color = '#22c55e';
        msg.textContent = '已保存';
        setTimeout(() => { msg.textContent = ''; }, 2000);
      } catch (err) {
        msg.style.color = '#ef4444';
        msg.textContent = '保存失败：' + (err.message || '');
      }
      btn.disabled = false; btn.textContent = '保存修改';
    });

    // Add member
    document.getElementById('add-member-btn').addEventListener('click', async () => {
      const email = document.getElementById('add-email').value.trim();
      const role  = document.getElementById('add-role').value;
      const msgEl = document.getElementById('add-msg');
      if (!email) { msgEl.textContent = '请输入邮箱'; return; }
      msgEl.style.color = 'var(--text-muted)';
      msgEl.textContent = '查询中…';

      // Look up user by email via profiles table
      const { data: profiles } = await sb.from('profiles').select('id, name, email').eq('email', email).limit(1);
      if (!profiles || !profiles.length) {
        msgEl.style.color = '#ef4444';
        msgEl.textContent = '未找到该用户，请确认对方已注册';
        return;
      }
      try {
        await Store.addMember(projectId, profiles[0].id, role);
        msgEl.style.color = '#22c55e';
        msgEl.textContent = `已添加 ${profiles[0].name || email}`;
        document.getElementById('add-email').value = '';
        // Refresh members section
        setTimeout(() => renderSettings(), 800);
      } catch (err) {
        msgEl.style.color = '#ef4444';
        msgEl.textContent = '添加失败：' + (err.message || '');
      }
    });

    // Delete project
    document.getElementById('delete-proj-btn').addEventListener('click', async () => {
      if (!confirm(`确定要删除项目「${project.name}」吗？\n此操作不可恢复，所有记录将被永久删除。`)) return;
      try {
        await Store.deleteProject(projectId);
        window.location.href = 'projects.html';
      } catch (err) {
        alert('删除失败：' + (err.message || ''));
      }
    });
  }

  // ============================================================
  // 占位符 Tab
  // ============================================================
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
