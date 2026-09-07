-- Phase 8 — Contacts / amis + présence (§3, §14).
-- Voir note RLS de 0002 : policies conservées, inertes sur Neon, contrôle
-- d'accès effectif côté Worker.

create table contact_requests (
  id text primary key,
  from_user text not null references "user"(id) on delete cascade,
  to_user text not null references "user"(id) on delete cascade,
  status text not null default 'pending', -- pending | accepted | declined
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index contact_requests_pair_pending on contact_requests(from_user, to_user) where status = 'pending';
create index contact_requests_to_idx on contact_requests(to_user) where status = 'pending';

-- Amitié = 2 lignes (bidirectionnel) pour des requêtes simples.
create table contacts (
  user_id text not null references "user"(id) on delete cascade,
  contact_id text not null references "user"(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, contact_id)
);

-- Présence globale : heartbeat de l'app ; "en ligne" = last_seen_at récent.
create table user_presence (
  user_id text primary key references "user"(id) on delete cascade,
  last_seen_at timestamptz not null default now()
);

alter table contact_requests enable row level security;
alter table contacts enable row level security;
alter table user_presence enable row level security;
create policy cr_access on contact_requests using (current_setting('app.user_id', true) in (from_user, to_user));
create policy ct_access on contacts using (current_setting('app.user_id', true) = user_id);
create policy up_access on user_presence using (true);

grant select, insert, update, delete on contact_requests to lingolink_app;
grant select, insert, delete on contacts to lingolink_app;
grant select, insert, update on user_presence to lingolink_app;
