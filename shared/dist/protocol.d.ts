export type RoomStatus = "waiting" | "playing" | "ended";
export type PlayerRole = "undercover" | "civilian" | "blank";
export type GamePhase = "speak" | "vote" | "result";
export type ErrorPayload = {
    message: string;
};
export type AckResponse<T = undefined> = {
    ok: true;
    data: T;
} | {
    ok: false;
    error: string;
};
export type PublicPlayer = {
    id: string;
    nickname: string;
    avatar: string;
    connected: boolean;
    alive: boolean;
    isHost: boolean;
    rematchReady: boolean;
    stats: {
        games: number;
        wins: number;
        score: number;
        level: number;
    };
};
export type PublicGameState = {
    round: number;
    phase: GamePhase;
    turnPlayerId: string | null;
    speakDeadlineAt: number | null;
    speakingHistory: Array<{
        playerId: string;
        text: string;
    }>;
    votedCount: number;
    totalAlive: number;
    lastEliminatedPlayerId: string | null;
    winner: PlayerRole | null;
};
export type RoomPublicState = {
    roomCode: string;
    status: RoomStatus;
    hostId: string;
    players: PublicPlayer[];
    gameState: PublicGameState | null;
    canStartRematch: boolean;
    options: {
        blankRoleEnabled: boolean;
    };
};
export type PlayerSecret = {
    role: PlayerRole;
    word: string | null;
};
export type VoteResultPayload = {
    eliminatedPlayerId: string | null;
    votes: Record<string, number>;
};
export type GameEndedPayload = {
    winner: PlayerRole;
};
export type CreateRoomInput = {
    nickname: string;
    clientId: string;
};
export type CreateRoomOutput = {
    roomCode: string;
};
export type JoinRoomInput = {
    roomCode: string;
    nickname: string;
    clientId: string;
};
export type StartGameInput = {
    roomCode: string;
};
export type LeaveRoomInput = {
    roomCode: string;
};
export type SubmitVoteInput = {
    roomCode: string;
    targetPlayerId: string;
};
export type NextPhaseInput = {
    roomCode: string;
};
export type EndTurnInput = {
    roomCode: string;
};
export type SubmitStatementInput = {
    roomCode: string;
    text: string;
};
export type SetRematchReadyInput = {
    roomCode: string;
    ready: boolean;
};
export type StartRematchInput = {
    roomCode: string;
};
export type UpdateRoomOptionsInput = {
    roomCode: string;
    blankRoleEnabled: boolean;
};
export interface ClientToServerEvents {
    "room:create": (payload: CreateRoomInput, ack: (response: AckResponse<CreateRoomOutput>) => void) => void;
    "room:join": (payload: JoinRoomInput, ack: (response: AckResponse<RoomPublicState>) => void) => void;
    "room:start": (payload: StartGameInput, ack: (response: AckResponse<undefined>) => void) => void;
    "room:leave": (payload: LeaveRoomInput, ack: (response: AckResponse<undefined>) => void) => void;
    "room:updateOptions": (payload: UpdateRoomOptionsInput, ack: (response: AckResponse<undefined>) => void) => void;
    "game:submitVote": (payload: SubmitVoteInput, ack: (response: AckResponse<undefined>) => void) => void;
    "game:nextPhase": (payload: NextPhaseInput, ack: (response: AckResponse<undefined>) => void) => void;
    "game:endTurn": (payload: EndTurnInput, ack: (response: AckResponse<undefined>) => void) => void;
    "game:submitStatement": (payload: SubmitStatementInput, ack: (response: AckResponse<undefined>) => void) => void;
    "room:setRematchReady": (payload: SetRematchReadyInput, ack: (response: AckResponse<undefined>) => void) => void;
    "room:startRematch": (payload: StartRematchInput, ack: (response: AckResponse<undefined>) => void) => void;
}
export interface ServerToClientEvents {
    "room:state": (state: RoomPublicState) => void;
    "game:started": (payload: {
        state: RoomPublicState;
        self: PlayerSecret;
    }) => void;
    "game:phaseChanged": (state: RoomPublicState) => void;
    "game:voteResult": (payload: VoteResultPayload) => void;
    "game:ended": (payload: GameEndedPayload) => void;
    error: (payload: ErrorPayload) => void;
}
