import { io, Socket } from 'socket.io-client';
import { SOCKET_URL } from './env';

let socket: Socket | null = null;
let currentToken: string | null = null;

/**
 * Single shared socket for the whole app — mirrors the web client. Every
 * feature (chat, calls, scribble, watch, games, soundboard) attaches its own
 * listeners via `socket.on(...)` and cleans up with `socket.off(event, fn)`.
 * Never call `removeAllListeners()` outside disconnect — it clobbers others.
 */
export function connectSocket(token: string): Socket {
  if (socket && currentToken === token) return socket;
  if (socket && currentToken !== token) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 20,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });
  currentToken = token;
  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
    currentToken = null;
  }
}
