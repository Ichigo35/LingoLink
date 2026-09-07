/**
 * Boîte de réception temps réel d'un utilisateur (un Durable Object par user).
 * Sert à pousser des évènements pendant que l'app est ouverte : invitations de
 * conversation depuis un contact (Phase 8) ou une personne à proximité (Phase 9).
 */
export class UserInbox {
  constructor(private ctx: DurableObjectState) {}

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);

    if (url.pathname === '/notify') {
      const body = await req.text();
      for (const s of this.ctx.getWebSockets()) {
        if (s.readyState !== 1) continue;
        try {
          s.send(body);
        } catch {
          /* socket mort */
        }
      }
      return new Response('ok');
    }

    if (req.headers.get('Upgrade') !== 'websocket') {
      return new Response('expected websocket', { status: 426 });
    }
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void {
    if (typeof message === 'string' && message.includes('"ping"')) {
      try {
        ws.send('{"type":"pong"}');
      } catch {
        /* ignore */
      }
    }
  }

  webSocketClose(ws: WebSocket): void {
    try {
      ws.close();
    } catch {
      /* déjà fermé */
    }
  }
}
