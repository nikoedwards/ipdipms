// ============================================================
// IPMS — LLM 集成模块 (Anthropic Claude API)
// ============================================================

const LLM = (() => {
  const CONFIG_KEY = 'ipms-llm-config';

  // ── 配置 helpers ─────────────────────────────────────────
  function getConfig() {
    try { return JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}'); }
    catch { return {}; }
  }
  function saveConfig(cfg) { localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg)); }
  function isConfigured() { const { apiKey, model } = getConfig(); return !!(apiKey && model); }

  // ── 构建项目上下文快照 ───────────────────────────────────
  function buildProjectContext({ project, todos, wikiEntries, meetings, deliverables, history, milestones, roleAssignments }) {
    const lines = [];
    const today = new Date().toISOString().slice(0, 10);

    lines.push('# 项目概况');
    lines.push(`名称：${project.name}  代码：${project.code || ''}`);
    lines.push(`状态：${project.status}  当前阶段：${project.current_stage || ''}`);
    if (project.description) lines.push(`描述：${project.description}`);
    if (project.pdt_lead)    lines.push(`PDT Lead：${project.pdt_lead}`);
    if (project.gtm_lead)    lines.push(`GTM Lead：${project.gtm_lead}`);
    lines.push(`今日日期：${today}`);

    if (milestones && Object.keys(milestones).length) {
      lines.push('\n# 评审节点（里程碑日期）');
      const msLabels = { kickoff:'Kick-off', cdcp:'CDCP', pdcp:'PDCP', devval:'开发验证', adcp:'ADCP', launch:'发布', gr5a_end:'稳定期结束', gr6_end:'退市完成' };
      Object.entries(milestones).forEach(([k, v]) => lines.push(`  ${msLabels[k] || k}: ${v}`));
    }

    if (roleAssignments && Object.keys(roleAssignments).length) {
      lines.push('\n# 角色分配');
      Object.entries(roleAssignments).forEach(([roleId, member]) => {
        if (member) lines.push(`  ${roleId}: ${member}`);
      });
    }

    if (meetings && meetings.length) {
      lines.push('\n# 近期会议记录（最近5条）');
      meetings.slice(0, 5).forEach(m => {
        lines.push(`\n## ${m.title || ''} (${m.meeting_date || ''})`);
        if (m.agenda)  lines.push(`议程：${m.agenda}`);
        if (m.minutes) lines.push(`纪要：${m.minutes}`);
        if (Array.isArray(m.action_items) && m.action_items.length) {
          lines.push('行动项：');
          m.action_items.forEach(a => lines.push(`  - ${a}`));
        }
        if (Array.isArray(m.attendees) && m.attendees.length) {
          lines.push(`参会人：${m.attendees.join('、')}`);
        }
      });
    }

    if (deliverables && deliverables.length) {
      lines.push('\n# 交付件状态');
      const byStage = {};
      deliverables.forEach(d => {
        if (!byStage[d.stage_id]) byStage[d.stage_id] = [];
        byStage[d.stage_id].push(d);
      });
      Object.entries(byStage).forEach(([stage, items]) => {
        lines.push(`  ${stage}：${items.map(d => `${d.name}(${d.status || 'pending'})`).join('、')}`);
      });
    }

    if (todos && todos.length) {
      const open = todos.filter(t => t.status !== 'done');
      lines.push(`\n# 当前待办（共 ${todos.length} 条，未完成 ${open.length} 条）`);
      if (open.length) {
        open.slice(0, 10).forEach(t => {
          lines.push(`  - [${t.priority || 'medium'}][${t.status || 'open'}] ${t.title}（负责：${t.assignee || '未指派'}，截止：${t.dueDate || '无'}）`);
        });
      }
    }

    if (wikiEntries && wikiEntries.length) {
      lines.push(`\n# Wiki 知识库（${wikiEntries.length} 条）`);
      wikiEntries.forEach(e => lines.push(`  - [${e.category || 'other'}] ${e.title}（更新：${(e.updatedAt || '').slice(0, 10)}）`));
    }

    if (history && history.length) {
      lines.push('\n# 近期操作记录（最近10条）');
      history.slice(0, 10).forEach(h => {
        lines.push(`  ${(h.ts || '').slice(0, 10)} [${h.category || ''}] ${h.action || ''}：${h.detail || ''}`);
      });
    }

    return lines.join('\n');
  }

  // ── 系统提示模板 ─────────────────────────────────────────
  const SYSTEM_BASE = `你是 IPMS 平台的 AI 项目助手，专注于 IPD（集成产品开发）项目管理。
你的回答必须是纯 JSON，包裹在 \`\`\`json 和 \`\`\` 之间，不要有任何其他文字。
今日日期已包含在项目上下文中，请据此推断合理的截止时间。`;

  const PROMPTS = {
    todo: `${SYSTEM_BASE}

生成 3-5 条具体可执行的待办事项。优先关注：
1. 会议行动项尚未创建为待办的
2. 交付件状态异常或逾期的
3. 当前阶段关键里程碑前应完成的事项
4. 不要与现有未完成待办重复

JSON 格式：
\`\`\`json
{
  "summary": "一句话说明 AI 判断依据",
  "actions": [
    {
      "type": "create_todo",
      "title": "待办标题（动词开头）",
      "assignee": "负责人姓名或空字符串",
      "dueDate": "YYYY-MM-DD 或空字符串",
      "priority": "high|medium|low",
      "stage": "gr1|gr2|gr3|gr4|gr5|gr5a|gr6",
      "notes": "来源说明，如：来自 CDCP 会议纪要"
    }
  ]
}
\`\`\``,

    wiki: `${SYSTEM_BASE}

根据项目最新活动，识别应记录到 Wiki 的重要信息，创建或更新知识库条目。优先关注：
1. 会议中产生的关键决策
2. 产品规格或技术方案的最新状态
3. 尚未在 Wiki 中记录的重要项目信息
4. 避免与现有 Wiki 条目内容重复（但可以更新）

JSON 格式：
\`\`\`json
{
  "summary": "一句话说明本次同步的主要内容",
  "actions": [
    {
      "type": "create_wiki",
      "title": "条目标题",
      "category": "overview|product|market|decision|tech|process|other",
      "content": "Markdown 格式内容（可使用 ## 小标题、- 列表、**粗体**）"
    }
  ]
}
\`\`\``,

    extractActionItems: `${SYSTEM_BASE}

从会议纪要中提取行动项，并建议创建对应待办。

JSON 格式：
\`\`\`json
{
  "summary": "一句话说明提取结果",
  "extractedItems": ["行动项1", "行动项2"],
  "actions": [
    {
      "type": "create_todo",
      "title": "待办标题",
      "assignee": "负责人或空",
      "dueDate": "YYYY-MM-DD 或空",
      "priority": "high|medium|low",
      "stage": "gr1|...|gr6",
      "notes": "来自本次会议"
    }
  ]
}
\`\`\``,

    meetingExtract: `你是一个专业的会议记录助手，服务于 IPD 产品管理团队。
从用户上传的文档内容中，提取并整理所有会议信息。注意：
- 日期格式统一为 YYYY-MM-DD（无法判断时返回空字符串）
- 行动项尽量包含负责人和截止时间（如文档有提及）
- 保留关键决策、数据、重要结论
- 若某字段文档中无对应内容，返回空字符串或空数组

只返回 JSON，包裹在 \`\`\`json 和 \`\`\` 之间，不要有其他文字：
\`\`\`json
{
  "title": "会议标题（从文档标题或内容推断）",
  "meeting_date": "YYYY-MM-DD 或空字符串",
  "attendees": ["姓名1", "姓名2"],
  "agenda": "议程摘要（1-3句，条目间用；分隔）",
  "minutes": "会议纪要正文（保留关键决策、数据、结论，Markdown 格式）",
  "action_items": [
    "【负责人】任务内容 — 截止日期",
    "【负责人】任务内容 — 截止日期"
  ]
}
\`\`\``,
  };

  // ── 判断 provider ────────────────────────────────────────
  const PROVIDERS = {
    anthropic: {
      label: 'Anthropic',
      models: [
        { id: 'claude-sonnet-4-6',          label: 'Claude Sonnet 4.6（推荐）' },
        { id: 'claude-haiku-4-5-20251001',  label: 'Claude Haiku 4.5（快速）' },
        { id: 'claude-opus-4-7',            label: 'Claude Opus 4.7（最强）' },
      ],
    },
    qwen: {
      label: '通义千问 (DashScope)',
      models: [
        { id: 'qwen3-235b-a22b',   label: 'Qwen3-235B-A22B' },
        { id: 'qwen-plus',         label: 'Qwen-Plus（平衡）' },
        { id: 'qwen-turbo',        label: 'Qwen-Turbo（快速）' },
        { id: 'qwen-max',          label: 'Qwen-Max（最强）' },
      ],
    },
    openai_compat: {
      label: 'OpenAI 兼容（自定义）',
      models: [],
    },
  };

  function detectProvider(model, baseUrl) {
    if (baseUrl) return 'openai_compat';
    if (!model) return 'anthropic';
    if (model.startsWith('qwen') || model.startsWith('qwq')) return 'qwen';
    if (model.startsWith('claude')) return 'anthropic';
    return 'openai_compat';
  }

  // ── 统一 LLM 调用入口 ────────────────────────────────────
  async function callLLM(systemPrompt, userMessage) {
    const { apiKey, model, baseUrl } = getConfig();
    if (!apiKey) throw new Error('未配置 API Key，请先在「设置」中填入');

    const provider = detectProvider(model, baseUrl);

    if (provider === 'anthropic') {
      return _callAnthropic(systemPrompt, userMessage, apiKey, model);
    } else {
      // OpenAI-compatible: Qwen DashScope, custom, etc.
      const endpoint = baseUrl
        ? baseUrl.replace(/\/$/, '') + '/chat/completions'
        : 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
      return _callOpenAICompat(systemPrompt, userMessage, apiKey, model, endpoint);
    }
  }

  async function _callAnthropic(systemPrompt, userMessage, apiKey, model) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: model || 'claude-sonnet-4-6',
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });
    if (!response.ok) {
      let msg = `Anthropic API 错误 ${response.status}`;
      try { const err = await response.json(); msg = err.error?.message || msg; } catch {}
      throw new Error(msg);
    }
    const data = await response.json();
    return data.content?.[0]?.text || '';
  }

  async function _callOpenAICompat(systemPrompt, userMessage, apiKey, model, endpoint) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || 'qwen-plus',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userMessage  },
        ],
        // Qwen3 thinking mode: disable for structured JSON output
        enable_thinking: false,
      }),
    });
    if (!response.ok) {
      let msg = `API 错误 ${response.status}`;
      try { const err = await response.json(); msg = err.error?.message || msg; } catch {}
      throw new Error(msg);
    }
    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }

  // ── 解析 LLM 输出的 JSON ─────────────────────────────────
  // Returns: action-schema  { actions:[], summary }
  //       or meeting-schema { title, meeting_date, attendees, agenda, minutes, action_items }
  //       on failure: { actions:[], summary:'...' }
  function parseResponse(text) {
    const jsonMatch = text.match(/```json\s*([\s\S]*?)```/);
    const jsonStr   = jsonMatch ? jsonMatch[1] : text;
    try {
      const parsed = JSON.parse(jsonStr.trim());
      // Action-schema
      if (Array.isArray(parsed.actions)) return parsed;
      if (Array.isArray(parsed)) return { actions: parsed, summary: '' };
      // Meeting-schema: has 'title' at top level (not wrapped in actions)
      if ('title' in parsed || 'minutes' in parsed || 'action_items' in parsed) return parsed;
      return { actions: [], summary: '' };
    } catch {
      return { actions: [], summary: '（无法解析 AI 输出）' };
    }
  }

  // ── 生成确认项描述 ───────────────────────────────────────
  function describeAction(a) {
    if (a.type === 'create_todo') {
      const pri = a.priority === 'high' ? ' 🔴' : a.priority === 'medium' ? ' 🟡' : ' 🟢';
      return `<b>${a.title}</b>${pri}${a.assignee ? `<br>负责：${a.assignee}` : ''}${a.dueDate ? `  ·  截止 ${a.dueDate}` : ''}${a.notes ? `<br><small style="color:var(--text-muted)">${a.notes}</small>` : ''}`;
    }
    if (a.type === 'create_wiki') {
      return `<b>${a.title}</b>  <small style="background:var(--bg-surface);padding:2px 6px;border-radius:4px">${a.category || 'other'}</small>${a.content ? `<br><small style="color:var(--text-muted)">${a.content.slice(0, 80).replace(/\n/g,' ')}…</small>` : ''}`;
    }
    if (a.type === 'update_wiki') {
      return `<b>更新：${a.title}</b>${a.content ? `<br><small style="color:var(--text-muted)">${a.content.slice(0, 80).replace(/\n/g,' ')}…</small>` : ''}`;
    }
    return `<b>${a.type}</b>：${a.title || JSON.stringify(a).slice(0, 60)}`;
  }

  // ── 确认模态框 ───────────────────────────────────────────
  function showConfirmModal({ title, summary, result, onConfirm }) {
    const actions = result.actions || [];
    if (!actions.length) {
      alert('AI 未生成任何建议，请检查项目数据是否充足。');
      return;
    }

    const TYPE_LABELS = { create_todo:'创建待办', update_todo:'更新待办', create_wiki:'创建 Wiki', update_wiki:'更新 Wiki', add_action_item:'添加行动项' };

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" style="max-width:560px">
        <div class="modal-header">
          <div class="modal-title">🤖 ${title || 'AI 建议'}</div>
          <button class="modal-close" id="llm-modal-close">✕</button>
        </div>
        <div class="modal-body">
          ${summary ? `<div class="llm-confirm-summary">${summary}</div>` : ''}
          <div class="llm-confirm-list">
            ${actions.map((a, i) => `
              <div class="llm-confirm-action">
                <div class="llm-confirm-action-hdr">
                  <span class="llm-action-type-badge">${TYPE_LABELS[a.type] || a.type}</span>
                  <span class="llm-action-num">${i + 1} / ${actions.length}</span>
                </div>
                <div class="llm-confirm-action-desc">${describeAction(a)}</div>
              </div>`).join('')}
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-ghost" id="llm-modal-cancel">取消</button>
          <button class="btn-primary" id="llm-modal-ok">确认执行（${actions.length} 项）</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.querySelector('#llm-modal-close').addEventListener('click', close);
    overlay.querySelector('#llm-modal-cancel').addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    overlay.querySelector('#llm-modal-ok').addEventListener('click', () => {
      close();
      onConfirm(actions);
    });
  }

  // ── 测试连接 ─────────────────────────────────────────────
  async function testConnection() {
    try {
      const text = await callLLM('You are a helpful assistant. Reply concisely.', '回复"连接成功"三个字');
      return { ok: true, text };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  return {
    getConfig, saveConfig, isConfigured,
    buildProjectContext,
    PROMPTS, PROVIDERS, detectProvider,
    callLLM, parseResponse,
    showConfirmModal,
    testConnection,
  };
})();
