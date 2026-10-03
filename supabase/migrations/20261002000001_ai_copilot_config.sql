-- Migration: Create ai_bot_configs table and seed admin_copilot prompt
create table if not exists public.ai_bot_configs (
  id text primary key,
  system_prompt text not null,
  model text not null default 'gemini-1.5-pro',
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security
alter table public.ai_bot_configs enable row level security;

-- Policy: Allow service_role full access
drop policy if exists "Allow service_role full access to ai_bot_configs" on public.ai_bot_configs;
create policy "Allow service_role full access to ai_bot_configs"
  on public.ai_bot_configs
  for all
  to service_role
  using (true)
  with check (true);

-- Policy: Allow authenticated admins to select ai_bot_configs
drop policy if exists "Allow admins to select ai_bot_configs" on public.ai_bot_configs;
create policy "Allow admins to select ai_bot_configs"
  on public.ai_bot_configs
  for select
  to authenticated
  using (
    exists (select 1 from public.admins where admins.id = auth.uid())
  );

-- Policy: Allow authenticated admins to update ai_bot_configs
drop policy if exists "Allow admins to update ai_bot_configs" on public.ai_bot_configs;
create policy "Allow admins to update ai_bot_configs"
  on public.ai_bot_configs
  for update
  to authenticated
  using (
    exists (select 1 from public.admins where admins.id = auth.uid())
  )
  with check (
    exists (select 1 from public.admins where admins.id = auth.uid())
  );

-- Seed row for admin_copilot
insert into public.ai_bot_configs (id, system_prompt, model, updated_at)
values (
  'admin_copilot',
  'You are the Universal Admin AI Copilot for the Home Services Platform (HomeServe). Your job is to assist platform operations admins with real-time operational insights, booking dispatch summaries, payout oversight, customer dispute analysis, and drafting professional customer support responses. When providing financial figures, format them using Indian Rupees (₹). Always be precise, professional, concise, and helpful.',
  'gemini-1.5-pro',
  timezone('utc'::text, now())
)
on conflict (id) do update set
  system_prompt = excluded.system_prompt,
  model = excluded.model,
  updated_at = timezone('utc'::text, now());

-- Reload PostgREST schema cache immediately
notify pgrst, 'reload schema';

