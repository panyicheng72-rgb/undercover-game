import http from "node:http";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import { Server } from "socket.io";
import { RoomManager } from "./core/roomManager.js";
const app = express();
app.use(cors());
app.use(express.json());
app.get("/health", (_req, res) => {
    res.json({ ok: true });
});
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const candidateDistPaths = [
    process.env.FRONTEND_DIST_PATH,
    path.join(__dirname, "../../frontend/dist"),
    path.join(process.cwd(), "frontend/dist"),
    path.join(process.cwd(), "../frontend/dist"),
].filter((value) => Boolean(value));
const distPath = candidateDistPaths.find((candidate) => existsSync(path.join(candidate, "index.html"))) ?? null;
if (distPath) {
    app.use(express.static(distPath));
    app.get("/{*path}", (req, res, next) => {
        if (req.path.startsWith("/socket.io")) {
            next();
            return;
        }
        res.sendFile(path.join(distPath, "index.html"));
    });
}
else {
    app.get("/", (_req, res) => {
        res.status(503).send("Frontend dist not found. Please build frontend and redeploy.");
    });
}
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
    },
});
const roomManager = new RoomManager();
setInterval(() => {
    const changedStates = roomManager.tickSpeakTimeouts();
    changedStates.forEach((state) => {
        io.to(state.roomCode).emit("room:state", state);
        io.to(state.roomCode).emit("game:phaseChanged", state);
    });
    roomManager.tickCleanupRooms();
}, 500);
const sendAckOk = (ack, data) => {
    ack({ ok: true, data });
};
const sendAckError = (ack, message) => {
    ack({ ok: false, error: message });
};
io.on("connection", (socket) => {
    socket.on("room:create", (payload, ack) => {
        try {
            const state = roomManager.createRoom(socket.id, payload.nickname, payload.clientId);
            socket.join(state.roomCode);
            io.to(state.roomCode).emit("room:state", state);
            sendAckOk(ack, { roomCode: state.roomCode });
        }
        catch (error) {
            sendAckError(ack, error.message);
        }
    });
    socket.on("room:join", (payload, ack) => {
        try {
            const state = roomManager.joinRoom(socket.id, payload.roomCode, payload.nickname, payload.clientId);
            socket.join(state.roomCode);
            io.to(state.roomCode).emit("room:state", state);
            sendAckOk(ack, state);
        }
        catch (error) {
            sendAckError(ack, error.message);
        }
    });
    socket.on("room:start", (_payload, ack) => {
        try {
            const state = roomManager.startGameBySocket(socket.id);
            io.to(state.roomCode).emit("room:state", state);
            roomManager.getSocketsInRoom(state.roomCode).forEach((socketId) => {
                const secret = roomManager.getPlayerSecret(socketId);
                io.to(socketId).emit("game:started", { state, self: secret });
            });
            sendAckOk(ack, undefined);
        }
        catch (error) {
            sendAckError(ack, error.message);
        }
    });
    socket.on("room:leave", (_payload, ack) => {
        try {
            const state = roomManager.leaveBySocket(socket.id);
            if (state) {
                io.to(state.roomCode).emit("room:state", state);
            }
            sendAckOk(ack, undefined);
        }
        catch (error) {
            sendAckError(ack, error.message);
        }
    });
    socket.on("room:updateOptions", (payload, ack) => {
        try {
            const state = roomManager.updateRoomOptionsBySocket(socket.id, payload.blankRoleEnabled);
            io.to(state.roomCode).emit("room:state", state);
            sendAckOk(ack, undefined);
        }
        catch (error) {
            sendAckError(ack, error.message);
        }
    });
    socket.on("game:submitVote", (payload, ack) => {
        try {
            const result = roomManager.voteBySocket(socket.id, payload.targetPlayerId);
            io.to(result.state.roomCode).emit("room:state", result.state);
            if (result.completed && result.voteResult) {
                io.to(result.state.roomCode).emit("game:voteResult", result.voteResult);
                io.to(result.state.roomCode).emit("game:phaseChanged", result.state);
            }
            if (result.winner) {
                io.to(result.state.roomCode).emit("game:ended", { winner: result.winner });
            }
            sendAckOk(ack, undefined);
        }
        catch (error) {
            sendAckError(ack, error.message);
        }
    });
    socket.on("game:nextPhase", (_payload, ack) => {
        try {
            const state = roomManager.nextPhaseBySocket(socket.id);
            io.to(state.roomCode).emit("room:state", state);
            io.to(state.roomCode).emit("game:phaseChanged", state);
            sendAckOk(ack, undefined);
        }
        catch (error) {
            sendAckError(ack, error.message);
        }
    });
    socket.on("game:endTurn", (_payload, ack) => {
        try {
            const state = roomManager.endTurnBySocket(socket.id);
            io.to(state.roomCode).emit("room:state", state);
            io.to(state.roomCode).emit("game:phaseChanged", state);
            sendAckOk(ack, undefined);
        }
        catch (error) {
            sendAckError(ack, error.message);
        }
    });
    socket.on("game:submitStatement", (payload, ack) => {
        try {
            const state = roomManager.submitStatementBySocket(socket.id, payload.text);
            io.to(state.roomCode).emit("room:state", state);
            sendAckOk(ack, undefined);
        }
        catch (error) {
            sendAckError(ack, error.message);
        }
    });
    socket.on("room:setRematchReady", (payload, ack) => {
        try {
            const state = roomManager.setRematchReadyBySocket(socket.id, payload.ready);
            io.to(state.roomCode).emit("room:state", state);
            sendAckOk(ack, undefined);
        }
        catch (error) {
            sendAckError(ack, error.message);
        }
    });
    socket.on("room:startRematch", (_payload, ack) => {
        try {
            const state = roomManager.startRematchBySocket(socket.id);
            io.to(state.roomCode).emit("room:state", state);
            roomManager.getSocketsInRoom(state.roomCode).forEach((socketId) => {
                const secret = roomManager.getPlayerSecret(socketId);
                io.to(socketId).emit("game:started", { state, self: secret });
            });
            sendAckOk(ack, undefined);
        }
        catch (error) {
            sendAckError(ack, error.message);
        }
    });
    socket.on("disconnect", () => {
        const state = roomManager.disconnectBySocket(socket.id);
        if (state) {
            io.to(state.roomCode).emit("room:state", state);
            if (state.gameState?.winner) {
                io.to(state.roomCode).emit("game:ended", { winner: state.gameState.winner });
            }
        }
    });
});
const PORT = Number(process.env.PORT ?? 4000);
server.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Server listening on ${PORT}`);
    // eslint-disable-next-line no-console
    console.log(`Frontend dist path: ${distPath ?? "NOT FOUND"}`);
});
