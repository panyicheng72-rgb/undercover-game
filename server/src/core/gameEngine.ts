import type { PlayerRole, VoteResultPayload } from "@undercover/shared";
import type { InternalGameState, InternalPlayer, InternalRoom } from "./types.js";
import { WORD_PAIRS } from "./wordBank.js";

const randomPick = <T>(items: T[]): T => items[Math.floor(Math.random() * items.length)];
const SPEAK_TURN_MS = 30_000;

const shuffle = <T>(items: T[]): T[] => {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
};

const livingPlayers = (room: InternalRoom): InternalPlayer[] => room.players.filter((player) => player.alive);
const nextSpeakDeadline = (): number => Date.now() + SPEAK_TURN_MS;

const getUndercoverCount = (playerCount: number): number => (playerCount >= 6 ? 2 : 1);
const getBlankCount = (playerCount: number, blankRoleEnabled: boolean): number =>
  blankRoleEnabled && playerCount >= 5 ? 1 : 0;

const evaluateWinner = (room: InternalRoom): PlayerRole | null => {
  const alive = livingPlayers(room);
  const undercoverAlive = alive.filter((player) => player.role === "undercover").length;
  const civilianAlive = alive.filter((player) => player.role !== "undercover").length;
  if (undercoverAlive === 0) {
    return "civilian";
  }
  if (undercoverAlive >= civilianAlive) {
    return "undercover";
  }
  return null;
};

export const startGame = (room: InternalRoom): void => {
  const aliveIds = room.players.map((player) => player.id);
  const undercoverCount = getUndercoverCount(room.players.length);
  const blankCount = getBlankCount(room.players.length, room.options.blankRoleEnabled);
  const shuffledIds = shuffle(aliveIds);
  const undercoverIds = new Set(shuffledIds.slice(0, undercoverCount));
  const blankIds = new Set(shuffledIds.slice(undercoverCount, undercoverCount + blankCount));
  const [civilianWord, undercoverWord] = randomPick(WORD_PAIRS);

  room.players.forEach((player) => {
    player.alive = true;
    player.rematchReady = false;
    const role: PlayerRole = undercoverIds.has(player.id)
      ? "undercover"
      : blankIds.has(player.id)
        ? "blank"
        : "civilian";
    player.role = role;
    player.word = role === "undercover" ? undercoverWord : role === "blank" ? null : civilianWord;
    player.stats.games += 1;
  });

  room.status = "playing";
  room.gameState = {
    round: 1,
    phase: "speak",
    turnPlayerId: aliveIds[0] ?? null,
    speakDeadlineAt: aliveIds[0] ? nextSpeakDeadline() : null,
    speakingHistory: [],
    votes: {},
    lastEliminatedPlayerId: null,
    lastVoteResult: null,
    winner: null,
  };
};

export const endCurrentSpeakerTurn = (room: InternalRoom): InternalGameState => {
  if (!room.gameState) {
    throw new Error("游戏尚未开始");
  }
  const game = room.gameState;
  if (game.phase !== "speak") {
    throw new Error("当前不是发言阶段");
  }
  const alive = livingPlayers(room).map((player) => player.id);
  const currentIndex = game.turnPlayerId ? alive.indexOf(game.turnPlayerId) : -1;
  if (currentIndex >= 0 && currentIndex < alive.length - 1) {
    game.turnPlayerId = alive[currentIndex + 1];
    game.speakDeadlineAt = nextSpeakDeadline();
    return game;
  }
  game.phase = "vote";
  game.turnPlayerId = null;
  game.speakDeadlineAt = null;
  game.votes = {};
  return game;
};

export const nextPhase = (room: InternalRoom): InternalGameState => {
  if (!room.gameState) {
    throw new Error("游戏尚未开始");
  }
  const game = room.gameState;

  if (game.phase === "result") {
    if (game.winner) {
      return game;
    }
    game.phase = "speak";
    game.round += 1;
    game.speakingHistory = [];
    game.votes = {};
    game.lastEliminatedPlayerId = null;
    game.turnPlayerId = livingPlayers(room)[0]?.id ?? null;
    game.speakDeadlineAt = game.turnPlayerId ? nextSpeakDeadline() : null;
    return game;
  }

  throw new Error("当前阶段只能由发言玩家结束发言");
};

export const submitStatement = (room: InternalRoom, playerId: string, rawText: string): InternalGameState => {
  if (!room.gameState) {
    throw new Error("游戏尚未开始");
  }
  const game = room.gameState;
  if (game.phase !== "speak") {
    throw new Error("仅发言阶段可提交发言记录");
  }
  if (game.turnPlayerId !== playerId) {
    throw new Error("仅当前发言玩家可提交发言记录");
  }
  const player = room.players.find((item) => item.id === playerId);
  if (!player || !player.alive) {
    throw new Error("仅存活玩家可提交发言记录");
  }
  const text = rawText.trim();
  if (!text) {
    throw new Error("发言内容不能为空");
  }
  if (text.length > 60) {
    throw new Error("发言内容不能超过 60 字");
  }

  const existing = game.speakingHistory.find((item) => item.playerId === playerId);
  if (existing) {
    existing.text = text;
  } else {
    game.speakingHistory.push({ playerId, text });
  }
  return game;
};

export const submitVote = (
  room: InternalRoom,
  voterId: string,
  targetPlayerId: string
): { completed: boolean; voteResult?: VoteResultPayload; winner?: PlayerRole | null } => {
  if (!room.gameState) {
    throw new Error("游戏尚未开始");
  }
  const game = room.gameState;
  if (game.phase !== "vote") {
    throw new Error("当前不是投票阶段");
  }

  const voter = room.players.find((player) => player.id === voterId);
  if (!voter || !voter.alive) {
    throw new Error("仅存活玩家可以投票");
  }
  const target = room.players.find((player) => player.id === targetPlayerId);
  if (!target || !target.alive) {
    throw new Error("投票目标无效");
  }

  game.votes[voterId] = targetPlayerId;

  const aliveCount = livingPlayers(room).length;
  if (Object.keys(game.votes).length < aliveCount) {
    return { completed: false };
  }

  const voteCounter: Record<string, number> = {};
  Object.values(game.votes).forEach((votedId) => {
    voteCounter[votedId] = (voteCounter[votedId] ?? 0) + 1;
  });
  const maxVotes = Math.max(...Object.values(voteCounter));
  const topIds = Object.keys(voteCounter).filter((id) => voteCounter[id] === maxVotes);
  const eliminatedPlayerId = topIds.length === 1 ? topIds[0] : null;

  if (eliminatedPlayerId) {
    const eliminated = room.players.find((player) => player.id === eliminatedPlayerId);
    if (eliminated) {
      eliminated.alive = false;
    }
  }

  game.phase = "result";
  game.turnPlayerId = null;
  game.speakDeadlineAt = null;
  game.lastEliminatedPlayerId = eliminatedPlayerId;
  game.lastVoteResult = {
    eliminatedPlayerId,
    votes: voteCounter,
  };
  game.winner = evaluateWinner(room);
  if (game.winner) {
    room.status = "ended";
  }

  return {
    completed: true,
    voteResult: game.lastVoteResult,
    winner: game.winner,
  };
};
