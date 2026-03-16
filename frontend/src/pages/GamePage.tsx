import { useEffect, useMemo, useRef, useState } from "react";
import type { PlayerRole, RoomPublicState, VoteResultPayload } from "@undercover/shared";

type GamePageProps = {
  roomState: RoomPublicState;
  myPlayerId: string | null;
  selfRole: PlayerRole;
  selfWord: string;
  votedTargetId: string | null;
  winner: PlayerRole | null;
  lastVoteResult: VoteResultPayload | null;
  myRematchReady: boolean;
  busy: boolean;
  onVote: (targetPlayerId: string) => void;
  onEndTurn: () => void;
  onSubmitStatement: (text: string) => void;
  onNextPhase: () => void;
  onToggleReady: (ready: boolean) => void;
  onStartRematch: () => void;
};

const phaseLabel: Record<string, string> = {
  speak: "发言阶段",
  vote: "投票阶段",
  result: "结果阶段",
};

export const GamePage = ({
  roomState,
  myPlayerId,
  selfRole,
  selfWord,
  votedTargetId,
  winner,
  lastVoteResult,
  myRematchReady,
  busy,
  onVote,
  onEndTurn,
  onSubmitStatement,
  onNextPhase,
  onToggleReady,
  onStartRematch,
}: GamePageProps) => {
  const [now, setNow] = useState(() => Date.now());
  const [statementInput, setStatementInput] = useState("");
  const [listening, setListening] = useState(false);
  const [animatedVotes, setAnimatedVotes] = useState<Record<string, number>>({});
  const [voteAnimationDone, setVoteAnimationDone] = useState(false);
  const speechRef = useRef<any>(null);
  const me = roomState.players.find((player) => player.id === myPlayerId);
  const isHost = me?.isHost ?? false;
  const gameState = roomState.gameState;
  if (!gameState) {
    return null;
  }

  const alivePlayers = roomState.players.filter((player) => player.alive);
  const canVote = gameState.phase === "vote" && me?.alive;
  const isCurrentSpeaker = gameState.phase === "speak" && me?.id === gameState.turnPlayerId;
  const currentSpeaker = roomState.players.find((player) => player.id === gameState.turnPlayerId);
  const allReady = roomState.players.every((player) => player.rematchReady);
  const speakingSecondsLeft = useMemo(() => {
    if (gameState.phase !== "speak" || !gameState.speakDeadlineAt) {
      return null;
    }
    const msLeft = gameState.speakDeadlineAt - now;
    return Math.max(0, Math.ceil(msLeft / 1000));
  }, [gameState.phase, gameState.speakDeadlineAt, now]);

  useEffect(() => {
    if (gameState.phase !== "speak") {
      return;
    }
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 250);
    return () => window.clearInterval(timer);
  }, [gameState.phase, gameState.speakDeadlineAt]);

  const startVoiceInput = () => {
    const SpeechRecognitionImpl = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionImpl) {
      return;
    }
    speechRef.current?.stop();
    const recognition = new SpeechRecognitionImpl();
    recognition.lang = "zh-CN";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim() ?? "";
      if (!transcript) {
        return;
      }
      setStatementInput((prev) => `${prev}${prev ? " " : ""}${transcript}`.slice(0, 60));
    };
    speechRef.current = recognition;
    recognition.start();
  };

  useEffect(() => {
    return () => {
      speechRef.current?.stop();
    };
  }, []);

  const statementByPlayerId = useMemo(() => {
    const map: Record<string, string> = {};
    gameState.speakingHistory.forEach((item) => {
      map[item.playerId] = item.text;
    });
    return map;
  }, [gameState.speakingHistory]);

  useEffect(() => {
    if (!myPlayerId) {
      setStatementInput("");
      return;
    }
    setStatementInput(statementByPlayerId[myPlayerId] ?? "");
  }, [myPlayerId, statementByPlayerId, gameState.round, gameState.phase]);

  useEffect(() => {
    if (!lastVoteResult) {
      setAnimatedVotes({});
      setVoteAnimationDone(false);
      return;
    }
    const sequence: string[] = [];
    Object.entries(lastVoteResult.votes).forEach(([playerId, count]) => {
      for (let i = 0; i < count; i += 1) {
        sequence.push(playerId);
      }
    });
    setAnimatedVotes({});
    if (sequence.length === 0) {
      setVoteAnimationDone(true);
      return;
    }
    setVoteAnimationDone(false);
    let index = 0;
    const timer = window.setInterval(() => {
      const playerId = sequence[index];
      setAnimatedVotes((prev) => ({
        ...prev,
        [playerId]: (prev[playerId] ?? 0) + 1,
      }));
      index += 1;
      if (index >= sequence.length) {
        window.clearInterval(timer);
        setVoteAnimationDone(true);
      }
    }, 260);
    return () => window.clearInterval(timer);
  }, [lastVoteResult]);

  const voteRows = useMemo(() => {
    if (!lastVoteResult) {
      return [];
    }
    return Object.entries(lastVoteResult.votes)
      .map(([playerId, finalCount]) => {
        const player = roomState.players.find((item) => item.id === playerId);
        return {
          playerId,
          nickname: player?.nickname ?? "未知玩家",
          finalCount,
          displayCount: animatedVotes[playerId] ?? 0,
        };
      })
      .sort((a, b) => b.finalCount - a.finalCount);
  }, [lastVoteResult, roomState.players, animatedVotes]);

  return (
    <div className={`page phase-${gameState.phase}`}>
      <div className="card party-card">
        <h2>房间号：{roomState.roomCode}</h2>
        <div className="secret-panel">
          <div>
            <strong>你的身份：</strong>
            <span>
              {selfRole === "undercover" ? "卧底" : selfRole === "blank" ? "白板" : "平民"}
            </span>
          </div>
          <div>
            <strong>你的词语：</strong>
            <span>{selfRole === "blank" ? "（白板无词）" : selfWord}</span>
          </div>
        </div>

        <p className="muted">
          第 {gameState.round} 轮 · {phaseLabel[gameState.phase]}
        </p>
        {gameState.phase === "speak" ? (
          <p className="muted">
            当前发言：{currentSpeaker?.nickname ?? "待定"} · 剩余 {speakingSecondsLeft ?? 0}s
          </p>
        ) : null}
        {gameState.phase === "speak" ? (
          <div className="statement-panel">
            <h3>发言记录</h3>
            {isCurrentSpeaker ? (
              <>
                <textarea
                  value={statementInput}
                  onChange={(event) => setStatementInput(event.target.value.slice(0, 60))}
                  placeholder="输入你的描述（最多 60 字）"
                />
                <button
                  disabled={busy || statementInput.trim().length === 0}
                  className="ghost"
                  onClick={() => onSubmitStatement(statementInput)}
                >
                  保存发言
                </button>
                <button className="ghost" disabled={busy || listening} onClick={startVoiceInput}>
                  {listening ? "正在收音..." : "语音输入"}
                </button>
              </>
            ) : (
              <p className="muted">当前发言玩家可记录本轮描述。</p>
            )}
          </div>
        ) : null}
        {winner ? (
          <div className="winner-banner">{winner === "undercover" ? "卧底获胜" : "平民阵营获胜"}</div>
        ) : null}

        <ul className="player-list">
          {roomState.players.map((player) => (
            <li
              key={player.id}
              className={`${player.id === gameState.turnPlayerId ? "speaking-player" : ""} ${!player.alive ? "eliminated-player" : ""}`}
            >
              <span>
                {player.avatar} {player.nickname}
                {!player.alive ? "（已出局）" : ""}
                {!player.connected ? "（离线）" : ""}
              </span>
              <div className="player-actions">
                <span className="muted">
                  Lv.{player.stats.level} 分:{player.stats.score}
                </span>
                {roomState.status === "ended" ? (
                  <span className={`ready-pill ${player.rematchReady ? "ready-on" : "ready-off"}`}>
                    {player.rematchReady ? "已准备" : "未准备"}
                  </span>
                ) : null}
                {canVote && player.alive && player.id !== myPlayerId ? (
                  <button
                    disabled={busy || votedTargetId !== null}
                    className="vote-button"
                    onClick={() => onVote(player.id)}
                  >
                    {votedTargetId === player.id ? "已投票" : "投票"}
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>

        {lastVoteResult ? (
          <div className="result-box">
            <h3>唱票中</h3>
            {voteRows.map((row) => (
              <div key={row.playerId} className="vote-row">
                <span>{row.nickname}</span>
                <span className="vote-dots" aria-label={`${row.displayCount} 票`}>
                  {Array.from({ length: row.displayCount }, (_, index) => (
                    <i key={`${row.playerId}-${index}`} className="vote-dot" />
                  ))}
                </span>
              </div>
            ))}
            {voteAnimationDone ? (
              <p style={{ marginTop: 8 }}>
                本轮结果：
                {lastVoteResult.eliminatedPlayerId
                  ? `玩家 ${roomState.players.find((player) => player.id === lastVoteResult.eliminatedPlayerId)?.nickname ?? "未知"} 出局`
                  : "平票，无人出局"}
              </p>
            ) : (
              <p className="muted" style={{ marginTop: 8 }}>
                正在统计票数...
              </p>
            )}
          </div>
        ) : null}

        {gameState.phase !== "speak" ? (
          <div className="statement-panel">
            <h3>发言历史</h3>
            {gameState.speakingHistory.length === 0 ? (
              <p className="muted">本轮暂未记录发言。</p>
            ) : (
              <ul className="history-list">
                {gameState.speakingHistory.map((item) => (
                  <li key={item.playerId}>
                    <strong>{roomState.players.find((player) => player.id === item.playerId)?.nickname ?? "未知"}：</strong>
                    <span>{item.text}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        {isCurrentSpeaker && !winner ? (
          <button disabled={busy} onClick={onEndTurn}>
            我已发言，结束发言
          </button>
        ) : null}

        {!isCurrentSpeaker && gameState.phase === "speak" && !winner ? (
          <p className="muted">等待当前发言玩家结束发言</p>
        ) : null}

        {isHost && gameState.phase === "result" && !winner ? (
          <button disabled={busy} onClick={onNextPhase}>
            开始下一轮
          </button>
        ) : null}

        <p className="muted">存活人数：{alivePlayers.length}</p>

        {winner ? (
          <div className="rematch-panel">
            <h3>再来一局</h3>
            <p className="muted">玩家先准备，全部准备后由房主开始新一局。</p>
            <div className="action-grid">
              <button disabled={busy} onClick={() => onToggleReady(!myRematchReady)}>
                {myRematchReady ? "取消准备" : "我已准备"}
              </button>
              <button disabled={busy || !isHost || !allReady || !roomState.canStartRematch} onClick={onStartRematch}>
                {isHost ? "房主开始新一局" : "等待房主开始"}
              </button>
            </div>
            {!allReady ? <p className="muted">还有玩家未准备</p> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
};
