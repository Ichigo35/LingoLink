import type { Env } from './env';

interface SocketMeta {
  uid: string;
  role: 'creator' | 'participant';
}

/**
 * Une instance par session de conversation. Relaie en temps réel :
 * - la présence (qui est connecté),
 * - le statut de session (poussé par le Worker via /notify),
 * - les messages de transcription/traduction entre les deux téléphones (Phase 6).
 *
 * Utilise l'API WebSocket Hibernation (pas de coût quand tout le monde est
 * silencieux).
 */
export class SessionRoom {
  constructor(
    private ctx: DurableObjectState,
    private env: Env,
  ) {}

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);

    // Diffusion d'un évènement poussé par le Worker (statut de session, etc.).
    if (url.pathname === '/notify') {
      const body = await req.text();
      this.broadcast(body);
      return new Response('ok');
    }

    // Upgrade WebSocket.
    if (req.headers.get('Upgrade') !== 'websocket') {
      return new Response('expected websocket', { status: 426 });
    }
    const uid = url.searchParams.get('uid');
    const role = url.searchParams.get('role') as SocketMeta['role'] | null;
    if (!uid || (role !== 'creator' && role !== 'participant')) {
      return new Response('missing identity', { status: 400 });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ uid, role } satisfies SocketMeta);

    // Snapshot de présence immédiat pour le nouvel arrivant + diffusion aux autres.
    this.broadcastPresence();

    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void {
    if (typeof message !== 'string') return;
    let parsed: { type?: string };
    try {
      parsed = JSON.parse(message);
    } catch {
      return;
    }
    switch (parsed.type) {
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong' }));
        return;
      case 'message':
      case 'message_update':
        // Relais vers l'autre téléphone.
        this.broadcast(message, ws);
        return;
      default:
        return;
    }
  }

  webSocketClose(ws: WebSocket): void {
    try {
      ws.close();
    } catch {
      /* déjà fermé */
    }
    this.broadcastPresence(ws);
  }

  webSocketError(ws: WebSocket): void {
    this.broadcastPresence(ws);
  }

  /** Sockets encore ouverts (exclut le socket en cours de fermeture). */
  private liveSockets(exclude?: WebSocket): WebSocket[] {
    // readyState 1 = OPEN
    return this.ctx.getWebSockets().filter((s) => s !== exclude && s.readyState === 1);
  }

  private broadcast(data: string, except?: WebSocket): void {
    for (const s of this.liveSockets()) {
      if (s === except) continue;
      try {
        s.send(data);
      } catch {
        /* socket mort, ignoré */
      }
    }
  }

  private broadcastPresence(closing?: WebSocket): void {
    const seen = new Map<string, { id: string; role: string; online: boolean }>();
    const live = this.liveSockets(closing);
    for (const s of live) {
      const meta = s.deserializeAttachment() as SocketMeta | null;
      if (meta) seen.set(meta.uid, { id: meta.uid, role: meta.role, online: true });
    }
    const payload = JSON.stringify({ type: 'presence', participants: [...seen.values()] });
    for (const s of live) {
      try {
        s.send(payload);
      } catch {
        /* ignoré */
      }
    }
  }
}
