const WORD_PAIRS = [
    ["牛奶", "酸奶"],
    ["可乐", "雪碧"],
    ["地铁", "高铁"],
    ["披萨", "汉堡"],
    ["猫", "老虎"],
    ["篮球", "足球"],
    ["咖啡", "奶茶"],
    ["苹果", "梨"],
];
const randomPick = (items) => items[Math.floor(Math.random() * items.length)];
const shuffle = (items) => {
    const next = [...items];
    for (let i = next.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [next[i], next[j]] = [next[j], next[i]];
    }
    return next;
};
const livingPlayers = (room) => room.players.filter((player) => player.alive);
const getUndercoverCount = (playerCount) => (playerCount >= 6 ? 2 : 1);
const evaluateWinner = (room) => {
    const alive = livingPlayers(room);
    const undercoverAlive = alive.filter((player) => player.role === "undercover").length;
    const civilianAlive = alive.filter((player) => player.role === "civilian").length;
    if (undercoverAlive === 0) {
        return "civilian";
    }
    if (undercoverAlive >= civilianAlive) {
        return "undercover";
    }
    return null;
};
export const startGame = (room) => {
    const aliveIds = room.players.map((player) => player.id);
    const undercoverCount = getUndercoverCount(room.players.length);
    const undercoverIds = new Set(shuffle(aliveIds).slice(0, undercoverCount));
    const [civilianWord, undercoverWord] = randomPick(WORD_PAIRS);
    room.players.forEach((player) => {
        player.alive = true;
        const role = undercoverIds.has(player.id) ? "undercover" : "civilian";
        player.role = role;
        player.word = role === "undercover" ? undercoverWord : civilianWord;
    });
    room.status = "playing";
    room.gameState = {
        round: 1,
        phase: "speak",
        turnPlayerId: aliveIds[0] ?? null,
        votes: {},
        lastEliminatedPlayerId: null,
        lastVoteResult: null,
        winner: null,
    };
};
export const nextPhase = (room) => {
    if (!room.gameState) {
        throw new Error("游戏尚未开始");
    }
    const game = room.gameState;
    if (game.phase === "speak") {
        const alive = livingPlayers(room).map((player) => player.id);
        const currentIndex = game.turnPlayerId ? alive.indexOf(game.turnPlayerId) : -1;
        if (currentIndex >= 0 && currentIndex < alive.length - 1) {
            game.turnPlayerId = alive[currentIndex + 1];
            return game;
        }
        game.phase = "vote";
        game.turnPlayerId = null;
        game.votes = {};
        return game;
    }
    if (game.phase === "result") {
        if (game.winner) {
            return game;
        }
        game.phase = "speak";
        game.round += 1;
        game.votes = {};
        game.lastEliminatedPlayerId = null;
        game.turnPlayerId = livingPlayers(room)[0]?.id ?? null;
        return game;
    }
    throw new Error("当前阶段不支持手动推进");
};
export const submitVote = (room, voterId, targetPlayerId) => {
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
    const voteCounter = {};
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
