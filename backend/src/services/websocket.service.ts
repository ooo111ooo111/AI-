import http from 'http';
import crypto from 'crypto';
import { parse } from 'url';
import { Socket } from 'net';
import { verifyAccessToken } from '../utils/jwt.util';

interface WebSocketClient {
  socket: Socket;
  userId: string;
}

const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

const parseCookies = (header?: string) => {
  if (!header) return {} as Record<string, string>;
  return header.split(';').reduce((acc, pair) => {
    const [key, ...rest] = pair.trim().split('=');
    if (!key) return acc;
    acc[key] = decodeURIComponent(rest.join('=') || '');
    return acc;
  }, {} as Record<string, string>);
};

const encodeFrame = (message: string) => {
  const payload = Buffer.from(message);
  const length = payload.length;

  if (length < 126) {
    const frame = Buffer.alloc(2 + length);
    frame[0] = 0b10000001;
    frame[1] = length;
    payload.copy(frame, 2);
    return frame;
  }

  if (length < 65536) {
    const frame = Buffer.alloc(4 + length);
    frame[0] = 0b10000001;
    frame[1] = 126;
    frame.writeUInt16BE(length, 2);
    payload.copy(frame, 4);
    return frame;
  }

  const frame = Buffer.alloc(10 + length);
  frame[0] = 0b10000001;
  frame[1] = 127;
  frame.writeBigUInt64BE(BigInt(length), 2);
  payload.copy(frame, 10);
  return frame;
};

class WebSocketHub {
  private clients = new Map<string, Set<WebSocketClient>>();

  attach(server: http.Server) {
    server.on('upgrade', (req, socket: Socket) => {
      const { pathname, query } = parse(req.url || '', true);
      if (pathname !== '/ws/quant') {
        socket.destroy();
        return;
      }

      const cookies = parseCookies(req.headers.cookie);
      const token = (query?.token as string) || cookies.access_token || '';
      const payload = verifyAccessToken(token);
      if (!payload) {
        socket.destroy();
        return;
      }

      const key = req.headers['sec-websocket-key'];
      if (!key || Array.isArray(key)) {
        socket.destroy();
        return;
      }

      const acceptKey = crypto.createHash('sha1').update(key + WS_GUID).digest('base64');
      const headers = [
        'HTTP/1.1 101 Switching Protocols',
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Accept: ${acceptKey}`,
        '\r\n',
      ];
      socket.write(headers.join('\r\n'));

      const client: WebSocketClient = { socket, userId: payload.userId };
      if (!this.clients.has(payload.userId)) {
        this.clients.set(payload.userId, new Set());
      }
      this.clients.get(payload.userId)!.add(client);

      socket.on('close', () => {
        this.clients.get(payload.userId)?.delete(client);
      });

      socket.on('error', () => {
        this.clients.get(payload.userId)?.delete(client);
      });
    });
  }

  sendToUser(userId: string, payload: any) {
    const clients = this.clients.get(userId);
    if (!clients || !clients.size) {
      return;
    }
    const frame = encodeFrame(JSON.stringify(payload));
    clients.forEach((client) => {
      client.socket.write(frame);
    });
  }
}

export const websocketHub = new WebSocketHub();
