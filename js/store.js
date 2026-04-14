// ============================================================
// IPMS — 共享数据层 (localStorage)
// ============================================================

const STORE_KEY = 'ipms-projects-v1';

// 角色快查表（供提交时选择）
const ALL_ROLES = [
  { id: 'lpdt',    label: 'LPDT',          team: 'PDT', color: '#1d4ed8' },
  { id: 'market',  label: '市场代表',       team: 'PDT', color: '#0891b2' },
  { id: 'procurement', label: '采购代表',   team: 'PDT', color: '#065f46' },
  { id: 'manufacturing', label: '制造代表', team: 'PDT', color: '#6d28d9' },
  { id: 'quality', label: '质量代表',       team: 'PDT', color: '#b45309' },
  { id: 'finance', label: '财务代表',       team: 'PDT', color: '#9d174d' },
  { id: 'service_tech', label: '技术服务代表', team: 'PDT', color: '#0f766e' },
  { id: 'mo_pdt',  label: 'MO 营运运作',    team: 'PDT', color: '#c2410c' },
  { id: 'pmo',     label: 'PDT / PMO',      team: 'PDT', color: '#475569' },
  { id: 'gtm_lead', label: 'GTM Lead',      team: 'PCT', color: '#0ea5e9' },
  { id: 'mo_pct',  label: 'MO 营运运作',    team: 'PCT', color: '#c2410c' },
  { id: 'marketing', label: '营销代表',     team: 'PCT', color: '#7c3aed' },
  { id: 'content', label: '内容与创意',     team: 'PCT', color: '#be185d' },
  { id: 'retail',  label: '零售代表',       team: 'PCT', color: '#0f766e' },
  { id: 'ecommerce', label: '渠道/电商代表', team: 'PCT', color: '#b45309' },
  { id: 'pr_kol',  label: 'PR / KOL 代表',  team: 'PCT', color: '#1d4ed8' },
  { id: 'crm',     label: 'CRM / 用户运营', team: 'PCT', color: '#9d174d' },
  { id: 'sales',   label: '销售代表',       team: 'PCT', color: '#065f46' },
  { id: 'cs',      label: '服务代表',       team: 'PCT', color: '#475569' },
];

const COMMIT_TYPES = [
  { id: 'meeting',   label: '会议纪要', icon: '📋', color: '#2563eb' },
  { id: 'change',    label: '信息变更', icon: '🔄', color: '#dc2626' },
  { id: 'milestone', label: '里程碑',   icon: '🎯', color: '#16a34a' },
  { id: 'note',      label: '备注记录', icon: '📝', color: '#ca8a04' },
  { id: 'decision',  label: '决策记录', icon: '⚡', color: '#7c3aed' },
];

// 演示项目（首次加载时写入）
const DEMO_PROJECT = {
  id: 'proj_demo_001',
  name: 'X1 Pro 智能音箱',
  code: 'X1PRO',
  status: 'active',
  currentStage: 'gr3',
  description: '面向都市职场用户的高端智能音箱，主打办公效率场景，搭载新一代语音交互引擎。',
  createdAt: '2026-03-01',
  updatedAt: '2026-04-14',
  pdtLead: '张明（产品经理）',
  gtmLead: '李华（GTM Lead）',
  commits: [
    {
      id: 'c001',
      type: 'meeting',
      roleId: 'lpdt',
      roleLabel: 'LPDT',
      stageId: 'gr3',
      title: 'PDCP 评审会议纪要',
      content: '会议于 4 月 10 日召开，PDT 全员参与。主要议题：\n1. 产品规格最终确认，核心功能锁定语音识别 + 智能家居联动；\n2. BOM 成本较目标超出 8%，需采购代表在 4/17 前提出降本方案；\n3. 试产时间确认为 5 月 15 日 EVT 阶段。\n\n行动项：采购代表 4/17 前提交降本方案，PMO 更新项目计划。',
      summary: '规格锁定 | BOM 成本偏高 8%，需降本 | EVT 试产定于 5/15',
      timestamp: '2026-04-10T14:00:00',
      tags: ['PDCP', '规格确认', '成本风险'],
    },
    {
      id: 'c002',
      type: 'change',
      roleId: 'market',
      roleLabel: '市场代表',
      stageId: 'gr3',
      title: '产品定位重大调整：家庭娱乐 → 办公效率',
      content: '基于最新用户调研（N=300），家庭娱乐场景竞争激烈，主要竞品已占据 60%+ 份额。办公效率场景用户付费意愿更高（ARPU 高出 40%），且竞品覆盖不足。建议将核心定位从"家庭娱乐"调整为"办公效率"，同步调整 USP 和营销方向。',
      summary: '产品定位重大调整，基于竞品分析和用户付费意愿数据。',
      timestamp: '2026-04-08T10:30:00',
      tags: ['产品定位', '市场调研', '重要变更'],
    },
    {
      id: 'c003',
      type: 'milestone',
      roleId: 'pmo',
      roleLabel: 'PDT / PMO',
      stageId: 'gr2',
      title: 'CDCP 评审通过，进入 GR2 计划阶段',
      content: 'CDCP 评审于 3 月 20 日通过，所有评审委员签字确认。产品进入 GR2 计划阶段，启动供应链和制造可行性深化工作。',
      summary: 'CDCP 通过，进入 GR2 阶段。',
      timestamp: '2026-03-20T16:00:00',
      tags: ['CDCP', '里程碑'],
    },
    {
      id: 'c004',
      type: 'note',
      roleId: 'finance',
      roleLabel: '财务代表',
      stageId: 'gr2',
      title: 'BOM 目标成本设定：¥280 / 台',
      content: '基于市场定价策略（零售价 ¥699），毛利率目标 40%，BOM 目标成本设定为 ¥280/台。当前最新 BOM 报价为 ¥305，缺口 ¥25。主要降本空间：扬声器模组（-¥10）、外壳工艺替代（-¥8）、主控芯片国产化（-¥7）。',
      summary: 'BOM 目标 ¥280，当前 ¥305，缺口 ¥25，降本路径已明确。',
      timestamp: '2026-03-15T09:00:00',
      tags: ['BOM成本', '财务目标'],
    },
    {
      id: 'c005',
      type: 'meeting',
      roleId: 'gtm_lead',
      roleLabel: 'GTM Lead',
      stageId: 'gr2',
      title: 'GTM 策略初版对齐会议',
      content: '与 PCT 核心成员对齐 GTM 战略方向。确认目标市场为一二线城市职场人群，渠道以线上（京东/天猫）为主，线下仅布局核心商圈体验店。预计上市时间 Q3。',
      summary: '目标客群、渠道策略、上市时间初步锁定。',
      timestamp: '2026-03-10T14:00:00',
      tags: ['GTM', '渠道策略'],
    },
    {
      id: 'c006',
      type: 'milestone',
      roleId: 'pmo',
      roleLabel: 'PDT / PMO',
      stageId: 'gr1',
      title: 'Charter 通过，项目正式立项',
      content: 'Charter 文件于 3 月 1 日获 IPMT 批准，项目正式立项。确认 PDT Lead 为张明，PMO 由王丽担任，启动 GR1 工作。',
      summary: '项目正式立项，核心团队确认。',
      timestamp: '2026-03-01T10:00:00',
      tags: ['Charter', '里程碑', '立项'],
    },
  ],
};

