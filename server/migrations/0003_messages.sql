-- Phase 6 — Messages de conversation (§9, §14).
-- Voir la note RLS de 0002 : policies conservées mais inertes sur Neon ;
-- l'accès est vérifié côté Worker (appartenance à la session).

create table conversation_messages (
  id text primary key,
  session_id text not null references conversation_sessions(id) on delete cascade,
  sender_id text not null references "user"(id) on delete cascade,
  source_language text not null,
  target_language text not null,
  original_transcript text not null default '',
  translated_text text not null default '',
  status text not null default 'processing', -- recording | processing | partial | completed | failed
  client_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index conversation_messages_session_idx on conversation_messages(session_id, created_at);

alter table conversation_messages enable row level security;
create policy cm_access on conversation_messages using (
  exists (
    select 1 from conversation_sessions s
    where s.id = conversation_messages.session_id
      and current_setting('app.user_id', true) in (s.creator_id, coalesce(s.participant_id, ''))
  )
);

grant select, insert, update on conversation_messages to lingolink_app;
