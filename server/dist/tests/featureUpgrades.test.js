import { describe, expect, it } from "vitest";
import { RoomManager } from "../src/core/roomManager.js";
describe("feature upgrades", () => {
    it("restores player seat on reconnect with same clientId", () => {
        const manager = new RoomManager();
        const host = manager.createRoom("socket-host-1", "房主", "client-host");
        manager.joinRoom("socket-a-1", host.roomCode, "玩家A", "client-a");
        manager.joinRoom("socket-b-1", host.roomCode, "玩家B", "client-b");
        manager.startGameBySocket("socket-host-1");
        const before = manager.getPublicState(host.roomCode);
        const aBefore = before.players.find((p) => p.nickname === "玩家A");
        expect(aBefore).toBeTruthy();
        manager.disconnectBySocket("socket-a-1");
        const afterDisconnect = manager.getPublicState(host.roomCode);
        expect(afterDisconnect.players.find((p) => p.nickname === "玩家A")?.connected).toBe(false);
        const afterReconnect = manager.joinRoom("socket-a-2", host.roomCode, "玩家A", "client-a");
        const aAfter = afterReconnect.players.find((p) => p.nickname === "玩家A");
        expect(aAfter?.id).toBe(aBefore?.id);
        expect(aAfter?.connected).toBe(true);
    });
    it("supports blank role when enabled", () => {
        const manager = new RoomManager();
        const host = manager.createRoom("host", "房主", "host-client");
        manager.joinRoom("p2", host.roomCode, "玩家A", "a-client");
        manager.joinRoom("p3", host.roomCode, "玩家B", "b-client");
        manager.joinRoom("p4", host.roomCode, "玩家C", "c-client");
        manager.joinRoom("p5", host.roomCode, "玩家D", "d-client");
        manager.updateRoomOptionsBySocket("host", true);
        manager.startGameBySocket("host");
        const room = manager.getPublicState(host.roomCode);
        const internal = manager.rooms.get(host.roomCode);
        const blankPlayers = internal.players.filter((p) => p.role === "blank");
        expect(room.options.blankRoleEnabled).toBe(true);
        expect(blankPlayers.length).toBe(1);
        expect(blankPlayers[0].word).toBeNull();
    });
    it("cleans up empty rooms after 10 minutes", () => {
        const manager = new RoomManager();
        const host = manager.createRoom("host", "房主", "host-client");
        manager.leaveBySocket("host");
        const rooms = manager.rooms;
        expect(rooms.has(host.roomCode)).toBe(true);
        manager.tickCleanupRooms(Date.now() + 10 * 60 * 1000 + 1000);
        expect(rooms.has(host.roomCode)).toBe(false);
    });
});
