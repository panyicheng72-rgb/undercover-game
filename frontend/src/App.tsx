import { useEffect, useMemo, useState } from "react";
import { LobbyPage } from "./pages/LobbyPage";
import { RoomPage } from "./pages/RoomPage";
import { GamePage } from "./pages/GamePage";
import {
  connectSocket,
  createRoom,
  endTurn,
  getSocket,
  joinRoom,
  leaveRoom,
  nextPhase,
  setRematchReady,
  startRematch,
  startRoomGame,
  submitStatement,
  submitVote,
  updateRoomOptions,
} from "./lib/socket";
import { useGameStore } from "./store/gameStore";
import "./App.css";

const STORAGE_KEY = "undercover:lastSession";

function App() {
  const [busy, setBusy] = useState(false);
  const {
    stage,
    connected,
    nickname,
    roomCode,
    roomState,
    selfSecret,
    votedTargetId,
    winner,
    lastVoteResult,
    errorMessage,
    noticeMessage,
    setNickname,
    setRoomCode,
    setRoomState,
    setSelfSecret,
    setConnected,
    setErrorMessage,
    setNoticeMessage,
    setVotedTargetId,
    setWinner,
    setLastVoteResult,
    myRematchReady,
    setMyRematchReady,
    goToLobby,
  } = useGameStore();

  const myPlayerId = useMemo(
    () => roomState?.players.find((player) => player.nickname === nickname)?.id ?? null,
    [roomState, nickname]
  );
  const deepLinkRoomCode = useMemo(() => {
    const matched = window.location.pathname.match(/^\/room\/([a-z0-9]{6})$/i);
    return matched?.[1]?.toLowerCase() ?? null;
  }, []);

  useEffect(() => {
    connectSocket();
    const socket = getSocket();

    const onConnect = async () => {
      setConnected(true);
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw || roomState) {
        if (deepLinkRoomCode) {
          setRoomCode(deepLinkRoomCode);
        }
      } else {
        try {
          const parsed = JSON.parse(raw) as { roomCode: string; nickname: string };
          if (parsed.roomCode && parsed.nickname) {
            setNickname(parsed.nickname);
            setRoomCode(parsed.roomCode);
            const state = await joinRoom(parsed.roomCode, parsed.nickname);
            setRoomState(state);
            setNoticeMessage("已自动重连到上次房间");
            return;
          }
        } catch {
          setNoticeMessage("自动重连失败，请手动加入房间");
        }
      }
      if (deepLinkRoomCode && nickname.trim().length >= 2) {
        try {
          const state = await joinRoom(deepLinkRoomCode, nickname);
          setRoomCode(deepLinkRoomCode);
          setRoomState(state);
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ nickname, roomCode: deepLinkRoomCode }));
          setNoticeMessage("已通过分享链接加入房间");
        } catch {
          // keep lobby state for manual retry
        }
      }
    };

    const onDisconnect = () => {
      setConnected(false);
      setNoticeMessage("连接已断开，正在自动重连...");
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("error", (payload) => setErrorMessage(payload.message));
    socket.on("room:state", (state) => {
      setRoomState(state);
      if (state.gameState?.phase === "vote") {
        setVotedTargetId(null);
      }
    });
    socket.on("game:started", (payload) => {
      setRoomState(payload.state);
      setSelfSecret(payload.self);
      setWinner(null);
      setLastVoteResult(null);
      setVotedTargetId(null);
      setMyRematchReady(false);
    });
    socket.on("game:phaseChanged", (state) => {
      setRoomState(state);
      if (state.gameState?.phase === "vote") {
        setVotedTargetId(null);
      }
    });
    socket.on("game:voteResult", (payload) => setLastVoteResult(payload));
    socket.on("game:ended", (payload) => setWinner(payload.winner));

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("error");
      socket.off("room:state");
      socket.off("game:started");
      socket.off("game:phaseChanged");
      socket.off("game:voteResult");
      socket.off("game:ended");
    };
  }, [
    deepLinkRoomCode,
    nickname,
    roomState,
    setConnected,
    setErrorMessage,
    setLastVoteResult,
    setNickname,
    setNoticeMessage,
    setRoomCode,
    setRoomState,
    setSelfSecret,
    setVotedTargetId,
    setWinner,
    setMyRematchReady,
  ]);

  useEffect(() => {
    const myState = roomState?.players.find((player) => player.nickname === nickname);
    if (myState) {
      setMyRematchReady(myState.rematchReady);
    }
  }, [roomState, nickname, setMyRematchReady]);

  const runAction = async (action: () => Promise<void>) => {
    setBusy(true);
    setErrorMessage(null);
    try {
      await action();
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleCreateRoom = () =>
    runAction(async () => {
      const data = await createRoom(nickname);
      setRoomCode(data.roomCode);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ nickname, roomCode: data.roomCode }));
    });

  const handleJoinRoom = () =>
    runAction(async () => {
      const normalized = roomCode.trim().toLowerCase();
      const state = await joinRoom(normalized, nickname);
      setRoomState(state);
      setRoomCode(normalized);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ nickname, roomCode: normalized }));
    });

  const handleStart = () =>
    runAction(async () => {
      await startRoomGame(roomCode);
    });

  const handleVote = (targetPlayerId: string) =>
    runAction(async () => {
      await submitVote(roomCode, targetPlayerId);
      setVotedTargetId(targetPlayerId);
    });

  const handleNextPhase = () =>
    runAction(async () => {
      await nextPhase(roomCode);
    });

  const handleEndTurn = () =>
    runAction(async () => {
      await endTurn(roomCode);
    });

  const handleSubmitStatement = (text: string) =>
    runAction(async () => {
      await submitStatement(roomCode, text);
    });

  const handleToggleReady = (ready: boolean) =>
    runAction(async () => {
      await setRematchReady(roomCode, ready);
      setMyRematchReady(ready);
    });

  const handleStartRematch = () =>
    runAction(async () => {
      await startRematch(roomCode);
    });

  const handleBlankRoleToggle = (enabled: boolean) =>
    runAction(async () => {
      await updateRoomOptions(roomCode, enabled);
    });

  const handleBackToLobby = () => {
    if (roomCode) {
      void leaveRoom(roomCode);
    }
    localStorage.removeItem(STORAGE_KEY);
    goToLobby();
    if (window.location.pathname.startsWith("/room/")) {
      window.history.replaceState(null, "", "/");
    }
  };

  return (
    <main className="party-stage">
      {errorMessage ? <div className="banner error">{errorMessage}</div> : null}
      {noticeMessage ? <div className="banner notice">{noticeMessage}</div> : null}
      {stage === "lobby" ? (
        <LobbyPage
          connected={connected}
          busy={busy}
          nickname={nickname}
          roomCode={roomCode}
          onNicknameChange={setNickname}
          onRoomCodeChange={setRoomCode}
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
        />
      ) : null}
      {stage === "room" && roomState ? (
        <RoomPage
          roomState={roomState}
          myPlayerId={myPlayerId}
          busy={busy}
          onStart={handleStart}
          onToggleBlankRole={handleBlankRoleToggle}
          onBackToLobby={handleBackToLobby}
        />
      ) : null}
      {stage === "game" && roomState ? (
        <GamePage
          roomState={roomState}
          myPlayerId={myPlayerId}
          selfRole={selfSecret?.role ?? "civilian"}
          selfWord={selfSecret?.word ?? "（白板无词）"}
          votedTargetId={votedTargetId}
          winner={winner}
          lastVoteResult={lastVoteResult}
          myRematchReady={myRematchReady}
          busy={busy}
          onVote={handleVote}
          onEndTurn={handleEndTurn}
          onSubmitStatement={handleSubmitStatement}
          onNextPhase={handleNextPhase}
          onToggleReady={handleToggleReady}
          onStartRematch={handleStartRematch}
        />
      ) : null}
    </main>
  );
}

export default App;
