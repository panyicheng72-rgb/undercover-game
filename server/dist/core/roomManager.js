import { randomUUID } from "node:crypto";
import { nextPhase, startGame, submitVote } from "./gameEngine.js";
import { toPublicRoomState } from "./types.js";
const ROOM_CODE_LENGTH = 6;
const MAX_PLAYERS = 8;
const MIN_START_PLAYERS = 3;
const createRoomCode = () => Array.from({ length: ROOM_CODE_LENGTH }, () => Math.floor(Math.random() * 10)).join("");
export class RoomManager {
    rooms = new Map();
    socketToRoomCode = new Map();
    socketToPlayerId = new Map();
    createUniqueRoomCode() {
        for (let i = 0; i < 1000; i += 1) {
            const code = createRoomCode();
            if (!this.rooms.has(code)) {
                return code;
            }
        }
        throw new Error("创建房间过于频繁，请稍后再试");
    }
    createRoom(socketId, nickname) {
        const name = nickname.trim();
        if (!name) {
            throw new Error("昵称不能为空");
        }
        const roomCode = this.createUniqueRoomCode();
        const playerId = randomUUID();
        const room = {
            roomCode,
            hostId: playerId,
            status: "waiting",
            players: [
                {
                    id: playerId,
                    socketId,
                    nickname: name,
                    alive: true,
                    role: null,
                    word: null,
                },
            ],
            gameState: null,
        };
        this.rooms.set(roomCode, room);
        this.socketToRoomCode.set(socketId, roomCode);
        this.socketToPlayerId.set(socketId, playerId);
        return toPublicRoomState(room);
    }
    joinRoom(socketId, roomCodeRaw, nickname) {
        const roomCode = roomCodeRaw.trim();
        const name = nickname.trim();
        if (!name) {
            throw new Error("昵称不能为空");
        }
        const room = this.rooms.get(roomCode);
        if (!room) {
            throw new Error("房间不存在");
        }
        if (room.status !== "waiting") {
            throw new Error("该房间正在游戏中，暂不支持中途加入");
        }
        if (room.players.length >= MAX_PLAYERS) {
            throw new Error("房间已满");
        }
        if (room.players.some((player) => player.nickname === name)) {
            throw new Error("昵称已被占用");
        }
        const playerId = randomUUID();
        room.players.push({
            id: playerId,
            socketId,
            nickname: name,
            alive: true,
            role: null,
            word: null,
        });
        this.socketToRoomCode.set(socketId, roomCode);
        this.socketToPlayerId.set(socketId, playerId);
        return toPublicRoomState(room);
    }
    getRoomCodeBySocket(socketId) {
        return this.socketToRoomCode.get(socketId);
    }
    getPublicState(roomCode) {
        const room = this.rooms.get(roomCode);
        if (!room) {
            throw new Error("房间不存在");
        }
        return toPublicRoomState(room);
    }
    getPlayerSecret(socketId) {
        const room = this.getRoomBySocket(socketId);
        const playerId = this.socketToPlayerId.get(socketId);
        const player = room.players.find((item) => item.id === playerId);
        if (!player || !player.role || !player.word) {
            throw new Error("身份信息不可用");
        }
        return {
            role: player.role,
            word: player.word,
        };
    }
    startGameBySocket(socketId) {
        const room = this.getRoomBySocket(socketId);
        const playerId = this.socketToPlayerId.get(socketId);
        if (!playerId || room.hostId !== playerId) {
            throw new Error("仅房主可以开始游戏");
        }
        if (room.players.length < MIN_START_PLAYERS) {
            throw new Error(`至少需要 ${MIN_START_PLAYERS} 名玩家`);
        }
        if (room.status !== "waiting") {
            throw new Error("游戏已开始");
        }
        startGame(room);
        return toPublicRoomState(room);
    }
    nextPhaseBySocket(socketId) {
        const room = this.getRoomBySocket(socketId);
        const playerId = this.socketToPlayerId.get(socketId);
        if (!playerId || room.hostId !== playerId) {
            throw new Error("仅房主可以推进阶段");
        }
        nextPhase(room);
        return toPublicRoomState(room);
    }
    voteBySocket(socketId, targetPlayerId) {
        const room = this.getRoomBySocket(socketId);
        const voterId = this.socketToPlayerId.get(socketId);
        if (!voterId) {
            throw new Error("玩家不存在");
        }
        const result = submitVote(room, voterId, targetPlayerId);
        return {
            state: toPublicRoomState(room),
            completed: result.completed,
            voteResult: result.voteResult,
            winner: result.winner,
        };
    }
    leaveBySocket(socketId) {
        const roomCode = this.socketToRoomCode.get(socketId);
        const playerId = this.socketToPlayerId.get(socketId);
        this.socketToRoomCode.delete(socketId);
        this.socketToPlayerId.delete(socketId);
        if (!roomCode || !playerId) {
            return null;
        }
        const room = this.rooms.get(roomCode);
        if (!room) {
            return null;
        }
        room.players = room.players.filter((player) => player.id !== playerId);
        if (room.players.length === 0) {
            this.rooms.delete(roomCode);
            return null;
        }
        if (!room.players.some((player) => player.id === room.hostId)) {
            room.hostId = room.players[0].id;
        }
        if (room.status === "playing") {
            const aliveCount = room.players.filter((player) => player.alive).length;
            if (aliveCount < 3) {
                room.status = "ended";
                if (room.gameState) {
                    room.gameState.winner = "undercover";
                    room.gameState.phase = "result";
                }
            }
        }
        return toPublicRoomState(room);
    }
    getSocketsInRoom(roomCode) {
        const room = this.rooms.get(roomCode);
        if (!room) {
            return [];
        }
        return room.players.map((player) => player.socketId);
    }
    getRoomBySocket(socketId) {
        const roomCode = this.socketToRoomCode.get(socketId);
        if (!roomCode) {
            throw new Error("你还未加入房间");
        }
        const room = this.rooms.get(roomCode);
        if (!room) {
            throw new Error("房间不存在");
        }
        return room;
    }
}
