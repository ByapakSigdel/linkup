'use client';

import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:4000';

let socket: Socket | null = null;
let currentToken: string | null = null;

/**
 * Single shared socket for the whole app. Every feature (chat, calls, scribble,
 * paint, watch party, music) attaches its own listeners to this one connection
 * with `socket.on(...)` and cleans up with `socket.off(event, handler)`.
 * Never call `removeAllListeners()` — that would clobber other features.
 */
export function connectSocket(token: string): Socket {
  if (socket && currentToken === token) {
    return socket;
  }
  if (socket && currentToken !== token) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
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
