// Socket.IO event handlers
const {
  createRoom,
  getRoom,
  addPlayerToRoom,
  removePlayerFromRoom,
  startGame,
  handleBuzz,
  castBuzzVote,
  getBuzzVoteResult,
  clearBuzzVote,
  validateFix,
  endRound,
  resetGame,
  checkBuggerWin,
  checkDebuggersWin,
} = require("./gameState");

const {
  generateRoomCode,
  generatePlayerId,
  isValidPlayerName,
} = require("./utils");

// Track socket to player/room mappings
const socketToPlayer = new Map();
const playerToSocket = new Map();
const buzzVoteTimers = new Map();

/**
 * Setup all socket event handlers
 */
function setupSocketHandlers(io) {
  io.on("connection", (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // CREATE ROOM
    socket.on("createRoom", ({ playerName }, callback) => {
      if (!isValidPlayerName(playerName)) {
        return callback({ success: false, error: "Invalid player name" });
      }

      const roomCode = generateRoomCode();
      const playerId = generatePlayerId();

      const room = createRoom(roomCode, playerId, playerName);

      // Track mappings
      socketToPlayer.set(socket.id, { playerId, roomCode });
      playerToSocket.set(playerId, socket.id);

      socket.join(roomCode);

      callback({
        success: true,
        roomCode,
        playerId,
        room: serializeRoom(room),
      });

      console.log(`Room created: ${roomCode} by ${playerName}`);
    });

    // JOIN ROOM
    socket.on("joinRoom", ({ roomCode, playerName }, callback) => {
      if (!isValidPlayerName(playerName)) {
        return callback({ success: false, error: "Invalid player name" });
      }

      const room = getRoom(roomCode);
      if (!room) {
        return callback({ success: false, error: "Room not found" });
      }

      const playerId = generatePlayerId();
      const result = addPlayerToRoom(roomCode, playerId, playerName);

      if (result.error) {
        return callback({ success: false, error: result.error });
      }

      // Track mappings
      socketToPlayer.set(socket.id, { playerId, roomCode });
      playerToSocket.set(playerId, socket.id);

      socket.join(roomCode);
      
      const serialized = serializeRoom(result);
      console.log(`Player ${playerName} joined room ${roomCode}. Room now has ${serialized.players.length} players`);
      
      callback({
        success: true,
        playerId,
        room: serialized
      });

      // Notify others in room
      socket.to(roomCode).emit("playerJoined", {
        player: result.players.get(playerId),
        room: serialized
      });

      // System message for chat
      socket.to(roomCode).emit('chatMessage', {
        username: 'System',
        message: `${playerName} joined the lobby`,
        color: '#00ff88'
      });

      console.log(`${playerName} joined room ${roomCode}`);
    });

    // PLAYER READY
    socket.on("playerReady", (callback) => {
      const playerData = socketToPlayer.get(socket.id);
      if (!playerData) return;

      const { playerId, roomCode } = playerData;
      const room = getRoom(roomCode);
      if (!room) return;

      const player = room.players.get(playerId);
      if (player) {
        player.isReady = !player.isReady;

        io.to(roomCode).emit("roomUpdated", {
          room: serializeRoom(room),
        });

        if (callback) callback({ success: true });
      }
    });

    // CHAT MESSAGE
    socket.on('chatMessage', ({ message }, callback) => {
      const playerData = socketToPlayer.get(socket.id);
      if (!playerData) return;

      const { playerId, roomCode } = playerData;
      const room = getRoom(roomCode);
      if (!room) return;

      const player = room.players.get(playerId);
      if (player && message.trim()) {
        io.to(roomCode).emit('chatMessage', {
          username: player.name,
          message: message,
          color: '#ffffff'
        });

        if (callback) callback({ success: true });
      }
    });

    // CHAT MESSAGE
    socket.on('chatMessage', ({ message }, callback) => {
      const playerData = socketToPlayer.get(socket.id);
      if (!playerData) return;

      const { playerId, roomCode } = playerData;
      const room = getRoom(roomCode);
      if (!room) return;

      const player = room.players.get(playerId);
      if (player && message.trim()) {
        io.to(roomCode).emit('chatMessage', {
          username: player.name,
          message: message,
          color: '#ffffff'
        });

        if (callback) callback({ success: true });
      }
    });

    // START GAME
    socket.on("startGame", (callback) => {
      const playerData = socketToPlayer.get(socket.id);
      if (!playerData) return;

      const { playerId, roomCode } = playerData;
      const room = getRoom(roomCode);

      if (!room) {
        return callback({ success: false, error: "Room not found" });
      }

      if (room.hostId !== playerId) {
        return callback({ success: false, error: "Only host can start game" });
      }

      const result = startGame(roomCode);

      if (result.error) {
        return callback({ success: false, error: result.error });
      }

      io.to(roomCode).emit("gameStarted", {
        room: serializeRoom(result),
      });

      // Start round timer
      startRoundTimer(io, roomCode);

      callback({ success: true });
      console.log(`Game started in room ${roomCode}`);
    });

    // BUZZ
    socket.on("buzz", (callback) => {
      const playerData = socketToPlayer.get(socket.id);
      if (!playerData) return;

      const { playerId, roomCode } = playerData;
      const result = handleBuzz(roomCode, playerId);

      if (result && result.error) {
        return callback({ success: false, error: result.error });
      }

      if (result) {
        const player = result.players.get(playerId);

        // Notify that player buzzed and vote started
        io.to(roomCode).emit("playerBuzzed", {
          playerId,
          playerName: player.name,
          vote: serializeBuzzVote(result.activeVote),
        });

        // Start buzz vote timer
        startBuzzVoteTimer(io, roomCode);

        callback({ success: true });
      }
    });

    // CAST BUZZ VOTE - Vote for any player to kick or skip
    socket.on("castBuzzVote", ({ targetPlayerId }, callback) => {
      const playerData = socketToPlayer.get(socket.id);
      if (!playerData) {
        return callback({ success: false, error: "Not in a room" });
      }

      const { playerId, roomCode } = playerData;
      const result = castBuzzVote(roomCode, playerId, targetPlayerId);

      if (result.error) {
        return callback({ success: false, error: result.error });
      }

      callback({ success: true });

      const room = getRoom(roomCode);

      // Broadcast vote update
      io.to(roomCode).emit("buzzVoteUpdated", {
        vote: serializeBuzzVote(room.activeVote),
      });

      // Check if all enabled players have voted
      if (result.allVoted) {
        // All legal voters have voted, end immediately
        clearTimeout(buzzVoteTimers.get(roomCode));
        handleBuzzVoteEnd(io, roomCode);
      }
    });

    // SUBMIT FIX
    socket.on("submitFix", ({ fixedCode }, callback) => {
      const playerData = socketToPlayer.get(socket.id);
      if (!playerData) return;

      const { playerId, roomCode } = playerData;
      const result = validateFix(roomCode, playerId, fixedCode);

      if (!result || result.error) {
        return callback({
          success: false,
          error: result?.error || "Invalid submission",
        });
      }

      const { isCorrect, room } = result;

      callback({ success: true, isCorrect });

      io.to(roomCode).emit("fixSubmitted", {
        playerId,
        playerName: room.players.get(playerId).name,
        isCorrect,
        correctCode: room.currentCode.correctCode,
        bugDescription: room.currentCode.currentBug.description,
      });

      // Clear buzzed player
      room.buzzedPlayer = null;

      // End round after fix submission
      setTimeout(() => {
        handleEndRound(io, roomCode);
      }, 3000);
    });

    // SUBMIT BUG (from bugger)
    socket.on("submitBug", ({ buggedCode }, callback) => {
      const playerData = socketToPlayer.get(socket.id);
      if (!playerData) return;

      const { playerId, roomCode } = playerData;
      const room = getRoom(roomCode);

      if (!room || room.bugger !== playerId) {
        return callback({
          success: false,
          error: "Only bugger can submit bugs",
        });
      }

      // Update the bugged code
      room.currentCode.buggedCode = buggedCode;

      callback({ success: true });

      // Notify debuggers that code was updated
      socket.to(roomCode).emit("codeUpdated", {
        code: buggedCode,
      });
    });

    // NEXT ROUND (after results shown)
    socket.on("nextRound", () => {
      const playerData = socketToPlayer.get(socket.id);
      if (!playerData) return;

      const { roomCode } = playerData;
      const room = getRoom(roomCode);

      if (room && room.gameState === "playing") {
        io.to(roomCode).emit("roundStarted", {
          room: serializeRoom(room),
        });

        startRoundTimer(io, roomCode);
      }
    });

    // PLAY AGAIN
    socket.on("playAgain", (callback) => {
      const playerData = socketToPlayer.get(socket.id);
      if (!playerData) return;

      const { roomCode } = playerData;
      const room = resetGame(roomCode);

      if (room) {
        io.to(roomCode).emit("gameReset", {
          room: serializeRoom(room),
        });

        callback({ success: true });
      }
    });

    // DISCONNECT
    socket.on("disconnect", () => {
      const playerData = socketToPlayer.get(socket.id);

      if (playerData) {
        const { playerId, roomCode } = playerData;
        const room = getRoom(roomCode);

        // If disconnecting player was in an active vote, cancel the vote
        if (room && room.activeVote) {
          clearTimeout(buzzVoteTimers.get(roomCode));
          clearBuzzVote(roomCode);
          io.to(roomCode).emit("voteCancelled", {
            reason: "A player disconnected",
          });
        }

        const updatedRoom = removePlayerFromRoom(roomCode, playerId);

        if (updatedRoom) {
          io.to(roomCode).emit("playerLeft", {
            playerId,
            room: serializeRoom(updatedRoom),
          });

          // System message for chat
          io.to(roomCode).emit('chatMessage', {
            username: 'System',
            message: 'A player left the lobby',
            color: '#ff3366'
          });

          // System message for chat
          io.to(roomCode).emit('chatMessage', {
            username: 'System',
            message: 'A player left the lobby',
            color: '#ff3366'
          });
        }

        socketToPlayer.delete(socket.id);
        playerToSocket.delete(playerId);
      }

      console.log(`Client disconnected: ${socket.id}`);
    });
  });
}

