-- Phase 9 — Personnes à proximité (§4, méthode 4).
-- Confidentialité : visibilité opt-in, coordonnées ARRONDIES (~110 m) avant
-- stockage, expiration automatique, jamais de position exacte renvoyée.

create table nearby_presence (
  user_id text primary key references "user"(id) on delete cascade,
  lat double precision not null, -- arrondi à 3 décimales côté Worker
  lng double precision not null,
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index nearby_presence_geo_idx on nearby_presence(lat, lng);

-- Anti-spam : une seule demande par paire (nettoyée après réponse/timeout).
create table nearby_requests (
  from_user text not null references "user"(id) on delete cascade,
  to_user text not null references "user"(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (from_user, to_user)
);

alter table nearby_presence enable row level security;
alter table nearby_requests enable row level security;
create policy np_access on nearby_presence using (true);
create policy nr_access on nearby_requests using (current_setting('app.user_id', true) in (from_user, to_user));

grant select, insert, update, delete on nearby_presence to lingolink_app;
grant select, insert, delete on nearby_requests to lingolink_app;
