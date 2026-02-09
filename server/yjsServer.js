// Simplified Yjs WebSocket Server
// Uses a simpler message format to avoid protocol mismatches
const WebSocket = require('ws');
const Y = require('yjs');

// Store for Yjs documents per room
const docs = new Map();

// Custom message types (simpler than y-protocols)
const MSG_SYNC_REQUEST = 0;
const MSG_SYNC_RESPONSE = 1;
const MSG_UPDATE = 2;
const MSG_AWARENESS = 3;

/**
 * Get or create a Yjs document for a room
 */
function getYDoc(roomCode) {
  if (!docs.has(roomCode)) {
    const doc = new Y.Doc();
    const clients = new Set();
    const awareness = new Map(); // playerId -> awareness state
    
    docs.set(roomCode, { doc, clients, awareness });
  }
  return docs.get(roomCode);
}

/**
 * Setup Yjs WebSocket server on the existing HTTP server
 */
function setupYjsServer(server) {
  const wss = new WebSocket.Server({ noServer: true });

  // Handle upgrade requests for Yjs WebSocket
  server.on('upgrade', (request, socket, head) => {
    if (request.url && request.url.startsWith('/yjs/')) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', (ws, req) => {
    // Extract room code from URL: /yjs/{roomCode}
    const urlParts = req.url.replace('/yjs/', '').split('?');
    const roomCode = urlParts[0];
    console.log(`Yjs connection for room: ${roomCode}`);

    const { doc, clients, awareness } = getYDoc(roomCode);
    clients.add(ws);
    ws.roomCode = roomCode;

    // Send current document state
    const stateVector = Y.encodeStateVector(doc);
    const fullState = Y.encodeStateAsUpdate(doc);
    
    // Send sync response with full state
    const syncMsg = JSON.stringify({
      type: MSG_SYNC_RESPONSE,
      state: Array.from(fullState)
    });
    ws.send(syncMsg);

    // Send current awareness states
    if (awareness.size > 0) {
      const awarenessMsg = JSON.stringify({
        type: MSG_AWARENESS,
        states: Object.fromEntries(awareness)
      });
      ws.send(awarenessMsg);
    }

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        switch (data.type) {
          case MSG_SYNC_REQUEST: {
            // Client requests full sync
            const fullState = Y.encodeStateAsUpdate(doc);
            ws.send(JSON.stringify({
              type: MSG_SYNC_RESPONSE,
              state: Array.from(fullState)
            }));
            break;
          }
          
          case MSG_UPDATE: {
            // Apply update from client
            if (data.update) {
              const update = new Uint8Array(data.update);
              Y.applyUpdate(doc, update);
              
              // Broadcast to other clients
              clients.forEach((client) => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                  client.send(JSON.stringify({
                    type: MSG_UPDATE,
                    update: data.update
                  }));
                }
              });
            }
            break;
          }
          
          case MSG_AWARENESS: {
            // Update and broadcast awareness
            if (data.playerId && data.state) {
              ws.playerIdForAwareness = data.playerId; // track for disconnect cleanup
              awareness.set(data.playerId, data.state);
              
              // Broadcast to other clients
              clients.forEach((client) => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                  client.send(JSON.stringify({
                    type: MSG_AWARENESS,
                    playerId: data.playerId,
                    state: data.state
                  }));
                }
              });
            }
            break;
          }
        }
      } catch (err) {
        console.error('Yjs message error:', err);
      }
    });

    ws.on('close', () => {
      clients.delete(ws);

      // Broadcast awareness removal so other clients remove the cursor
      if (ws.playerIdForAwareness) {
        awareness.delete(ws.playerIdForAwareness);
        clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: MSG_AWARENESS,
              playerId: ws.playerIdForAwareness,
              state: null  // null signals removal
            }));
          }
        });
      }
      
      // Clean up empty rooms after delay
      if (clients.size === 0) {
        setTimeout(() => {
          const docData = docs.get(roomCode);
          if (docData && docData.clients.size === 0) {
            docData.doc.destroy();
            docs.delete(roomCode);
            console.log(`Cleaned up Yjs doc for room: ${roomCode}`);
          }
        }, 30000);
      }
    });

    ws.on('error', (err) => {
      console.error('Yjs WebSocket error:', err);
    });
  });

  console.log('[YJS] WebSocket server ready');
  return wss;
}

/**
 * Initialize (or reset) a room's code in the Yjs document
 */
function initializeRoomCode(roomCode, initialCode) {
  const { doc } = getYDoc(roomCode);
  const yText = doc.getText('code');
  doc.transact(() => {
    // Clear existing content first (handles round changes)
    if (yText.length > 0) {
      yText.delete(0, yText.length);
    }
    if (initialCode) {
      yText.insert(0, initialCode);
    }
  });
  console.log(`Initialized Yjs doc for room ${roomCode} (${initialCode?.length || 0} chars)`);
}

/**
 * Get current code from Yjs document
 */
function getCurrentCode(roomCode) {
  if (!docs.has(roomCode)) {
    return null;
  }
  const { doc } = docs.get(roomCode);
  const yText = doc.getText('code');
  return yText.toString();
}

/**
 * Clean up a room's Yjs document
 */
function cleanupRoom(roomCode) {
  if (docs.has(roomCode)) {
    const { doc } = docs.get(roomCode);
    doc.destroy();
    docs.delete(roomCode);
    console.log(`Cleaned up Yjs doc for room: ${roomCode}`);
  }
}

module.exports = {
  setupYjsServer,
  getYDoc,
  initializeRoomCode,
  getCurrentCode,
  cleanupRoom
};
