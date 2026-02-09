import React from "react";
import { X, Check, SkipForward } from "lucide-react";

const PLAYER_COLORS = [
  "#00ddff",
  "#00ff88",
  "#dd00ff",
  "#ffcc00",
  "#ff9900",
  "#ff3366",
];

function VoteModal({
  isOpen,
  voteData,
  voteTimeRemaining,
  buzzedPlayerName,
  players,
  currentPlayerId,
  isDisabled,
  hasVoted,
  onCastVote,
  onSkipVote,
}) {
  if (!isOpen || !voteData) return null;

  // Filter out current player and disabled players from voting options
  const votablePlayers = players.filter(
    (p) => p.id !== currentPlayerId && !p.disabled,
  );

  return (
    <div className="vote-modal-overlay">
      <div className="vote-modal-content">
        <h2>VOTE TO KICK A PLAYER</h2>
        <p className="vote-modal-subtitle">
          <strong>{buzzedPlayerName}</strong> buzzed! Vote for who to kick, or
          skip.
        </p>

        {isDisabled ? (
          <div className="disabled-message">
            <X size={32} className="icon" />
            <p>You are disabled and cannot vote</p>
          </div>
        ) : (
          <>
            <div className="vote-stats">
              <div className="stat">
                <div className="stat-value">{voteData.votedCount || 0}</div>
                <div className="stat-label">Votes Cast</div>
              </div>
              <div className="stat">
                <div className="stat-value">{voteData.skipCount || 0}</div>
                <div className="stat-label">Skipped</div>
              </div>
              <div className="stat">
                <div className="stat-value">{voteTimeRemaining}s</div>
                <div className="stat-label">Remaining</div>
              </div>
            </div>

            <div className="vote-players">
              {votablePlayers.map((player, idx) => (
                <button
                  key={player.id}
                  onClick={() => onCastVote(player.id)}
                  className={`vote-player-btn ${hasVoted ? "disabled" : ""}`}
                  disabled={hasVoted}
                  style={{
                    borderColor: PLAYER_COLORS[idx % PLAYER_COLORS.length],
                  }}
                >
                  <span
                    className="player-indicator"
                    style={{
                      backgroundColor:
                        PLAYER_COLORS[idx % PLAYER_COLORS.length],
                    }}
                  />
                  {player.name}
                </button>
              ))}
            </div>

            <button
              onClick={onSkipVote}
              className={`skip-vote-btn ${hasVoted ? "disabled" : ""}`}
              disabled={hasVoted}
            >
              <SkipForward
                size={14}
                style={{ display: "inline", marginRight: "6px" }}
              />{" "}
              SKIP VOTE
            </button>

            {hasVoted && (
              <p className="voted-message">
                <Check
                  size={14}
                  style={{ display: "inline", marginRight: "6px" }}
                />{" "}
                Your vote has been recorded. Waiting for others...
              </p>
            )}
          </>
        )}
      </div>

      <style jsx>{`
        .vote-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.9);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
          backdrop-filter: blur(10px);
        }

        .vote-modal-content {
          background: #1a1f3a;
          border: 2px solid #00ff88;
          border-radius: 8px;
          padding: 30px;
          max-width: 600px;
          width: 100%;
          max-height: 90vh;
          overflow: auto;
          font-family: "Share Tech Mono", monospace;
        }

        .vote-modal-content h2 {
          color: #00ff88;
          font-size: 24px;
          margin-bottom: 10px;
          text-shadow: 0 0 10px #00ff88;
          text-align: center;
        }

        .vote-modal-subtitle {
          color: #999;
          font-size: 13px;
          line-height: 1.5;
          text-align: center;
          margin-bottom: 20px;
        }

        .vote-stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 15px;
          margin-bottom: 25px;
          padding: 20px;
          background: rgba(0, 255, 136, 0.05);
          border-radius: 8px;
        }

        .stat {
          text-align: center;
        }

        .stat-value {
          font-size: 28px;
          font-weight: bold;
          color: #00ddff;
          margin-bottom: 5px;
        }

        .stat-label {
          font-size: 10px;
          color: #666;
          letter-spacing: 1px;
        }

        .vote-players {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          margin-bottom: 20px;
        }

        .vote-player-btn {
          background: rgba(0, 221, 255, 0.05);
          border: 2px solid #00ddff;
          color: #00ddff;
          padding: 15px;
          border-radius: 6px;
          font-family: "Share Tech Mono", monospace;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .vote-player-btn:hover:not(.disabled) {
          background: rgba(0, 221, 255, 0.15);
          box-shadow: 0 0 15px rgba(0, 221, 255, 0.3);
          transform: translateY(-2px);
        }

        .vote-player-btn.disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }

        .player-indicator {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .role-icon {
          margin-left: auto;
          font-size: 16px;
        }

        .skip-vote-btn {
          width: 100%;
          background: rgba(255, 204, 0, 0.1);
          border: 2px solid #ffcc00;
          color: #ffcc00;
          padding: 15px;
          border-radius: 6px;
          font-family: "Share Tech Mono", monospace;
          font-size: 12px;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .skip-vote-btn:hover:not(.disabled) {
          background: rgba(255, 204, 0, 0.2);
          box-shadow: 0 0 15px rgba(255, 204, 0, 0.3);
        }

        .skip-vote-btn.disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }

        .voted-message {
          margin-top: 20px;
          text-align: center;
          color: #00ff88;
          font-size: 12px;
          padding: 15px;
          background: rgba(0, 255, 136, 0.1);
          border-radius: 6px;
          animation: pulse 2s infinite;
        }

        .disabled-message {
          padding: 30px;
          background: rgba(255, 51, 102, 0.1);
          border: 2px solid #ff3366;
          border-radius: 8px;
          text-align: center;
        }

        .disabled-message .icon {
          font-size: 48px;
          display: block;
          margin-bottom: 15px;
        }

        .disabled-message p {
          color: #ff3366;
          font-size: 14px;
          margin: 0;
        }

        @keyframes pulse {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.7;
          }
        }

        @media (max-width: 600px) {
          .vote-players {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

export default VoteModal;
