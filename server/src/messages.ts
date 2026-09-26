import { Hono } from 'hono';

import { MAX_AUDIO_B64_LENGTH, aiErrorInfo, aiErrorResponse, getTranslationProvider } from './ai';
import type { AppEnv } from './context';
import type { Database } from './db';
import { isLanguageCode } from './languages';
import { enforceRateLimit } from './rate-limit';
import { notifyRoom } from './realtime';

type MessageRow = Database['conversation_messages'];

/** Limite de longueur d'un message écrit (envoi texte ou édition). */
export const MAX_MESSAGE_TEXT_LENGTH = 2000;

function toDto(row: MessageRow) {
  return {
    id: row.id,
    sessionId: row.session_id,
    senderId: row.sender_id,
    sourceLanguage: row.source_language,
    targetLanguage: row.target_language,
    originalTranscript: row.original_transcript,
    translatedText: row.translated_text,
    status: row.status,
    clientId: row.client_id,
    edited: row.edited,
    createdAt: (row.created_at instanceof Date ? row.created_at : new Date(row.created_at)).toISOString(),
  };
}

export function registerMessageRoutes(app: Hono<AppEnv>) {
  // Historique récent (snapshot à l'ouverture de l'écran).
  app.get('/api/sessions/:id/messages', async (c) => {
    const session = await c.get('auth').api.getSession({ headers: c.req.raw.headers });
    if (!session?.user) return c.json({ code: 'unauthenticated', message: 'Connexion requise' }, 401);
    const id = c.req.param('id');
    if (!id) return c.json({ code: 'not_found', message: 'Session introuvable' }, 404);

    const db = c.get('db');
    const row = await db
      .selectFrom('conversation_sessions')
      .select(['creator_id', 'participant_id'])
      .where('id', '=', id)
      .executeTakeFirst();
    if (!row || (row.creator_id !== session.user.id && row.participant_id !== session.user.id)) {
      return c.json({ code: 'not_found', message: 'Session introuvable' }, 404);
    }

    const messages = await db
      .selectFrom('conversation_messages')
      .selectAll()
      .where('session_id', '=', id)
      .orderBy('created_at', 'asc')
      .limit(200)
      .execute();
    return c.json({ messages: messages.map((m) => toDto(m as MessageRow)) });
  });

  // Nouveau message : vocal (transcription + traduction streamées) ou texte
  // (traduction directe, sans passage par Gemini audio).
  app.post('/api/sessions/:id/messages', async (c) => {
    const id = c.req.param('id');
    if (!id) return c.json({ code: 'not_found', message: 'Session introuvable' }, 404);

    const provider = getTranslationProvider(c.env);
    if (!provider) return c.json({ code: 'ai_disabled', message: 'Service IA non configuré' }, 503);

    const db = c.get('db');
    // Auth + lecture de session en parallèle (chemin critique de latence).
    const [session, sessionRow] = await Promise.all([
      c.get('auth').api.getSession({ headers: c.req.raw.headers }),
      db
        .selectFrom('conversation_sessions')
        .select(['creator_id', 'participant_id', 'creator_language', 'participant_language', 'status'])
        .where('id', '=', id)
        .executeTakeFirst(),
    ]);
    if (!session?.user) return c.json({ code: 'unauthenticated', message: 'Connexion requise' }, 401);
    const userId = session.user.id;
    if (
      !sessionRow ||
      (sessionRow.creator_id !== userId && sessionRow.participant_id !== userId)
    ) {
      return c.json({ code: 'not_found', message: 'Session introuvable' }, 404);
    }
    if (sessionRow.status !== 'active') {
      return c.json({ code: 'session_not_active', message: 'La conversation n’est pas active' }, 409);
    }

    const limited = await enforceRateLimit(c, c.env.MSG_RATE_LIMITER, `msg:${userId}`);
    if (limited) return limited;

    const body = await c.req.json().catch(() => ({}));
    const { audioBase64, mimeType, clientId, text } = body ?? {};
    const hasAudio = typeof audioBase64 === 'string' && audioBase64.length > 0;
    const writtenText = typeof text === 'string' ? text.trim() : '';
    const hasText = writtenText.length > 0;
    if (!hasAudio && !hasText) {
      return c.json({ code: 'missing_content', message: 'Message vide' }, 400);
    }
    if (hasAudio && audioBase64.length > MAX_AUDIO_B64_LENGTH) {
      return c.json({ code: 'audio_too_large', message: 'Segment audio trop long' }, 413);
    }
    if (hasText && writtenText.length > MAX_MESSAGE_TEXT_LENGTH) {
      return c.json({ code: 'text_too_long', message: 'Message trop long' }, 413);
    }

    const isCreator = sessionRow.creator_id === userId;
    const sourceLanguage = isCreator ? sessionRow.creator_language : sessionRow.participant_language;
    const targetLanguage = isCreator ? sessionRow.participant_language : sessionRow.creator_language;
    if (!isLanguageCode(sourceLanguage) || !isLanguageCode(targetLanguage)) {
      return c.json({ code: 'invalid_language', message: 'Langues invalides' }, 400);
    }

    const messageId = crypto.randomUUID();
    const now = new Date();
    let row: MessageRow = {
      id: messageId,
      session_id: id,
      sender_id: userId,
      source_language: sourceLanguage,
      target_language: targetLanguage,
      original_transcript: hasText ? writtenText : '',
      translated_text: '',
      status: 'processing',
      client_id: typeof clientId === 'string' ? clientId.slice(0, 64) : null,
      edited: false,
      created_at: now,
      updated_at: now,
    };

    // Insert + diffusion "processing" sans bloquer le démarrage de Gemini
    // (chemin critique de latence).
    const insertPromise = db.insertInto('conversation_messages').values(row).execute();
    void notifyRoom(c.env, id, { type: 'message', message: toDto(row) });

    try {
      if (hasText) {
        // Message écrit : une traduction directe, pas de streaming.
        const result = await provider.translateText({ text: writtenText, sourceLanguage, targetLanguage });
        await insertPromise;
        row = { ...row, translated_text: result.translation, status: 'completed', updated_at: new Date() };
        const updated = await db
          .updateTable('conversation_messages')
          .set({ translated_text: row.translated_text, status: row.status, updated_at: row.updated_at })
          .where('id', '=', messageId)
          .returning('id')
          .executeTakeFirst();
        // Le message a pu être supprimé pendant la traduction : ne pas le ressusciter.
        if (updated) await notifyRoom(c.env, id, { type: 'message_update', message: toDto(row) });
        return c.json({ message: toDto(row) });
      }

      let lastBroadcast = 0;
      const result = await provider.streamInterpretation(
        {
          audioBase64,
          mimeType: typeof mimeType === 'string' && mimeType ? mimeType : 'audio/mp4',
          sourceLanguage,
          targetLanguage,
        },
        (partial) => {
          row = {
            ...row,
            original_transcript: partial.transcript,
            translated_text: partial.translation,
            status: 'partial',
          };
          const t = Date.now();
          if (t - lastBroadcast > 80) {
            lastBroadcast = t;
            void notifyRoom(c.env, id, { type: 'message_update', message: toDto(row) });
          }
        },
      );

      await insertPromise;
      const empty = !result.transcript.trim();
      row = {
        ...row,
        original_transcript: result.transcript,
        translated_text: result.translation,
        status: empty ? 'failed' : 'completed',
        updated_at: new Date(),
      };
      const updated = await db
        .updateTable('conversation_messages')
        .set({
          original_transcript: row.original_transcript,
          translated_text: row.translated_text,
          status: row.status,
          updated_at: row.updated_at,
        })
        .where('id', '=', messageId)
        .returning('id')
        .executeTakeFirst();
      if (updated) await notifyRoom(c.env, id, { type: 'message_update', message: toDto(row) });
      return c.json({ message: toDto(row) });
    } catch (err) {
      await insertPromise.catch(() => {});
      row = { ...row, status: 'failed', updated_at: new Date() };
      const updated = await db
        .updateTable('conversation_messages')
        .set({ status: 'failed', updated_at: row.updated_at })
        .where('id', '=', messageId)
        .returning('id')
        .executeTakeFirst();
      const info = aiErrorInfo(err);
      if (updated) {
        await notifyRoom(c.env, id, {
          type: 'message_update',
          message: { ...toDto(row), error: info.message, errorCode: info.code },
        });
      }
      return aiErrorResponse(c, err);
    }
  });

  // Édition d'un message déjà envoyé (transcription vocale ou texte écrit) :
  // seul l'émetteur peut corriger SON message, qui est retraduit (langues
  // figées à l'envoi, cf. §7 changement de langue en cours de conversation).
  app.patch('/api/sessions/:id/messages/:messageId', async (c) => {
    const id = c.req.param('id');
    const messageId = c.req.param('messageId');
    if (!id || !messageId) return c.json({ code: 'not_found', message: 'Message introuvable' }, 404);

    const provider = getTranslationProvider(c.env);
    if (!provider) return c.json({ code: 'ai_disabled', message: 'Service IA non configuré' }, 503);

    const session = await c.get('auth').api.getSession({ headers: c.req.raw.headers });
    if (!session?.user) return c.json({ code: 'unauthenticated', message: 'Connexion requise' }, 401);
    const userId = session.user.id;

    const db = c.get('db');
    const [sessionRow, messageRow] = await Promise.all([
      db
        .selectFrom('conversation_sessions')
        .select(['creator_id', 'participant_id', 'status'])
        .where('id', '=', id)
        .executeTakeFirst(),
      db
        .selectFrom('conversation_messages')
        .selectAll()
        .where('id', '=', messageId)
        .where('session_id', '=', id)
        .executeTakeFirst(),
    ]);
    if (!sessionRow || (sessionRow.creator_id !== userId && sessionRow.participant_id !== userId)) {
      return c.json({ code: 'not_found', message: 'Session introuvable' }, 404);
    }
    if (!messageRow) return c.json({ code: 'not_found', message: 'Message introuvable' }, 404);
    if (messageRow.sender_id !== userId) {
      return c.json({ code: 'forbidden', message: 'Vous ne pouvez modifier que vos propres messages' }, 403);
    }
    if (sessionRow.status !== 'active') {
      return c.json({ code: 'session_not_active', message: 'La conversation n’est pas active' }, 409);
    }
    if (messageRow.status === 'processing' || messageRow.status === 'partial') {
      return c.json({ code: 'message_busy', message: 'Message en cours de traitement' }, 409);
    }
    if (!isLanguageCode(messageRow.source_language) || !isLanguageCode(messageRow.target_language)) {
      return c.json({ code: 'invalid_language', message: 'Langues invalides' }, 400);
    }

    const limited = await enforceRateLimit(c, c.env.MSG_RATE_LIMITER, `msg:${userId}`);
    if (limited) return limited;

    const body = await c.req.json().catch(() => ({}));
    const { text } = body ?? {};
    if (typeof text !== 'string' || !text.trim()) {
      return c.json({ code: 'missing_text', message: 'Texte manquant' }, 400);
    }
    const trimmed = text.trim();
    if (trimmed.length > MAX_MESSAGE_TEXT_LENGTH) {
      return c.json({ code: 'text_too_long', message: 'Message trop long' }, 413);
    }

    try {
      const result = await provider.translateText({
        text: trimmed,
        sourceLanguage: messageRow.source_language,
        targetLanguage: messageRow.target_language,
      });
      const row: MessageRow = {
        ...messageRow,
        original_transcript: trimmed,
        translated_text: result.translation,
        status: 'completed',
        edited: true,
        updated_at: new Date(),
      };
      const updated = await db
        .updateTable('conversation_messages')
        .set({
          original_transcript: row.original_transcript,
          translated_text: row.translated_text,
          status: row.status,
          edited: true,
          updated_at: row.updated_at,
        })
        .where('id', '=', messageId)
        .returning('id')
        .executeTakeFirst();
      if (!updated) return c.json({ code: 'not_found', message: 'Message introuvable' }, 404);
      await notifyRoom(c.env, id, { type: 'message_update', message: toDto(row) });
      return c.json({ message: toDto(row) });
    } catch (err) {
      return aiErrorResponse(c, err);
    }
  });

  // Suppression d'un message par son émetteur — retire la ligne et diffuse
  // l'évènement pour que la bulle disparaisse chez les deux participants.
  app.delete('/api/sessions/:id/messages/:messageId', async (c) => {
    const id = c.req.param('id');
    const messageId = c.req.param('messageId');
    if (!id || !messageId) return c.json({ code: 'not_found', message: 'Message introuvable' }, 404);

    const session = await c.get('auth').api.getSession({ headers: c.req.raw.headers });
    if (!session?.user) return c.json({ code: 'unauthenticated', message: 'Connexion requise' }, 401);
    const userId = session.user.id;

    const db = c.get('db');
    const [sessionRow, messageRow] = await Promise.all([
      db
        .selectFrom('conversation_sessions')
        .select(['creator_id', 'participant_id', 'status'])
        .where('id', '=', id)
        .executeTakeFirst(),
      db
        .selectFrom('conversation_messages')
        .select(['sender_id'])
        .where('id', '=', messageId)
        .where('session_id', '=', id)
        .executeTakeFirst(),
    ]);
    if (!sessionRow || (sessionRow.creator_id !== userId && sessionRow.participant_id !== userId)) {
      return c.json({ code: 'not_found', message: 'Session introuvable' }, 404);
    }
    if (!messageRow) return c.json({ code: 'not_found', message: 'Message introuvable' }, 404);
    if (messageRow.sender_id !== userId) {
      return c.json({ code: 'forbidden', message: 'Vous ne pouvez supprimer que vos propres messages' }, 403);
    }
    if (sessionRow.status !== 'active') {
      return c.json({ code: 'session_not_active', message: 'La conversation n’est pas active' }, 409);
    }

    const limited = await enforceRateLimit(c, c.env.MSG_RATE_LIMITER, `msg:${userId}`);
    if (limited) return limited;

    await db.deleteFrom('conversation_messages').where('id', '=', messageId).execute();
    await notifyRoom(c.env, id, { type: 'message_deleted', messageId });
    return c.json({ ok: true });
  });
}
