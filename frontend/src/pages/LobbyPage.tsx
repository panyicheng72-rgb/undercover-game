import { useState } from "react";
const FRIENDS_KEY = "undercover:friends";

type LobbyPageProps = {
  connected: boolean;
  busy: boolean;
  nickname: string;
  roomCode: string;
  onNicknameChange: (value: string) => void;
  onRoomCodeChange: (value: string) => void;
  onCreateRoom: () => void;
  onJoinRoom: () => void;
};

export const LobbyPage = ({
  connected,
  busy,
  nickname,
  roomCode,
  onNicknameChange,
  onRoomCodeChange,
  onCreateRoom,
  onJoinRoom,
}: LobbyPageProps) => {
  const [nicknameTouched, setNicknameTouched] = useState(false);
  const [friends, setFriends] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(FRIENDS_KEY);
      if (!raw) {
        return [];
      }
      const parsed = JSON.parse(raw) as string[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const nicknameInvalid = nicknameTouched && nickname.trim().length < 2;
  const canSubmit = nickname.trim().length >= 2;
  const saveFriend = () => {
    const next = nickname.trim();
    if (next.length < 2) {
      return;
    }
    const merged = [next, ...friends.filter((name) => name !== next)].slice(0, 8);
    setFriends(merged);
    localStorage.setItem(FRIENDS_KEY, JSON.stringify(merged));
  };

  return (
    <div className="page">
      <div className="card party-card">
        <div className="party-stars" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <h1>谁是卧底派对夜</h1>
        <p className="muted">一键开房，好友秒进，手机和电脑都能实时开玩。</p>
        <div className="connection-indicator">
          <span className={connected ? "dot online" : "dot offline"} />
          {connected ? "已连接服务器" : "正在连接服务器..."}
        </div>
        <label className="field">
          <span>你的昵称</span>
          <input
            value={nickname}
            placeholder="至少 2 个字"
            onBlur={() => setNicknameTouched(true)}
            onChange={(event) => onNicknameChange(event.target.value)}
            maxLength={12}
          />
          {nicknameInvalid ? <small className="error-text">昵称长度至少 2 个字</small> : null}
        </label>
        <div className="action-grid">
          <button disabled={!canSubmit || busy || !connected} onClick={onCreateRoom}>
            创建派对房间
          </button>
        </div>
        <label className="field">
          <span>房间号</span>
          <input
            value={roomCode}
            placeholder="输入 6 位短码（如 abc123）"
            onChange={(event) => onRoomCodeChange(event.target.value.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 6))}
          />
        </label>
        <button disabled={!canSubmit || roomCode.length !== 6 || busy || !connected} onClick={onJoinRoom}>
          输入房号加入
        </button>
        <p className="muted footer-tip">建议 4-8 人体验更佳。</p>
        <div className="friend-panel">
          <h3>好友系统（本地）</h3>
          <button className="ghost" onClick={saveFriend} disabled={!canSubmit}>
            保存当前昵称到好友
          </button>
          {friends.length > 0 ? (
            <div className="friend-list">
              {friends.map((friend) => (
                <button key={friend} className="ghost" onClick={() => onNicknameChange(friend)}>
                  {friend}
                </button>
              ))}
            </div>
          ) : (
            <p className="muted">保存后可快速切换常用好友昵称。</p>
          )}
        </div>
      </div>
    </div>
  );
};