/**
 * Start round timer
 */
function startRoundTimer(io, roomCode) {
  const room = getRoom(roomCode);
  if (!room) return;

  const timer = setInterval(() => {
    const room = getRoom(roomCode);
    if (!room || room.gameState !== "playing") {
      clearInterval(timer);
      return;
    }

    const elapsed = Math.floor((Date.now() - room.roundStartTime) / 1000);
    const remaining = room.roundDuration - elapsed;

    io.to(roomCode).emit("timerUpdate", { remaining });

    if (remaining <= 0) {
      clearInterval(timer);
      handleEndRound(io, roomCode);
    }
  }, 1000);
}

/**
 * Handle end of round
 */
function handleEndRound(io, roomCode) {
  const room = endRound(roomCode);

  if (!room) return;

  if (room.gameState === "results") {
    // Game over - show final results
    io.to(roomCode).emit("gameEnded", {
      room: serializeRoom(room),
    });
  } else {
    // Next round
    io.to(roomCode).emit("roundEnded", {
      room: serializeRoom(room),
    });

    // Start next round after brief delay
    setTimeout(() => {
      io.to(roomCode).emit("roundStarted", {
        room: serializeRoom(room),
      });

      startRoundTimer(io, roomCode);
    }, 5000);
  }
}

/**
 * Serialize buzz vote for client
 */
