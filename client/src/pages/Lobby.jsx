import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MessageCircle, Send, LogOut, AlertCircle } from 'lucide-react';
import socket from '../socket';

const GameLobby = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [message, setMessage] = useState('');
  const [currentPlayerReady, setCurrentPlayerReady] = useState(false);
  const [gameStarting, setGameStarting] = useState(false);
  const [error, setError] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isHost, setIsHost] = useState(false);
  
  const [chatMessages, setChatMessages] = useState([]);
  const [players, setPlayers] = useState([]);

  const colors = ['#00ff88', '#00ddff', '#dd00ff', '#ffcc00', '#ff9900', '#ff3366'];

  const roles = [
    { 
      title: 'Fixers', 
      description: 'Write clean code and catch the bugger before time runs out',
      icon: '</>', 
      color: '#00ddff',
      bgColor: 'rgba(0, 221, 255, 0.05)'
    },
    { 
      title: 'SABOTEUR', 
      description: 'Inject subtle bugs and survive until the timer ends',
      icon: '🐛', 
      color: '#ff3366',
      bgColor: 'rgba(255, 51, 102, 0.05)'
    },
    { 
      title: 'TIMER', 
      description: '14 minutes to complete tasks and identify the bugger',
      icon: '⏱', 
      color: '#00ff88',
      bgColor: 'rgba(0, 255, 136, 0.05)'
    },
    { 
      title: 'BUZZER', 
      description: "Press to accuse and review code. Wrong? You're penalized!",
      icon: '🔔', 
      color: '#ffcc00',
      bgColor: 'rgba(255, 204, 0, 0.05)'
    }
  ];

  // Initialize socket connection and join room
  useEffect(() => {
    const roomInfo = location.state;
    
    if (!roomInfo || !roomInfo.roomCode || !roomInfo.playerName) {
      // Redirect to landing if no room info
      navigate('/');
      return;
    }

    setRoomCode(roomInfo.roomCode);

    // Connect to socket if not already connected
    if (!socket.connected) {
      socket.connect();
    }

    socket.on('connect', () => {
      setIsConnected(true);
      console.log('Connected to server');

      // Join or create room
      if (roomInfo.isCreating) {
        socket.emit('createRoom', { playerName: roomInfo.playerName }, (response) => {
          if (response.success) {
            setPlayerId(response.playerId);
            setRoomCode(response.roomCode);
            setIsHost(true);
            handleRoomUpdate(response.room);
            setChatMessages([{ username: 'System', message: `Room ${response.roomCode} created!`, color: '#00ff88' }]);
          } else {
            setError(response.error || 'Failed to create room');
          }
        });
      } else {
        socket.emit('joinRoom', { roomCode: roomInfo.roomCode, playerName: roomInfo.playerName }, (response) => {
          console.log('Join room response:', response);
          if (response.success) {
            setPlayerId(response.playerId);
            console.log('Joined successfully. PlayerId:', response.playerId);
            console.log('Room data:', response.room);
            handleRoomUpdate(response.room);
            setChatMessages([{ username: 'System', message: `Joined room ${response.playerId.substring(0, 8)}!`, color: '#00ddff' }]);
          } else {
            setError(response.error || 'Failed to join room');
            setTimeout(() => navigate('/'), 2000);
          }
        });
      }
    });

    // Listen for room updates
    socket.on('roomUpdated', ({ room }) => {
      handleRoomUpdate(room);
    });

    socket.on('playerJoined', ({ player, room }) => {
      handleRoomUpdate(room);
      setChatMessages(prev => [...prev, { 
        username: 'System', 
        message: `${player.name} joined the lobby`, 
        color: '#00ff88' 
      }]);
    });

    socket.on('playerLeft', ({ playerId: leftPlayerId, room }) => {
      handleRoomUpdate(room);
      setChatMessages(prev => [...prev, { 
        username: 'System', 
        message: `A player left the lobby`, 
        color: '#ff3366' 
      }]);
    });

    socket.on('gameStarted', ({ room }) => {
      setGameStarting(false);
      navigate('/game', { state: { room, playerId } });
    });

    socket.on('chatMessage', ({ username, message: msg, color }) => {
      setChatMessages(prev => [...prev, { username, message: msg, color }]);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      setError('Disconnected from server');
    });

    socket.on('connect_error', (error) => {
      setError('Connection error: ' + error.message);
    });

    return () => {
      socket.off('connect');
      socket.off('roomUpdated');
      socket.off('playerJoined');
      socket.off('playerLeft');
      socket.off('gameStarted');
      socket.off('chatMessage');
      socket.off('disconnect');
      socket.off('connect_error');
    };
  }, [navigate, location]);

  const handleRoomUpdate = (room) => {
    console.log('Room update received:', room);
    
    if (!room || !room.players) {
      console.error('Invalid room data:', room);
      setError('Invalid room data received from server');
      return;
    }

    const playersArray = Array.isArray(room.players) ? room.players : Object.values(room.players);
    console.log('Players array:', playersArray);

    const playerList = playersArray.map((player, idx) => ({
      ...player,
      color: colors[idx % colors.length],
      bgColor: `rgba(${parseInt(colors[idx % colors.length].slice(1, 3), 16)}, ${parseInt(colors[idx % colors.length].slice(3, 5), 16)}, ${parseInt(colors[idx % colors.length].slice(5, 7), 16)}, 0.1)`,
      border: colors[idx % colors.length]
    }));
    
    console.log('Player list with colors:', playerList);
    
    // Update current player ready status
    const currentPlayer = playerList.find(p => p.id === playerId);
    if (currentPlayer) {
      console.log('Current player found:', currentPlayer);
      setCurrentPlayerReady(currentPlayer.isReady);
    } else {
      console.warn('Current player not found in list. PlayerId:', playerId);
    }

    setPlayers(playerList);
    setIsHost(room.hostId === playerId);
  };

  const sendMessage = () => {
    if (message.trim()) {
      socket.emit('chatMessage', { message });
      setMessage('');
    }
  };

  const handleExitLobby = () => {
    if (window.confirm('Are you sure you want to leave the lobby?')) {
      socket.disconnect();
      navigate('/');
    }
  };

  const handleStartGame = () => {
    if (allPlayersReady && isHost) {
      setGameStarting(true);
      socket.emit('startGame', (response) => {
        if (!response.success) {
          setError(response.error || 'Failed to start game');
          setGameStarting(false);
        }
      });
    }
  };

  const handleToggleReady = () => {
    socket.emit('playerReady', (response) => {
      if (!response || !response.success) {
        setError('Failed to update ready status');
      }
    });
  };

  const allPlayersReady = players.length > 0 && players.every(p => p.isReady);
  const readyCount = players.filter(p => p.isReady).length;

  return (
    <div className="game-lobby">
      {/* Animated Background */}
      <div className="stars"></div>
      <div className="stars2"></div>
      <div className="stars3"></div>

      {/* Error Banner */}
      {error && (
        <div className="error-banner">
          <AlertCircle size={20} />
          <span>{error}</span>
          <button onClick={() => setError('')}>×</button>
        </div>
      )}

      {/* Header */}
      <header className="lobby-header">
        <div className="logo">
          <span className="dev">CODE</span>
          <span className="hunter">RED</span>
        </div>
        <div className="header-room">
          <span className="room-label">ROOM:</span>
          <span className="room-code">{roomCode}</span>
          <span className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}></span>
        </div>
        <div className="header-controls">
          <button 
            className="boom-btn"
            disabled={!allPlayersReady || gameStarting || !isHost}
            onClick={handleStartGame}
            title={!isHost ? 'Only host can start' : allPlayersReady ? 'Start the game' : 'Wait for all players'}
          >
            {gameStarting ? 'STARTING...' : 'START GAME'}
          </button>
          <button 
            className="exit-btn"
            onClick={handleExitLobby}
            title="Leave the lobby"
          >
            <LogOut size={18} style={{ marginRight: '0.5rem' }} />
            EXIT
          </button>
        </div>
      </header>

      <div className="lobby-container">
        {/* Left Panel - Players */}
        <div className="players-panel">
          <div className="panel-header">
            <h2>PLAYERS ({readyCount}/{players.length})</h2>
            <span className="player-count">{readyCount}/{players.length}</span>
          </div>
          <div className="players-list">
            {players.map((player, idx) => (
              <div 
                key={player.id} 
                className={`player-card ${player.id === playerId ? 'current-player' : ''}`}
                style={{ 
                  borderColor: player.border,
                  background: player.bgColor
                }}
              >
                <div className="player-avatar" style={{ background: player.color }}>
                  {player.name.substring(0, 2).toUpperCase()}
                </div>
                <div className="player-info">
                  <div className="player-role" style={{ color: player.color }}>
                    {player.id === player.hostId || (players[0] && player.id === players[0].id) ? 'HOST' : 'PLAYER'}
                  </div>
                  <div className="player-name">{player.name}</div>
                </div>
                <div 
                  className={`player-status ${player.isReady ? 'ready' : 'waiting'}`}
                  style={{ background: player.isReady ? '#00ff88' : '#666' }}
                  title={player.isReady ? 'Ready' : 'Not ready'}
                ></div>
              </div>
            ))}
          </div>
          {playerId && (
            <button 
              className={`ready-btn ${currentPlayerReady ? 'ready' : 'not-ready'}`}
              onClick={handleToggleReady}
            >
              {currentPlayerReady ? '✓ READY' : 'NOT READY'}
            </button>
          )}
        </div>

        {/* Right Panel - Lobby Info */}
        <div className="lobby-panel">
          <div className="lobby-title-section">
            <h1 className="lobby-title">LOBBY</h1>
            <p className="lobby-subtitle">{allPlayersReady ? 'All players ready! Host can start.' : 'Waiting for players to ready up...'}</p>
          </div>

          {/* Roles Grid */}
          <div className="roles-grid">
            {roles.map((role, idx) => (
              <div 
                key={idx} 
                className="role-card"
                style={{ 
                  borderColor: role.color,
                  background: role.bgColor
                }}
              >
                <div className="role-icon" style={{ color: role.color }}>
                  {role.icon}
                </div>
                <div className="role-content">
                  <h3 style={{ color: role.color }}>{role.title}</h3>
                  <p>{role.description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Game Settings */}
          <div className="game-settings">
            <div className="settings-header">
              <span className="cursor-icon">🖱️</span>
              <h3>GAME SETTINGS</h3>
            </div>
            <div className="settings-row">
              <div className="setting">
                <span className="setting-label">MAX PLAYERS</span>
                <div className="setting-value">
                  <span className="setting-icon">👥</span>
                  <span>8</span>
                </div>
              </div>
              <div className="setting">
                <span className="setting-label">GAME MODE</span>
                <div className="setting-value mode-classic">CLASSIC</div>
              </div>
              <div className="setting">
                <span className="setting-label">DIFFICULTY</span>
                <div className="setting-value mode-medium">MEDIUM</div>
              </div>
            </div>
          </div>

          {/* Chat Section */}
          <div className="chat-section">
            <div className="chat-header">
              <MessageCircle size={20} />
              <h3>CHAT</h3>
            </div>
            <div className="chat-messages">
              {chatMessages.map((msg, idx) => (
                <div key={idx} className="chat-message">
                  <span className="chat-username" style={{ color: msg.color }}>
                    {msg.username}:
                  </span>
                  <span className="chat-text">{msg.message}</span>
                </div>
              ))}
            </div>
            <div className="chat-input-wrapper">
              <input
                type="text"
                placeholder="Type message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                className="chat-input"
              />
              <button onClick={sendMessage} className="send-btn">
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Share+Tech+Mono&display=swap');

        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        .game-lobby {
          min-height: 100vh;
          background: #0a0e1a;
          color: #fff;
          font-family: 'Share Tech Mono', monospace;
          position: relative;
          overflow: hidden;
        }

        /* Error Banner */
        .error-banner {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          background: rgba(255, 51, 102, 0.9);
          border-bottom: 2px solid #ff3366;
          padding: 1rem 2rem;
          display: flex;
          align-items: center;
          gap: 1rem;
          z-index: 100;
          animation: slideDown 0.3s ease;
        }

        @keyframes slideDown {
          from {
            transform: translateY(-100%);
          }
          to {
            transform: translateY(0);
          }
        }

        .error-banner button {
          margin-left: auto;
          background: none;
          border: none;
          color: #fff;
          font-size: 1.5rem;
          cursor: pointer;
          padding: 0;
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* Starfield Background */
        .stars, .stars2, .stars3 {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
        }

        .stars {
          background: transparent url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><circle cx="1" cy="1" r="0.5" fill="white" opacity="0.3"/></svg>') repeat;
          animation: animateStars 100s linear infinite;
        }

        .stars2 {
          background: transparent url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="3" height="3"><circle cx="1.5" cy="1.5" r="0.8" fill="white" opacity="0.2"/></svg>') repeat;
          animation: animateStars 150s linear infinite;
        }

        .stars3 {
          background: transparent url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"><circle cx="2" cy="2" r="1" fill="white" opacity="0.1"/></svg>') repeat;
          animation: animateStars 200s linear infinite;
        }

        @keyframes animateStars {
          from { transform: translateY(0); }
          to { transform: translateY(-2000px); }
        }

        /* Header */
        .lobby-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 2rem;
          background: rgba(10, 14, 26, 0.9);
          border-bottom: 2px solid rgba(0, 255, 136, 0.3);
          position: relative;
          z-index: 10;
        }

        .logo {
          font-family: 'Orbitron', sans-serif;
          font-size: 1.8rem;
          font-weight: 900;
          letter-spacing: 2px;
        }

        .dev {
          color: #00ff88;
          text-shadow: 0 0 20px rgba(0, 255, 136, 0.5);
        }

        .hunter {
          color: #ff3366;
          text-shadow: 0 0 20px rgba(255, 51, 102, 0.5);
        }

        .header-room {
          display: flex;
          align-items: center;
          gap: 0.8rem;
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
        }

        .room-label {
          color: #666;
          font-size: 0.9rem;
          letter-spacing: 1px;
        }

        .room-code {
          color: #00ddff;
          font-weight: 700;
          font-size: 1rem;
          font-family: 'Orbitron', sans-serif;
        }

        .connection-status {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #666;
          animation: pulse 2s ease-in-out infinite;
        }

        .connection-status.connected {
          background: #00ff88;
        }

        .header-controls {
          display: flex;
          gap: 1rem;
        }

        .boom-btn, .exit-btn {
          font-family: 'Orbitron', sans-serif;
          font-weight: 700;
          padding: 0.6rem 1.5rem;
          border: 2px solid;
          background: transparent;
          cursor: pointer;
          text-transform: uppercase;
          font-size: 0.9rem;
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .boom-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .boom-btn {
          color: #ffcc00;
          border-color: #ffcc00;
        }

        .boom-btn:hover:not(:disabled) {
          background: #ffcc00;
          color: #0a0e1a;
          box-shadow: 0 0 20px rgba(255, 204, 0, 0.5);
        }

        .exit-btn {
          color: #ff3366;
          border-color: #ff3366;
        }

        .exit-btn:hover {
          background: #ff3366;
          color: #fff;
          box-shadow: 0 0 20px rgba(255, 51, 102, 0.5);
        }

        /* Main Container */
        .lobby-container {
          display: grid;
          grid-template-columns: 400px 1fr;
          gap: 2rem;
          padding: 2rem;
          max-width: 1800px;
          margin: 0 auto;
          position: relative;
          z-index: 1;
        }

        /* Players Panel */
        .players-panel {
          background: rgba(15, 20, 35, 0.8);
          border: 2px solid rgba(0, 221, 255, 0.3);
          border-radius: 8px;
          padding: 1.5rem;
          backdrop-filter: blur(10px);
          box-shadow: 0 8px 32px rgba(0, 221, 255, 0.1);
        }

        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
          padding-bottom: 1rem;
          border-bottom: 2px solid rgba(0, 221, 255, 0.2);
        }

        .panel-header h2 {
          font-family: 'Orbitron', sans-serif;
          font-size: 1.3rem;
          color: #00ddff;
          letter-spacing: 2px;
        }

        .player-count {
          color: #00ff88;
          font-weight: 700;
          font-size: 1.1rem;
        }

        .players-list {
          display: flex;
          flex-direction: column;
          gap: 0.8rem;
          margin-bottom: 1.5rem;
        }

        .player-card {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1rem;
          border: 2px solid;
          border-radius: 6px;
          transition: all 0.3s ease;
          animation: slideIn 0.5s ease forwards;
          opacity: 0;
        }

        .player-card:nth-child(1) { animation-delay: 0.1s; }
        .player-card:nth-child(2) { animation-delay: 0.2s; }
        .player-card:nth-child(3) { animation-delay: 0.3s; }
        .player-card:nth-child(4) { animation-delay: 0.4s; }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        .player-card:hover {
          transform: translateX(5px);
          box-shadow: 0 4px 20px rgba(0, 221, 255, 0.2);
        }

        .player-avatar {
          width: 48px;
          height: 48px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 1.1rem;
          font-family: 'Orbitron', sans-serif;
        }

        .player-info {
          flex: 1;
        }

        .player-role {
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 1px;
          margin-bottom: 0.2rem;
        }

        .player-name {
          color: #ccc;
          font-size: 0.95rem;
        }

        .player-status {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          animation: glow 2s ease-in-out infinite;
        }

        @keyframes glow {
          0%, 100% { box-shadow: 0 0 5px currentColor; }
          50% { box-shadow: 0 0 15px currentColor; }
        }

        .current-player {
          box-shadow: inset 0 0 10px rgba(255, 204, 0, 0.2);
        }

        .waiting-indicator {
          display: flex;
          align-items: center;
          gap: 0.8rem;
          padding: 1rem;
          background: rgba(0, 0, 0, 0.3);
          border-radius: 6px;
          color: #666;
        }

        .waiting-avatar {
          width: 32px;
          height: 32px;
          border-radius: 4px;
          background: #333;
          position: relative;
          overflow: hidden;
        }

        .waiting-avatar::after {
          content: '';
          position: absolute;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
          animation: shimmer 2s infinite;
        }

        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }

        .ready-btn {
          width: 100%;
          padding: 1rem;
          border-radius: 6px;
          border: 2px solid;
          font-family: 'Orbitron', sans-serif;
          font-weight: 700;
          font-size: 1rem;
          letter-spacing: 1px;
          cursor: pointer;
          transition: all 0.3s ease;
          text-transform: uppercase;
          margin-top: 1rem;
        }

        .ready-btn.not-ready {
          color: #ff9900;
          border-color: #ff9900;
          background: rgba(255, 153, 0, 0.1);
        }

        .ready-btn.not-ready:hover {
          background: #ff9900;
          color: #0a0e1a;
          box-shadow: 0 0 20px rgba(255, 153, 0, 0.5);
        }

        .ready-btn.ready {
          color: #00ff88;
          border-color: #00ff88;
          background: rgba(0, 255, 136, 0.1);
        }

        .ready-btn.ready:hover {
          background: #00ff88;
          color: #0a0e1a;
          box-shadow: 0 0 20px rgba(0, 255, 136, 0.5);
        }

        .current-player {
          box-shadow: inset 0 0 10px rgba(255, 204, 0, 0.2);
        }

        /* Lobby Panel */
        .lobby-panel {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .lobby-title-section {
          background: rgba(15, 20, 35, 0.8);
          border: 2px solid rgba(221, 0, 255, 0.3);
          border-radius: 8px;
          padding: 2rem;
          text-align: center;
          backdrop-filter: blur(10px);
        }

        .lobby-title {
          font-family: 'Orbitron', sans-serif;
          font-size: 4rem;
          font-weight: 900;
          color: #dd00ff;
          letter-spacing: 8px;
          text-shadow: 0 0 40px rgba(221, 0, 255, 0.6);
          margin-bottom: 0.5rem;
          animation: titleGlow 3s ease-in-out infinite;
        }

        @keyframes titleGlow {
          0%, 100% { text-shadow: 0 0 40px rgba(221, 0, 255, 0.6); }
          50% { text-shadow: 0 0 60px rgba(221, 0, 255, 0.9); }
        }

        .lobby-subtitle {
          color: #aaa;
          font-size: 1rem;
        }

        /* Roles Grid */
        .roles-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 1rem;
        }

        .role-card {
          background: rgba(15, 20, 35, 0.8);
          border: 2px solid;
          border-radius: 8px;
          padding: 1.5rem;
          transition: all 0.3s ease;
          backdrop-filter: blur(10px);
        }

        .role-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 8px 30px rgba(0, 221, 255, 0.2);
        }

        .role-icon {
          font-size: 2.5rem;
          margin-bottom: 1rem;
        }

        .role-content h3 {
          font-family: 'Orbitron', sans-serif;
          font-size: 1rem;
          margin-bottom: 0.5rem;
          letter-spacing: 1px;
        }

        .role-content p {
          color: #aaa;
          font-size: 0.85rem;
          line-height: 1.4;
        }

        /* Game Settings */
        .game-settings {
          background: rgba(15, 20, 35, 0.8);
          border: 2px solid rgba(100, 100, 100, 0.3);
          border-radius: 8px;
          padding: 1.5rem;
          backdrop-filter: blur(10px);
        }

        .settings-header {
          display: flex;
          align-items: center;
          gap: 0.8rem;
          margin-bottom: 1.2rem;
          padding-bottom: 0.8rem;
          border-bottom: 2px solid rgba(100, 100, 100, 0.2);
        }

        .cursor-icon {
          font-size: 1.3rem;
        }

        .settings-header h3 {
          font-family: 'Orbitron', sans-serif;
          font-size: 1rem;
          letter-spacing: 1px;
        }

        .settings-row {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1.5rem;
        }

        .setting {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .setting-label {
          font-size: 0.7rem;
          color: #888;
          letter-spacing: 1px;
        }

        .setting-value {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-weight: 700;
          font-size: 1rem;
        }

        .setting-icon {
          font-size: 1.2rem;
        }

        .mode-classic {
          color: #dd00ff;
        }

        .mode-medium {
          color: #00ff88;
        }

        /* Chat Section */
        .chat-section {
          background: rgba(15, 20, 35, 0.8);
          border: 2px solid rgba(100, 100, 100, 0.3);
          border-radius: 8px;
          padding: 1.5rem;
          backdrop-filter: blur(10px);
        }

        .chat-header {
          display: flex;
          align-items: center;
          gap: 0.8rem;
          margin-bottom: 1rem;
          padding-bottom: 0.8rem;
          border-bottom: 2px solid rgba(100, 100, 100, 0.2);
        }

        .chat-header h3 {
          font-family: 'Orbitron', sans-serif;
          font-size: 1rem;
          letter-spacing: 1px;
        }

        .chat-messages {
          height: 120px;
          overflow-y: auto;
          margin-bottom: 1rem;
          padding-right: 0.5rem;
        }

        .chat-messages::-webkit-scrollbar {
          width: 6px;
        }

        .chat-messages::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.2);
          border-radius: 3px;
        }

        .chat-messages::-webkit-scrollbar-thumb {
          background: rgba(0, 221, 255, 0.3);
          border-radius: 3px;
        }

        .chat-message {
          margin-bottom: 0.6rem;
          font-size: 0.9rem;
          animation: messageSlide 0.3s ease;
        }

        @keyframes messageSlide {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .chat-username {
          font-weight: 700;
          margin-right: 0.5rem;
        }

        .chat-text {
          color: #ddd;
        }

        .chat-input-wrapper {
          display: flex;
          gap: 0.5rem;
        }

        .chat-input {
          flex: 1;
          background: rgba(0, 0, 0, 0.3);
          border: 2px solid rgba(100, 100, 100, 0.3);
          border-radius: 6px;
          padding: 0.8rem 1rem;
          color: #fff;
          font-family: 'Share Tech Mono', monospace;
          font-size: 0.9rem;
          transition: all 0.3s ease;
        }

        .chat-input:focus {
          outline: none;
          border-color: #00ddff;
          box-shadow: 0 0 10px rgba(0, 221, 255, 0.3);
        }

        .chat-input::placeholder {
          color: #666;
        }

        .send-btn {
          background: #00ddff;
          border: none;
          border-radius: 6px;
          padding: 0.8rem 1rem;
          color: #0a0e1a;
          cursor: pointer;
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .send-btn:hover {
          background: #00ff88;
          box-shadow: 0 0 20px rgba(0, 255, 136, 0.5);
        }

        @keyframes pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }

        /* Responsive */
        @media (max-width: 1200px) {
          .lobby-container {
            grid-template-columns: 1fr;
          }

          .roles-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

export default GameLobby;