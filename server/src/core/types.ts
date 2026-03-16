import type {
  PlayerRole,
  PublicGameState,
  PublicPlayer,
  RoomPublicState,
  RoomStatus,
  VoteResultPayload,
} from "@undercover/shared";

export type InternalPlayer = {
  id: string;
  socketId: string;
  clientId: string;
  nickname: string;
  avatar: string;
  connected: boolean;
  joinedAt: number;
  stats: {
    games: number;
    wins: number;
    score: number;
    level: number;
  };
  alive: boolean;
  role: PlayerRole | null;
  word: string | null;
  rematchReady: boolean;
};

export type InternalGameState = {
  round: number;
  phase: "speak" | "vote" | "result";
  turnPlayerId: string | null;
  speakDeadlineAt: number | null;
  speakingHistory: Array<{ playerId: string; text: string }>;
  votes: Record<string, string>;
  lastEliminatedPlayerId: string | null;
  lastVoteResult: VoteResultPayload | null;
  winner: PlayerRole | null;
};

export type InternalRoom = {
  roomCode: string;
  hostId: string;
  status: RoomStatus;
  options: {
    blankRoleEnabled: boolean;
  };
  players: InternalPlayer[];
  gameState: InternalGameState | null;
  emptySince: number | null;
};

export const toPublicPlayer = (player: InternalPlayer, hostId: string): PublicPlayer => ({
  id: player.id,
  nickname: player.nickname,
  avatar: player.avatar,
  connected: player.connected,
  alive: player.alive,
  isHost: player.id === hostId,
  rematchReady: player.rematchReady,
  stats: player.stats,
});

export const toPublicGameState = (gameState: InternalGameState, aliveCount: number): PublicGameState => ({
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

export const toPublicRoomState = (room: InternalRoom): RoomPublicState => ({
  roomCode: room.roomCode,
  status: room.status,
  hostId: room.hostId,
  players: room.players.map((player) => toPublicPlayer(player, room.hostId)),
  canStartRematch:
    room.status === "ended" &&
    room.players.length >= 3 &&
    room.players.every((player) => player.rematchReady),
  gameState: room.gameState
    ? toPublicGameState(
        room.gameState,
        room.players.filter((player) => player.alive).length
      )
    : null,
  options: room.options,
});
