-- Phase 3 — Sessions de conversation (§11).
--
-- RLS activée + policies conservées (défense en profondeur / portabilité).
-- NOTE Neon : tous les rôles héritent de `neon_superuser` (BYPASSRLS) et le
-- plan gratuit interdit `ALTER ROLE ... NOBYPASSRLS`, donc ces policies sont
-- inertes aujourd'hui. Le contrôle d'accès effectif est fait côté Worker :
-- chaque endpoint filtre par `creator_id`/`participant_id` = utilisateur courant
-- (voir server/src/sessions.ts, `ownSessionQuery`). Le rôle `lingolink_app` et
-- ses grants ne sont pas utilisés pour l'instant.

create table conversation_sessions (
  id text primary key,
  creator_id text not null references "user"(id) on delete cascade,
  participant_id text references "user"(id) on delete set null,
  creator_language text not null,
  participant_language text not null,
  method text not null default 'qr',
  status text not null default 'waiting',
  connection_token text not null unique,
  short_code text not null unique,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  ended_at timestamptz
);

create index conversation_sessions_creator_idx on conversation_sessions(creator_id);
create index conversation_sessions_participant_idx on conversation_sessions(participant_id) where participant_id is not null;

alter table conversation_sessions enable row level security;

create policy cs_select on conversation_sessions for select
  using (current_setting('app.user_id', true) in (creator_id, coalesce(participant_id, '')));
create policy cs_insert on conversation_sessions for insert
  with check (current_setting('app.user_id', true) = creator_id);
create policy cs_update on conversation_sessions for update
  using (current_setting('app.user_id', true) in (creator_id, coalesce(participant_id, '')))
  with check (current_setting('app.user_id', true) in (creator_id, coalesce(participant_id, '')));

grant usage on schema public to lingolink_app;
grant select, insert, update on conversation_sessions to lingolink_app;

-- Jointure : SECURITY DEFINER pour retrouver la session par token/code avant
-- que l'appelant ne soit participant (donc hors périmètre RLS).
create or replace function join_conversation_session(p_token text, p_code text, p_user_id text)
returns conversation_sessions
language plpgsql security definer set search_path = public
as $$
declare s conversation_sessions;
begin
  select * into s from conversation_sessions
   where (p_token is not null and connection_token = p_token)
      or (p_code is not null and short_code = upper(p_code))
   for update;
  if not found then raise exception 'not_found'; end if;
  if s.expires_at is not null and s.expires_at < now() and s.status = 'waiting' then
    update conversation_sessions set status = 'expired' where id = s.id;
    raise exception 'expired';
  end if;
  if s.status <> 'waiting' then raise exception 'not_joinable'; end if;
  if s.creator_id = p_user_id then raise exception 'own_session'; end if;
  update conversation_sessions
     set participant_id = p_user_id, status = 'active', activated_at = now()
   where id = s.id
   returning * into s;
  return s;
end $$;

grant execute on function join_conversation_session(text, text, text) to lingolink_app;