function serializeBuzzVote(vote) {
  if (!vote) return null;

  return {
    initiatorId: vote.initiatorId,
    initiatorName: vote.initiatorName,
    type: vote.type,
    votes: Array.from(vote.votes.entries()).map(([voterId, targetId]) => ({
      voterId,
      targetId,
    })),
    skips: Array.from(vote.skips || []),
    votedCount: vote.votes.size,
    skipCount: (vote.skips || new Set()).size,
    startTime: vote.startTime,
    duration: vote.duration,
  };
}

/**
 * Start buzz vote timer - automatically ends vote after duration
 */
function startBuzzVoteTimer(io, roomCode) {
  const room = getRoom(roomCode);
  if (!room || !room.activeVote) return;

  const duration = room.activeVote.duration || 60000;

  // Clear any existing timer
  if (buzzVoteTimers.has(roomCode)) {
    clearTimeout(buzzVoteTimers.get(roomCode));
  }

  // Store timer ID so we can clear it later
  const timerId = setTimeout(() => {
    handleBuzzVoteEnd(io, roomCode);
  }, duration);

  buzzVoteTimers.set(roomCode, timerId);

  // Send periodic countdown updates
  const updateInterval = setInterval(() => {
    const room = getRoom(roomCode);
    if (!room || !room.activeVote) {
      clearInterval(updateInterval);
      return;
    }

    const elapsed = Date.now() - room.activeVote.startTime;
    const remaining = Math.ceil((duration - elapsed) / 1000);

    if (remaining > 0) {
      io.to(roomCode).emit("voteTimeUpdate", { remaining });
    } else {
      clearInterval(updateInterval);
    }
  }, 1000);
}

