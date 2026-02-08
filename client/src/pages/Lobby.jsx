import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { MessageCircle, Send, LogOut, AlertCircle } from "lucide-react";
import socket from "../socket";

/* ---------------- Constants ---------------- */

const COLORS = [
  "#00ff88",
  "#00ddff",
  "#dd00ff",
  "#ffcc00",
  "#ff9900",
  "#ff3366",
];

const ROLES_INFO = [
  {
    title: "FIXERS",
    description: "Find and fix bugs before time runs out",
    icon: "🛠️",
    color: "#00ddff",
  },
  {
    title: "BUGGER",
    description: "Inject subtle bugs and avoid detection",
    icon: "🐛",
    color: "#ff3366",
  },
  {
    title: "TIMER",
    description: "Each round lasts 90 seconds",
    icon: "⏱️",
    color: "#00ff88",
  },
  {
    title: "BUZZER",
    description: "Buzz to submit a fix — wrong answers cost points",
    icon: "🔔",
    color: "#ffcc00",
  },
];

/* ---------------- Helpers ---------------- */

function normalizeRoom(room) {
  if (!room) return null;

  return {
    ...room,
    players: Array.isArray(room.players)
      ? room.players
      : Array.from(room.players.values()),
    scores:
      room.scores instanceof Map
        ? Object.fromEntries(room.scores)
        : room.scores ?? {},
  };
}

/* ---------------- Component ---------------- */

