import { randomUUID } from "node:crypto";
import { endCurrentSpeakerTurn, nextPhase, startGame, submitStatement, submitVote } from "./gameEngine.js";
import { toPublicRoomState } from "./types.js";
const ROOM_CODE_LENGTH = 6;
const ROOM_CODE_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";
const MAX_PLAYERS = 8;
const MIN_START_PLAYERS = 3;
const EMPTY_ROOM_TTL_MS = 10 * 60 * 1000;
const AVATARS = ["🐼", "🦊", "🐯", "🐶", "🐱", "🐨", "🦁", "🐵", "🐰", "🐸", "🐻", "🦄"];
const createRoomCode = () => Array.from({ length: ROOM_CODE_LENGTH }, () => ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)]).join("");
const createDefaultStats = () => ({
    games: 0,
    wins: 0,
    score: 0,
    level: 1,
});
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
    createRoom(socketId, nickname, clientId = socketId) {
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
            options: {
                blankRoleEnabled: false,
            },
            players: [
                {
                    id: playerId,
                    socketId,
                    clientId,
                    nickname: name,
                    avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)],
                    connected: true,
                    joinedAt: Date.now(),
                    stats: createDefaultStats(),
                    alive: true,
                    role: null,
                    word: null,
                    rematchReady: false,
                },
            ],
            gameState: null,
            emptySince: null,
        };
        this.rooms.set(roomCode, room);
        this.socketToRoomCode.set(socketId, roomCode);
        this.socketToPlayerId.set(socketId, playerId);
        return toPublicRoomState(room);
    }
    joinRoom(socketId, roomCodeRaw, nickname, clientId = socketId) {
        const roomCode = roomCodeRaw.trim().toLowerCase();
        const name = nickname.trim();
        if (!name) {
            throw new Error("昵称不能为空");
        }
        const room = this.rooms.get(roomCode);
        if (!room) {
            throw new Error("房间不存在");
        }
        if (room.players.length === 0) {
            throw new Error("房间已关闭");
        }
        const existingByClient = room.players.find((player) => player.clientId === clientId);
        if (existingByClient) {
            existingByClient.socketId = socketId;
            existingByClient.connected = true;
            this.socketToRoomCode.set(socketId, roomCode);
            this.socketToPlayerId.set(socketId, existingByClient.id);
            room.emptySince = null;
            return toPublicRoomState(room);
        }
        if (room.status !== "waiting") {
            throw new Error("该房间正在游戏中，仅支持已在房内玩家重连");
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
            clientId,
            nickname: name,
            avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)],
            connected: true,
            joinedAt: Date.now(),
            stats: createDefaultStats(),
            alive: true,
            role: null,
            word: null,
            rematchReady: false,
        });
        room.emptySince = null;
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
        if (!player || !player.role) {
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
        if (room.gameState?.phase !== "result") {
            throw new Error("仅结果阶段可由房主推进");
        }
        nextPhase(room);
        return toPublicRoomState(room);
    }
    endTurnBySocket(socketId) {
        const room = this.getRoomBySocket(socketId);
        const playerId = this.socketToPlayerId.get(socketId);
        if (!playerId) {
            throw new Error("玩家不存在");
        }
        if (!room.gameState || room.gameState.phase !== "speak") {
            throw new Error("当前不是发言阶段");
        }
        if (room.gameState.turnPlayerId !== playerId) {
            throw new Error("仅当前发言玩家可结束发言");
        }
        const player = room.players.find((item) => item.id === playerId);
        if (!player || !player.alive) {
            throw new Error("仅存活玩家可结束发言");
        }
        endCurrentSpeakerTurn(room);
        return toPublicRoomState(room);
    }
    voteBySocket(socketId, targetPlayerId) {
        const room = this.getRoomBySocket(socketId);
        const voterId = this.socketToPlayerId.get(socketId);
        if (!voterId) {
            throw new Error("玩家不存在");
        }
        const result = submitVote(room, voterId, targetPlayerId);
        if (result.winner) {
            this.applyWinnerStats(room, result.winner);
        }
        return {
            state: toPublicRoomState(room),
            completed: result.completed,
            voteResult: result.voteResult,
            winner: result.winner,
        };
    }
    submitStatementBySocket(socketId, text) {
        const room = this.getRoomBySocket(socketId);
        const playerId = this.socketToPlayerId.get(socketId);
        if (!playerId) {
            throw new Error("玩家不存在");
        }
        submitStatement(room, playerId, text);
        return toPublicRoomState(room);
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
            room.emptySince = Date.now();
            return null;
        }
        if (!room.players.some((player) => player.id === room.hostId)) {
            room.hostId = room.players.sort((a, b) => a.joinedAt - b.joinedAt)[0].id;
        }
        if (room.status === "playing") {
            const aliveCount = room.players.filter((player) => player.alive).length;
            if (aliveCount < 3) {
                room.status = "ended";
                if (room.gameState) {
                    room.gameState.winner = "undercover";
                    room.gameState.phase = "result";
                    this.applyWinnerStats(room, "undercover");
                }
            }
        }
        return toPublicRoomState(room);
    }
    disconnectBySocket(socketId) {
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
        const player = room.players.find((item) => item.id === playerId);
        if (!player) {
            return null;
        }
        player.connected = false;
        if (room.hostId === playerId) {
            const replacement = room.players
                .filter((item) => item.connected && item.id !== playerId)
                .sort((a, b) => a.joinedAt - b.joinedAt)[0] ??
                room.players.filter((item) => item.id !== playerId).sort((a, b) => a.joinedAt - b.joinedAt)[0];
            if (replacement) {
                room.hostId = replacement.id;
            }
        }
        return toPublicRoomState(room);
    }
    setRematchReadyBySocket(socketId, ready) {
        const room = this.getRoomBySocket(socketId);
        if (room.status !== "ended") {
            throw new Error("仅在游戏结束后可设置再来一局状态");
        }
        const playerId = this.socketToPlayerId.get(socketId);
        if (!playerId) {
            throw new Error("玩家不存在");
        }
        const player = room.players.find((item) => item.id === playerId);
        if (!player) {
            throw new Error("玩家不存在");
        }
        player.rematchReady = ready;
        return toPublicRoomState(room);
    }
    startRematchBySocket(socketId) {
        const room = this.getRoomBySocket(socketId);
        const playerId = this.socketToPlayerId.get(socketId);
        if (!playerId || room.hostId !== playerId) {
            throw new Error("仅房主可以开始再来一局");
        }
        if (room.status !== "ended") {
            throw new Error("当前不可开启再来一局");
        }
        if (room.players.length < MIN_START_PLAYERS) {
            throw new Error(`至少需要 ${MIN_START_PLAYERS} 名玩家`);
        }
        if (!room.players.every((player) => player.rematchReady)) {
            throw new Error("请等待所有玩家准备完成");
        }
        startGame(room);
        return toPublicRoomState(room);
    }
    updateRoomOptionsBySocket(socketId, blankRoleEnabled) {
        const room = this.getRoomBySocket(socketId);
        const playerId = this.socketToPlayerId.get(socketId);
        if (!playerId || room.hostId !== playerId) {
            throw new Error("仅房主可以修改房间设置");
        }
        if (room.status !== "waiting") {
            throw new Error("仅等待阶段可修改房间设置");
        }
        room.options.blankRoleEnabled = blankRoleEnabled;
        return toPublicRoomState(room);
    }
    getSocketsInRoom(roomCode) {
        const room = this.rooms.get(roomCode);
        if (!room) {
            return [];
        }
        return room.players.filter((player) => player.connected).map((player) => player.socketId);
    }
    tickSpeakTimeouts(now = Date.now()) {
        const changedStates = [];
        for (const room of this.rooms.values()) {
            const game = room.gameState;
            if (room.status !== "playing" ||
                !game ||
                game.phase !== "speak" ||
                !game.turnPlayerId ||
                !game.speakDeadlineAt ||
                game.speakDeadlineAt > now) {
                continue;
            }
            endCurrentSpeakerTurn(room);
            changedStates.push(toPublicRoomState(room));
        }
        return changedStates;
    }
    tickCleanupRooms(now = Date.now()) {
        for (const room of this.rooms.values()) {
            if (room.players.length > 0) {
                room.emptySince = null;
                continue;
            }
            if (!room.emptySince) {
                room.emptySince = now;
                continue;
            }
            if (now - room.emptySince >= EMPTY_ROOM_TTL_MS) {
                this.rooms.delete(room.roomCode);
            }
        }
    }
    applyWinnerStats(room, winner) {
        const game = room.gameState;
        if (!game) {
            return;
        }
        room.players.forEach((player) => {
            const won = winner === "undercover"
                ? player.role === "undercover"
                : player.role === "civilian" || player.role === "blank";
            if (won) {
                player.stats.wins += 1;
            }
            player.stats.score += won ? 100 : 30;
            player.stats.level = Math.floor(player.stats.score / 300) + 1;
        });
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
