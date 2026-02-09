// PlayerList component
import React from "react";

function PlayerList({
  players,
  hostId,
  currentPlayerId,
  scores,
  showRoles = false,
}) {
  return (
    <div style={styles.container}>
      <h3 style={styles.title}>Players ({players.length})</h3>
      <div style={styles.playerList}>
        {players.map((player) => (
          <div
            key={player.id}
            style={{
              ...styles.playerCard,
              ...(player.id === currentPlayerId ? styles.currentPlayer : {}),
              ...(player.disabled ? styles.disabledPlayer : {}),
            }}
          >
            <div style={styles.playerInfo}>
              <div style={styles.playerName}>
                {player.name}
                {player.disabled && (
                  <span style={styles.disabledBadge}>🚫 Disabled</span>
                )}
                {player.id === hostId && (
                  <span style={styles.hostBadge}>👑 Host</span>
                )}
                {player.id === currentPlayerId && (
                  <span style={styles.youBadge}>You</span>
                )}
              </div>

              {showRoles && player.role && (
                <div style={styles.role}>
                  {player.role === "bugger" ? "🐛 Bugger" : "🔍 Debugger"}
                </div>
              )}

              {scores && (
                <div style={styles.score}>Score: {scores[player.id] || 0}</div>
              )}
            </div>

            {player.isReady && <div style={styles.readyBadge}>✓ Ready</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  container: {
    backgroundColor: "white",
    borderRadius: "12px",
    padding: "20px",
    boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
  },
  title: {
    fontSize: "20px",
    fontWeight: "bold",
    marginBottom: "15px",
    color: "#1f2937",
  },
  playerList: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  playerCard: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 16px",
    backgroundColor: "#f9fafb",
    borderRadius: "8px",
    border: "2px solid transparent",
    transition: "all 0.2s",
  },
  currentPlayer: {
    backgroundColor: "#ede9fe",
    border: "2px solid #8b5cf6",
  },
  disabledPlayer: {
    backgroundColor: "#f3f4f6",
    border: "2px solid #ef4444",
    opacity: 0.6,
  },
  playerInfo: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  playerName: {
    fontSize: "16px",
    fontWeight: "600",
    color: "#1f2937",
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  hostBadge: {
    fontSize: "12px",
    color: "#f59e0b",
    fontWeight: "normal",
  },
  disabledBadge: {
    fontSize: "12px",
    color: "#ef4444",
    fontWeight: "bold",
  },
  youBadge: {
    fontSize: "12px",
    color: "#8b5cf6",
    fontWeight: "normal",
  },
  role: {
    fontSize: "14px",
    color: "#6b7280",
    fontWeight: "500",
  },
  score: {
    fontSize: "14px",
    color: "#059669",
    fontWeight: "600",
  },
  readyBadge: {
    padding: "4px 12px",
    backgroundColor: "#10b981",
    color: "white",
    borderRadius: "12px",
    fontSize: "12px",
    fontWeight: "600",
  },
};

export default PlayerList;