export default function GameLobby() {
  const navigate = useNavigate();
  const location = useLocation();

  // Initialize state from location or localStorage
  const [room, setRoom] = useState(location.state?.room || null);
  const [playerId, setPlayerId] = useState(location.state?.playerId || localStorage.getItem('codeRed_playerId'));
  const [playerName, setPlayerName] = useState(location.state?.playerName || localStorage.getItem('codeRed_playerName'));

  const [message, setMessage] = useState("");
  const [chatMessages, setChatMessages] = useState([]);

  const [readyLoading, setReadyLoading] = useState(false);
  const [startLoading, setStartLoading] = useState(false);
  const [connected, setConnected] = useState(socket.connected);
  const [error, setError] = useState("");

  /* ---------------- Derived State ---------------- */

  const players = useMemo(() => {
    if (!room?.players) return [];
    return room.players.map((p, idx) => ({
      ...p,
      color: COLORS[idx % COLORS.length],
    }));
  }, [room]);

  const me = players.find((p) => p.id === playerId);
  const isHost = me?.isHost === true;

  const readyCount = players.filter((p) => p.isReady).length;
  const allPlayersReady =
    players.length >= 2 && players.every((p) => p.isReady); // Min 2 players for testing

  /* ---------------- Socket Lifecycle ---------------- */

  useEffect(() => {
    const roomCode = location.state?.roomCode || localStorage.getItem('codeRed_roomCode');
    const pid = location.state?.playerId || localStorage.getItem('codeRed_playerId');
    const pname = location.state?.playerName || localStorage.getItem('codeRed_playerName');

    if (!roomCode || !pid || !pname) {
      navigate("/");
      return;
    }

    // Update state if recovered from storage
    if (!playerId) setPlayerId(pid);
    if (!playerName) setPlayerName(pname);

    if (!socket.connected) {
      socket.connect();
    }
    setConnected(socket.connected);

    socket.on("connect", () => {
      setConnected(true);
      // Re-join logic if simple reconnect
      socket.emit('joinRoom', { roomCode, playerName: pname }, (res) => {
        if (res.success) {
           setRoom(normalizeRoom(res.room));
           setPlayerId(res.playerId); // Should match cached
        } else {
           // If room handled by previous state, might get "already in room" or similar if logic existed, 
           // but here we just ensure we are synced.
           // If error is "Room not found" (server restart), redirection happens
           if (res.error === "Room not found") {
             navigate("/");
           }
        }
      });
    });

    socket.on("roomUpdated", ({ room }) => {
      setRoom(normalizeRoom(room));
    });

    socket.on("playerJoined", ({ player, room }) => {
      setRoom(normalizeRoom(room));
      setChatMessages((prev) => [
        ...prev,
        {
          username: "System",
          message: `${player.name} joined the lobby`,
          color: "#00ff88",
        },
      ]);
    });

    socket.on("playerLeft", () => {
      setChatMessages((prev) => [
        ...prev,
        {
          username: "System",
          message: "A player left the lobby",
          color: "#ff3366",
        },
      ]);
    });

    socket.on("chatMessage", (msg) => {
      setChatMessages((prev) => [...prev, msg]);
    });

    socket.on("gameStarted", ({ room }) => {
      navigate("/game", {
        state: {
          roomCode: room.code,
          room,
          playerId,
          playerName,
        },
      });
    });

    socket.on("disconnect", () => {
      setConnected(false);
      setError("Disconnected from server");
    });

    return () => socket.removeAllListeners();
  }, [navigate, location, playerId, playerName]);

  /* ---------------- Actions ---------------- */

  const toggleReady = () => {
    if (readyLoading) return;
    setReadyLoading(true);

    socket.emit("playerReady", (res) => {
      setReadyLoading(false);
      if (!res?.success) setError("Failed to update ready status");
    });
  };

  const startGame = () => {
    if (!isHost || !allPlayersReady || startLoading) return;
    setStartLoading(true);

    socket.emit("startGame", (res) => {
      if (!res?.success) {
        setError(res?.error || "Failed to start game");
        setStartLoading(false);
      }
    });
  };

  const sendMessage = () => {
    if (!message.trim()) return;
    socket.emit("chatMessage", { message });
    setMessage("");
  };

  const exitLobby = () => {
    socket.disconnect();
    navigate("/");
  };

  /* ---------------- UI ---------------- */

  return (
    <div className="game-lobby">
      {error && (
        <div className="error-banner">
          <AlertCircle size={18} />
          <span>{error}</span>
          <button onClick={() => setError("")}>×</button>
        </div>
      )}

      {/* Header */}
      <header className="lobby-header">
        <div className="logo">
          <span className="dev">CODE</span>
          <span className="hunter">RED</span>
        </div>

        <div className="room-info">
          ROOM <b>{room?.code}</b>
          <span className={`status ${connected ? "on" : ""}`} />
        </div>

        <div className="header-actions">
          <button
            className="start-btn"
            disabled={!isHost || !allPlayersReady || startLoading}
            onClick={startGame}
          >
            {startLoading ? "STARTING..." : "START GAME"}
          </button>

          <button className="exit-btn" onClick={exitLobby}>
            <LogOut size={16} /> EXIT
          </button>
        </div>
      </header>

      {/* Body */}
      <main className="lobby-body">
        {/* Players Panel */}
        <section className="players-panel">
          <h2>
            PLAYERS ({readyCount}/{players.length})
          </h2>

          {players.map((p) => (
            <div key={p.id} className="player-row">
              <div className="avatar" style={{ background: p.color }}>
                {p.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="player-info">
                <span>{p.name}</span>
                {p.isHost && <span className="host-tag">HOST</span>}
              </div>
              <span className={`ready-dot ${p.isReady ? "ready" : ""}`} />
            </div>
          ))}

          {me && (
            <button className="ready-btn" onClick={toggleReady}>
              {readyLoading
                ? "UPDATING..."
                : me.isReady
                ? "✓ READY"
                : "READY"}
            </button>
          )}
        </section>

        {/* Right Panel */}
        <section className="info-panel">
          {/* Roles */}
          <div className="roles-grid">
            {ROLES_INFO.map((r) => (
              <div key={r.title} className="role-card">
                <span className="role-icon">{r.icon}</span>
                <h3 style={{ color: r.color }}>{r.title}</h3>
                <p>{r.description}</p>
              </div>
            ))}
          </div>

          {/* Chat */}
          <div className="chat-panel">
            <h3>
              <MessageCircle size={18} /> CHAT
            </h3>

            <div className="chat-messages">
              {chatMessages.map((m, i) => (
                <div key={i}>
                  <b style={{ color: m.color }}>{m.username}:</b> {m.message}
                </div>
              ))}
            </div>

            <div className="chat-input">
              <input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder="Type message..."
              />
              <button onClick={sendMessage}>
                <Send size={16} />
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* ---------------- CSS ---------------- */}
      <style>{`
@import url("https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700;900&family=Share+Tech+Mono&display=swap");

* { box-sizing: border-box; margin: 0; padding: 0; }

.game-lobby {
  min-height: 100vh;
  background: #0a0e1a;
  color: #fff;
  font-family: "Share Tech Mono", monospace;
}

/* Error */
.error-banner {
  position: fixed;
  top: 0; left: 0; right: 0;
  background: rgba(255,51,102,0.95);
  padding: 0.8rem 1.5rem;
  display: flex;
  gap: 0.8rem;
  z-index: 1000;
}
.error-banner button {
  margin-left: auto;
  background: none;
  border: none;
  color: white;
  font-size: 1.3rem;
  cursor: pointer;
}

/* Header */
.lobby-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 2rem;
  border-bottom: 2px solid rgba(0,255,136,0.3);
}
.logo {
  font-family: "Orbitron", sans-serif;
  font-size: 1.8rem;
}
.dev { color: #00ff88; }
.hunter { color: #ff3366; }

.room-info {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}
.status {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: #555;
}
.status.on { background: #00ff88; }

.header-actions {
  display: flex;
  gap: 1rem;
}

.start-btn, .exit-btn {
  padding: 0.5rem 1.4rem;
  border: 2px solid;
  background: transparent;
  font-family: "Orbitron", sans-serif;
  font-weight: 700;
  cursor: pointer;
}
.start-btn {
  border-color: #ffcc00;
  color: #ffcc00;
}
.start-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.exit-btn {
  border-color: #ff3366;
  color: #ff3366;
}

/* Layout */
.lobby-body {
  display: grid;
  grid-template-columns: 360px 1fr;
  gap: 2rem;
  padding: 2rem;
}

/* Players */
.players-panel {
  background: rgba(15,20,35,0.8);
  border: 2px solid rgba(0,221,255,0.3);
  border-radius: 8px;
  padding: 1.2rem;
}
.players-panel h2 {
  font-family: "Orbitron", sans-serif;
  color: #00ddff;
  margin-bottom: 1rem;
}
.player-row {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  padding: 0.6rem;
  margin-bottom: 0.5rem;
  border-radius: 6px;
  background: rgba(0,0,0,0.3);
}
.avatar {
  width: 42px; height: 42px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: "Orbitron", sans-serif;
}
.host-tag {
  font-size: 0.65rem;
  margin-left: 0.4rem;
  color: #ffcc00;
}
.ready-dot {
  width: 10px; height: 10px;
  border-radius: 50%;
  background: #555;
}
.ready-dot.ready {
  background: #00ff88;
  box-shadow: 0 0 8px rgba(0,255,136,0.8);
}
.ready-btn {
  margin-top: 1rem;
  width: 100%;
  padding: 0.8rem;
  border: 2px solid #00ff88;
  background: transparent;
  color: #00ff88;
  font-family: "Orbitron", sans-serif;
  cursor: pointer;
}

/* Info panel */
.info-panel {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* Roles */
.roles-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}
.role-card {
  background: rgba(15,20,35,0.8);
  border-radius: 8px;
  padding: 1.2rem;
}
.role-icon {
  font-size: 1.8rem;
}

/* Chat */
.chat-panel {
  background: rgba(15,20,35,0.8);
  border-radius: 8px;
  padding: 1.2rem;
  display: flex;
  flex-direction: column;
}
.chat-messages {
  flex: 1;
  overflow-y: auto;
  margin-bottom: 0.8rem;
}
.chat-input {
  display: flex;
  gap: 0.5rem;
}
.chat-input input {
  flex: 1;
  padding: 0.6rem;
  background: rgba(0,0,0,0.4);
  border: 1px solid rgba(255,255,255,0.2);
  color: white;
}
.chat-input button {
  background: #00ddff;
  border: none;
  padding: 0 1rem;
  cursor: pointer;
}

/* Responsive */
@media (max-width: 900px) {
  .lobby-body {
    grid-template-columns: 1fr;
  }
}
      `}</style>
    </div>
  );
}
