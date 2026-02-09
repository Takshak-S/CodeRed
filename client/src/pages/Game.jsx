import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import socket from '../socket';
import CodeEditor from '../components/CodeEditor';
import { Bell, LogOut } from 'lucide-react';

function Game() {
  const navigate = useNavigate();
  const location = useLocation();
  const { roomCode, playerId, playerName, room: initialRoom } = location.state || {};

  const [room, setRoom] = useState(initialRoom);
  const [code, setCode] = useState('');
  const [timeRemaining, setTimeRemaining] = useState(90);
  const [buzzedPlayerName, setBuzzedPlayerName] = useState(null);
  const [buzzedPlayerId, setBuzzedPlayerId] = useState(null);
  const [showVoteModal, setShowVoteModal] = useState(false);
  const [voteData, setVoteData] = useState(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [voteTimeRemaining, setVoteTimeRemaining] = useState(60);
  const [showFixModal, setShowFixModal] = useState(false);
  const [fixedCode, setFixedCode] = useState('');
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    if (!roomCode || !playerId || !room) {
      navigate('/');
      return;
    }

    if (room.currentCode) {
      if (getCurrentPlayer()?.role === 'bugger') {
        setCode(room.currentCode.currentBug.buggedCode);
      } else {
        setCode(room.currentCode.currentBug.buggedCode);
      }
    }

    // Socket event listeners
    socket.on('timerUpdate', ({ remaining }) => {
      setTimeRemaining(remaining);
    });

    socket.on('playerBuzzed', ({ playerId: buzzerId, playerName, vote }) => {
      setBuzzedPlayerName(playerName);
      setBuzzedPlayerId(buzzerId);
      setVoteData(vote);
      setShowVoteModal(true);
      setHasVoted(false);
      setVoteTimeRemaining(60);
    });

    socket.on('buzzVoteUpdated', ({ vote }) => {
      setVoteData(vote);
    });

    socket.on('voteTimeUpdate', ({ remaining }) => {
      setVoteTimeRemaining(remaining);
    });

    socket.on('buzzVoteEnded', ({
      shouldKick,
      kickedPlayerName,
      maxVotes,
      voteCount,
      hasClearMajority,
      reason,
    }) => {
      setShowVoteModal(false);
      setBuzzedPlayerName(null);
      setBuzzedPlayerId(null);
      setHasVoted(false);

      if (shouldKick && hasClearMajority) {
        alert(`${kickedPlayerName} was disabled with ${maxVotes} votes!`);
      } else if (!hasClearMajority) {
        alert(reason || 'No clear majority - game continues!');
      }
    });

    socket.on('playerDisabled', ({ playerId: disabledId, playerName, room: updatedRoom }) => {
      setRoom(updatedRoom);
      if (disabledId === playerId) {
        alert(`You were disabled and can no longer buzz or vote!`);
      }
    });

    socket.on('voteCancelled', ({ reason }) => {
      setShowVoteModal(false);
      setBuzzedPlayerName(null);
      setBuzzedPlayerId(null);
      setHasVoted(false);
      if (reason) {
        alert(`Vote cancelled: ${reason}`);
      }
    });

    socket.on('codeUpdated', ({ code: newCode }) => {
      setCode(newCode);
    });

    socket.on('fixSubmitted', ({ playerId: submitterId, isCorrect, correctCode, bugDescription }) => {
      setFeedback({
        isCorrect,
        correctCode,
        bugDescription,
        submittedBy: submitterId
      });
      setBuzzedPlayerName(null);
      setBuzzedPlayerId(null);
      setShowVoteModal(false);
      setShowFixModal(false);

      setTimeout(() => {
        setFeedback(null);
      }, 5000);
    });

    socket.on('roundEnded', ({ room: updatedRoom }) => {
      setRoom(updatedRoom);
    });

    socket.on('roundStarted', ({ room: updatedRoom }) => {
      setRoom(updatedRoom);
      setBuzzedPlayerName(null);
      setBuzzedPlayerId(null);
      setShowVoteModal(false);
      setVoteData(null);
      setHasVoted(false);
      setShowFixModal(false);
      setFeedback(null);
      
      if (updatedRoom.currentCode) {
        const currentPlayer = updatedRoom.players.find((p) => p.id === playerId);
        if (currentPlayer?.role === 'bugger') {
          setCode(updatedRoom.currentCode.currentBug.buggedCode);
        } else {
          setCode(updatedRoom.currentCode.currentBug.buggedCode);
        }
      }
    });

    socket.on('gameEnded', ({ room: updatedRoom, winner, reason }) => {
      navigate('/result', {
        state: {
          roomCode,
          playerId,
          playerName,
          room: updatedRoom,
          winner,
          reason
        }
      });
    });

    socket.on('playerLeft', ({ room: updatedRoom }) => {
      setRoom(updatedRoom);
    });

    return () => {
      socket.off('timerUpdate');
      socket.off('playerBuzzed');
      socket.off('buzzVoteUpdated');
      socket.off('voteTimeUpdate');
      socket.off('buzzVoteEnded');
      socket.off('playerDisabled');
      socket.off('voteCancelled');
      socket.off('codeUpdated');
      socket.off('fixSubmitted');
      socket.off('roundEnded');
      socket.off('roundStarted');
      socket.off('gameEnded');
      socket.off('playerLeft');
    };
  }, [roomCode, playerId, navigate, room, code, playerName]);

  const getCurrentPlayer = () => {
    return room?.players.find((p) => p.id === playerId);
  };

  const handleBuzz = () => {
    socket.emit('buzz', (response) => {
      if (!response.success) {
        alert(response.error || 'Failed to buzz');
      }
    });
  };

  const handleCastVote = (targetPlayerId) => {
    socket.emit('castBuzzVote', { targetPlayerId }, (response) => {
      if (!response.success) {
        alert(response.error || 'Failed to vote');
      } else {
        setHasVoted(true);
      }
    });
  };

  const handleSkipVote = () => {
    socket.emit('castBuzzVote', { targetPlayerId: 'skip' }, (response) => {
      if (!response.success) {
        alert(response.error || 'Failed to skip');
      } else {
        setHasVoted(true);
      }
    });
  };

  const handleSubmitFix = () => {
    socket.emit('submitFix', { fixedCode }, (response) => {
      if (!response.success) {
        alert('Failed to submit fix');
      }
    });
  };

  const handleCodeChange = (newCode) => {
    setCode(newCode);
    
    if (getCurrentPlayer()?.role === 'bugger') {
      socket.emit('submitBug', { buggedCode: newCode });
    }
  };

  const handleLeaveRoom = () => {
    if (window.confirm('Are you sure you want to leave the game?')) {
      socket.disconnect();
      navigate('/');
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  if (!room) {
    return (
      <div className="game-container">
        <div className="loading">Loading game...</div>
        <style jsx>{`
          .game-container {
            min-height: 100vh;
            background: linear-gradient(135deg, #0a0e27 0%, #1a1f3a 100%);
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .loading {
            color: #00ff88;
            font-size: 20px;
            font-family: 'Share Tech Mono', monospace;
          }
        `}</style>
      </div>
    );
  }

  const currentPlayer = getCurrentPlayer();
  const isBugger = currentPlayer?.role === 'bugger';
  const isDisabled = currentPlayer?.disabled;
  const canBuzz = !isBugger && !buzzedPlayerName && !isDisabled;

  const bugsList = room.currentCode?.currentBug ? [
    { id: 1, title: room.currentCode.currentBug.description, location: room.currentCode.title }
  ] : [];

  const playerColors = ['#00ddff', '#00ff88', '#dd00ff', '#ffcc00', '#ff9900', '#ff3366'];

  return (
    <div className="game-container">
      <div className="top-bar">
        <div className="left">
          <span className="title">CODERED</span>
          <span className="status">● ROUND {room.currentRound}/{room.totalRounds}</span>
        </div>
        <div className="right">
          <span className="room-code">ROOM: #{roomCode}</span>
          <span className={`role-badge ${isBugger ? 'bugger' : 'debugger'}`}>
            {isBugger ? '🐛 BUGGER' : '🔍 DEBUGGER'}
          </span>
          {isDisabled && <span className="disabled-badge">❌ DISABLED</span>}
        </div>
      </div>

      <div className="game-header">
        <div className="timer-display">
          <span className="timer-icon">⏱</span>
          <span className="timer-text">{formatTime(timeRemaining)}</span>
        </div>

        <div className="header-right">
          <div className="players-display">
            {room.players.slice(0, 6).map((player, idx) => (
              <div
                key={player.id}
                className={`player-dot ${player.disabled ? 'disabled' : ''}`}
                style={{ backgroundColor: player.disabled ? '#666' : playerColors[idx] }}
                title={`${player.name}${player.disabled ? ' (disabled)' : ''}`}
              />
            ))}
          </div>

          <div className="bugs-counter">
            <span className="bug-emoji">🐛</span>
            <span className="count">{bugsList.length}</span>
            <span className="label">BUGS</span>
          </div>
        </div>
      </div>

      <div className="main-content">
        <div className="left-panel">
          <div className="bugs-panel">
            <div className="panel-header">
              <span className="icon">🐛</span>
              <span>CURRENT BUG</span>
            </div>
            <div className="bugs-list">
              {bugsList.map(bug => (
                <div key={bug.id} className="bug-item">
                  <span className="bug-icon">🐛</span>
                  <div className="bug-info">
                    <div className="bug-title">{bug.title}</div>
                    <div className="bug-location">in {bug.location}</div>
                  </div>
                </div>
              ))}
              {bugsList.length === 0 && (
                <div className="no-bugs">No bugs to display</div>
              )}
            </div>
          </div>

          {isBugger && (
            <div className="tools-panel">
              <div className="panel-header purple">
                <span className="icon">🔧</span>
                <span>BUGGER TOOLS</span>
              </div>
              <div className="tools-content">
                <p className="tools-text">Edit the code to introduce subtle bugs:</p>
                <div className="tool-info">
                  <span className="info-icon">💡</span>
                  <span>Real-time editing enabled</span>
                </div>
              </div>
            </div>
          )}

          {!isBugger && !isDisabled && (
            <div className="info-panel">
              <div className="panel-header">
                <span className="icon">ℹ️</span>
                <span>GAME INFO</span>
              </div>
              <div className="info-content">
                <div className="info-item">
                  <span className="info-label">Your Role:</span>
                  <span className="info-value">Debugger</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Status:</span>
                  <span className="info-value">{buzzedPlayerName ? 'Voting...' : 'Active'}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="center-panel">
          <div className="code-editor-container">
            {room.currentCode && (
              <CodeEditor
                code={code}
                onChange={handleCodeChange}
                readOnly={!isBugger && !showFixModal}
                language={room.currentCode.language}
                height="calc(100vh - 180px)"
              />
            )}
          </div>
        </div>
      </div>

      {!isBugger && !isDisabled && (
        <div className="buzzer-section">
          <button
            className={`buzzer-button ${!canBuzz ? 'disabled' : ''}`}
            onClick={handleBuzz}
            disabled={!canBuzz}
          >
            <Bell size={40} />
          </button>
          <div className="buzzer-text">
            {buzzedPlayerName 
              ? `${buzzedPlayerName} buzzed!` 
              : 'Press to start voting'}
          </div>
          <button className="leave-btn" onClick={handleLeaveRoom}>
            <LogOut size={18} />
            LEAVE ROOM
          </button>
        </div>
      )}

      {/* Vote Modal */}
      {showVoteModal && voteData && (
        <div className="modal-overlay">
          <div className="modal-content vote-modal">
            <h2>🗳️ VOTE TO KICK A PLAYER</h2>
            <p className="modal-subtitle">
              <strong>{buzzedPlayerName}</strong> buzzed! Vote for who to kick, or skip.
            </p>

            {isDisabled ? (
              <div className="disabled-message">
                <span className="icon">❌</span>
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
                  {room.players
                    .filter((p) => p.id !== playerId && !p.disabled)
                    .map((player, idx) => (
                      <button
                        key={player.id}
                        onClick={() => handleCastVote(player.id)}
                        className={`vote-player-btn ${hasVoted ? 'disabled' : ''}`}
                        disabled={hasVoted}
                        style={{ borderColor: playerColors[idx] }}
                      >
                        <span className="player-indicator" style={{ backgroundColor: playerColors[idx] }}></span>
                        {player.name}
                        {player.role === 'bugger' && <span className="role-icon">🐛</span>}
                      </button>
                    ))}
                </div>

                <button
                  onClick={handleSkipVote}
                  className={`skip-vote-btn ${hasVoted ? 'disabled' : ''}`}
                  disabled={hasVoted}
                >
                  ⏭️ SKIP VOTE
                </button>

                {hasVoted && (
                  <p className="voted-message">
                    ✓ Your vote has been recorded. Waiting for others...
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Fix Modal */}
      {showFixModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Submit Your Fix</h2>
            <p>Edit the code below to fix the bug you found:</p>
            <CodeEditor
              code={fixedCode}
              onChange={setFixedCode}
              language={room.currentCode.language}
              height="400px"
            />
            <div className="modal-actions">
              <button onClick={handleSubmitFix} className="submit-btn">
                Submit Fix
              </button>
              <button onClick={() => setShowFixModal(false)} className="cancel-btn">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feedback */}
      {feedback && (
        <div className={`feedback ${feedback.isCorrect ? 'success' : 'error'}`}>
          <div className="feedback-title">
            {feedback.isCorrect ? '✅ Correct Fix!' : '❌ Incorrect Fix'}
          </div>
          <div className="feedback-text">
            <strong>Bug:</strong> {feedback.bugDescription}
          </div>
        </div>
      )}

      <style jsx>{`
        @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap');

        .game-container {
          min-height: 100vh;
          background: linear-gradient(135deg, #0a0e27 0%, #1a1f3a 100%);
          color: #00ff88;
          font-family: 'Share Tech Mono', monospace;
          position: relative;
          overflow: hidden;
        }

        .top-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 15px 30px;
          border-bottom: 2px solid #00ff88;
          background: rgba(0, 255, 136, 0.05);
        }

        .top-bar .left {
          display: flex;
          align-items: center;
          gap: 15px;
        }

        .top-bar .title {
          font-size: 20px;
          font-weight: bold;
          letter-spacing: 2px;
          color: #00ff88;
          text-shadow: 0 0 10px #00ff88;
        }

        .top-bar .status {
          font-size: 12px;
          color: #00ddff;
        }

        .top-bar .right {
          display: flex;
          align-items: center;
          gap: 15px;
        }

        .top-bar .room-code {
          font-size: 14px;
          color: #999;
        }

        .top-bar .role-badge {
          padding: 5px 15px;
          border-radius: 3px;
          font-size: 12px;
          font-weight: bold;
        }

        .top-bar .role-badge.bugger {
          background: #ff3366;
          color: #fff;
        }

        .top-bar .role-badge.debugger {
          background: #00ff88;
          color: #0a0e27;
        }

        .top-bar .disabled-badge {
          background: #666;
          color: #fff;
          padding: 5px 15px;
          border-radius: 3px;
          font-size: 12px;
        }

        .game-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 15px 20px;
          gap: 20px;
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: 15px;
        }

        .main-content {
          display: grid;
          grid-template-columns: 280px 1fr;
          gap: 20px;
          padding: 20px;
          height: calc(100vh - 140px);
        }

        .left-panel {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .bugs-panel, .tools-panel, .info-panel {
          border: 2px solid #00ff88;
          border-radius: 8px;
          background: rgba(0, 255, 136, 0.05);
          overflow: hidden;
        }

        .tools-panel {
          border-color: #dd00ff;
          background: rgba(221, 0, 255, 0.05);
        }

        .panel-header {
          background: rgba(0, 255, 136, 0.1);
          padding: 12px 15px;
          display: flex;
          align-items: center;
          gap: 10px;
          border-bottom: 2px solid #00ff88;
          font-size: 12px;
          font-weight: bold;
          letter-spacing: 1px;
        }

        .panel-header.purple {
          background: rgba(221, 0, 255, 0.1);
          border-bottom-color: #dd00ff;
          color: #dd00ff;
        }

        .panel-header .icon {
          font-size: 16px;
        }

        .bugs-list {
          padding: 15px;
          display: flex;
          flex-direction: column;
          gap: 15px;
        }

        .bug-item {
          display: flex;
          gap: 10px;
          align-items: flex-start;
        }

        .bug-icon {
          font-size: 20px;
          flex-shrink: 0;
        }

        .bug-info {
          flex: 1;
        }

        .bug-title {
          color: #00ff88;
          font-size: 11px;
          line-height: 1.4;
          margin-bottom: 3px;
        }

        .bug-location {
          color: #666;
          font-size: 10px;
        }

        .no-bugs {
          color: #666;
          font-size: 11px;
          text-align: center;
          padding: 20px;
        }

        .tools-content, .info-content {
          padding: 15px;
        }

        .tools-text {
          color: #999;
          font-size: 11px;
          margin-bottom: 15px;
          line-height: 1.5;
        }

        .tool-info {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #dd00ff;
          font-size: 10px;
        }

        .info-icon {
          font-size: 14px;
        }

        .info-item {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid rgba(0, 255, 136, 0.1);
          font-size: 11px;
        }

        .info-label {
          color: #999;
        }

        .info-value {
          color: #00ff88;
          font-weight: bold;
        }

        .center-panel {
          display: flex;
          flex-direction: column;
          gap: 15px;
        }

        .timer-display {
          border: 2px solid #00ddff;
          border-radius: 8px;
          padding: 10px 25px;
          display: flex;
          align-items: center;
          gap: 10px;
          background: rgba(0, 221, 255, 0.05);
        }

        .timer-icon {
          font-size: 20px;
        }

        .timer-text {
          font-size: 24px;
          font-weight: bold;
          color: #00ddff;
          letter-spacing: 2px;
        }

        .code-editor-container {
          flex: 1;
          border: 2px solid #00ff88;
          border-radius: 8px;
          overflow: hidden;
          background: #1e1e1e;
        }

        .players-display {
          display: flex;
          gap: 8px;
        }

        .player-dot {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: 2px solid rgba(255, 255, 255, 0.3);
          box-shadow: 0 0 10px currentColor;
          transition: all 0.3s ease;
        }

        .player-dot.disabled {
          opacity: 0.3;
          box-shadow: none;
        }

        .bugs-counter {
          border: 2px solid #ffcc00;
          border-radius: 8px;
          padding: 8px 20px;
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(255, 204, 0, 0.05);
        }

        .bugs-counter .bug-emoji {
          font-size: 20px;
        }

        .bugs-counter .count {
          font-size: 20px;
          font-weight: bold;
          color: #ffcc00;
        }

        .bugs-counter .label {
          font-size: 12px;
          color: #ffcc00;
          letter-spacing: 1px;
        }

        .buzzer-section {
          position: fixed;
          bottom: 30px;
          left: 30px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 15px;
          z-index: 100;
        }

        .buzzer-button {
          width: 120px;
          height: 120px;
          border-radius: 50%;
          border: 4px solid #ff3366;
          background: radial-gradient(circle, #ff6b6b 0%, #ff3366 50%, #cc0033 100%);
          color: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s ease;
          box-shadow: 0 0 40px rgba(255, 51, 102, 0.6),
                      inset 0 0 20px rgba(255, 255, 255, 0.2);
        }

        .buzzer-button:hover:not(.disabled) {
          transform: scale(1.05);
          box-shadow: 0 0 50px rgba(255, 51, 102, 0.8),
                      inset 0 0 25px rgba(255, 255, 255, 0.3);
        }

        .buzzer-button:active:not(.disabled) {
          transform: scale(0.95);
        }

        .buzzer-button.disabled {
          opacity: 0.5;
          cursor: not-allowed;
          background: #666;
          border-color: #444;
          box-shadow: none;
        }

        .buzzer-text {
          color: #999;
          font-size: 11px;
          text-align: center;
          max-width: 150px;
        }

        .leave-btn {
          background: transparent;
          border: 2px solid #ff3366;
          color: #ff3366;
          padding: 10px 20px;
          border-radius: 5px;
          font-family: 'Share Tech Mono', monospace;
          font-size: 11px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.3s ease;
        }

        .leave-btn:hover {
          background: rgba(255, 51, 102, 0.1);
          box-shadow: 0 0 15px rgba(255, 51, 102, 0.5);
        }

        .modal-overlay {
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

        .modal-content {
          background: #1a1f3a;
          border: 2px solid #00ff88;
          border-radius: 8px;
          padding: 30px;
          max-width: 800px;
          width: 100%;
          max-height: 90vh;
          overflow: auto;
        }

        .modal-content h2 {
          color: #00ff88;
          font-size: 24px;
          margin-bottom: 10px;
          text-shadow: 0 0 10px #00ff88;
        }

        .modal-content p {
          color: #999;
          font-size: 14px;
          margin-bottom: 20px;
        }

        .modal-subtitle {
          font-size: 13px;
          line-height: 1.5;
        }

        .vote-modal h2 {
          text-align: center;
          margin-bottom: 15px;
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
          font-family: 'Share Tech Mono', monospace;
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
          font-family: 'Share Tech Mono', monospace;
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

        .modal-actions {
          display: flex;
          gap: 15px;
          margin-top: 20px;
        }

        .submit-btn, .cancel-btn {
          flex: 1;
          padding: 15px;
          border-radius: 5px;
          font-family: 'Share Tech Mono', monospace;
          font-size: 14px;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .submit-btn {
          background: #00ff88;
          border: none;
          color: #0a0e27;
        }

        .submit-btn:hover {
          box-shadow: 0 0 20px rgba(0, 255, 136, 0.5);
        }

        .cancel-btn {
          background: transparent;
          border: 2px solid #666;
          color: #999;
        }

        .cancel-btn:hover {
          border-color: #00ff88;
          color: #00ff88;
        }

        .feedback {
          position: fixed;
          top: 80px;
          right: 30px;
          padding: 20px;
          border-radius: 8px;
          max-width: 350px;
          z-index: 200;
          animation: slideIn 0.3s ease;
        }

        .feedback.success {
          background: rgba(0, 255, 136, 0.1);
          border: 2px solid #00ff88;
          color: #00ff88;
        }

        .feedback.error {
          background: rgba(255, 51, 102, 0.1);
          border: 2px solid #ff3366;
          color: #ff3366;
        }

        .feedback-title {
          font-size: 16px;
          font-weight: bold;
          margin-bottom: 10px;
        }

        .feedback-text {
          font-size: 12px;
          color: #999;
        }

        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }

        @media (max-width: 1024px) {
          .main-content {
            grid-template-columns: 1fr;
          }

          .vote-players {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

export default Game;