// ============================================================
// IPMS — 共享数据层 (Supabase)
// ============================================================

// ── 角色快查表 ────────────────────────────────────────────────
const ALL_ROLES = [
  { id: 'lpdt',           label: 'LPDT',             team: 'PDT', color: '#1d4ed8' },
  { id: 'market',         label: '市场代表',           team: 'PDT', color: '#0891b2' },
  { id: 'procurement',    label: '采购代表',           team: 'PDT', color: '#065f46' },
  { id: 'manufacturing',  label: '制造代表',           team: 'PDT', color: '#6d28d9' },
  { id: 'quality',        label: '质量代表',           team: 'PDT', color: '#b45309' },
  { id: 'finance',        label: '财务代表',           team: 'PDT', color: '#9d174d' },
  { id: 'service_tech',   label: '技术服务代表',       team: 'PDT', color: '#0f766e' },
  { id: 'mo_pdt',         label: 'MO 营运运作',        team: 'PDT', color: '#c2410c' },
  { id: 'pmo',            label: 'PDT / PMO',          team: 'PDT', color: '#475569' },
  { id: 'gtm_lead',       label: 'GTM Lead',           team: 'PCT', color: '#0ea5e9' },
  { id: 'mo_pct',         label: 'MO 营运运作',        team: 'PCT', color: '#c2410c' },
  { id: 'marketing',      label: '营销代表',           team: 'PCT', color: '#7c3aed' },
  { id: 'content',        label: '内容与创意',         team: 'PCT', color: '#be185d' },
  { id: 'retail',         label: '零售代表',           team: 'PCT', color: '#0f766e' },
  { id: 'ecommerce',      label: '渠道/电商代表',      team: 'PCT', color: '#b45309' },
  { id: 'pr_kol',         label: 'PR / KOL 代表',      team: 'PCT', color: '#1d4ed8' },
  { id: 'crm',            label: 'CRM / 用户运营',     team: 'PCT', color: '#9d174d' },
  { id: 'sales',          label: '销售代表',           team: 'PCT', color: '#065f46' },
  { id: 'cs',             label: '服务代表',           team: 'PCT', color: '#475569' },
];

const COMMIT_TYPES = [
  { id: 'meeting',   label: '会议纪要', icon: '📋', color: '#2563eb' },
  { id: 'change',    label: '信息变更', icon: '🔄', color: '#dc2626' },
  { id: 'milestone', label: '里程碑',   icon: '🎯', color: '#16a34a' },
  { id: 'note',      label: '备注记录', icon: '📝', color: '#ca8a04' },
  { id: 'decision',  label: '决策记录', icon: '⚡', color: '#7c3aed' },
];

