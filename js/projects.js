// ============================================================
// 项目列表页
// ============================================================

(function () {
  const app = document.getElementById('app');
  let activeTab = 'all';

  const STAGE_COLORS = {
    gr1: { bg: '#dbeafe', color: '#1d4ed8' },
    gr2: { bg: '#ede9fe', color: '#6d28d9' },
    gr3: { bg: '#fce7f3', color: '#9d174d' },
    gr4: { bg: '#fce7f3', color: '#9d174d' },
    gr5: { bg: '#dcfce7', color: '#166534' },
    gr5a:{ bg: '#dcfce7', color: '#166534' },
    gr6: { bg: '#fef9c3', color: '#854d0e' },
  };

  function getStageDisplay(stageId) {
    const labels = { gr1:'GR1', gr2:'GR2', gr3:'GR3', gr4:'GR4', gr5:'GR5', gr5a:'GR5A', gr6:'GR6' };
    const names  = { gr1:'规划与立项', gr2:'拓展准备', gr3:'市场拓展', gr4:'上市准备', gr5:'上市销售', gr5a:'稳定销售', gr6:'退市撤盘' };
    return { code: labels[stageId] || stageId, name: names[stageId] || '' };
  }

  function renderCard(p) {
    const stageColors = STAGE_COLORS[p.currentStage] || { bg: '#f1f5f9', color: '#475569' };
    const { code, name } = getStageDisplay(p.currentStage);
    const commitCount = (p.commits || []).length;
    const statusMap = { active: '进行中', hold: '暂停', done: '已完成' };

    const card = document.createElement('a');
    card.className = `proj-card status-${p.status || 'active'}`;
    card.href = `project.html?id=${p.id}`;
    card.innerHTML = `
      <div class="proj-card-top">
        <span class="proj-code">${p.code || ''}</span>
        <span class="proj-stat">${commitCount} 条记录</span>
      </div>
      <div class="proj-name">${p.name}</div>
      <div class="proj-desc">${p.description || '暂无描述'}</div>
      <div class="proj-meta">
        <span class="proj-stage-badge" style="background:${stageColors.bg};color:${stageColors.color}">
          <span class="proj-status-dot"></span>
          ${code} ${name}
        </span>
        <span class="proj-stat">${statusMap[p.status] || '进行中'}</span>
        <span class="proj-updated">更新于 ${formatRelativeTime(p.updatedAt || p.createdAt)}</span>
      </div>
    `;
    return card;
  }

  function renderGrid(container) {
    container.innerHTML = '';
    let projects = Store.getProjects();
    if (activeTab === 'active') projects = projects.filter(p => p.status === 'active');
    if (activeTab === 'done')   projects = projects.filter(p => p.status === 'done');

    if (projects.length === 0) {
      container.innerHTML = `
        <div class="proj-empty">
          <div class="proj-empty-icon">📂</div>
          <div class="proj-empty-text">暂无项目</div>
          <div class="proj-empty-sub">点击右上角「新建项目」开始</div>
        </div>`;
      return;
    }
    projects.forEach(p => container.appendChild(renderCard(p)));
  }

  // ── 新建项目 Modal ────────────────────────────────────────
  function buildCreateModal(onCreated) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <span class="modal-title">新建项目</span>
          <button class="modal-close" id="closeModal">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">项目名称 *</label>
            <input class="form-input" id="inp-name" placeholder="例：X2 智能耳机" />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">产品代码 *</label>
              <input class="form-input" id="inp-code" placeholder="例：X2EAR" style="text-transform:uppercase" />
            </div>
            <div class="form-group">
              <label class="form-label">当前阶段</label>
              <select class="form-select" id="inp-stage">
                <option value="gr1">GR1 规划与立项</option>
                <option value="gr2">GR2 拓展准备</option>
                <option value="gr3">GR3 市场拓展</option>
                <option value="gr4">GR4 上市准备</option>
                <option value="gr5">GR5 上市销售</option>
                <option value="gr5a">GR5A 稳定销售</option>
                <option value="gr6">GR6 退市撤盘</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">项目描述</label>
            <textarea class="form-textarea" id="inp-desc" rows="3" placeholder="简要描述产品定位和目标"></textarea>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">PDT Lead</label>
              <input class="form-input" id="inp-pdt" placeholder="姓名（职位）" />
            </div>
            <div class="form-group">
              <label class="form-label">GTM Lead</label>
              <input class="form-input" id="inp-gtm" placeholder="姓名（职位）" />
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-ghost" id="cancelModal">取消</button>
          <button class="btn-primary" id="confirmCreate">创建项目</button>
        </div>
      </div>`;

    document.getElementById('closeModal')?.remove();
    overlay.querySelector('#closeModal').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#cancelModal').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

    overlay.querySelector('#confirmCreate').addEventListener('click', () => {
      const name = overlay.querySelector('#inp-name').value.trim();
      const code = overlay.querySelector('#inp-code').value.trim().toUpperCase();
      if (!name || !code) { alert('请填写项目名称和产品代码'); return; }
      const project = Store.createProject({
        name,
        code,
        currentStage: overlay.querySelector('#inp-stage').value,
        description: overlay.querySelector('#inp-desc').value.trim(),
        pdtLead: overlay.querySelector('#inp-pdt').value.trim(),
        gtmLead: overlay.querySelector('#inp-gtm').value.trim(),
      });
      overlay.remove();
      onCreated(project);
    });

    return overlay;
  }

  // ── 主渲染 ───────────────────────────────────────────────────
  function render() {
    const page = document.createElement('div');
    page.className = 'page';

    // Header
    const header = document.createElement('div');
    header.className = 'proj-list-header';
    header.innerHTML = `
      <div>
        <div class="page-title">项目</div>
        <div class="page-subtitle">管理所有 IPD / IPMS 产品项目及其动态记录</div>
      </div>`;

    const createBtn = document.createElement('button');
    createBtn.className = 'btn-primary';
    createBtn.innerHTML = '＋ 新建项目';
    header.appendChild(createBtn);
    page.appendChild(header);

    // Tabs
    const tabs = document.createElement('div');
    tabs.className = 'proj-tabs';
    [['all','全部'], ['active','进行中'], ['done','已完成']].forEach(([id, label]) => {
      const btn = document.createElement('button');
      btn.className = `proj-tab${activeTab === id ? ' active' : ''}`;
      btn.textContent = label;
      btn.addEventListener('click', () => {
        activeTab = id;
        tabs.querySelectorAll('.proj-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderGrid(grid);
      });
      tabs.appendChild(btn);
    });
    page.appendChild(tabs);

    // Grid
    const grid = document.createElement('div');
    grid.className = 'proj-grid';
    renderGrid(grid);
    page.appendChild(grid);

    // Create button handler
    createBtn.addEventListener('click', () => {
      const modal = buildCreateModal(project => {
        renderGrid(grid);
        window.location.href = `project.html?id=${project.id}`;
      });
      document.body.appendChild(modal);
    });

    app.appendChild(page);
  }

  render();
})();
