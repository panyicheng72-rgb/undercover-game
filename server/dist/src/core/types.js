export const toPublicPlayer = (player, hostId) => ({
    id: player.id,
    nickname: player.nickname,
    avatar: player.avatar,
    connected: player.connected,
    alive: player.alive,
    isHost: player.id === hostId,
    rematchReady: player.rematchReady,
    stats: player.stats,
});
export const toPublicGameState = (gameState, aliveCount) => ({
    round: gameState.round,
    phase: gameState.phase,
    turnPlayerId: gameState.turnPlayerId,
    speakDeadlineAt: gameState.speakDeadlineAt,
    speakingHistory: gameState.speakingHistory,
    votedCount: Object.keys(gameState.votes).length,
    totalAlive: aliveCount,
    lastEliminatedPlayerId: gameState.lastEliminatedPlayerId,
    winner: gameState.winner,
});
export const toPublicRoomState = (room) => ({
    roomCode: room.roomCode,
    status: room.status,
    hostId: room.hostId,
    players: room.players.map((player) => toPublicPlayer(player, room.hostId)),
    canStartRematch: room.status === "ended" &&
        room.players.length >= 3 &&
        room.players.every((player) => player.rematchReady),
    gameState: room.gameState
        ? toPublicGameState(room.gameState, room.players.filter((player) => player.alive).length)
        : null,
    options: room.options,
});
