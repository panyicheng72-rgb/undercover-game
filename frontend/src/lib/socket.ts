import { io, type Socket } from "socket.io-client";
import type {
  AckResponse,
  ClientToServerEvents,
  CreateRoomOutput,
  RoomPublicState,
  ServerToClientEvents,
} from "@undercover/shared";

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? "http://localhost:4000";
const CLIENT_ID_KEY = "undercover:clientId";

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

export const getClientId = (): string => {
  const existing = localStorage.getItem(CLIENT_ID_KEY);
  if (existing) {
    return existing;
  }
  const next = (crypto.randomUUID?.() ?? `guest-${Math.random().toString(36).slice(2, 10)}`).toLowerCase();
  localStorage.setItem(CLIENT_ID_KEY, next);
  return next;
};

export const getSocket = (): Socket<ServerToClientEvents, ClientToServerEvents> => {
  if (!socket) {
    socket = io(SERVER_URL, {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      transports: ["websocket", "polling"],
    });
  }
  return socket;
};

export const connectSocket = (): void => {
  const client = getSocket();
  if (!client.connected) {
    client.connect();
  }
};

const normalizeAck = <T>(response: AckResponse<T>, resolve: (data: T) => void, reject: (reason?: unknown) => void) => {
  if (response.ok) {
    resolve(response.data);
    return;
  }
  reject(new Error(response.error));
};

export const createRoom = (nickname: string): Promise<CreateRoomOutput> =>
  new Promise((resolve, reject) => {
    getSocket().emit("room:create", { nickname, clientId: getClientId() }, (response) =>
      normalizeAck(response, resolve, reject)
    );
  });

export const joinRoom = (roomCode: string, nickname: string): Promise<RoomPublicState> =>
  new Promise((resolve, reject) => {
    getSocket().emit("room:join", { roomCode, nickname, clientId: getClientId() }, (response) =>
      normalizeAck(response, resolve, reject)
    );
  });

export const startRoomGame = (roomCode: string): Promise<void> =>
  new Promise((resolve, reject) => {
    getSocket().emit("room:start", { roomCode }, (response) =>
      normalizeAck(response, () => resolve(), reject)
    );
  });

export const submitVote = (roomCode: string, targetPlayerId: string): Promise<void> =>
  new Promise((resolve, reject) => {
    getSocket().emit("game:submitVote", { roomCode, targetPlayerId }, (response) =>
      normalizeAck(response, () => resolve(), reject)
    );
  });

export const nextPhase = (roomCode: string): Promise<void> =>
  new Promise((resolve, reject) => {
    getSocket().emit("game:nextPhase", { roomCode }, (response) =>
      normalizeAck(response, () => resolve(), reject)
    );
  });

export const endTurn = (roomCode: string): Promise<void> =>
  new Promise((resolve, reject) => {
    getSocket().emit("game:endTurn", { roomCode }, (response) =>
      normalizeAck(response, () => resolve(), reject)
    );
  });

export const submitStatement = (roomCode: string, text: string): Promise<void> =>
  new Promise((resolve, reject) => {
    getSocket().emit("game:submitStatement", { roomCode, text }, (response) =>
      normalizeAck(response, () => resolve(), reject)
    );
  });

export const setRematchReady = (roomCode: string, ready: boolean): Promise<void> =>
  new Promise((resolve, reject) => {
    getSocket().emit("room:setRematchReady", { roomCode, ready }, (response) =>
      normalizeAck(response, () => resolve(), reject)
    );
  });

export const leaveRoom = (roomCode: string): Promise<void> =>
  new Promise((resolve, reject) => {
    getSocket().emit("room:leave", { roomCode }, (response) => normalizeAck(response, () => resolve(), reject));
  });

export const updateRoomOptions = (roomCode: string, blankRoleEnabled: boolean): Promise<void> =>
  new Promise((resolve, reject) => {
    getSocket().emit("room:updateOptions", { roomCode, blankRoleEnabled }, (response) =>
      normalizeAck(response, () => resolve(), reject)
    );
  });

export const startRematch = (roomCode: string): Promise<void> =>
  new Promise((resolve, reject) => {
    getSocket().emit("room:startRematch", { roomCode }, (response) =>
      normalizeAck(response, () => resolve(), reject)
    );
  });
