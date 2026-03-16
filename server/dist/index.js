import http from "node:http";
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
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
    },
});
const roomManager = new RoomManager();
const sendAckOk = (ack, data) => {
    ack({ ok: true, data });
};
const sendAckError = (ack, message) => {
    ack({ ok: false, error: message });
};
io.on("connection", (socket) => {
    socket.on("room:create", (payload, ack) => {
        try {
            const state = roomManager.createRoom(socket.id, payload.nickname);
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
            const state = roomManager.joinRoom(socket.id, payload.roomCode, payload.nickname);
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
    socket.on("disconnect", () => {
        const state = roomManager.leaveBySocket(socket.id);
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
});
