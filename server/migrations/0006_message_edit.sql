-- Itér. 15 — édition + suppression de message en cours de conversation (§9).
-- `edited` : true dès qu'un message (retranscrit ou écrit) a été corrigé après
-- envoi ; affiché côté client comme repère de transparence pour le destinataire.
-- La suppression retire directement la ligne (pas de soft-delete) : cohérent
-- avec le reste du modèle (rétention = DELETE, cf. server/src/retention.ts).

alter table conversation_messages add column edited boolean not null default false;

grant delete on conversation_messages to lingolink_app;
