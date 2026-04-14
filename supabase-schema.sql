-- ============================================================
-- IPMS Platform — Supabase Database Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- 1. 用户档案（扩展 auth.users）
create table if not exists public.profiles (
  id    uuid references auth.users(id) on delete cascade primary key,
  name  text not null default '',
  title text default '',
  email text,
  created_at timestamptz default now()
);

-- 2. 项目
create table if not exists public.projects (
  id            text primary key,
  name          text not null,
  code          text not null,
  description   text default '',
  status        text default 'active' check (status in ('active','hold','done')),
  current_stage text default 'gr1',
  pdt_lead      text default '',
  gtm_lead      text default '',
  owner_id      uuid references auth.users(id),
  created_at    text default to_char(current_date,'YYYY-MM-DD'),
  updated_at    text default to_char(current_date,'YYYY-MM-DD')
);

-- 3. 项目成员（含角色）
create table if not exists public.project_members (
  id         serial primary key,
  project_id text references public.projects(id) on delete cascade,
  user_id    uuid references auth.users(id),
  ipms_role  text default 'member' check (ipms_role in ('owner','admin','member')),
  created_at timestamptz default now(),
  unique(project_id, user_id)
);

-- 4. 时间线记录（所有 Tab 操作的汇总）
create table if not exists public.commits (
  id         text primary key,
  project_id text references public.projects(id) on delete cascade,
  type       text not null,
  role_id    text default '',
  role_label text default '',
  stage_id   text default '',
  title      text not null,
  content    text default '',
  summary    text default '',
  tags       text[] default '{}',
  source_tab text default 'timeline',   -- 来源 tab：timeline/deliverables/meetings
  source_id  text default '',            -- 关联记录 id
  author_id  uuid references auth.users(id),
  created_at timestamptz default now()
);

-- 5. 交付件（从 IPD/IPMS 流程自动生成）
create table if not exists public.deliverables (
  id           text primary key,
  project_id   text references public.projects(id) on delete cascade,
  stage_id     text not null,
  team         text not null,
  role_id      text not null,
  role_label   text not null,
  name         text not null,
  status       text default 'pending' check (status in ('pending','in_progress','submitted','approved')),
  content      text default '',
  submitted_by uuid references auth.users(id),
  submitted_at timestamptz,
  sort_order   integer default 0,
  created_at   timestamptz default now()
);

-- 6. 会议记录
create table if not exists public.meetings (
  id           text primary key,
  project_id   text references public.projects(id) on delete cascade,
  stage_id     text default '',
  title        text not null,
  meeting_date text,
  attendees    jsonb default '[]',
  agenda       text default '',
  minutes      text default '',
  action_items jsonb default '[]',
  author_id    uuid references auth.users(id),
  created_at   timestamptz default now()
);

-- 7. 变更申请
create table if not exists public.change_requests (
  id             text primary key,
  project_id     text references public.projects(id) on delete cascade,
  type           text not null,
  title          text not null,
  description    text default '',
  status         text default 'pending' check (status in ('pending','approved','rejected')),
  requested_by   uuid references auth.users(id),
  reviewed_by    uuid references auth.users(id),
  review_comment text default '',
  reviewed_at    timestamptz,
  created_at     timestamptz default now()
);

-- ── Row Level Security ────────────────────────────────────────
alter table public.profiles         enable row level security;
alter table public.projects         enable row level security;
alter table public.project_members  enable row level security;
alter table public.commits          enable row level security;
alter table public.deliverables     enable row level security;
alter table public.meetings         enable row level security;
alter table public.change_requests  enable row level security;

-- 简单策略：登录用户可访问所有数据（后续可收紧到项目级）
create policy "auth_all" on public.profiles        for all using (auth.uid() is not null);
create policy "auth_all" on public.projects        for all using (auth.uid() is not null);
create policy "auth_all" on public.project_members for all using (auth.uid() is not null);
create policy "auth_all" on public.commits         for all using (auth.uid() is not null);
create policy "auth_all" on public.deliverables    for all using (auth.uid() is not null);
create policy "auth_all" on public.meetings        for all using (auth.uid() is not null);
create policy "auth_all" on public.change_requests for all using (auth.uid() is not null);

-- ── 注册时自动创建用户档案 ────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)),
    new.email
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
