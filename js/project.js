// ============================================================
// 项目详情页
// ============================================================

(function () {
  const app = document.getElementById('app');
  const params = new URLSearchParams(window.location.search);
  const projectId = params.get('id');

  if (!projectId) { window.location.href = 'projects.html'; return; }

  const STAGE_ORDER = ['gr1','gr2','gr3','gr4','gr5','gr5a','gr6'];
  const STAGE_LABELS = { gr1:'GR1 规划与立项', gr2:'GR2 拓展准备', gr3:'GR3 市场拓展', gr4:'GR4 上市准备', gr5:'GR5 上市销售', gr5a:'GR5A 稳定销售', gr6:'GR6 退市撤盘' };

  function getCurrentProject() { return Store.getProject(projectId); }

  // ── Commit 卡片 ──────────────────────────────────────────────
  function renderCommit(c) {
    const type = getCommitType(c.type);
    const role = getRoleInfo(c.roleId);
    const stageLabel = (STAGE_LABELS[c.stageId] || '').split(' ');

    const item = document.createElement('div');
    item.className = 'commit-item';
    item.innerHTML = `
      <div class="commit-icon" style="background:${type.color}18;border-color:${type.color}30">
        ${type.icon}
      </div>
      <div class="commit-body">
        <div class="commit-top">
          <span class="commit-role-badge" style="background:${role.color}18;color:${role.color}">${c.roleLabel || role.label}</span>
          ${c.stageId ? `<span class="commit-stage-chip">${stageLabel[0] || ''}</span>` : ''}
          <span class="commit-time">${formatRelativeTime(c.timestamp)}</span>
        </div>
        <div class="commit-title">${c.title}</div>
        ${c.summary ? `<div class="commit-summary">${c.summary}</div>` : ''}
        ${(c.tags||[]).length ? `<div class="commit-tags">${c.tags.map(t=>`<span class="commit-tag">${t}</span>`).join('')}</div>` : ''}
        ${c.content ? `<button class="commit-expand-btn" data-open="0">展开详情 ↓</button><div class="commit-full-content">${c.content}</div>` : ''}
      </div>`;

    const expandBtn = item.querySelector('.commit-expand-btn');
    const fullContent = item.querySelector('.commit-full-content');
    if (expandBtn) {
      expandBtn.addEventListener('click', () => {
        const isOpen = expandBtn.dataset.open === '1';
        expandBtn.dataset.open = isOpen ? '0' : '1';
        expandBtn.textContent = isOpen ? '展开详情 ↓' : '收起 ↑';
        fullContent.classList.toggle('open', !isOpen);
      });
    }
    return item;
  }

  // ── 提交 Modal ───────────────────────────────────────────────
  function buildSubmitModal(onSubmitted) {
    const pdtRoles = ALL_ROLES.filter(r => r.team === 'PDT');
    const pctRoles = ALL_ROLES.filter(r => r.team === 'PCT');
    const roleOptions = (group, roles) =>
      `<optgroup label="${group}">${roles.map(r=>`<option value="${r.id}">${r.label}</option>`).join('')}</optgroup>`;

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
                ${roleOptions('PDT — 产品开发团队', pdtRoles)}
                ${roleOptions('PCT — 产品商业化团队', pctRoles)}
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
            <textarea class="form-textarea" id="s-content" rows="5" placeholder="记录完整的会议纪要、变更原因、决策背景等内容…"></textarea>
          </div>
          <div class="form-group">
            <label class="form-label">标签（用逗号分隔）</label>
            <input class="form-input" id="s-tags" placeholder="例：PDCP, 成本风险, 重要决策" />
          </div>
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

    overlay.querySelector('#s-confirm').addEventListener('click', () => {
      const title = overlay.querySelector('#s-title').value.trim();
      const roleId = overlay.querySelector('#s-role').value;
      if (!title) { alert('请填写标题'); return; }

      const roleInfo = getRoleInfo(roleId);
      const tagsRaw = overlay.querySelector('#s-tags').value.trim();
      const commit = Store.addCommit(projectId, {
        type:      overlay.querySelector('#s-type').value,
        roleId,
        roleLabel: roleInfo.label,
        stageId:   overlay.querySelector('#s-stage').value,
        title,
        content:   overlay.querySelector('#s-content').value.trim(),
        summary:   '',
        tags:      tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [],
      });
      close();
      onSubmitted(commit);
    });

    return overlay;
  }

  // ── 左侧边栏 ─────────────────────────────────────────────────
  function renderSidebar(p) {
    const col = document.createElement('div');

    // 项目信息卡
    const infoCard = document.createElement('div');
    infoCard.className = 'sidebar-card';
    const currentIdx = STAGE_ORDER.indexOf(p.currentStage);
    infoCard.innerHTML = `
      <div class="sidebar-card-title">项目信息</div>
      <div class="sidebar-row"><span class="sidebar-row-label">状态</span><span class="sidebar-row-value">${{active:'进行中',hold:'已暂停',done:'已完成'}[p.status]||'进行中'}</span></div>
      <div class="sidebar-row"><span class="sidebar-row-label">PDT Lead</span><span class="sidebar-row-value">${p.pdtLead||'—'}</span></div>
      <div class="sidebar-row"><span class="sidebar-row-label">GTM Lead</span><span class="sidebar-row-value">${p.gtmLead||'—'}</span></div>
      <div class="sidebar-row"><span class="sidebar-row-label">创建时间</span><span class="sidebar-row-value">${formatDate(p.createdAt)}</span></div>
      <div class="sidebar-row"><span class="sidebar-row-label">最近更新</span><span class="sidebar-row-value">${formatDate(p.updatedAt)}</span></div>
      <div class="sidebar-row"><span class="sidebar-row-label">记录总数</span><span class="sidebar-row-value">${(p.commits||[]).length} 条</span></div>
    `;
    col.appendChild(infoCard);

    // IPMS 阶段进度卡
    const phaseCard = document.createElement('div');
    phaseCard.className = 'sidebar-card';
    phaseCard.innerHTML = `<div class="sidebar-card-title">IPMS 阶段进度</div>`;
    const stepsEl = document.createElement('div');
    stepsEl.className = 'phase-progress';
    STAGE_ORDER.forEach((id, i) => {
      const step = document.createElement('div');
      const state = i < currentIdx ? 'done' : i === currentIdx ? 'current' : 'future';
      step.className = `phase-step ${state}`;
      step.innerHTML = `<span class="phase-step-dot"></span><span>${STAGE_LABELS[id]}</span>`;
      stepsEl.appendChild(step);
    });
    phaseCard.appendChild(stepsEl);
    col.appendChild(phaseCard);

    return col;
  }

  // ── 中间活动流 ───────────────────────────────────────────────
  function renderActivity(p) {
    const col = document.createElement('div');

    const actHeader = document.createElement('div');
    actHeader.className = 'activity-header';
    actHeader.innerHTML = `<span class="activity-title">动态记录 (${(p.commits||[]).length})</span>`;

    const submitBtn = document.createElement('button');
    submitBtn.className = 'btn-primary';
    submitBtn.innerHTML = '＋ 提交记录';
    actHeader.appendChild(submitBtn);
    col.appendChild(actHeader);

    const commitList = document.createElement('div');
    commitList.className = 'commit-list';

    const renderCommits = () => {
      commitList.innerHTML = '';
      const proj = getCurrentProject();
      if (!proj || !(proj.commits||[]).length) {
        commitList.innerHTML = `<div style="text-align:center;padding:40px 0;color:var(--text-muted);font-size:13px">暂无记录，点击「提交记录」开始</div>`;
        return;
      }
      proj.commits.forEach(c => commitList.appendChild(renderCommit(c)));
    };

    renderCommits();
    col.appendChild(commitList);

    submitBtn.addEventListener('click', () => {
      const modal = buildSubmitModal(() => renderCommits());
      // Pre-select current stage
      document.body.appendChild(modal);
      const stageSelect = modal.querySelector('#s-stage');
      if (stageSelect) stageSelect.value = p.currentStage;
    });

    return col;
  }

  // ── 右侧 AI Mock 面板 ────────────────────────────────────────
  function renderAIPanel(p) {
    const col = document.createElement('div');

    const panel = document.createElement('div');
    panel.className = 'ai-panel';

    const commits = p.commits || [];
    const latestTitle = commits[0]?.title || '暂无动态';
    const commitCount = commits.length;
    const changeCount = commits.filter(c => c.type === 'change').length;
    const meetingCount = commits.filter(c => c.type === 'meeting').length;

    panel.innerHTML = `
      <div class="ai-panel-header">
        <div style="font-size:14px">✦</div>
        <div class="ai-panel-title">AI 项目助手</div>
        <span class="ai-beta-badge">即将上线</span>
      </div>
      <div class="ai-panel-body">
        <div class="ai-msg">
          <div class="ai-avatar">✦</div>
          <div class="ai-bubble">
            <strong>${p.name}</strong> 当前处于 <strong>${STAGE_LABELS[p.currentStage]||p.currentStage}</strong> 阶段。<br><br>
            共有 ${commitCount} 条记录，其中会议纪要 ${meetingCount} 条，信息变更 ${changeCount} 条。<br><br>
            最新动态：${latestTitle}
          </div>
        </div>
        <div class="ai-msg">
          <div class="ai-avatar">✦</div>
          <div class="ai-bubble">
            <strong>功能预告</strong><br>
            • 自动摘要会议纪要<br>
            • 识别并提取关键决策<br>
            • 追踪信息变更与影响<br>
            • 回答产品相关问题
          </div>
        </div>
        <div class="ai-input-area">
          <input class="ai-input" placeholder="问一个关于项目的问题…" disabled />
          <button class="ai-send-btn" disabled>发送</button>
        </div>
        <div class="ai-coming-soon">
          <span>🔌</span> API 接入中，敬请期待
        </div>
      </div>
    `;

    col.appendChild(panel);

    // Stats card
    const statsCard = document.createElement('div');
    statsCard.className = 'sidebar-card';
    statsCard.style.marginTop = '12px';
    const typeCounts = {};
    COMMIT_TYPES.forEach(t => { typeCounts[t.id] = commits.filter(c => c.type === t.id).length; });
    statsCard.innerHTML = `
      <div class="sidebar-card-title">记录分布</div>
      ${COMMIT_TYPES.map(t => `
        <div class="sidebar-row">
          <span class="sidebar-row-label">${t.icon} ${t.label}</span>
          <span class="sidebar-row-value" style="color:${t.color};font-weight:700">${typeCounts[t.id]}</span>
        </div>`).join('')}
    `;
    col.appendChild(statsCard);

    return col;
  }

  // ── 主渲染 ───────────────────────────────────────────────────
  function render() {
    const p = getCurrentProject();
    if (!p) {
      app.innerHTML = `<div class="page"><p style="color:var(--text-muted);padding:40px">项目不存在。<a href="projects.html">返回列表</a></p></div>`;
      return;
    }

    const page = document.createElement('div');
    page.className = 'page';
    page.style.paddingBottom = '40px';

    // Breadcrumb
    const bc = document.createElement('div');
    bc.className = 'breadcrumb';
    bc.innerHTML = `<a href="projects.html">项目</a><span class="breadcrumb-sep">/</span><span>${p.name}</span>`;
    page.appendChild(bc);

    // Project header
    const header = document.createElement('div');
    header.className = 'proj-header';
    const statusLabels = { active:'进行中', hold:'已暂停', done:'已完成' };
    header.innerHTML = `
      <div class="proj-header-top">
        <div class="proj-header-name">${p.name}</div>
        <div style="display:flex;gap:8px;align-items:center;margin-top:4px">
          <span class="proj-code">${p.code}</span>
          <span class="status-badge ${p.status||'active'}">${statusLabels[p.status]||'进行中'}</span>
          <button class="btn-ghost" id="deleteBtn" style="margin-left:8px;padding:4px 10px;font-size:12px">删除项目</button>
        </div>
      </div>
      ${p.description ? `<div class="proj-header-desc">${p.description}</div>` : ''}
    `;
    page.appendChild(header);

    // 3-column layout
    const layout = document.createElement('div');
    layout.className = 'proj-detail-layout';
    layout.appendChild(renderSidebar(p));
    layout.appendChild(renderActivity(p));
    layout.appendChild(renderAIPanel(p));
    page.appendChild(layout);

    app.appendChild(page);

    // Delete handler
    document.getElementById('deleteBtn').addEventListener('click', () => {
      if (confirm(`确定要删除项目「${p.name}」吗？此操作不可恢复。`)) {
        Store.deleteProject(projectId);
        window.location.href = 'projects.html';
      }
    });
  }

  render();
})();
