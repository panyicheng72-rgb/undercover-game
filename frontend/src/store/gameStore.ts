import { create } from "zustand";
import type { PlayerRole, PlayerSecret, RoomPublicState, VoteResultPayload } from "@undercover/shared";

type ViewStage = "lobby" | "room" | "game";

type GameStore = {
  stage: ViewStage;
  nickname: string;
  roomCode: string;
  roomState: RoomPublicState | null;
  selfSecret: PlayerSecret | null;
  lastVoteResult: VoteResultPayload | null;
  winner: PlayerRole | null;
  connected: boolean;
  errorMessage: string | null;
  noticeMessage: string | null;
  votedTargetId: string | null;
  myRematchReady: boolean;
  setNickname: (nickname: string) => void;
  setRoomCode: (roomCode: string) => void;
  setRoomState: (state: RoomPublicState | null) => void;
  setSelfSecret: (selfSecret: PlayerSecret | null) => void;
  setLastVoteResult: (result: VoteResultPayload | null) => void;
  setWinner: (winner: PlayerRole | null) => void;
  setConnected: (connected: boolean) => void;
  setErrorMessage: (error: string | null) => void;
  setNoticeMessage: (message: string | null) => void;
  setVotedTargetId: (targetId: string | null) => void;
  setMyRematchReady: (ready: boolean) => void;
  goToLobby: () => void;
};

export const useGameStore = create<GameStore>((set) => ({
  stage: "lobby",
  nickname: "",
  roomCode: "",
  roomState: null,
  selfSecret: null,
  lastVoteResult: null,
  winner: null,
  connected: false,
  errorMessage: null,
  noticeMessage: null,
  votedTargetId: null,
  myRematchReady: false,
  setNickname: (nickname) => set({ nickname }),
  setRoomCode: (roomCode) => set({ roomCode }),
  setRoomState: (roomState) =>
    set({
      roomState,
      stage: roomState ? (roomState.status === "playing" || roomState.status === "ended" ? "game" : "room") : "lobby",
    }),
  setSelfSecret: (selfSecret) => set({ selfSecret }),
  setLastVoteResult: (lastVoteResult) => set({ lastVoteResult }),
  setWinner: (winner) => set({ winner }),
  setConnected: (connected) => set({ connected }),
  setErrorMessage: (errorMessage) => set({ errorMessage }),
  setNoticeMessage: (noticeMessage) => set({ noticeMessage }),
  setVotedTargetId: (votedTargetId) => set({ votedTargetId }),
  setMyRematchReady: (myRematchReady) => set({ myRematchReady }),
  goToLobby: () =>
    set({
      stage: "lobby",
      roomCode: "",
      roomState: null,
      selfSecret: null,
      lastVoteResult: null,
      winner: null,
      errorMessage: null,
      noticeMessage: null,
      votedTargetId: null,
      myRematchReady: false,
    }),
}));