// ── Supabase 数据层 ───────────────────────────────────────────
const Store = {

  // ── 项目 ────────────────────────────────────────────────────
  async getProjects() {
    const { data, error } = await sb
      .from('projects')
      .select('*, commits(id)')
      .order('created_at', { ascending: false });
    if (error) { console.error('getProjects:', error); return []; }
    return (data || []).map(p => ({
      ...p,
      commitCount: Array.isArray(p.commits) ? p.commits.length : 0,
    }));
  },

  async getProject(id) {
    const { data, error } = await sb
      .from('projects')
      .select('*')
      .eq('id', id)
      .single();
    if (error) { console.error('getProject:', error); return null; }
    return data;
  },

  async createProject(payload, userId) {
    const id = 'proj_' + Date.now();
    const today = new Date().toISOString().slice(0, 10);
    const row = {
      id,
      name:          payload.name,
      code:          payload.code,
      description:   payload.description || '',
      status:        'active',
      current_stage: payload.currentStage || 'gr1',
      pdt_lead:      payload.pdtLead || '',
      gtm_lead:      payload.gtmLead || '',
      owner_id:      userId,
      created_at:    today,
      updated_at:    today,
    };
    const { data, error } = await sb.from('projects').insert(row).select().single();
    if (error) { console.error('createProject:', error); throw error; }

    // Also add as project member (owner)
    await sb.from('project_members').insert({
      project_id: id,
      user_id:    userId,
      ipms_role:  'owner',
    });

    return data;
  },

  async updateProject(id, updates) {
    const mapped = {};
    if (updates.name          !== undefined) mapped.name          = updates.name;
    if (updates.description   !== undefined) mapped.description   = updates.description;
    if (updates.status        !== undefined) mapped.status        = updates.status;
    if (updates.currentStage  !== undefined) mapped.current_stage = updates.currentStage;
    if (updates.pdtLead       !== undefined) mapped.pdt_lead      = updates.pdtLead;
    if (updates.gtmLead       !== undefined) mapped.gtm_lead      = updates.gtmLead;
    mapped.updated_at = new Date().toISOString().slice(0, 10);

    const { data, error } = await sb
      .from('projects').update(mapped).eq('id', id).select().single();
    if (error) { console.error('updateProject:', error); throw error; }
    return data;
  },

  async deleteProject(id) {
    const { error } = await sb.from('projects').delete().eq('id', id);
    if (error) { console.error('deleteProject:', error); throw error; }
  },

  // ── 动态记录（commits）────────────────────────────────────
  async getCommits(projectId) {
    const { data, error } = await sb
      .from('commits')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    if (error) { console.error('getCommits:', error); return []; }
    return data || [];
  },

  async addCommit(projectId, payload, userId) {
    const id = 'c_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    const row = {
      id,
      project_id: projectId,
      type:       payload.type,
      role_id:    payload.roleId   || '',
      role_label: payload.roleLabel || '',
      stage_id:   payload.stageId  || '',
      title:      payload.title,
      content:    payload.content  || '',
      summary:    payload.summary  || '',
      tags:       payload.tags     || [],
      source_tab: payload.sourceTab || 'timeline',
      source_id:  payload.sourceId || '',
      author_id:  userId,
    };
    const { data, error } = await sb.from('commits').insert(row).select().single();
    if (error) { console.error('addCommit:', error); throw error; }

    // bump updated_at on project
    await sb.from('projects').update({ updated_at: new Date().toISOString().slice(0,10) }).eq('id', projectId);
    return data;
  },

  // ── 交付件 ───────────────────────────────────────────────────
  async getDeliverables(projectId) {
    const { data, error } = await sb
      .from('deliverables')
      .select('*')
      .eq('project_id', projectId)
      .order('sort_order');
    if (error) { console.error('getDeliverables:', error); return []; }
    return data || [];
  },

  async upsertDeliverable(row) {
    const { data, error } = await sb
      .from('deliverables').upsert(row, { onConflict: 'id' }).select().single();
    if (error) { console.error('upsertDeliverable:', error); throw error; }
    return data;
  },

  // ── 会议记录 ─────────────────────────────────────────────────
  async getMeetings(projectId) {
    const { data, error } = await sb
      .from('meetings')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    if (error) { console.error('getMeetings:', error); return []; }
    return data || [];
  },

  async addMeeting(projectId, payload, userId) {
    const id = 'mtg_' + Date.now();
    const row = {
      id,
      project_id:   projectId,
      stage_id:     payload.stageId || '',
      title:        payload.title,
      meeting_date: payload.meetingDate || '',
      attendees:    payload.attendees  || [],
      agenda:       payload.agenda     || '',
      minutes:      payload.minutes    || '',
      action_items: payload.actionItems || [],
      author_id:    userId,
    };
    const { data, error } = await sb.from('meetings').insert(row).select().single();
    if (error) { console.error('addMeeting:', error); throw error; }
    return data;
  },

  // ── 项目成员 ─────────────────────────────────────────────────
  async getMembers(projectId) {
    const { data, error } = await sb
      .from('project_members')
      .select('*, profiles(id, name, email)')
      .eq('project_id', projectId);
    if (error) { console.error('getMembers:', error); return []; }
    return data || [];
  },

  async addMember(projectId, userId, role = 'member') {
    const { data, error } = await sb
      .from('project_members')
      .upsert({ project_id: projectId, user_id: userId, ipms_role: role }, { onConflict: 'project_id,user_id' })
      .select().single();
    if (error) { console.error('addMember:', error); throw error; }
    return data;
  },

  async updateMemberRole(projectId, userId, role) {
    const { error } = await sb
      .from('project_members')
      .update({ ipms_role: role })
      .eq('project_id', projectId)
      .eq('user_id', userId);
    if (error) { console.error('updateMemberRole:', error); throw error; }
  },

  async removeMember(projectId, userId) {
    const { error } = await sb
      .from('project_members')
      .delete()
      .eq('project_id', projectId)
      .eq('user_id', userId);
    if (error) { console.error('removeMember:', error); throw error; }
  },

  async getUserRole(projectId, userId) {
    const { data } = await sb
      .from('project_members')
      .select('ipms_role')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .single();
    return data?.ipms_role || null;
  },

  // ── 变更申请 ─────────────────────────────────────────────────
  async getChangeRequests(projectId) {
    const { data, error } = await sb
      .from('change_requests')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    if (error) { console.error('getChangeRequests:', error); return []; }
    return data || [];
  },
};

// ── 工具函数 ─────────────────────────────────────────────────

function formatRelativeTime(isoString) {
  if (!isoString) return '';
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
