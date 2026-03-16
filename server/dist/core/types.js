export const toPublicPlayer = (player, hostId) => ({
    id: player.id,
    nickname: player.nickname,
    alive: player.alive,
    isHost: player.id === hostId,
});
export const toPublicGameState = (gameState, aliveCount) => ({
    round: gameState.round,
    phase: gameState.phase,
    turnPlayerId: gameState.turnPlayerId,
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
    gameState: room.gameState
        ? toPublicGameState(room.gameState, room.players.filter((player) => player.alive).length)
        : null,
});
