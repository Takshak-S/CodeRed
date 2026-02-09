const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const { setupSocketHandlers } = require("./socketHandlers");

const app = express();
const server = http.createServer(app);

app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  }),
);

app.use(express.json());

const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Code validation endpoint
const { validateCode } = require('./validation');
const { codeSamples } = require('./gameState');

app.post('/validate', async (req, res) => {
  try {
    const { code, sampleId } = req.body;
    
    if (!code) {
      return res.status(400).json({ success: false, error: 'No code provided' });
    }
    
    // Find test cases for the sample (or use default)
    let testCases = [];
    if (sampleId) {
      const sample = codeSamples.find(s => s.id === sampleId);
      if (sample && sample.testCases) {
        testCases = sample.testCases;
      }
    }
    
    // If no sample found, try to detect function and use generic tests
    if (testCases.length === 0) {
      // Default empty test case list - validation will still check safety
      testCases = [];
    }
    
    const result = await validateCode(code, testCases);
    res.json(result);
  } catch (error) {
    console.error('Validation error:', error);
    res.status(500).json({ success: false, error: 'Validation failed' });
  }
});

// Import gameState for admin routes
const { getAllRooms, getRoomStats } = require("./gameState");

// Admin: Get all active rooms
app.get("/admin/rooms", (req, res) => {
  const rooms = getAllRooms();
  res.json({
    totalRooms: rooms.length,
    rooms: rooms.map((room) => ({
      code: room.code,
      hostId: room.hostId,
      playerCount: room.players.size,
      players: Array.from(room.players.values()).map((p) => ({
        id: p.id,
        name: p.name,
        isHost: p.isHost,
        role: p.role,
        isReady: p.isReady,
      })),
      gameState: room.gameState,
      currentRound: room.currentRound,
      totalRounds: room.totalRounds,
      createdAt: new Date(room.createdAt).toISOString(),
    })),
  });
});

// Admin: Get server statistics
app.get("/admin/stats", (req, res) => {
  const stats = getRoomStats();
  res.json({
    ...stats,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString(),
  });
});

// Admin: Get specific room details
app.get("/admin/rooms/:roomCode", (req, res) => {
  const { getRoom } = require("./gameState");
  const room = getRoom(req.params.roomCode);

  if (!room) {
    return res.status(404).json({ error: "Room not found" });
  }

  res.json({
    code: room.code,
    hostId: room.hostId,
    players: Array.from(room.players.values()),
    scores: Object.fromEntries(room.scores),
    gameState: room.gameState,
    currentRound: room.currentRound,
    totalRounds: room.totalRounds,
    bugger: room.bugger,
    debuggers: room.debuggers,
    createdAt: new Date(room.createdAt).toISOString(),
  });
});

// Setup socket event handlers
setupSocketHandlers(io);

// Setup Yjs WebSocket server for collaborative editing
const { setupYjsServer } = require("./yjsServer");
setupYjsServer(server);

const PORT = process.env.PORT || 3001;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[SERVER] Running on port ${PORT}`);
  console.log(`[SOCKET.IO] Ready for connections`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully...");
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});