/**
 * Handle end of buzz vote - process result and kick player if needed
 */
function handleBuzzVoteEnd(io, roomCode) {
  const room = getRoom(roomCode);
  if (!room || !room.activeVote) return;

  // Get vote results
  const voteResult = getBuzzVoteResult(room);

  if (!voteResult) return;

  const {
    shouldKick,
    playerToKick,
    kickedPlayerName,
    maxVotes,
    voteCount,
    votedCount,
    skipCount,
    totalPlayers,
    hasClearMajority,
    buggerVotedOut,
  } = voteResult;

  console.log(`Vote ended in room ${roomCode}:`, {
    shouldKick,
    kickedPlayerName,
    maxVotes,
    voteCount,
    skipCount,
    hasClearMajority,
  });

  // Emit vote result to all players
  io.to(roomCode).emit("buzzVoteEnded", {
    shouldKick,
    playerToKick,
    kickedPlayerName,
    maxVotes,
    voteCount,
    votedCount,
    skipCount,
    totalPlayers,
    hasClearMajority,
    reason: !hasClearMajority ? "No clear majority - game continues" : null,
  });

  // Check if there's a clear majority
  if (!hasClearMajority) {
    // No clear majority - game continues without disabling anyone
    console.log(
      `No clear majority in room ${roomCode}. Votes: ${JSON.stringify(voteCount)}, Skips: ${skipCount}`,
    );

    // Clear the vote and allow next buzz
    room.buzzedPlayer = null;
    clearBuzzVote(roomCode);
    buzzVoteTimers.delete(roomCode);
    return;
  }

  // There is a clear majority - disable the player
  const player = room.players.get(playerToKick);
  if (player) {
    player.disabled = true;
  }

  console.log(
    `Player ${kickedPlayerName} was disabled in room ${roomCode} with ${maxVotes} votes`,
  );

  // Notify all players about disabled player
  io.to(roomCode).emit("playerDisabled", {
    playerId: playerToKick,
    playerName: kickedPlayerName,
    room: serializeRoom(room),
  });

  // Check if debuggers won (bugger was voted out)
  if (buggerVotedOut) {
    console.log(`Bugger was voted out in room ${roomCode}! Debuggers win!`);
    room.gameState = "results";
    io.to(roomCode).emit("gameEnded", {
      room: serializeRoom(room),
      winner: "debuggers",
      reason: "Bugger was voted out",
    });
    clearBuzzVote(roomCode);
    buzzVoteTimers.delete(roomCode);
    return;
  }

  // Check if buggers won
  if (checkBuggerWin(room)) {
    console.log(`Buggers won in room ${roomCode}!`);
    room.gameState = "results";
    io.to(roomCode).emit("gameEnded", {
      room: serializeRoom(room),
      winner: "buggers",
      reason: "All debuggers eliminated or only 2 players remain",
    });
    clearBuzzVote(roomCode);
    buzzVoteTimers.delete(roomCode);
    return;
  }

  // Clear the buzzer and vote for next buzz
  room.buzzedPlayer = null;
  clearBuzzVote(roomCode);
  buzzVoteTimers.delete(roomCode);
}

/**
 * Serialize room for client
 */
function serializeRoom(room) {
  if (!room) {
    console.error('serializeRoom called with null/undefined room');
    return null;
  }

  const serialized = {
    code: room.code,
    hostId: room.hostId,
    players: Array.from(room.players.values()),
    gameState: room.gameState,
    currentRound: room.currentRound,
    totalRounds: room.totalRounds,
    currentCode: room.currentCode,
    bugger: room.bugger,
    debuggers: room.debuggers,
    scores: Object.fromEntries(room.scores),
    buzzedPlayer: room.buzzedPlayer,
    activeVote: serializeBuzzVote(room.activeVote),
  };

  console.log(`Serialized room ${room.code} with ${serialized.players.length} players`);
  
  return serialized;
}

module.exports = { setupSocketHandlers };