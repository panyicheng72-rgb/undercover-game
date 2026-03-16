import type { RoomPublicState } from "@undercover/shared";

type RoomPageProps = {
  roomState: RoomPublicState;
  myPlayerId: string | null;
  busy: boolean;
  onStart: () => void;
  onToggleBlankRole: (enabled: boolean) => void;
  onBackToLobby: () => void;
};

export const RoomPage = ({ roomState, myPlayerId, busy, onStart, onToggleBlankRole, onBackToLobby }: RoomPageProps) => {
  const me = roomState.players.find((player) => player.id === myPlayerId);
  const isHost = me?.isHost ?? false;
  const joinUrl = `${window.location.origin}/room/${roomState.roomCode}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(joinUrl)}`;

  return (
    <div className="page">
      <div className="card party-card">
        <h2>派对房间：{roomState.roomCode}</h2>
        <p className="muted">当前玩家：{roomState.players.length} / 8（至少 3 人开局）</p>
        <div className="share-panel">
          <p className="muted">分享链接：{joinUrl}</p>
          <div className="action-grid">
            <button
              className="ghost"
              onClick={() => {
                void navigator.clipboard.writeText(joinUrl);
              }}
            >
              复制邀请链接
            </button>
          </div>
          <img src={qrUrl} alt="房间二维码" className="room-qr" />
        </div>
        {isHost ? (
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={roomState.options.blankRoleEnabled}
              onChange={(event) => onToggleBlankRole(event.target.checked)}
              disabled={busy}
            />
            <span>启用白板角色（5人及以上将加入1名白板）</span>
          </label>
        ) : (
          <p className="muted">白板角色：{roomState.options.blankRoleEnabled ? "已启用" : "未启用"}</p>
        )}
        <ul className="player-list">
          {roomState.players.map((player) => (
            <li key={player.id}>
              <span>
                {player.avatar} {player.nickname} {!player.connected ? "（离线）" : ""}
              </span>
              <span className={`badge ${player.isHost ? "host-badge" : ""}`}>{player.isHost ? "房主" : "玩家"}</span>
            </li>
          ))}
        </ul>
        <div className="action-grid">
          <button disabled={!isHost || busy || roomState.players.length < 3} onClick={onStart}>
            {isHost ? "开始派对对局" : "等待房主开始"}
          </button>
          <button className="ghost" onClick={onBackToLobby}>
            退出房间
          </button>
        </div>
      </div>
    </div>
  );
};