// ── 核心操作 ─────────────────────────────────────────────────

function _getAll() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) {
      localStorage.setItem(STORE_KEY, JSON.stringify([DEMO_PROJECT]));
      return [DEMO_PROJECT];
    }
    return JSON.parse(raw);
  } catch { return [DEMO_PROJECT]; }
}

function _saveAll(projects) {
  localStorage.setItem(STORE_KEY, JSON.stringify(projects));
}

const Store = {
  getProjects() { return _getAll(); },

  getProject(id) { return _getAll().find(p => p.id === id) || null; },

  createProject(data) {
    const projects = _getAll();
    const project = {
      id: 'proj_' + Date.now(),
      status: 'active',
      currentStage: 'gr1',
      commits: [],
      createdAt: new Date().toISOString().slice(0, 10),
      updatedAt: new Date().toISOString().slice(0, 10),
      ...data,
    };
    projects.unshift(project);
    _saveAll(projects);
    return project;
  },

  updateProject(id, updates) {
    const projects = _getAll();
    const idx = projects.findIndex(p => p.id === id);
    if (idx < 0) return null;
    projects[idx] = { ...projects[idx], ...updates, updatedAt: new Date().toISOString().slice(0, 10) };
    _saveAll(projects);
    return projects[idx];
  },

  addCommit(projectId, commitData) {
    const projects = _getAll();
    const project = projects.find(p => p.id === projectId);
    if (!project) return null;
    const commit = {
      id: 'c_' + Date.now(),
      timestamp: new Date().toISOString(),
      ...commitData,
    };
    if (!project.commits) project.commits = [];
    project.commits.unshift(commit);
    project.updatedAt = new Date().toISOString().slice(0, 10);
    _saveAll(projects);
    return commit;
  },

  deleteProject(id) {
    const projects = _getAll().filter(p => p.id !== id);
    _saveAll(projects);
  },
};

// ── 工具函数 ─────────────────────────────────────────────────

function formatRelativeTime(isoString) {
  const diff = Date.now() - new Date(isoString).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1)  return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  const h = Math.floor(min / 60);
  if (h < 24)   return `${h} 小时前`;
  const d = Math.floor(h / 24);
  if (d < 30)   return `${d} 天前`;
  return new Date(isoString).toLocaleDateString('zh-CN');
}

function formatDate(isoString) {
  if (!isoString) return '';
  return new Date(isoString).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function getStageLabel(stageId) {
  if (!stageId) return '';
  const s = (typeof STAGES !== 'undefined' ? STAGES : []).find(x => x.id === stageId);
  return s ? `${s.code} ${s.name}` : stageId.toUpperCase();
}

function getCommitType(typeId) {
  return COMMIT_TYPES.find(t => t.id === typeId) || COMMIT_TYPES[3];
}

function getRoleInfo(roleId) {
  return ALL_ROLES.find(r => r.id === roleId) || { label: roleId, color: '#64748b' };
}
