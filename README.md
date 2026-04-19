# IPMS 学习平台

一个基于 IPD（集成产品开发）流程的项目管理学习平台，前端静态 + Supabase 后端。

## 项目是什么

IPMS（Integrated Product Management System）是一个可视化的产品管理流程工具，帮助团队理解和实践 IPD/IPMS 方法论。平台包含：

- **IPD/IPMS 流程视图**：可交互的 IPD 阶段流程图，展示完整的产品开发生命周期
- **方法论模型库**：内置 70+ 产品管理方法论卡片（PDCP、GTM、JTBD 等），支持搜索和分类筛选
- **项目管理面板**：基于 IPD 的项目时间线、交付件追踪、会议记录、操作历史

## 技术栈

- 纯静态 HTML + CSS + Vanilla JS（无框架依赖）
- Supabase（认证 + 数据库）
- localStorage（本地配置持久化）

## 目录结构

```
ipms/
├── index.html          # IPD/IPMS 流程视图（Page 1）
├── frameworks.html     # 方法论模型库（Page 2）
├── projects.html       # 项目列表（Page 3）
├── project.html        # 项目详情页
├── css/
│   └── style.css       # 全局样式
└── js/
    ├── data.js         # 静态数据（阶段、角色、交付件、方法论）
    ├── supabase-client.js
    ├── auth.js
    ├── store.js        # Supabase CRUD 封装
    └── project.js      # 项目详情页逻辑
```

## 项目管理面板功能

### 时间线（IPD 流程图）
- 横向 CSS Grid，7 个 GR 阶段 × 所有 PDT/PCT 角色
- 每个阶段可编辑周次（点击 WEEK 行），今日线实时定位
- 右上角 **⚙ 配置** 全局面板：
  - 职能开关：一键启用/禁用整个角色行
  - 成员分配：在面板内直接给每个职能分配负责人
  - 交付件开关：展开每个职能，可逐条开关各阶段交付件（数据保留）

### 交付件
- 按 GR 阶段 + 团队分组展示，支持状态流转（待提交 → 已批准）

### 会议记录
- 结构化记录议程、纪要、行动项

### 看板（操作历史）
- 自动记录所有关键操作：时间线配置、交付件更新、会议新增、设置变更
- 按日期分组展示，支持按类别过滤（时间线 / 交付件 / 会议 / 设置）

### 导航 Tab
- 支持拖拽调整 Tab 顺序，顺序保存到 localStorage

## 近期更新（2026-04）

- **全局配置面板**：将职能配置、成员分配、交付件开关整合到时间线右上角的统一抽屉面板
- **操作历史看板**：自动追踪时间线/交付件/会议/设置的关键变更，支持分类过滤
- **Tab 拖拽排序**：项目导航 Tab 支持拖拽自定义顺序
- **IPD 时间线优化**：修复 WEEK 行显示、今日线定位、交付件开关逻辑

## 快速开始

1. 配置 Supabase：在 `js/supabase-client.js` 填入你的 `SUPABASE_URL` 和 `SUPABASE_ANON_KEY`
2. 用任意静态服务器托管（如 VS Code Live Server）
3. 注册 / 登录后，在「项目」页创建第一个项目
